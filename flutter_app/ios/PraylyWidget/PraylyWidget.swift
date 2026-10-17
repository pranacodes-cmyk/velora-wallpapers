import ImageIO
import SwiftUI
import UIKit
import WidgetKit

// MARK: - Entry + image loading

struct PraylyWidgetEntry: TimelineEntry {
    let date: Date
    let content: PraylyDailyContent
    let lang: String
    let streak: Int
    let image: UIImage?
}

enum PraylyWidgetImages {
    static func load(number: Int, maxPixel: CGFloat) -> UIImage? {
        let url = PraylyResources.backgroundURL(number: number)
        guard let src = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
        let opts: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixel,
        ]
        guard let cg = CGImageSourceCreateThumbnailAtIndex(src, 0, opts as CFDictionary) else { return nil }
        return UIImage(cgImage: cg)
    }
}

private func makeEntry(at date: Date, withImage: Bool, displaySize: CGSize) -> PraylyWidgetEntry {
    let state = PraylySharedStore.load()
    let content = PraylyContent.display(state: state, date: date)
    var image: UIImage?
    if withImage {
        let scale: CGFloat = 3
        let target = min(1100, max(displaySize.width, displaySize.height) * scale * 1.15)
        image = PraylyWidgetImages.load(number: content.backgroundNumber, maxPixel: max(400, target))
    }
    let streakAlive: Bool = {
        guard state.streak > 0, !state.streakLastDate.isEmpty else { return state.streak > 0 }
        let f = DateFormatter()
        f.calendar = PraylyContent.calendar
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        guard let last = f.date(from: state.streakLastDate) else { return true }
        let days = PraylyContent.calendar.dateComponents([.day], from: PraylyContent.calendar.startOfDay(for: last),
                                                         to: PraylyContent.calendar.startOfDay(for: date)).day ?? 0
        return days <= 1
    }()
    return PraylyWidgetEntry(date: date, content: content, lang: state.lang,
                             streak: streakAlive ? state.streak : 0, image: image)
}

private func timelineDates(from now: Date) -> [Date] {
    let first = PraylyContent.nextMidnight(after: now)
    return [now, first.addingTimeInterval(1)]
}

struct PraylyHomeProvider: TimelineProvider {
    func placeholder(in context: Context) -> PraylyWidgetEntry {
        makeEntry(at: Date(), withImage: false, displaySize: context.displaySize)
    }

    func getSnapshot(in context: Context, completion: @escaping (PraylyWidgetEntry) -> Void) {
        completion(makeEntry(at: Date(), withImage: true, displaySize: context.displaySize))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<PraylyWidgetEntry>) -> Void) {
        let now = Date()
        let entries = timelineDates(from: now).map { makeEntry(at: $0, withImage: true, displaySize: context.displaySize) }
        let refresh = PraylyContent.nextMidnight(after: PraylyContent.nextMidnight(after: now)).addingTimeInterval(60)
        completion(Timeline(entries: entries, policy: .after(refresh)))
    }
}

struct PraylyLockProvider: TimelineProvider {
    func placeholder(in context: Context) -> PraylyWidgetEntry {
        makeEntry(at: Date(), withImage: false, displaySize: context.displaySize)
    }

    func getSnapshot(in context: Context, completion: @escaping (PraylyWidgetEntry) -> Void) {
        completion(makeEntry(at: Date(), withImage: false, displaySize: context.displaySize))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<PraylyWidgetEntry>) -> Void) {
        let now = Date()
        let entries = timelineDates(from: now).map { makeEntry(at: $0, withImage: false, displaySize: context.displaySize) }
        let refresh = PraylyContent.nextMidnight(after: PraylyContent.nextMidnight(after: now)).addingTimeInterval(60)
        completion(Timeline(entries: entries, policy: .after(refresh)))
    }
}

// MARK: - Shared visuals

private let praylyGold = Color(red: 245 / 255, green: 204 / 255, blue: 110 / 255)

struct PraylyCrossShape: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        let armY = rect.minY + rect.height * 0.3
        let arm = rect.height * 0.39
        p.move(to: CGPoint(x: rect.midX, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.midX, y: rect.maxY))
        p.move(to: CGPoint(x: rect.midX - arm, y: armY))
        p.addLine(to: CGPoint(x: rect.midX + arm, y: armY))
        return p
    }
}

struct PraylyCross: View {
    var height: CGFloat
    var color: Color = praylyGold
    var body: some View {
        PraylyCrossShape()
            .stroke(color, style: StrokeStyle(lineWidth: max(1.4, height * 0.1), lineCap: .round))
            .frame(width: height * 0.8, height: height)
    }
}

extension View {
    /// iOS 17+ needs `containerBackground` (StandBy, tinted modes); older
    /// systems get the classic padded background.
    @ViewBuilder
    func praylyWidgetBackground<B: View>(padding: CGFloat = 14, _ background: B) -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            self.containerBackground(for: .widget) { background }
        } else {
            self.padding(padding).background(background)
        }
    }

    func praylyTextShadow() -> some View {
        shadow(color: Color.black.opacity(0.65), radius: 3, x: 0, y: 1)
    }
}

// MARK: - Home Screen widget (same photo + verse as the wallpaper)

