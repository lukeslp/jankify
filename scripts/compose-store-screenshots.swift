#!/usr/bin/env swift

import AppKit
import Foundation

struct Shot {
    let source: String
    let output: String
    let title: String
    let subtitle: String
    let accent: NSColor
}

let fileManager = FileManager.default
let repository = URL(fileURLWithPath: fileManager.currentDirectoryPath)
let sourceDirectory = repository.appendingPathComponent("fastlane/screenshot-source/en-US")
let outputDirectory = repository.appendingPathComponent("fastlane/screenshots/en-US")

let cyan = NSColor(calibratedRed: 0.27, green: 0.83, blue: 0.92, alpha: 1)
let orange = NSColor(calibratedRed: 0.93, green: 0.43, blue: 0.25, alpha: 1)

let shots = [
    Shot(source: "iphone69-01-sprites.png", output: "iphone69-01-create.png", title: "Make a little universe", subtitle: "Ships, worlds, sprites, effects & more", accent: cyan),
    Shot(source: "iphone69-02-ships.png", output: "iphone69-02-ships.png", title: "Fleets from a single seed", subtitle: "Change the recipe. Keep what gets weird.", accent: cyan),
    Shot(source: "iphone69-03-explosions.png", output: "iphone69-03-explosions.png", title: "A new blast every time", subtitle: "Vary the seed, palette, power & debris", accent: orange),
    Shot(source: "iphone69-04-pixel.png", output: "iphone69-04-edit.png", title: "Then wreck a photo", subtitle: "Eight handmade looks, from pixels to pen strokes", accent: orange),
    Shot(source: "iphone69-05-edit.png", output: "iphone69-05-motion.png", title: "Stills in. Loops out.", subtitle: "PNG, SVG, GIF, sprite sheets & video", accent: orange),
    Shot(source: "ipad13-01-sprites.png", output: "ipad13-01-create.png", title: "Make a little universe", subtitle: "Ships, worlds, sprites, effects & more", accent: cyan),
    Shot(source: "ipad13-02-ships.png", output: "ipad13-02-ships.png", title: "Fleets from a single seed", subtitle: "Change the recipe. Keep what gets weird.", accent: cyan),
    Shot(source: "ipad13-03-explosions.png", output: "ipad13-03-explosions.png", title: "A new blast every time", subtitle: "Vary the seed, palette, power & debris", accent: orange),
    Shot(source: "ipad13-04-pixel.png", output: "ipad13-04-edit.png", title: "Then wreck a photo", subtitle: "Eight handmade looks, from pixels to pen strokes", accent: orange),
    Shot(source: "ipad13-05-emoji.png", output: "ipad13-05-motion.png", title: "Stills in. Loops out.", subtitle: "PNG, SVG, GIF, sprite sheets & video", accent: orange),
]

func centeredText(_ text: String, in rect: NSRect, font: NSFont, color: NSColor) {
    let paragraph = NSMutableParagraphStyle()
    paragraph.alignment = .center
    paragraph.lineBreakMode = .byWordWrapping
    let attributes: [NSAttributedString.Key: Any] = [
        .font: font,
        .foregroundColor: color,
        .paragraphStyle: paragraph,
    ]
    NSAttributedString(string: text, attributes: attributes).draw(in: rect)
}

func outputSize(for image: NSImage) -> NSSize {
    guard let representation = image.representations.first else { return image.size }
    return NSSize(width: representation.pixelsWide, height: representation.pixelsHigh)
}

