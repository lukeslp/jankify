#!/usr/bin/env swift
import AppKit

let size = NSSize(width: 1024, height: 1024)
let outputDirectory = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
    .appendingPathComponent("icon-variants", isDirectory: true)
try FileManager.default.createDirectory(
    at: outputDirectory,
    withIntermediateDirectories: true
)

func color(_ red: CGFloat, _ green: CGFloat, _ blue: CGFloat) -> NSColor {
    NSColor(srgbRed: red / 255, green: green / 255, blue: blue / 255, alpha: 1)
}

func triangle(_ points: [NSPoint], fill: NSColor) {
    let path = NSBezierPath()
    path.move(to: points[0])
    path.line(to: points[1])
    path.line(to: points[2])
    path.close()
    fill.setFill()
    path.fill()
}

func render(name: String, draw: () -> Void) throws {
    guard let bitmap = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: 1024,
        pixelsHigh: 1024,
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 32
    ), let context = NSGraphicsContext(bitmapImageRep: bitmap) else {
        fatalError("Could not create icon context")
    }

    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = context
    draw()
    context.flushGraphics()
    NSGraphicsContext.restoreGraphicsState()

    guard let data = bitmap.representation(using: .png, properties: [:]) else {
        fatalError("Could not encode icon")
    }
    try data.write(to: outputDirectory.appendingPathComponent(name))
}

let paper = color(244, 237, 224)
let ink = color(26, 23, 20)
let coral = color(193, 80, 46)
let gold = color(219, 158, 54)
let teal = color(49, 116, 110)

try render(name: "triangle.png") {
    paper.setFill()
    NSBezierPath(rect: NSRect(origin: .zero, size: size)).fill()
    NSShadow().apply {
        $0.shadowColor = ink.withAlphaComponent(0.18)
        $0.shadowBlurRadius = 28
        $0.shadowOffset = NSSize(width: 0, height: -18)
    }
    triangle(
        [NSPoint(x: 512, y: 812), NSPoint(x: 202, y: 222), NSPoint(x: 822, y: 222)],
        fill: coral
    )
    triangle(
        [NSPoint(x: 512, y: 670), NSPoint(x: 354, y: 340), NSPoint(x: 670, y: 340)],
        fill: paper
    )
}

try render(name: "mosaic.png") {
    ink.setFill()
    NSBezierPath(rect: NSRect(origin: .zero, size: size)).fill()
    let colors = [coral, gold, teal, paper]
    for row in 0..<3 {
        for column in 0..<3 {
            let rect = NSRect(
                x: 180 + CGFloat(column) * 224,
                y: 180 + CGFloat(row) * 224,
                width: 188,
                height: 188
            )
            colors[(row + column) % colors.count].setFill()
            NSBezierPath(roundedRect: rect, xRadius: 28, yRadius: 28).fill()
        }
    }
}

try render(name: "pixels.png") {
    coral.setFill()
    NSBezierPath(rect: NSRect(origin: .zero, size: size)).fill()
    let widths: [CGFloat] = [160, 272, 384, 496, 608]
    for (index, width) in widths.enumerated() {
        let rect = NSRect(
            x: (1024 - width) / 2,
            y: 176 + CGFloat(index) * 132,
            width: width,
            height: 96
        )
        (index.isMultiple(of: 2) ? paper : ink).setFill()
        NSBezierPath(roundedRect: rect, xRadius: 18, yRadius: 18).fill()
    }
}

extension NSShadow {
    func apply(_ configure: (NSShadow) -> Void) {
        configure(self)
        set()
    }
}
