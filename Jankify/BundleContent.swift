import Foundation

enum BundleContent {
    static let appURL = URL(string: "jankify://app/index.html")!

    static func webDirectoryURL(in bundle: Bundle) throws -> URL {
        guard let webDirectory = bundle.url(forResource: "Web", withExtension: nil) else {
            throw BundleContentError.missingIndex
        }
        guard FileManager.default.fileExists(
            atPath: webDirectory.appendingPathComponent("index.html").path
        ) else {
            throw BundleContentError.missingIndex
        }
        return webDirectory
    }

    static func indexURL(in bundle: Bundle) throws -> URL {
        let webDirectory = try webDirectoryURL(in: bundle)
        return webDirectory.appendingPathComponent("index.html")
    }
}

enum BundleContentError: Error {
    case missingIndex
}
