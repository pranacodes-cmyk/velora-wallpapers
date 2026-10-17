import AppTrackingTransparency
import Flutter
import Photos
import StoreKit
import UIKit
import UserNotifications
import WidgetKit

/// Native iOS side of Prayly. Answers the same MethodChannels the Android app
/// uses (wallpaper, prayer_alarm, content_push, pray_screen, parallax) with
/// honest iOS behaviour, plus one iOS-only channel for the wallpaper preview,
/// Shortcuts, widgets, App Tracking Transparency and the Apple review sheet.
final class PraylyIosPlugin: NSObject, FlutterPlugin {
    private let work = DispatchQueue(label: "prayly.ios.render", qos: .userInitiated)

    static func register(with registrar: FlutterPluginRegistrar) {
        let instance = PraylyIosPlugin()
        let messenger = registrar.messenger()
        let names = [
            "com.prayly/ios",
            "com.jesuswallpaperbible.app/wallpaper",
            "com.jesuswallpaperbible.app/prayer_alarm",
            "com.jesuswallpaperbible.app/content_push",
            "com.jesuswallpaperbible.app/pray_screen",
            "com.jesuswallpaperbible.app/parallax_wallpaper",
        ]
        for name in names {
            let channel = FlutterMethodChannel(name: name, binaryMessenger: messenger)
            channel.setMethodCallHandler { call, result in
                instance.handle(channel: name, call: call, result: result)
            }
        }
    }

