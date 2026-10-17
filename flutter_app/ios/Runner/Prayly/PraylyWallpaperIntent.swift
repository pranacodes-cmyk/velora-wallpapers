import AppIntents
import Foundation
import UIKit
import UniformTypeIdentifiers
import WidgetKit

/// Shortcuts action: "Get Today's Prayly Wallpaper". Renders today's verse
/// wallpaper on-device (same photo, verse and layout as the app preview) and
/// hands it to the next action — the user pairs it with "Set Wallpaper" in a
/// daily personal automation, set up once.
@available(iOS 16.0, *)
struct PraylyTodayWallpaperIntent: AppIntent {
    static var title: LocalizedStringResource = "Get Today's Prayly Wallpaper"
    static var description = IntentDescription(
        "Creates today's Bible verse wallpaper on this device — the same photo and verse you see in Prayly. Add “Set Wallpaper” after this action to change your wallpaper automatically every day."
    )
    static var openAppWhenRun: Bool = false

    func perform() async throws -> some IntentResult & ReturnsValue<IntentFile> {
        let size = await MainActor.run { PraylyWallpaperRenderer.devicePixelSize() }
        let state = PraylySharedStore.load()
        let (image, content) = PraylyWallpaperExporter.renderDisplay(size: size, state: state)
        guard let data = image.jpegData(compressionQuality: 0.93) else {
            throw PraylyIntentError.renderFailed
        }
        PraylySharedStore.update { $0.lastAutomationRun = Date().timeIntervalSince1970 }
        WidgetCenter.shared.reloadAllTimelines()
        let file = IntentFile(data: data, filename: "Prayly-Verse-\(content.dayOfYear).jpg", type: .jpeg)
        return .result(value: file)
    }
}

@available(iOS 16.0, *)
enum PraylyIntentError: Error, CustomLocalizedStringResourceConvertible {
    case renderFailed

    var localizedStringResource: LocalizedStringResource {
        switch self {
        case .renderFailed:
            return "Prayly couldn't create today's wallpaper. Open Prayly once, then run the shortcut again."
        }
    }
}

@available(iOS 16.0, *)
struct PraylyAppShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: PraylyTodayWallpaperIntent(),
            phrases: [
                "Get today's wallpaper from \(.applicationName)",
                "\(.applicationName) daily wallpaper",
                "Today's verse wallpaper in \(.applicationName)",
            ],
            shortTitle: "Today's Wallpaper",
            systemImageName: "photo.on.rectangle.angled"
        )
    }
}
