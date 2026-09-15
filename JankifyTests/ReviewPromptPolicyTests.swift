import UIKit
import XCTest
@testable import Jankify

@MainActor
final class ReviewPromptPolicyTests: XCTestCase {
    func testPendingRequestRetriesOnceWhenForegroundReturns() {
        let suiteName = "ReviewPromptPolicyTests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        let center = NotificationCenter()
        var sceneAvailable = false
        var requestCount = 0
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "test"
        let policy = ReviewPromptPolicy(
            defaults: defaults,
            requirements: .init(
                minimumSessions: 0,
                minimumUseAge: 0,
                minimumMeaningfulEvents: 0,
                requestCooldown: 0
            ),
            keyPrefix: "test",
            notificationCenter: center,
            requestReview: {
                requestCount += 1
                return sceneAvailable
            }
        )
        policy.recordSession(now: Date(timeIntervalSince1970: 1))

        XCTAssertFalse(policy.attemptRequest(appVersion: version))
        XCTAssertTrue(policy.hasPendingRequest(appVersion: version))
        XCTAssertTrue(policy.shouldRequest(appVersion: version))

        sceneAvailable = true
        center.post(name: UIScene.didActivateNotification, object: nil)

        XCTAssertEqual(requestCount, 2)
        XCTAssertFalse(policy.hasPendingRequest(appVersion: version))
        XCTAssertFalse(policy.shouldRequest(appVersion: version))

        center.post(name: UIScene.didActivateNotification, object: nil)
        XCTAssertEqual(requestCount, 2)
        defaults.removePersistentDomain(forName: suiteName)
    }

    func testDebugOverrideStillMarksOnlyAfterDispatch() {
        let suiteName = "ReviewPromptPolicyTests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        var dispatched = false
        let policy = ReviewPromptPolicy(
            defaults: defaults,
            forceEligible: true,
            requestReview: { dispatched }
        )

        XCTAssertFalse(policy.attemptRequest(appVersion: "1.2.3"))
        XCTAssertTrue(policy.shouldRequest(appVersion: "1.2.3"))

        dispatched = true
        XCTAssertTrue(policy.attemptRequest(appVersion: "1.2.3"))
        XCTAssertFalse(policy.shouldRequest(appVersion: "1.2.3"))
        defaults.removePersistentDomain(forName: suiteName)
    }
}
