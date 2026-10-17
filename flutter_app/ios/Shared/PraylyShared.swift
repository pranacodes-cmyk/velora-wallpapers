import Foundation

// Shared between the Runner app (Flutter host + Shortcuts action) and the
// PraylyWidget extension. Everything here is pure Foundation so it compiles
// in both targets without UIKit-only APIs.

// MARK: - Bundled content location

enum PraylyResources {
    /// The containing app bundle, also when running inside the widget extension
    /// (`Runner.app/PlugIns/PraylyWidget.appex`).
    static var appBundleURL: URL {
        let url = Bundle.main.bundleURL
        if url.pathExtension == "appex" {
            return url.deletingLastPathComponent().deletingLastPathComponent()
        }
        return url
    }

    /// Full-resolution wallpaper content ships with the app; the widget carries
    /// its own lighter copy so it never depends on reading another bundle.
    static var contentDirectory: URL {
        let own = Bundle.main.bundleURL
        if own.pathExtension == "appex" {
            let widgetDir = own.appendingPathComponent("WidgetContent", isDirectory: true)
            if FileManager.default.fileExists(atPath: widgetDir.path) { return widgetDir }
        }
        return appBundleURL.appendingPathComponent("DailyWallpaper", isDirectory: true)
    }

    static func backgroundURL(number: Int) -> URL {
        contentDirectory
            .appendingPathComponent("backgrounds", isDirectory: true)
            .appendingPathComponent(String(format: "bg-%02d.jpg", number))
    }

    static func versesURL(lang: String) -> URL {
        contentDirectory
            .appendingPathComponent("verses", isDirectory: true)
            .appendingPathComponent("\(lang).json")
    }

    static func stringsURL(lang: String) -> URL {
        contentDirectory
            .appendingPathComponent("strings", isDirectory: true)
            .appendingPathComponent("\(lang).json")
    }
}

// MARK: - Shared state (app → widget / Shortcut)

struct PraylyPackVerse: Codable, Equatable {
    var text: String
    var reference: String
}

struct PraylySharedState: Codable, Equatable {
    var lang: String = "en"
    var premium: Bool = false
    /// Day-of-year the free user last unlocked the daily verse (Android parity).
    var unlockedDay: Int = -1
    var unlockedYear: Int = -1
    var packVerses: [PraylyPackVerse] = []
    var packMood: String = ""
    var packFrozenDay: Int = -1
    var packFrozenYear: Int = -1
    var streak: Int = 0
    var streakLastDate: String = ""
    /// Epoch seconds of the last time the Shortcuts action produced a wallpaper.
    var lastAutomationRun: Double = 0

    init() {}

    enum CodingKeys: String, CodingKey {
        case lang, premium, unlockedDay, unlockedYear, packVerses, packMood
        case packFrozenDay, packFrozenYear, streak, streakLastDate, lastAutomationRun
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        lang = (try? c.decodeIfPresent(String.self, forKey: .lang)) ?? "en"
        premium = (try? c.decodeIfPresent(Bool.self, forKey: .premium)) ?? false
        unlockedDay = (try? c.decodeIfPresent(Int.self, forKey: .unlockedDay)) ?? -1
        unlockedYear = (try? c.decodeIfPresent(Int.self, forKey: .unlockedYear)) ?? -1
        packVerses = (try? c.decodeIfPresent([PraylyPackVerse].self, forKey: .packVerses)) ?? []
        packMood = (try? c.decodeIfPresent(String.self, forKey: .packMood)) ?? ""
        packFrozenDay = (try? c.decodeIfPresent(Int.self, forKey: .packFrozenDay)) ?? -1
        packFrozenYear = (try? c.decodeIfPresent(Int.self, forKey: .packFrozenYear)) ?? -1
        streak = (try? c.decodeIfPresent(Int.self, forKey: .streak)) ?? 0
        streakLastDate = (try? c.decodeIfPresent(String.self, forKey: .streakLastDate)) ?? ""
        lastAutomationRun = (try? c.decodeIfPresent(Double.self, forKey: .lastAutomationRun)) ?? 0
    }
}

/// App ↔ widget storage in the App Group the live App Store app already
/// registered for its widget (`group.com.jesuswallpaperbible.app.shared`), so
/// the existing App IDs/profiles keep working with this replacement build.
enum PraylySharedStore {
    static let appGroup = "group.com.jesuswallpaperbible.app.shared"
    private static let defaultsKey = "prayly.flutter.shared.state.v1"
    private static let lock = NSLock()

