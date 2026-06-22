#!/usr/bin/env swift
import AppKit
import CoreGraphics

let canvasSize: CGFloat = 1024
let outputDirectory = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
    .appendingPathComponent("icon-variants", isDirectory: true)
let appIconPath = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
    .appendingPathComponent("Jankify/Assets.xcassets/AppIcon.appiconset/icon_1024x1024.png")

try FileManager.default.createDirectory(at: outputDirectory, withIntermediateDirectories: true)

func color(_ hex: UInt32, alpha: CGFloat = 1) -> NSColor {
    NSColor(
        srgbRed: CGFloat((hex >> 16) & 0xff) / 255,
        green: CGFloat((hex >> 8) & 0xff) / 255,
        blue: CGFloat(hex & 0xff) / 255,
        alpha: alpha
    )
}

func point(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
    CGPoint(x: x, y: y)
}

func fillRect(_ rect: CGRect, color: NSColor, radius: CGFloat = 0) {
    color.setFill()
    if radius > 0 {
        NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius).fill()
    } else {
        NSBezierPath(rect: rect).fill()
    }
}

func drawLinearGradient(_ rect: CGRect, top: NSColor, bottom: NSColor) {
    let gradient = NSGradient(colors: [top, bottom])!
    gradient.draw(in: NSBezierPath(rect: rect), angle: -90)
}

func drawRadialGlow(center: CGPoint, radius: CGFloat, color: NSColor) {
    guard let gradient = NSGradient(colors: [
        color.withAlphaComponent(0.38),
        color.withAlphaComponent(0.08),
        color.withAlphaComponent(0)
    ]) else { return }

    let rect = CGRect(
        x: center.x - radius,
        y: center.y - radius,
        width: radius * 2,
        height: radius * 2
    )
    gradient.draw(in: NSBezierPath(ovalIn: rect), relativeCenterPosition: .zero)
}

func drawPolygon(_ points: [CGPoint], fill: NSColor, stroke: NSColor? = nil, lineWidth: CGFloat = 10) {
    guard let first = points.first else { return }
    let path = NSBezierPath()
    path.move(to: first)
    for point in points.dropFirst() {
        path.line(to: point)
    }
    path.close()

    fill.setFill()
    path.fill()

    if let stroke {
        stroke.setStroke()
        path.lineWidth = lineWidth
        path.lineJoinStyle = .round
        path.stroke()
    }
}

func drawSlash(_ start: CGPoint, _ end: CGPoint, width: CGFloat, color: NSColor) {
    let path = NSBezierPath()
    path.move(to: start)
    path.line(to: end)
    path.lineCapStyle = .round
    path.lineWidth = width
    color.setStroke()
    path.stroke()
}

func withShadow(color: NSColor, blur: CGFloat, offset: CGSize, draw: () -> Void) {
    NSGraphicsContext.saveGraphicsState()
    let shadow = NSShadow()
    shadow.shadowColor = color
    shadow.shadowBlurRadius = blur
    shadow.shadowOffset = offset
    shadow.set()
    draw()
    NSGraphicsContext.restoreGraphicsState()
}

func render(name: String, install: Bool = false, draw: () -> Void) throws {
    let dimension = Int(canvasSize)
    guard let cgContext = CGContext(
        data: nil,
        width: dimension,
        height: dimension,
        bitsPerComponent: 8,
        bytesPerRow: 0,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
    ) else {
        fatalError("Could not create icon bitmap")
    }

    let context = NSGraphicsContext(cgContext: cgContext, flipped: false)
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = context
    draw()
    context.flushGraphics()
    NSGraphicsContext.restoreGraphicsState()

    guard let cgImage = cgContext.makeImage() else {
        fatalError("Could not snapshot icon")
    }

    let bitmap = NSBitmapImageRep(cgImage: cgImage)
    guard let data = bitmap.representation(using: .png, properties: [.compressionFactor: 0.9]) else {
        fatalError("Could not encode icon PNG")
    }

    let variantURL = outputDirectory.appendingPathComponent(name)
    try data.write(to: variantURL)
    if install {
        try data.write(to: appIconPath)
    }
    print("\(install ? "installed" : "wrote") \(variantURL.path)")
}