    // FlutterPlugin requirement (unused: handlers are attached per channel).
    func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
        result(FlutterMethodNotImplemented)
    }

    private func handle(channel: String, call: FlutterMethodCall, result: @escaping FlutterResult) {
        let args = call.arguments as? [String: Any] ?? [:]
        switch channel {
        case "com.prayly/ios": handleIos(call.method, args, result)
        case "com.jesuswallpaperbible.app/wallpaper": handleWallpaper(call.method, args, result)
        case "com.jesuswallpaperbible.app/prayer_alarm": handlePrayerAlarm(call.method, args, result)
        case "com.jesuswallpaperbible.app/content_push": handleContentPush(call.method, args, result)
        case "com.jesuswallpaperbible.app/pray_screen": handlePrayScreen(call.method, args, result)
        default: result(call.method.hasPrefix("set") ? false : FlutterMethodNotImplemented)
        }
    }

    // MARK: - iOS-only channel

    private func handleIos(_ method: String, _ args: [String: Any], _ result: @escaping FlutterResult) {
        switch method {
        case "syncState":
            PraylySharedStore.update { s in
                if let lang = args["lang"] as? String { s.lang = PraylyContent.normalizedLang(lang) }
                if let premium = args["premium"] as? Bool { s.premium = premium }
            }
            reloadWidgets()
            PraylyNotifications.shared.rebuild()
            result(true)

        case "renderPreview":
            let width = (args["width"] as? NSNumber)?.doubleValue ?? 720
            let device = PraylyWallpaperRenderer.devicePixelSize()
            let w = CGFloat(max(240, min(width, Double(device.width))))
            let size = CGSize(width: w.rounded(), height: (w * device.height / device.width).rounded())
            let display = (args["display"] as? Bool) ?? false
            work.async {
                let state = PraylySharedStore.load()
                let image = display
                    ? PraylyWallpaperExporter.renderDisplay(size: size, state: state).0
                    : PraylyWallpaperExporter.renderPreview(size: size, state: state)
                let data = image.jpegData(compressionQuality: 0.9)
                DispatchQueue.main.async {
                    if let data = data {
                        result(FlutterStandardTypedData(bytes: data))
                    } else {
                        result(FlutterError(code: "render_failed", message: "Could not render preview", details: nil))
                    }
                }
            }

        case "saveTodayToPhotos":
            saveTodayToPhotos(result)

        case "saveImageToPhotos":
            guard let typed = args["bytes"] as? FlutterStandardTypedData,
                  let image = UIImage(data: typed.data) else {
                result("failed")
                return
            }
            saveToPhotos(image, result)

        case "automationStatus":
            let state = PraylySharedStore.load()
            var res: [String: Any] = [
                "lastRun": state.lastAutomationRun,
                "supported": false,
                "osMajor": ProcessInfo.processInfo.operatingSystemVersion.majorVersion,
            ]
            if #available(iOS 16.0, *) { res["supported"] = true }
            let since = Date().timeIntervalSince1970 - state.lastAutomationRun
            res["active"] = state.lastAutomationRun > 0 && since < 60 * 60 * 50
            result(res)

        case "openShortcutsApp":
            openURL("shortcuts://", result)

        case "runShortcut":
            let name = (args["name"] as? String) ?? "Prayly Wallpaper"
            var comps = URLComponents()
            comps.scheme = "shortcuts"
            comps.host = "run-shortcut"
            comps.queryItems = [URLQueryItem(name: "name", value: name)]
            guard let url = comps.url else { result(false); return }
            openURL(url.absoluteString, result)

        case "trackingStatus":
            result(trackingStatusString())

        case "requestTracking":
            requestTracking(result)

        case "requestReview":
            requestReview()
            result(true)

        case "openAppSettings":
            openURL(UIApplication.openSettingsURLString, result)

        case "reloadWidgets":
            reloadWidgets()
            result(true)

        default:
            result(FlutterMethodNotImplemented)
        }
    }

    // MARK: - Wallpaper channel (Android contract, iOS behaviour)

    private func handleWallpaper(_ method: String, _ args: [String: Any], _ result: @escaping FlutterResult) {
        switch method {
        case "setDailyVerse":
            // iOS cannot set a wallpaper directly: unlock today, refresh the
            // widgets and let the Shortcuts automation (or Photos) apply it.
            markUnlockedToday()
            result(true)
        case "dailyVerseMarkUnlocked":
            markUnlockedToday()
            result(true)
        case "dailyVerseSetPremium":
            let premium = (args["premium"] as? Bool) ?? false
            PraylySharedStore.update { $0.premium = premium }
            reloadWidgets()
            result(true)
        case "dailyVerseSetMoodPack":
            setMoodPack(args)
            result(true)
        case "dailyVerseIsActive", "dailyVerseStatus":
            let state = PraylySharedStore.load()
            let since = Date().timeIntervalSince1970 - state.lastAutomationRun
            let active = state.lastAutomationRun > 0 && since < 60 * 60 * 50
            result(["active": active, "platform": "ios"])
        case "setStatic", "setLive", "setParallax":
            result(false)
        default:
            result(FlutterMethodNotImplemented)
        }
    }

    private func markUnlockedToday() {
        let now = Date()
        PraylySharedStore.update { s in
            s.unlockedDay = PraylyContent.dayOfYear(now)
            s.unlockedYear = PraylyContent.year(now)
        }
        reloadWidgets()
    }

    private func setMoodPack(_ args: [String: Any]) {
        var verses: [PraylyPackVerse] = []
        if let raw = args["verses"] as? String,
           let data = raw.data(using: .utf8),
           let arr = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
            verses = arr.compactMap { item -> PraylyPackVerse? in
                guard let text = item["text"] as? String, !text.isEmpty else { return nil }
                return PraylyPackVerse(text: text, reference: (item["reference"] as? String) ?? (item["ref"] as? String) ?? "")
            }
        } else if let arr = args["verses"] as? [[String: Any]] {
            verses = arr.compactMap { item -> PraylyPackVerse? in
                guard let text = item["text"] as? String, !text.isEmpty else { return nil }
                return PraylyPackVerse(text: text, reference: (item["reference"] as? String) ?? (item["ref"] as? String) ?? "")
            }
        }
        let mood = (args["mood"] as? String) ?? ""
        let now = Date()
        PraylySharedStore.update { s in
            s.packVerses = verses
            s.packMood = verses.isEmpty ? "" : mood
            if verses.isEmpty {
                s.packFrozenDay = -1
                s.packFrozenYear = -1
            } else {
                s.packFrozenDay = PraylyContent.dayOfYear(now)
                s.packFrozenYear = PraylyContent.year(now)
            }
        }
        reloadWidgets()
    }

    private func saveTodayToPhotos(_ result: @escaping FlutterResult) {
        let size = PraylyWallpaperRenderer.devicePixelSize()
        work.async {
            let state = PraylySharedStore.load()
            let image = PraylyWallpaperExporter.renderDisplay(size: size, state: state).0
            DispatchQueue.main.async { self.saveToPhotos(image, result) }
        }
    }

    private func saveToPhotos(_ image: UIImage, _ result: @escaping FlutterResult) {
        let write: () -> Void = {
            PHPhotoLibrary.shared().performChanges({
                PHAssetChangeRequest.creationRequestForAsset(from: image)
            }, completionHandler: { success, _ in
                DispatchQueue.main.async { result(success ? "saved" : "failed") }
            })
        }
        // Add-only access: Prayly never reads the photo library.
        PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
            if status == .authorized || status == .limited {
                write()
            } else {
                DispatchQueue.main.async { result("denied") }
            }
        }
    }

    // MARK: - Prayer alarm / reminders channel

    private func handlePrayerAlarm(_ method: String, _ args: [String: Any], _ result: @escaping FlutterResult) {
        let n = PraylyNotifications.shared
        switch method {
        case "dailyReminderSync":
            n.syncDailyReminder(
                enabled: (args["enabled"] as? Bool) ?? false,
                timesJSON: (args["times"] as? String) ?? "[]",
                streak: (args["streak"] as? NSNumber)?.intValue ?? 0,
                copyJSON: (args["copy"] as? String) ?? "{}"
            )
            result(true)
        case "streakSync":
            n.syncStreak((args["streak"] as? NSNumber)?.intValue ?? 0, lastDate: args["lastDate"] as? String)
            reloadWidgets()
            result(true)
        case "challengeReminderSync":
            n.syncJourney(itemsJSON: (args["items"] as? String) ?? "[]")
            result(true)
        case "dailyReminderPreview":
            n.previewReminder(night: (args["slot"] as? String) == "night")
            result(true)
        case "consumeOpenRoute":
            result(n.consumeRoute())
        case "scheduleAll":
            let times = (args["times"] as? [[String: Any]]) ?? []
            result(n.scheduleAlarms(times: times, sound: (args["soundEnabled"] as? Bool) ?? true))
        case "cancelAll":
            n.cancelAlarms()
            result(true)
        case "preview":
            n.previewAlarm(label: (args["label"] as? String) ?? "", sound: (args["soundEnabled"] as? Bool) ?? true)
            result(true)
        case "getStatus":
            n.authorizationStatus { status in
                let allowed = status == .authorized || status == .provisional
                result([
                    "exactAlarmAllowed": true,
                    "notificationsAllowed": allowed,
                    "overlayAllowed": true,
                    "fullScreenIntentAllowed": true,
                    "canScheduleFullScreen": true,
                    "scheduledCount": n.scheduledAlarmCount(),
                ])
            }
        case "openNotificationSettings", "openExactAlarmSettings", "openOverlaySettings", "openFullScreenIntentSettings":
            if let url = URL(string: UIApplication.openSettingsURLString) {
                UIApplication.shared.open(url, options: [:]) { ok in result(["opened": ok]) }
            } else {
                result(["opened": false])
            }
        default:
            result(FlutterMethodNotImplemented)
        }
    }

    // MARK: - Content push channel

    private func handleContentPush(_ method: String, _ args: [String: Any], _ result: @escaping FlutterResult) {
        let n = PraylyNotifications.shared
        switch method {
        case "repair", "enable":
            n.setContentEnabled(true)
            result(3)
        case "disable":
            n.setContentEnabled(false)
            result(true)
        case "getStatus":
            result(n.contentEnabled)
        case "markAppOpen":
            n.markAppOpen()
            result(true)
        case "setProMode":
            n.setPro((args["pro"] as? Bool) ?? false)
            result(true)
        case "preview":
            n.previewContent(kind: (args["kind"] as? String) ?? "verse")
            result(true)
        case "diagnostics":
            n.diagnostics { result($0) }
        default:
            result(FlutterMethodNotImplemented)
        }
    }

    // MARK: - Shield (Android-only feature): answer safely

    private func handlePrayScreen(_ method: String, _ args: [String: Any], _ result: @escaping FlutterResult) {
        switch method {
        case "consumeSacredPauseLaunch", "start", "stop", "testShield", "getPauseMode", "setPauseMode", "setCopy":
            result(false)
        case "batteryUnrestricted":
            result(true)
        case "drainEvents":
            result("[]")
        default:
            result(nil)
        }
    }

    // MARK: - Helpers

    private func reloadWidgets() {
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
    }

    private func openURL(_ string: String, _ result: @escaping FlutterResult) {
        guard let url = URL(string: string) else { result(false); return }
        UIApplication.shared.open(url, options: [:]) { ok in result(ok) }
    }

    private func trackingStatusString() -> String {
        guard #available(iOS 14, *) else { return "authorized" }
        switch ATTrackingManager.trackingAuthorizationStatus {
        case .authorized: return "authorized"
        case .denied: return "denied"
        case .restricted: return "restricted"
        case .notDetermined: return "notDetermined"
        @unknown default: return "notDetermined"
        }
    }

    private func requestTracking(_ result: @escaping FlutterResult) {
        guard #available(iOS 14, *) else { result("authorized"); return }
        if ATTrackingManager.trackingAuthorizationStatus != .notDetermined {
            result(trackingStatusString())
            return
        }
        // The system prompt only appears while the app is active.
        let ask = {
            ATTrackingManager.requestTrackingAuthorization { _ in
                DispatchQueue.main.async { result(self.trackingStatusString()) }
            }
        }
        if UIApplication.shared.applicationState == .active {
            ask()
        } else {
            var token: NSObjectProtocol?
            token = NotificationCenter.default.addObserver(
                forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main
            ) { _ in
                if let t = token { NotificationCenter.default.removeObserver(t) }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { ask() }
            }
        }
    }

    private func requestReview() {
        if #available(iOS 14.0, *) {
            let scene = UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .first { $0.activationState == .foregroundActive }
                ?? UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first
            if let scene = scene {
                SKStoreReviewController.requestReview(in: scene)
                return
            }
        }
        SKStoreReviewController.requestReview()
    }
}