struct PraylyHomeWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: PraylyWidgetEntry

    private var isHindi: Bool { PraylyContent.normalizedLang(entry.lang) == "hi" }

    private var verseSize: CGFloat {
        let n = entry.content.text.count
        switch family {
        case .systemSmall: return n > 150 ? 11 : n > 100 ? 12 : 13.5
        case .systemMedium: return n > 170 ? 13 : n > 110 ? 14.5 : 16
        default: return n > 220 ? 17 : n > 140 ? 19 : 21
        }
    }

    private var verseLines: Int {
        switch family {
        case .systemSmall: return 6
        case .systemMedium: return 4
        default: return 9
        }
    }

    var body: some View {
        VStack(spacing: family == .systemSmall ? 5 : 8) {
            if family == .systemLarge { Spacer(minLength: 0) }
            PraylyCross(height: family == .systemSmall ? 13 : 17)
                .shadow(color: praylyGold.opacity(0.8), radius: 4)
            if family == .systemLarge {
                Text(PraylyContent.dateLabel(entry.content.date))
                    .font(.custom("Georgia-Bold", size: 10))
                    .kerning(2.6)
                    .foregroundColor(praylyGold)
                    .praylyTextShadow()
            }
            Text("“\(entry.content.text)”")
                .font(.custom("Georgia-BoldItalic", size: verseSize))
                .foregroundColor(.white)
                .multilineTextAlignment(.center)
                .lineLimit(verseLines)
                .minimumScaleFactor(0.62)
                .lineSpacing(family == .systemSmall ? 1 : 3)
                .praylyTextShadow()
            Text("— \(entry.content.reference)")
                .font(.custom("Georgia-Bold", size: family == .systemSmall ? 9 : 11))
                .kerning(isHindi ? 0.2 : 1.4)
                .foregroundColor(praylyGold)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .praylyTextShadow()
            if entry.content.stale || entry.content.packFrozen {
                Text(PraylyContent.string("widget.newVerse", lang: entry.lang))
                    .font(.system(size: family == .systemSmall ? 8.5 : 10, weight: .bold))
                    .foregroundColor(praylyGold)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    .padding(.horizontal, 9)
                    .padding(.vertical, 4)
                    .background(Capsule().fill(Color.black.opacity(0.55)))
                    .overlay(Capsule().stroke(praylyGold.opacity(0.8), lineWidth: 0.8))
            }
            if family == .systemLarge {
                Spacer(minLength: 0)
                Text("PRAYLY")
                    .font(.custom("Georgia-Bold", size: 11))
                    .kerning(2.2)
                    .foregroundColor(praylyGold.opacity(0.95))
                    .praylyTextShadow()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .praylyWidgetBackground(background)
    }

    private var background: some View {
        ZStack {
            LinearGradient(
                colors: [Color(red: 7 / 255, green: 11 / 255, blue: 24 / 255),
                         Color(red: 20 / 255, green: 33 / 255, blue: 63 / 255),
                         Color(red: 9 / 255, green: 6 / 255, blue: 17 / 255)],
                startPoint: .top, endPoint: .bottom
            )
            if let image = entry.image {
                GeometryReader { geo in
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFill()
                        .frame(width: geo.size.width, height: geo.size.height)
                        .clipped()
                }
            }
            LinearGradient(
                colors: [Color.black.opacity(0.32), Color.black.opacity(0.55), Color.black.opacity(0.6)],
                startPoint: .top, endPoint: .bottom
            )
        }
    }
}

struct PraylyHomeWidget: Widget {
    let kind: String = "PraylyWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: PraylyHomeProvider()) { entry in
            PraylyHomeWidgetView(entry: entry)
        }
        .configurationDisplayName("Daily Verse")
        .description("Today's verse on the same photo as your Prayly wallpaper.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

// MARK: - Lock Screen widgets

struct PraylyLockWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: PraylyWidgetEntry

    var body: some View {
        switch family {
        case .accessoryInline:
            Text("✝︎ \(entry.content.reference)")
                .praylyWidgetBackground(padding: 0, Color.clear)
        case .accessoryCircular:
            ZStack {
                AccessoryWidgetBackground()
                VStack(spacing: 1) {
                    PraylyCross(height: 12, color: .primary)
                    if entry.streak > 0 {
                        Text("\(entry.streak)")
                            .font(.system(size: 17, weight: .bold, design: .rounded))
                            .minimumScaleFactor(0.6)
                        Text(PraylyContent.string("widget.streakShort", lang: entry.lang))
                            .font(.system(size: 7.5, weight: .semibold))
                            .lineLimit(1)
                            .minimumScaleFactor(0.6)
                    } else {
                        Text("\(entry.content.dayOfYear)")
                            .font(.system(size: 16, weight: .bold, design: .rounded))
                            .minimumScaleFactor(0.6)
                    }
                }
                .padding(4)
            }
            .widgetAccentable()
            .praylyWidgetBackground(padding: 0, Color.clear)
        default:
            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: 4) {
                    PraylyCross(height: 10, color: .primary)
                    Text(entry.content.reference)
                        .font(.system(size: 11, weight: .bold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
                .widgetAccentable()
                Text(entry.content.text)
                    .font(.system(size: 12, weight: .medium, design: .serif))
                    .lineLimit(3)
                    .minimumScaleFactor(0.75)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .praylyWidgetBackground(padding: 0, Color.clear)
        }
    }
}

struct PraylyLockWidget: Widget {
    let kind: String = "PraylyLockWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: PraylyLockProvider()) { entry in
            PraylyLockWidgetView(entry: entry)
        }
        .configurationDisplayName("Verse of the Day")
        .description("Today's verse and your prayer streak on the Lock Screen.")
        .supportedFamilies([.accessoryRectangular, .accessoryInline, .accessoryCircular])
    }
}

@main
struct PraylyWidgetBundle: WidgetBundle {
    var body: some Widget {
        PraylyHomeWidget()
        PraylyLockWidget()
    }
}
