import Foundation

enum BundleContent {
    static func indexURL(in bundle: Bundle) throws -> URL {
        guard
            let webDirectory = bundle.url(forResource: "Web", withExtension: nil),
            FileManager.default.fileExists(
                atPath: webDirectory.appendingPathComponent("index.html").path
            )
        else {
            throw BundleContentError.missingIndex
        }
        return webDirectory.appendingPathComponent("index.html")
    }
}

enum BundleContentError: Error {
    case missingIndex
}