let ink = color(0x1a1714)
let espresso = color(0x2b1c18)
let blackCherry = color(0x32151e)
let coral = color(0xe16f45)
let rust = color(0xb9442d)
let amber = color(0xf0b54d)
let cream = color(0xf3ead8)
let cyan = color(0x48c4b7)
let blue = color(0x2378c6)
let violet = color(0x6f49d8)
let shadow = color(0x000000, alpha: 0.3)

func drawJankedPhotoMark(tilePalette: [NSColor], brokenCore: Bool, accentSlash: NSColor) {
    drawLinearGradient(CGRect(x: 0, y: 0, width: canvasSize, height: canvasSize), top: blackCherry, bottom: ink)
    drawRadialGlow(center: point(540, 560), radius: 460, color: coral)
    drawRadialGlow(center: point(310, 780), radius: 320, color: cyan)

    withShadow(color: shadow, blur: 34, offset: CGSize(width: 0, height: -18)) {
        fillRect(CGRect(x: 178, y: 174, width: 668, height: 676), color: cream, radius: 74)
    }

    fillRect(CGRect(x: 210, y: 206, width: 604, height: 612), color: color(0x211b18), radius: 54)

    let cells: [(CGRect, NSColor)] = [
        (CGRect(x: 246, y: 590, width: 174, height: 190), tilePalette[0]),
        (CGRect(x: 436, y: 590, width: 134, height: 190), tilePalette[1]),
        (CGRect(x: 586, y: 590, width: 192, height: 190), tilePalette[2]),
        (CGRect(x: 246, y: 406, width: 128, height: 168), tilePalette[3]),
        (CGRect(x: 390, y: 406, width: 216, height: 168), tilePalette[4]),
        (CGRect(x: 622, y: 406, width: 156, height: 168), tilePalette[5]),
        (CGRect(x: 246, y: 244, width: 210, height: 146), tilePalette[6]),
        (CGRect(x: 472, y: 244, width: 112, height: 146), tilePalette[7]),
        (CGRect(x: 600, y: 244, width: 178, height: 146), tilePalette[8])
    ]

    for (rect, cellColor) in cells {
        fillRect(rect, color: cellColor, radius: 22)
    }

    drawPolygon(
        [point(246, 390), point(420, 574), point(246, 574)],
        fill: color(0xf7cf73)
    )
    drawPolygon(
        [point(456, 244), point(606, 406), point(456, 390)],
        fill: color(0x45a39b)
    )
    drawPolygon(
        [point(584, 244), point(778, 390), point(600, 390)],
        fill: color(0xdf5c3d)
    )

    if brokenCore {
        drawPolygon(
            [point(406, 430), point(528, 586), point(616, 470), point(554, 358)],
            fill: color(0x17120f),
            stroke: cream.withAlphaComponent(0.18),
            lineWidth: 12
        )
    }

    drawSlash(point(270, 300), point(738, 754), width: 42, color: accentSlash.withAlphaComponent(0.95))
    drawSlash(point(314, 260), point(782, 714), width: 15, color: cream.withAlphaComponent(0.5))
    drawSlash(point(304, 768), point(788, 284), width: 22, color: color(0x12100e, alpha: 0.42))
}

try render(name: "jankify-mosaic.png", install: true) {
    drawJankedPhotoMark(
        tilePalette: [coral, amber, cyan, violet, rust, cream, blue, amber, coral],
        brokenCore: true,
        accentSlash: color(0xffd15c)
    )
}

try render(name: "jankify-rough.png") {
    drawJankedPhotoMark(
        tilePalette: [cream, rust, amber, cyan, coral, violet, espresso, blue, cream],
        brokenCore: false,
        accentSlash: color(0x55e0d1)
    )
}

try render(name: "jankify-hot.png") {
    drawJankedPhotoMark(
        tilePalette: [amber, coral, rust, color(0xf6d091), espresso, cream, coral, amber, rust],
        brokenCore: true,
        accentSlash: color(0x5bd4ff)
    )
}