    private static var defaults: UserDefaults {
        UserDefaults(suiteName: appGroup) ?? UserDefaults.standard
    }

    /// Shared container for files both targets read (rendered wallpaper cache).
    static var containerURL: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup)
    }

    static func load() -> PraylySharedState {
        lock.lock(); defer { lock.unlock() }
        if let data = defaults.data(forKey: defaultsKey),
           let state = try? JSONDecoder().decode(PraylySharedState.self, from: data) {
            return state
        }
        return PraylySharedState()
    }

    @discardableResult
    static func save(_ state: PraylySharedState) -> Bool {
        lock.lock(); defer { lock.unlock() }
        guard let data = try? JSONEncoder().encode(state) else { return false }
        defaults.set(data, forKey: defaultsKey)
        return true
    }

    @discardableResult
    static func update(_ mutate: (inout PraylySharedState) -> Void) -> PraylySharedState {
        var state = load()
        mutate(&state)
        save(state)
        return state
    }
}

// MARK: - Daily content (1:1 with Flutter ContentData + Android service)

struct PraylyDailyContent: Equatable {
    let text: String
    let reference: String
    let backgroundNumber: Int
    let dayOfYear: Int
    let date: Date
    /// Free user whose wallpaper still shows an older verse.
    let stale: Bool
    /// Free user holding a frozen mood-pack verse.
    let packFrozen: Bool
}

enum PraylyContent {
    static let backgroundCount = 20
    static let supportedLanguages: Set<String> = ["en", "hi", "es", "pt", "fr", "de", "id", "fil"]

