import Foundation
import UIKit
import UserNotifications

/// iOS counterpart of the Android reminder stack (daily prayer card, Journey
/// reminders, content pushes and user-set prayer bells), built on local
/// notifications. Every category is composed in one place so the same rules
/// as Android hold: max three content pushes a day (two for Pro), no verse
/// push for Pro or while a Journey is running, and a Journey reminder replaces
/// the daily prayer card when both land on the same minute.
final class PraylyNotifications: NSObject, UNUserNotificationCenterDelegate {
    static let shared = PraylyNotifications()

    private let center = UNUserNotificationCenter.current()
    private let defaults = UserDefaults.standard
    private let prefix = "prayly."
    private let daysAhead = 7
    private var pendingRoute: String?
    private let queue = DispatchQueue(label: "prayly.notifications")

    private enum Key {
        static let reminderEnabled = "prayly.ios.reminder.enabled"
        static let reminderTimes = "prayly.ios.reminder.times"
        static let reminderCopy = "prayly.ios.reminder.copy"
        static let streak = "prayly.ios.streak"
        static let streakLastDate = "prayly.ios.streak.lastDate"
        static let journeyItems = "prayly.ios.journey.items"
        static let contentEnabled = "prayly.ios.content.enabled"
        static let contentPro = "prayly.ios.content.pro"
        static let alarmTimes = "prayly.ios.alarm.times"
        static let alarmSound = "prayly.ios.alarm.sound"
        static let alarmEnabled = "prayly.ios.alarm.enabled"
        static let lastOpen = "prayly.ios.lastOpen"
    }

    func install() {
        center.delegate = self
    }

