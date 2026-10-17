import Foundation
import ImageIO
import UIKit

/// Draws the daily verse wallpaper on-device: same 20 photos, same verse
/// selection and the same composition as the Android renderer, shifted lower
/// so every element sits in the safe area beneath the iOS Lock Screen clock
/// and widgets. The in-app preview uses this exact function, so what the user
/// sees in Prayly is pixel-for-pixel what lands on the Lock/Home Screen.
enum PraylyWallpaperRenderer {
    static let gold = UIColor(red: 245 / 255, green: 204 / 255, blue: 110 / 255, alpha: 1)
    static let goldLine = UIColor(red: 232 / 255, green: 188 / 255, blue: 89 / 255, alpha: 0.85)

    /// Portrait pixel size of the current device. Call on the main thread.
    static func devicePixelSize() -> CGSize {
        let native = UIScreen.main.nativeBounds.size
        let w = min(native.width, native.height)
        let h = max(native.width, native.height)
        if w < 300 || h < 500 { return CGSize(width: 1179, height: 2556) }
        return CGSize(width: w, height: h)
    }

    static func render(content: PraylyDailyContent, lang: String, size: CGSize) -> UIImage {
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        format.opaque = true
        if #available(iOS 12.0, *) { format.preferredRange = .standard }
        let renderer = UIGraphicsImageRenderer(size: size, format: format)
        return renderer.image { ctx in
            draw(ctx.cgContext, size: size, content: content, lang: lang)
        }
    }