func render(_ shot: Shot) throws {
    let inputURL = sourceDirectory.appendingPathComponent(shot.source)
    guard let source = NSImage(contentsOf: inputURL) else {
        throw NSError(domain: "JankifyScreenshots", code: 1, userInfo: [NSLocalizedDescriptionKey: "Could not read \(inputURL.path)"])
    }

    let canvasSize = outputSize(for: source)
    let isPhone = Int(canvasSize.width) == 1320 && Int(canvasSize.height) == 2868
    let isPad = Int(canvasSize.width) == 2064 && Int(canvasSize.height) == 2752
    guard isPhone || isPad else {
        throw NSError(domain: "JankifyScreenshots", code: 2, userInfo: [NSLocalizedDescriptionKey: "Unexpected source size for \(shot.source): \(canvasSize)"])
    }

    guard let bitmap = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: Int(canvasSize.width),
        pixelsHigh: Int(canvasSize.height),
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    ) else {
        throw NSError(domain: "JankifyScreenshots", code: 3, userInfo: [NSLocalizedDescriptionKey: "Could not allocate output bitmap"])
    }

    bitmap.size = canvasSize
    NSGraphicsContext.saveGraphicsState()
    guard let graphicsContext = NSGraphicsContext(bitmapImageRep: bitmap) else {
        throw NSError(domain: "JankifyScreenshots", code: 4, userInfo: [NSLocalizedDescriptionKey: "Could not create graphics context"])
    }
    NSGraphicsContext.current = graphicsContext
    graphicsContext.imageInterpolation = .high

    let canvas = NSRect(origin: .zero, size: canvasSize)
    let gradient = NSGradient(colorsAndLocations:
        (NSColor(calibratedRed: 0.055, green: 0.067, blue: 0.09, alpha: 1), 0),
        (NSColor(calibratedRed: 0.09, green: 0.075, blue: 0.065, alpha: 1), 0.52),
        (NSColor(calibratedRed: 0.035, green: 0.045, blue: 0.06, alpha: 1), 1)
    )!
    gradient.draw(in: canvas, angle: 90)

    let glow = NSGradient(colors: [shot.accent.withAlphaComponent(0.22), shot.accent.withAlphaComponent(0)])!
    let glowSize = isPhone ? NSSize(width: 1_650, height: 1_000) : NSSize(width: 2_300, height: 1_300)
    glow.draw(fromCenter: NSPoint(x: canvas.midX, y: canvas.maxY), radius: 0, toCenter: NSPoint(x: canvas.midX, y: canvas.maxY), radius: glowSize.width / 2, options: [.drawsBeforeStartingLocation, .drawsAfterEndingLocation])

    let brandFont = NSFont.systemFont(ofSize: isPhone ? 42 : 44, weight: .bold)
    let titleFont = NSFont.systemFont(ofSize: isPhone ? 72 : 82, weight: .heavy)
    let subtitleFont = NSFont.systemFont(ofSize: isPhone ? 34 : 38, weight: .medium)
    let footerFont = NSFont.monospacedSystemFont(ofSize: isPhone ? 28 : 30, weight: .medium)

    let brandY = canvas.height - (isPhone ? 155 : 130)
    centeredText("▲  JANKIFY", in: NSRect(x: 0, y: brandY, width: canvas.width, height: 60), font: brandFont, color: NSColor(calibratedWhite: 0.82, alpha: 1))

    let titleY = canvas.height - (isPhone ? 305 : 260)
    centeredText(shot.title, in: NSRect(x: isPhone ? 55 : 100, y: titleY, width: canvas.width - (isPhone ? 110 : 200), height: isPhone ? 105 : 115), font: titleFont, color: .white)
    centeredText(shot.subtitle, in: NSRect(x: isPhone ? 70 : 140, y: titleY - (isPhone ? 78 : 82), width: canvas.width - (isPhone ? 140 : 280), height: 60), font: subtitleFont, color: shot.accent)

    let screenshotWidth: CGFloat = isPhone ? 1_000 : 1_620
    let screenshotHeight = screenshotWidth * canvas.height / canvas.width
    let screenshotY: CGFloat = isPhone ? 250 : 145
    let screenshotRect = NSRect(x: (canvas.width - screenshotWidth) / 2, y: screenshotY, width: screenshotWidth, height: screenshotHeight)

    NSGraphicsContext.saveGraphicsState()
    let shadow = NSShadow()
    shadow.shadowColor = NSColor.black.withAlphaComponent(0.65)
    shadow.shadowBlurRadius = isPhone ? 50 : 60
    shadow.shadowOffset = NSSize(width: 0, height: -18)
    shadow.set()
    shot.accent.withAlphaComponent(0.28).setFill()
    NSBezierPath(roundedRect: screenshotRect.insetBy(dx: -4, dy: -4), xRadius: isPhone ? 75 : 58, yRadius: isPhone ? 75 : 58).fill()
    NSGraphicsContext.restoreGraphicsState()

    NSGraphicsContext.saveGraphicsState()
    NSBezierPath(roundedRect: screenshotRect, xRadius: isPhone ? 70 : 52, yRadius: isPhone ? 70 : 52).addClip()
    source.draw(in: screenshotRect, from: NSRect(origin: .zero, size: source.size), operation: .sourceOver, fraction: 1, respectFlipped: true, hints: [.interpolation: NSImageInterpolation.high])
    NSGraphicsContext.restoreGraphicsState()

    let footerY: CGFloat = isPhone ? 110 : 60
    centeredText("PRIVATE BY DESIGN  ·  FULLY OFFLINE", in: NSRect(x: 0, y: footerY, width: canvas.width, height: 45), font: footerFont, color: NSColor(calibratedWhite: 0.62, alpha: 1))

    graphicsContext.flushGraphics()
    NSGraphicsContext.restoreGraphicsState()

    guard let png = bitmap.representation(using: .png, properties: [:]) else {
        throw NSError(domain: "JankifyScreenshots", code: 5, userInfo: [NSLocalizedDescriptionKey: "Could not encode \(shot.output)"])
    }
    try png.write(to: outputDirectory.appendingPathComponent(shot.output), options: .atomic)
}

try fileManager.createDirectory(at: outputDirectory, withIntermediateDirectories: true)
for existing in try fileManager.contentsOfDirectory(at: outputDirectory, includingPropertiesForKeys: nil) where existing.pathExtension.lowercased() == "png" {
    try fileManager.removeItem(at: existing)
}
for shot in shots {
    try render(shot)
    print("Wrote \(shot.output)")
}
