import XCTest
@testable import Jankify

final class AppConfigurationTests: XCTestCase {
    func testBuiltAppDefinesLaunchScreenConfiguration() {
        let launchScreen = Bundle.main.object(
            forInfoDictionaryKey: "UILaunchScreen"
        ) as? [String: Any]

        XCTAssertEqual(launchScreen?["UIColorName"] as? String, "LaunchBackground")
    }

    func testBuiltAppSupportsEveryInterfaceOrientation() throws {
        let expected = Set([
            "UIInterfaceOrientationPortrait",
            "UIInterfaceOrientationPortraitUpsideDown",
            "UIInterfaceOrientationLandscapeLeft",
            "UIInterfaceOrientationLandscapeRight"
        ])
        let infoURL = Bundle.main.bundleURL.appendingPathComponent("Info.plist")
        let data = try Data(contentsOf: infoURL)
        let info = try XCTUnwrap(
            PropertyListSerialization.propertyList(
                from: data,
                options: [],
                format: nil
            ) as? [String: Any]
        )
        let phone = info["UISupportedInterfaceOrientations"] as? [String]
        let pad = info["UISupportedInterfaceOrientations~ipad"] as? [String]

        XCTAssertEqual(Set(phone ?? []), expected)
        XCTAssertEqual(Set(pad ?? []), expected)
    }

    func testBuiltAppDeclaresExportCompliance() {
        let usesEncryption = Bundle.main.object(
            forInfoDictionaryKey: "ITSAppUsesNonExemptEncryption"
        ) as? Bool

        XCTAssertEqual(usesEncryption, false)
    }
}