    static func loadImage(url: URL, maxPixel: CGFloat) -> CGImage? {
        guard let src = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
        let opts: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixel,
        ]
        return CGImageSourceCreateThumbnailAtIndex(src, 0, opts as CFDictionary)
    }

    // MARK: - Composition

    private static func draw(_ cg: CGContext, size: CGSize, content: PraylyDailyContent, lang: String) {
        let W = size.width
        let H = size.height
        let isHindi = PraylyContent.normalizedLang(lang) == "hi"

        // 1. Fallback night gradient (visible only if a photo fails to load).
        fillVertical(cg, rect: CGRect(origin: .zero, size: size), stops: [
            (0, UIColor(red: 7 / 255, green: 11 / 255, blue: 24 / 255, alpha: 1)),
            (0.48, UIColor(red: 20 / 255, green: 33 / 255, blue: 63 / 255, alpha: 1)),
            (1, UIColor(red: 9 / 255, green: 6 / 255, blue: 17 / 255, alpha: 1)),
        ])

        // 2. Photo, aspect-fill.
        if let img = loadImage(url: PraylyResources.backgroundURL(number: content.backgroundNumber), maxPixel: max(W, H)) {
            let iw = CGFloat(img.width)
            let ih = CGFloat(img.height)
            let scale = max(W / iw, H / ih)
            let dw = iw * scale
            let dh = ih * scale
            UIImage(cgImage: img).draw(in: CGRect(x: (W - dw) / 2, y: (H - dh) / 2, width: dw, height: dh))
        }

        // 3. Legibility veil — light under the clock, deepest behind the verse.
        fillVertical(cg, rect: CGRect(origin: .zero, size: size), stops: [
            (0.00, UIColor(white: 0, alpha: 0.16)),
            (0.22, UIColor(white: 0, alpha: 0.26)),
            (0.40, UIColor(white: 0, alpha: 0.52)),
            (0.58, UIColor(white: 0, alpha: 0.62)),
            (0.76, UIColor(white: 0, alpha: 0.56)),
            (0.90, UIColor(white: 0, alpha: 0.44)),
            (1.00, UIColor(white: 0, alpha: 0.58)),
        ])

        // Metrics (fractions of width, like Android).
        let crossH = 0.0615 * W
        let crossArm = 0.0239 * W
        let crossStroke = 0.006 * W
        let dateFont = UIFont(name: "Georgia-Bold", size: 0.0205 * W) ?? UIFont.boldSystemFont(ofSize: 0.0205 * W)
        let refFont = UIFont(name: "Georgia-Bold", size: 0.0239 * W) ?? UIFont.boldSystemFont(ofSize: 0.0239 * W)
        let gapCrossDate = 0.024 * W
        let gapDateVerse = 0.036 * W
        let gapVerseRef = 0.026 * W
        let maxTextWidth = W * 0.84

        // Branding block anchors.
        let dividerY = H * 0.9107
        let pillH = 0.135 * W
        let pillTop = dividerY - 0.03 * W - pillH
        let showPill = content.stale || content.packFrozen
        let blockLimit = showPill ? pillTop - 0.035 * W : dividerY - 0.05 * W

        // Attributed pieces.
        let dateText = PraylyContent.dateLabel(content.date)
        let dateAttr = attributed(dateText, font: dateFont, color: gold, kern: 0.33 * dateFont.pointSize,
                                  shadow: shadow(alpha: 0.85, blur: 0.007 * W, dy: 0.0015 * W))
        let refText = "— " + content.reference
        let refAttr = attributed(refText, font: refFont, color: gold,
                                 kern: (isHindi ? 0.03 : 0.178) * refFont.pointSize,
                                 shadow: shadow(alpha: 0.85, blur: 0.007 * W, dy: 0.0015 * W))
        let verseString = "“" + content.text.trimmingCharacters(in: .whitespacesAndNewlines) + "”"

        // Fit the verse by shrinking type, never by cutting words.
        var verseSize = 0.0547 * W
        let minVerse = 0.034 * W
        var verseAttr = verseAttributed(verseString, size: verseSize, W: W)
        var verseRect = measure(verseAttr, width: maxTextWidth)
        let dateH = ceil(dateFont.lineHeight)
        let refRect = measure(refAttr, width: maxTextWidth)
        func blockHeight() -> CGFloat {
            crossH + gapCrossDate + dateH + gapDateVerse + verseRect.height + gapVerseRef + refRect.height
        }
        let preferredTop = H * 0.42 - crossH / 2
        while preferredTop + blockHeight() > blockLimit && verseSize > minVerse {
            verseSize = max(minVerse, verseSize * 0.94)
            verseAttr = verseAttributed(verseString, size: verseSize, W: W)
            verseRect = measure(verseAttr, width: maxTextWidth)
        }
        var top = preferredTop
        if top + blockHeight() > blockLimit {
            top = max(H * 0.36, blockLimit - blockHeight())
        }

        // 4. Cross with a soft gold glow.
        let cx = W / 2
        let crossTop = top
        let crossBottom = top + crossH
        let armY = crossTop + 0.0188 * W
        cg.saveGState()
        cg.setShadow(offset: .zero, blur: 0.014 * W, color: gold.withAlphaComponent(0.9).cgColor)
        cg.setStrokeColor(gold.cgColor)
        cg.setLineWidth(crossStroke)
        cg.setLineCap(.round)
        cg.move(to: CGPoint(x: cx, y: crossTop))
        cg.addLine(to: CGPoint(x: cx, y: crossBottom))
        cg.move(to: CGPoint(x: cx - crossArm, y: armY))
        cg.addLine(to: CGPoint(x: cx + crossArm, y: armY))
        cg.strokePath()
        cg.restoreGState()

        // 5. Date label with hairlines.
        let dateTop = crossBottom + gapCrossDate
        let dateSize = dateAttr.size()
        let trailingKern = 0.33 * dateFont.pointSize
        let dateVisualW = dateSize.width - trailingKern
        dateAttr.draw(at: CGPoint(x: cx - dateVisualW / 2, y: dateTop))
        let hairY = dateTop + dateH / 2
        let halfText = dateVisualW / 2 + 0.0205 * W
        let lineLen = 0.0513 * W
        cg.saveGState()
        cg.setStrokeColor(goldLine.cgColor)
        cg.setLineWidth(max(1, 0.0009 * W))
        cg.move(to: CGPoint(x: cx - halfText - lineLen, y: hairY))
        cg.addLine(to: CGPoint(x: cx - halfText, y: hairY))
        cg.move(to: CGPoint(x: cx + halfText, y: hairY))
        cg.addLine(to: CGPoint(x: cx + halfText + lineLen, y: hairY))
        cg.strokePath()
        cg.restoreGState()

        // 6. Verse.
        let verseTop = dateTop + dateH + gapDateVerse
        let verseDrawRect = CGRect(x: (W - maxTextWidth) / 2, y: verseTop, width: maxTextWidth, height: verseRect.height + 2)
        verseAttr.draw(with: verseDrawRect, options: [.usesLineFragmentOrigin, .usesFontLeading], context: nil)

        // 7. Reference.
        let refTop = verseTop + verseRect.height + gapVerseRef
        let refDrawRect = CGRect(x: (W - maxTextWidth) / 2, y: refTop, width: maxTextWidth, height: refRect.height + 2)
        refAttr.draw(with: refDrawRect, options: [.usesLineFragmentOrigin, .usesFontLeading], context: nil)

        // 8. Gentle badge for free users whose verse is waiting.
        if showPill {
            drawPill(cg, W: W, top: pillTop, height: pillH, content: content, lang: lang, isHindi: isHindi)
        }

        // 9. Branding.
        drawBranding(cg, W: W, H: H, dividerY: dividerY, lang: lang)
    }

    private static func verseAttributed(_ text: String, size: CGFloat, W: CGFloat) -> NSAttributedString {
        let font = UIFont(name: "Georgia-BoldItalic", size: size) ?? UIFont.italicSystemFont(ofSize: size)
        let para = NSMutableParagraphStyle()
        para.alignment = .center
        para.lineBreakMode = .byWordWrapping
        para.minimumLineHeight = size * 1.45
        para.maximumLineHeight = size * 1.45
        return NSAttributedString(string: text, attributes: [
            .font: font,
            .foregroundColor: UIColor.white,
            .paragraphStyle: para,
            .shadow: shadow(alpha: 0.9, blur: 0.011 * W, dy: 0.003 * W),
        ])
    }

    private static func attributed(_ text: String, font: UIFont, color: UIColor, kern: CGFloat, shadow: NSShadow?) -> NSAttributedString {
        let para = NSMutableParagraphStyle()
        para.alignment = .center
        var attrs: [NSAttributedString.Key: Any] = [
            .font: font,
            .foregroundColor: color,
            .kern: kern,
            .paragraphStyle: para,
        ]
        if let shadow = shadow { attrs[.shadow] = shadow }
        return NSAttributedString(string: text, attributes: attrs)
    }

    private static func shadow(alpha: CGFloat, blur: CGFloat, dy: CGFloat) -> NSShadow {
        let s = NSShadow()
        s.shadowColor = UIColor(white: 0, alpha: alpha)
        s.shadowBlurRadius = blur
        s.shadowOffset = CGSize(width: 0, height: dy)
        return s
    }

    private static func measure(_ attr: NSAttributedString, width: CGFloat) -> CGRect {
        let r = attr.boundingRect(
            with: CGSize(width: width, height: .greatestFiniteMagnitude),
            options: [.usesLineFragmentOrigin, .usesFontLeading],
            context: nil
        )
        return CGRect(x: 0, y: 0, width: ceil(r.width), height: ceil(r.height))
    }

    private static func fillVertical(_ cg: CGContext, rect: CGRect, stops: [(CGFloat, UIColor)]) {
        let colors = stops.map { $0.1.cgColor } as CFArray
        var locations = stops.map { $0.0 }
        guard let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: &locations) else { return }
        cg.saveGState()
        cg.addRect(rect)
        cg.clip()
        cg.drawLinearGradient(gradient, start: CGPoint(x: rect.midX, y: rect.minY), end: CGPoint(x: rect.midX, y: rect.maxY), options: [])
        cg.restoreGState()
    }

    private static func drawPill(_ cg: CGContext, W: CGFloat, top: CGFloat, height: CGFloat,
                                 content: PraylyDailyContent, lang: String, isHindi: Bool) {
        let pillW = 0.84 * W
        let rect = CGRect(x: (W - pillW) / 2, y: top, width: pillW, height: height)
        let path = UIBezierPath(roundedRect: rect, cornerRadius: height / 2)

        cg.saveGState()
        cg.setShadow(offset: .zero, blur: 0.03 * W, color: gold.withAlphaComponent(0.35).cgColor)
        UIColor(red: 28 / 255, green: 22 / 255, blue: 10 / 255, alpha: 0.93).setFill()
        path.fill()
        cg.restoreGState()

        cg.saveGState()
        path.addClip()
        let colors = [
            UIColor(red: 28 / 255, green: 22 / 255, blue: 10 / 255, alpha: 0.93).cgColor,
            UIColor(red: 52 / 255, green: 38 / 255, blue: 14 / 255, alpha: 0.93).cgColor,
        ] as CFArray
        var locs: [CGFloat] = [0, 1]
        if let g = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: &locs) {
            cg.drawLinearGradient(g, start: CGPoint(x: rect.minX, y: rect.minY), end: CGPoint(x: rect.maxX, y: rect.maxY), options: [])
        }
        cg.restoreGState()

        gold.withAlphaComponent(0.92).setStroke()
        path.lineWidth = 0.004 * W
        path.stroke()

        let titleKey = content.packFrozen ? "wallpaper.packTitle" : "wallpaper.staleTitle"
        let subKey = content.packFrozen ? "wallpaper.packSub" : "wallpaper.staleSub"
        var title = PraylyContent.string(titleKey, lang: lang)
        if !isHindi { title = title.uppercased() }
        let sub = PraylyContent.string(subKey, lang: lang)
        let titleFont = UIFont.systemFont(ofSize: 0.0235 * W, weight: .bold)
        let subFont = UIFont.systemFont(ofSize: 0.020 * W, weight: .medium)
        let titleAttr = attributed(title, font: titleFont, color: gold, kern: (isHindi ? 0.02 : 0.22) * titleFont.pointSize, shadow: nil)
        let subAttr = attributed(sub, font: subFont, color: UIColor(white: 1, alpha: 0.86), kern: 0.01 * subFont.pointSize, shadow: nil)
        let inner = rect.insetBy(dx: height * 0.4, dy: 0)
        let tH = ceil(titleFont.lineHeight)
        let sH = ceil(subFont.lineHeight)
        let gap = height * 0.06
        let startY = rect.midY - (tH + gap + sH) / 2
        titleAttr.draw(with: CGRect(x: inner.minX, y: startY, width: inner.width, height: tH + 2),
                       options: [.usesLineFragmentOrigin, .truncatesLastVisibleLine], context: nil)
        subAttr.draw(with: CGRect(x: inner.minX, y: startY + tH + gap, width: inner.width, height: sH + 2),
                     options: [.usesLineFragmentOrigin, .truncatesLastVisibleLine], context: nil)
    }

    private static func drawBranding(_ cg: CGContext, W: CGFloat, H: CGFloat, dividerY: CGFloat, lang: String) {
        // Divider: transparent → gold → transparent.
        let lineW = 0.24 * W
        let lineH = max(1, 0.0013 * W)
        let lineRect = CGRect(x: (W - lineW) / 2, y: dividerY, width: lineW, height: lineH)
        cg.saveGState()
        cg.addRect(lineRect)
        cg.clip()
        let colors = [
            gold.withAlphaComponent(0).cgColor,
            gold.withAlphaComponent(0.75).cgColor,
            gold.withAlphaComponent(0).cgColor,
        ] as CFArray
        var locs: [CGFloat] = [0, 0.5, 1]
        if let g = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: &locs) {
            cg.drawLinearGradient(g, start: CGPoint(x: lineRect.minX, y: dividerY), end: CGPoint(x: lineRect.maxX, y: dividerY), options: [])
        }
        cg.restoreGState()

        // Small cross.
        let cx = W / 2
        let smallTop = dividerY + 0.016 * W
        let smallH = 0.0257 * W
        cg.saveGState()
        cg.setStrokeColor(gold.cgColor)
        cg.setLineWidth(0.003 * W)
        cg.setLineCap(.round)
        cg.move(to: CGPoint(x: cx, y: smallTop))
        cg.addLine(to: CGPoint(x: cx, y: smallTop + smallH))
        cg.move(to: CGPoint(x: cx - 0.0077 * W, y: smallTop + 0.0077 * W))
        cg.addLine(to: CGPoint(x: cx + 0.0077 * W, y: smallTop + 0.0077 * W))
        cg.strokePath()
        cg.restoreGState()

        let nameFont = UIFont(name: "Georgia-Bold", size: 0.0308 * W) ?? UIFont.boldSystemFont(ofSize: 0.0308 * W)
        let nameKern = 0.167 * nameFont.pointSize
        let name = attributed("PRAYLY", font: nameFont, color: gold, kern: nameKern,
                              shadow: shadow(alpha: 0.7, blur: 0.006 * W, dy: 0.001 * W))
        let nameTop = smallTop + smallH + 0.012 * W
        let nameW = name.size().width - nameKern
        name.draw(at: CGPoint(x: cx - nameW / 2, y: nameTop))

        let tagFont = UIFont(name: "Georgia", size: 0.0171 * W) ?? UIFont.systemFont(ofSize: 0.0171 * W)
        let tagKern = 0.2 * tagFont.pointSize
        let tagText = PraylyContent.string("wallpaper.tagline", lang: lang).uppercased()
        let tag = attributed(tagText, font: tagFont, color: UIColor(white: 1, alpha: 0.78), kern: tagKern,
                             shadow: shadow(alpha: 0.7, blur: 0.006 * W, dy: 0.001 * W))
        let tagTop = nameTop + ceil(nameFont.lineHeight) + 0.002 * W
        let tagW = tag.size().width - tagKern
        tag.draw(at: CGPoint(x: cx - tagW / 2, y: tagTop))
        _ = H
    }
}

/// Produces the files the app and the Shortcuts action hand to iOS.
enum PraylyWallpaperExporter {
    /// Today's wallpaper exactly as the Lock Screen will show it.
    static func renderDisplay(size: CGSize, state: PraylySharedState, date: Date = Date()) -> (UIImage, PraylyDailyContent) {
        let content = PraylyContent.display(state: state, date: date)
        return (PraylyWallpaperRenderer.render(content: content, lang: state.lang, size: size), content)
    }

    /// Today's verse for the in-app preview (no "waiting" badge — what you unlock).
    static func renderPreview(size: CGSize, state: PraylySharedState, date: Date = Date()) -> UIImage {
        let content = PraylyContent.today(state: state, date: date)
        return PraylyWallpaperRenderer.render(content: content, lang: state.lang, size: size)
    }
}