    static var calendar: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone.current
        return c
    }

    /// Same arithmetic as Flutter `ContentData.dayOfYear` (Jan 1 → 1).
    static func dayOfYear(_ date: Date) -> Int {
        calendar.ordinality(of: .day, in: .year, for: date) ?? 1
    }

    static func year(_ date: Date) -> Int {
        calendar.component(.year, from: date)
    }

    static func daysInYear(_ year: Int) -> Int {
        ((year % 4 == 0 && year % 100 != 0) || year % 400 == 0) ? 366 : 365
    }

    static func normalizedLang(_ lang: String) -> String {
        let l = lang.lowercased()
        if supportedLanguages.contains(l) { return l }
        if l.hasPrefix("tl") { return "fil" }
        return "en"
    }

    private static var verseCache: [String: [[String]]] = [:]
    private static var stringsCache: [String: [String: String]] = [:]
    private static let cacheLock = NSLock()

    static func verses(lang: String) -> [[String]] {
        let l = normalizedLang(lang)
        cacheLock.lock(); defer { cacheLock.unlock() }
        if let cached = verseCache[l] { return cached }
        var list: [[String]] = []
        for candidate in [l, "en"] {
            if let data = try? Data(contentsOf: PraylyResources.versesURL(lang: candidate)),
               let arr = try? JSONSerialization.jsonObject(with: data) as? [[String]],
               !arr.isEmpty {
                list = arr
                break
            }
        }
        verseCache[l] = list
        return list
    }

    /// Small localized copy for native surfaces (widget labels, badge, Shortcut).
    static func string(_ key: String, lang: String) -> String {
        let l = normalizedLang(lang)
        cacheLock.lock()
        var table = stringsCache[l]
        if table == nil {
            var loaded: [String: String] = [:]
            if let data = try? Data(contentsOf: PraylyResources.stringsURL(lang: l)),
               let dict = try? JSONSerialization.jsonObject(with: data) as? [String: String] {
                loaded = dict
            }
            stringsCache[l] = loaded
            table = loaded
        }
        var english = stringsCache["en"]
        if english == nil {
            var loaded: [String: String] = [:]
            if let data = try? Data(contentsOf: PraylyResources.stringsURL(lang: "en")),
               let dict = try? JSONSerialization.jsonObject(with: data) as? [String: String] {
                loaded = dict
            }
            stringsCache["en"] = loaded
            english = loaded
        }
        cacheLock.unlock()
        if let v = table?[key], !v.isEmpty { return v }
        if let v = english?[key], !v.isEmpty { return v }
        return fallbackStrings[key] ?? key
    }

    private static let fallbackStrings: [String: String] = [
        "widget.title": "Daily Verse",
        "widget.newVerse": "New verse waiting",
        "widget.openApp": "Open Prayly",
        "widget.streak": "Day streak",
        "wallpaper.staleTitle": "NEW VERSE WAITING",
        "wallpaper.staleSub": "Open Prayly to unlock today's verse",
        "wallpaper.packTitle": "MOOD PACK PAUSED",
        "wallpaper.packSub": "Open Prayly for your next verse",
        "wallpaper.tagline": "Bible Prayer & Verse",
    ]

    static func baseVerse(day: Int, lang: String) -> (text: String, reference: String) {
        let list = verses(lang: lang)
        guard !list.isEmpty else {
            return ("The Lord is my shepherd; I shall not want.", "Psalm 23:1")
        }
        let raw = (day - 1) % list.count
        let idx = raw < 0 ? 0 : raw
        let row = list[idx]
        return (row.first ?? "", row.count > 1 ? row[1] : "")
    }

    /// Flutter `backgroundForDay`: `_backgrounds[dayOfYear % 20]` → bg-(i+1).
    static func backgroundNumber(day: Int) -> Int {
        ((day % backgroundCount) + backgroundCount) % backgroundCount + 1
    }

    private static func verse(day: Int, state: PraylySharedState, useFrozenPack: Bool) -> (String, String, Bool) {
        if !state.packVerses.isEmpty {
            let count = state.packVerses.count
            let frozen = useFrozenPack && !state.premium && state.packFrozenDay > 0
            let idx = ((frozen ? state.packFrozenDay : day) % count + count) % count
            let v = state.packVerses[idx]
            return (v.text, v.reference, frozen)
        }
        let v = baseVerse(day: day, lang: state.lang)
        return (v.text, v.reference, false)
    }

    /// What the in-app preview shows: today's verse, exactly as it will land.
    static func today(state: PraylySharedState, date: Date = Date()) -> PraylyDailyContent {
        let day = dayOfYear(date)
        let v = verse(day: day, state: state, useFrozenPack: false)
        return PraylyDailyContent(
            text: v.0, reference: v.1,
            backgroundNumber: backgroundNumber(day: day),
            dayOfYear: day, date: date, stale: false, packFrozen: false
        )
    }

    /// What the wallpaper / widget shows for `date`. Pro → that day's verse.
    /// Free → the day they last unlocked, with a gentle "new verse" badge once
    /// it goes stale (mirrors Android `DailyVerseWallpaperService`).
    static func display(state: PraylySharedState, date: Date = Date()) -> PraylyDailyContent {
        let today = dayOfYear(date)
        let thisYear = year(date)
        var targetDay = today
        var stale = false
        if !state.premium {
            let unlockedToday = state.unlockedDay == today && state.unlockedYear == thisYear
            if !unlockedToday {
                stale = true
                if state.unlockedDay > 0 && state.unlockedYear == thisYear && state.unlockedDay < today {
                    targetDay = state.unlockedDay
                } else {
                    targetDay = max(1, today - 1)
                }
            }
        }
        let v = verse(day: targetDay, state: state, useFrozenPack: true)
        var targetDate = date
        if targetDay != today,
           let shifted = calendar.date(byAdding: .day, value: targetDay - today, to: date) {
            targetDate = shifted
        }
        return PraylyDailyContent(
            text: v.0, reference: v.1,
            backgroundNumber: backgroundNumber(day: targetDay),
            dayOfYear: targetDay, date: targetDate,
            stale: stale && !v.2, packFrozen: v.2
        )
    }

    static func monthNames(lang: String) -> [String] {
        // Wallpaper date label stays English uppercase on Android; keep parity.
        ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY",
         "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"]
    }

    static func dateLabel(_ date: Date) -> String {
        let c = calendar
        let m = c.component(.month, from: date)
        let d = c.component(.day, from: date)
        let y = c.component(.year, from: date)
        return "\(monthNames(lang: "en")[max(0, min(11, m - 1))]) \(d) · \(y)"
    }

    static func nextMidnight(after date: Date) -> Date {
        let start = calendar.startOfDay(for: date)
        return calendar.date(byAdding: .day, value: 1, to: start) ?? date.addingTimeInterval(86_400)
    }
}