    // MARK: - Delegate

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        if #available(iOS 14.0, *) {
            completionHandler([.banner, .list, .sound])
        } else {
            completionHandler([.alert, .sound])
        }
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let info = response.notification.request.content.userInfo
        if response.actionIdentifier != UNNotificationDismissActionIdentifier,
           let route = info["route"] as? String, !route.isEmpty {
            queue.sync { pendingRoute = route }
        }
        completionHandler()
    }

    func consumeRoute() -> String? {
        queue.sync { () -> String? in
            let r = pendingRoute
            pendingRoute = nil
            return r
        }
    }

    // MARK: - Authorization

    func authorizationStatus(_ done: @escaping (UNAuthorizationStatus) -> Void) {
        center.getNotificationSettings { settings in
            DispatchQueue.main.async { done(settings.authorizationStatus) }
        }
    }

    // MARK: - Config setters (from Flutter)

    func syncDailyReminder(enabled: Bool, timesJSON: String, streak: Int, copyJSON: String) {
        defaults.set(enabled, forKey: Key.reminderEnabled)
        defaults.set(timesJSON, forKey: Key.reminderTimes)
        defaults.set(copyJSON, forKey: Key.reminderCopy)
        defaults.set(streak, forKey: Key.streak)
        rebuild()
    }

    func syncStreak(_ streak: Int, lastDate: String?) {
        defaults.set(streak, forKey: Key.streak)
        defaults.set(lastDate ?? "", forKey: Key.streakLastDate)
        PraylySharedStore.update { s in
            s.streak = streak
            s.streakLastDate = lastDate ?? ""
        }
    }

    func syncJourney(itemsJSON: String) {
        defaults.set(itemsJSON, forKey: Key.journeyItems)
        rebuild()
    }

    func setContentEnabled(_ on: Bool) {
        defaults.set(on, forKey: Key.contentEnabled)
        rebuild()
    }

    var contentEnabled: Bool {
        defaults.object(forKey: Key.contentEnabled) as? Bool ?? false
    }

    func setPro(_ pro: Bool) {
        defaults.set(pro, forKey: Key.contentPro)
        rebuild()
    }

    func markAppOpen() {
        defaults.set(Date().timeIntervalSince1970, forKey: Key.lastOpen)
        rebuild()
    }

    func scheduleAlarms(times: [[String: Any]], sound: Bool) -> Int {
        let clean: [[String: Any]] = times.compactMap { t -> [String: Any]? in
            guard let h = (t["hour"] as? NSNumber)?.intValue,
                  let m = (t["minute"] as? NSNumber)?.intValue else { return nil }
            return ["hour": h, "minute": m, "label": (t["label"] as? String) ?? ""]
        }
        if let data = try? JSONSerialization.data(withJSONObject: clean) {
            defaults.set(String(data: data, encoding: .utf8), forKey: Key.alarmTimes)
        }
        defaults.set(sound, forKey: Key.alarmSound)
        defaults.set(true, forKey: Key.alarmEnabled)
        rebuild()
        return clean.count
    }

    func cancelAlarms() {
        defaults.set(false, forKey: Key.alarmEnabled)
        rebuild()
    }

    // MARK: - Immediate previews

    func previewReminder(night: Bool) {
        let copy = reminderCopy()
        let content = UNMutableNotificationContent()
        content.title = copy[night ? "notification.nightTitle" : "notification.morningTitle"] as? String
            ?? (night ? "Night Prayer" : "Morning Prayer")
        content.body = reminderBody(copy: copy, night: night, dayIndex: 0)
        content.userInfo = ["route": "/devotional"]
        fireSoon(id: "preview.reminder", content: content)
    }

    func previewAlarm(label: String, sound: Bool) {
        let copy = reminderCopy()
        let content = UNMutableNotificationContent()
        content.title = label.isEmpty ? (copy["alarm.defaultLabel"] as? String ?? "Prayer Time") : label
        content.body = copy["alarm.subtitle"] as? String ?? "A quiet moment with Jesus is ready"
        content.userInfo = ["route": "/devotional"]
        if sound { content.sound = .default }
        fireSoon(id: "preview.alarm", content: content)
    }

    func previewContent(kind: String) {
        let lang = PraylySharedStore.load().lang
        let content: UNMutableNotificationContent
        if kind == "quiz" {
            content = quizContent(lang: lang, seed: Int(Date().timeIntervalSince1970 / 86_400))
        } else {
            content = verseContent(lang: lang, date: Date())
        }
        fireSoon(id: "preview.content", content: content)
    }

    private func fireSoon(id: String, content: UNMutableNotificationContent) {
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 2, repeats: false)
        center.add(UNNotificationRequest(identifier: prefix + id, content: content, trigger: trigger))
    }

    // MARK: - Composition

    private struct Planned {
        let id: String
        let date: Date
        let content: UNMutableNotificationContent
    }

    private func reminderCopy() -> [String: Any] {
        guard let raw = defaults.string(forKey: Key.reminderCopy),
              let data = raw.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return [:] }
        return obj
    }

    private func reminderBody(copy: [String: Any], night: Bool, dayIndex: Int) -> String {
        let base = night ? "night" : "morning"
        let n = (dayIndex % 3) + 1
        let line = copy["\(base).\(n)"] as? String
            ?? copy["notification.body"] as? String
            ?? "Relax, reflect and talk to God"
        let streak = defaults.integer(forKey: Key.streak)
        if streak > 0, let fmt = copy["streak.count"] as? String {
            let s = fmt.replacingOccurrences(of: "{{count}}", with: "\(streak)")
            return "\(line) · \(s)"
        }
        return line
    }

    private func verseContent(lang: String, date: Date) -> UNMutableNotificationContent {
        let day = PraylyContent.dayOfYear(date)
        let verse = PraylyContent.baseVerse(day: day, lang: lang)
        let content = UNMutableNotificationContent()
        content.title = PraylyContent.string("push.verse.title", lang: lang)
        content.body = "“\(verse.text)” — \(verse.reference)"
        content.userInfo = ["route": "/?openReflection=1&from=push"]
        content.sound = .default
        return content
    }

    private func quizContent(lang: String, seed: Int) -> UNMutableNotificationContent {
        let count = 8
        let n = ((seed % count) + count) % count + 1
        let content = UNMutableNotificationContent()
        content.title = PraylyContent.string("push.quiz.\(n).title", lang: lang)
        content.body = PraylyContent.string("push.quiz.\(n).body", lang: lang)
        content.userInfo = ["route": "/quiz?from=push"]
        content.sound = .default
        return content
    }

    private func at(_ day: Date, hour: Int, minute: Int) -> Date? {
        var comps = PraylyContent.calendar.dateComponents([.year, .month, .day], from: day)
        comps.hour = hour
        comps.minute = minute
        comps.second = 0
        return PraylyContent.calendar.date(from: comps)
    }

    private func minuteKey(_ date: Date) -> String {
        let c = PraylyContent.calendar.dateComponents([.year, .month, .day, .hour, .minute], from: date)
        return "\(c.year ?? 0)-\(c.month ?? 0)-\(c.day ?? 0)-\(c.hour ?? 0)-\(c.minute ?? 0)"
    }

    /// Re-composes every pending Prayly notification. Cheap; safe to call often.
    func rebuild() {
        center.getNotificationSettings { [weak self] settings in
            guard let self = self else { return }
            let status = settings.authorizationStatus
            var allowed = status == .authorized || status == .provisional
            if #available(iOS 14.0, *) { allowed = allowed || status == .ephemeral }
            self.center.getPendingNotificationRequests { pending in
                let old = pending.map { $0.identifier }.filter { $0.hasPrefix(self.prefix) && !$0.hasPrefix(self.prefix + "preview.") }
                self.center.removePendingNotificationRequests(withIdentifiers: old)
                guard allowed else { return }
                self.compose().forEach { item in
                    let comps = PraylyContent.calendar.dateComponents([.year, .month, .day, .hour, .minute, .second], from: item.date)
                    let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: false)
                    self.center.add(UNNotificationRequest(identifier: self.prefix + item.id, content: item.content, trigger: trigger))
                }
                self.composeAlarms().forEach { self.center.add($0) }
            }
        }
    }

    private func compose() -> [Planned] {
        let now = Date()
        let lang = PraylySharedStore.load().lang
        var out: [Planned] = []
        var journeyMinutes = Set<String>()

        // Journey reminders (already localized + state-aware in Flutter).
        if let raw = defaults.string(forKey: Key.journeyItems),
           let data = raw.data(using: .utf8),
           let items = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
            for (i, item) in items.enumerated() {
                guard let atMs = (item["at"] as? NSNumber)?.doubleValue else { continue }
                let date = Date(timeIntervalSince1970: atMs / 1000)
                guard date > now else { continue }
                let content = UNMutableNotificationContent()
                content.title = item["title"] as? String ?? ""
                content.body = item["body"] as? String ?? ""
                content.userInfo = ["route": item["route"] as? String ?? "/challenge"]
                content.sound = .default
                journeyMinutes.insert(minuteKey(date))
                out.append(Planned(id: "journey.\(i)", date: date, content: content))
            }
        }
        let journeyActive = !journeyMinutes.isEmpty || (defaults.string(forKey: Key.journeyItems).map { $0.count > 2 } ?? false)

        // Daily prayer card (quiet: no sound).
        let reminderOn = defaults.object(forKey: Key.reminderEnabled) as? Bool ?? false
        if reminderOn,
           let raw = defaults.string(forKey: Key.reminderTimes),
           let data = raw.data(using: .utf8),
           let times = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
            let copy = reminderCopy()
            for d in 0..<daysAhead {
                guard let day = PraylyContent.calendar.date(byAdding: .day, value: d, to: now) else { continue }
                for t in times {
                    let h = (t["hour"] as? NSNumber)?.intValue ?? 7
                    let m = (t["minute"] as? NSNumber)?.intValue ?? 0
                    let night = (t["slot"] as? String) == "night" || h >= 17
                    guard let date = at(day, hour: h, minute: m), date > now else { continue }
                    if journeyMinutes.contains(minuteKey(date)) { continue }
                    let content = UNMutableNotificationContent()
                    content.title = copy[night ? "notification.nightTitle" : "notification.morningTitle"] as? String
                        ?? (night ? "Night Prayer" : "Morning Prayer")
                    content.body = reminderBody(copy: copy, night: night, dayIndex: PraylyContent.dayOfYear(date))
                    content.userInfo = ["route": "/devotional"]
                    out.append(Planned(id: "reminder.\(d).\(h).\(m)", date: date, content: content))
                }
            }
        }

        // Content pushes: 11:00 verse, 12:30 + 18:00 quiz.
        if contentEnabled {
            let pro = defaults.bool(forKey: Key.contentPro)
            for d in 0..<daysAhead {
                guard let day = PraylyContent.calendar.date(byAdding: .day, value: d, to: now) else { continue }
                var count = 0
                let cap = pro ? 2 : 3
                if !pro && !journeyActive, let date = at(day, hour: 11, minute: 0), date > now, count < cap {
                    out.append(Planned(id: "content.verse.\(d)", date: date, content: verseContent(lang: lang, date: date)))
                    count += 1
                }
                let seed = PraylyContent.dayOfYear(day) * 2
                if let date = at(day, hour: 12, minute: 30), date > now, count < cap {
                    out.append(Planned(id: "content.quiz1.\(d)", date: date, content: quizContent(lang: lang, seed: seed)))
                    count += 1
                }
                if let date = at(day, hour: 18, minute: 0), date > now, count < cap {
                    out.append(Planned(id: "content.quiz2.\(d)", date: date, content: quizContent(lang: lang, seed: seed + 1)))
                    count += 1
                }
            }
        }
        // Stay well inside iOS's 64 pending-request limit (alarms use the rest).
        out.sort { $0.date < $1.date }
        return Array(out.prefix(52))
    }

    private func composeAlarms() -> [UNNotificationRequest] {
        guard defaults.bool(forKey: Key.alarmEnabled),
              let raw = defaults.string(forKey: Key.alarmTimes),
              let data = raw.data(using: .utf8),
              let times = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else { return [] }
        let copy = reminderCopy()
        let sound = defaults.object(forKey: Key.alarmSound) as? Bool ?? true
        return times.prefix(8).enumerated().compactMap { (i, t) -> UNNotificationRequest? in
            guard let h = (t["hour"] as? NSNumber)?.intValue,
                  let m = (t["minute"] as? NSNumber)?.intValue else { return nil }
            let label = (t["label"] as? String).flatMap { $0.isEmpty ? nil : $0 }
            let content = UNMutableNotificationContent()
            content.title = label ?? (copy["alarm.defaultLabel"] as? String ?? "Prayer Time")
            content.body = copy["alarm.subtitle"] as? String ?? "A quiet moment with Jesus is ready"
            content.userInfo = ["route": "/devotional"]
            if sound { content.sound = .default }
            var comps = DateComponents()
            comps.hour = h
            comps.minute = m
            let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: true)
            return UNNotificationRequest(identifier: prefix + "alarm.\(i)", content: content, trigger: trigger)
        }
    }

    func scheduledAlarmCount() -> Int {
        guard defaults.bool(forKey: Key.alarmEnabled),
              let raw = defaults.string(forKey: Key.alarmTimes),
              let data = raw.data(using: .utf8),
              let times = try? JSONSerialization.jsonObject(with: data) as? [Any] else { return 0 }
        return min(times.count, 8)
    }

    func diagnostics(_ done: @escaping ([String: Any]) -> Void) {
        center.getPendingNotificationRequests { pending in
            let ours = pending.filter { $0.identifier.hasPrefix(self.prefix) }
            let res: [String: Any] = [
                "platform": "ios",
                "pending": ours.count,
                "content": ours.filter { $0.identifier.hasPrefix(self.prefix + "content.") }.count,
                "journey": ours.filter { $0.identifier.hasPrefix(self.prefix + "journey.") }.count,
                "reminder": ours.filter { $0.identifier.hasPrefix(self.prefix + "reminder.") }.count,
                "alarm": ours.filter { $0.identifier.hasPrefix(self.prefix + "alarm.") }.count,
                "enabled": self.contentEnabled,
            ]
            DispatchQueue.main.async { done(res) }
        }
    }
}
