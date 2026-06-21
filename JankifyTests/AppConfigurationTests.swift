import XCTest
@testable import Jankify

final class AppConfigurationTests: XCTestCase {
    func testBuiltAppDefinesLaunchScreenConfiguration() {
        let launchScreen = Bundle.main.object(
            forInfoDictionaryKey: "UILaunchScreen"
        ) as? [String: Any]

        XCTAssertEqual(launchScreen?["UIColorName"] as? String, "LaunchBackground")
    }

    func testBuiltAppSupportsEveryInterfaceOrientation() {
        let expected = Set([
            "UIInterfaceOrientationPortrait",
            "UIInterfaceOrientationPortraitUpsideDown",
            "UIInterfaceOrientationLandscapeLeft",
            "UIInterfaceOrientationLandscapeRight"
        ])
        let phone = Bundle.main.object(
            forInfoDictionaryKey: "UISupportedInterfaceOrientations"
        ) as? [String]
        let pad = Bundle.main.object(
            forInfoDictionaryKey: "UISupportedInterfaceOrientations~ipad"
        ) as? [String]

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
