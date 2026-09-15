import Foundation
import StoreKit
#if canImport(UIKit)
import UIKit
#endif

/// Device-local App Store review cadence.
///
/// Eligible only after real use: several sessions, about a week since first open,
/// and a few meaningful successes. StoreKit still decides whether a sheet appears.
@MainActor
final class ReviewPromptPolicy {
    struct Requirements: Equatable, Sendable {
        var minimumSessions: Int
        var minimumUseAge: TimeInterval
        var minimumMeaningfulEvents: Int
        var requestCooldown: TimeInterval

        /// Portfolio default: strategic, non-intrusive.
        static let strategic = Requirements(
            minimumSessions: 3,
            minimumUseAge: 7 * 24 * 60 * 60,
            minimumMeaningfulEvents: 2,
            requestCooldown: 120 * 24 * 60 * 60
        )
    }

    private enum Key {
        static let firstUse = "reviewPrompt.firstUse"
        static let sessions = "reviewPrompt.sessions"
        static let lastSession = "reviewPrompt.lastSession"
        static let events = "reviewPrompt.meaningfulEvents"
        static let lastRequest = "reviewPrompt.lastRequest"
        static let lastVersion = "reviewPrompt.lastVersion"
        static let pendingVersion = "reviewPrompt.pendingVersion"
    }

    private static let sessionSeparation: TimeInterval = 6 * 60 * 60
    private let defaults: UserDefaults
    private let requirements: Requirements
    private let keyPrefix: String
    private let notificationCenter: NotificationCenter
    private let forceEligible: Bool
    private let requestReview: @MainActor () -> Bool
    private var foregroundObserver: NSObjectProtocol?

    init(
        defaults: UserDefaults = .standard,
        requirements: Requirements = .strategic,
        keyPrefix: String = "jankify",
        notificationCenter: NotificationCenter = .default,
        forceEligible: Bool? = nil,
        requestReview: (@MainActor () -> Bool)? = nil
    ) {
        self.defaults = defaults
        self.requirements = requirements
        self.keyPrefix = keyPrefix
        self.notificationCenter = notificationCenter
        self.forceEligible = forceEligible ?? Self.debugForceEligible
        self.requestReview = requestReview ?? Self.requestReviewInForegroundScene
        restorePendingRequestIfNeeded()
    }

    private func key(_ base: String) -> String {
        keyPrefix.isEmpty ? base : "\(keyPrefix).\(base)"
    }

    func recordSession(now: Date = .now) {
        let last = defaults.object(forKey: key(Key.lastSession)) as? Date
        if let last, now.timeIntervalSince(last) < Self.sessionSeparation {
            retryPendingRequestIfPossible()
            return
        }
        if defaults.object(forKey: key(Key.firstUse)) == nil {
            defaults.set(now, forKey: key(Key.firstUse))
        }
        defaults.set(defaults.integer(forKey: key(Key.sessions)) + 1, forKey: key(Key.sessions))
        defaults.set(now, forKey: key(Key.lastSession))
        retryPendingRequestIfPossible()
    }

    func recordMeaningfulEvent() {
        defaults.set(defaults.integer(forKey: key(Key.events)) + 1, forKey: key(Key.events))
    }

    func shouldRequest(appVersion: String, now: Date = .now) -> Bool {
        guard !appVersion.isEmpty,
              defaults.string(forKey: key(Key.lastVersion)) != appVersion
        else { return false }

        if forceEligible {
            return true
        }

        guard let first = defaults.object(forKey: key(Key.firstUse)) as? Date,
              defaults.integer(forKey: key(Key.sessions)) >= requirements.minimumSessions,
              defaults.integer(forKey: key(Key.events)) >= requirements.minimumMeaningfulEvents,
              now.timeIntervalSince(first) >= requirements.minimumUseAge
        else { return false }

        if let last = defaults.object(forKey: key(Key.lastRequest)) as? Date,
           now.timeIntervalSince(last) < requirements.requestCooldown {
            return false
        }
        return true
    }

    func markRequest(appVersion: String, now: Date = .now) {
        defaults.set(now, forKey: key(Key.lastRequest))
        defaults.set(appVersion, forKey: key(Key.lastVersion))
    }

    @discardableResult
    func attemptRequest(appVersion: String, now: Date = .now) -> Bool {
        guard shouldRequest(appVersion: appVersion, now: now) else {
            if hasPendingRequest(appVersion: appVersion) {
                clearPendingRequest()
            }
            return false
        }

        guard requestReview() else {
            defaults.set(appVersion, forKey: key(Key.pendingVersion))
            installForegroundObserverIfNeeded()
            return false
        }

        markRequest(appVersion: appVersion, now: now)
        clearPendingRequest()
        return true
    }

    func hasPendingRequest(appVersion: String) -> Bool {
        defaults.string(forKey: key(Key.pendingVersion)) == appVersion
    }

    /// Record a success and, if eligible, request a review after a short calm delay.
    func noteSuccessAndRequestIfAppropriate(
        delaySeconds: Double = 2.5,
        isCalm: @escaping @MainActor () -> Bool = { true }
    ) {
        recordMeaningfulEvent()
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? ""
        guard shouldRequest(appVersion: version) else { return }

        Task { @MainActor in
            try? await Task.sleep(nanoseconds: UInt64(delaySeconds * 1_000_000_000))
            guard !Task.isCancelled, isCalm(), shouldRequest(appVersion: version) else { return }
            attemptRequest(appVersion: version)
        }
    }

    private static var debugForceEligible: Bool {
        #if DEBUG
        ProcessInfo.processInfo.arguments.contains("-ForceReviewPrompt")
            || ProcessInfo.processInfo.environment["FORCE_REVIEW_PROMPT"] == "1"
        #else
        false
        #endif
    }

    private static func requestReviewInForegroundScene() -> Bool {
        #if canImport(UIKit)
        guard let scene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first(where: { $0.activationState == .foregroundActive })
        else { return false }

        AppStore.requestReview(in: scene)
        return true
        #else
        return false
        #endif
    }

    private func restorePendingRequestIfNeeded() {
        guard let version = defaults.string(forKey: key(Key.pendingVersion)) else { return }
        guard version == currentAppVersion else {
            defaults.removeObject(forKey: key(Key.pendingVersion))
            return
        }
        installForegroundObserverIfNeeded()
    }

    private func retryPendingRequestIfPossible() {
        guard let version = defaults.string(forKey: key(Key.pendingVersion)) else { return }
        guard version == currentAppVersion else {
            clearPendingRequest()
            return
        }
        attemptRequest(appVersion: version)
    }

    private func installForegroundObserverIfNeeded() {
        #if canImport(UIKit)
        guard foregroundObserver == nil else { return }
        foregroundObserver = notificationCenter.addObserver(
            forName: UIScene.didActivateNotification,
            object: nil,
            queue: .main
        ) { [self] _ in
            MainActor.assumeIsolated {
                retryPendingRequestIfPossible()
            }
        }
        #endif
    }

    private func clearPendingRequest() {
        defaults.removeObject(forKey: key(Key.pendingVersion))
        if let foregroundObserver {
            notificationCenter.removeObserver(foregroundObserver)
            self.foregroundObserver = nil
        }
    }

    private var currentAppVersion: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? ""
    }
}
