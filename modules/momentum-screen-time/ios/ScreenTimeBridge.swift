import Foundation

#if canImport(FamilyControls)
import FamilyControls
import ManagedSettings

/**
 * Real Screen Time / FamilyControls calls. Compiled only when the
 * FamilyControls framework is available (iOS 16+ SDK + entitlement).
 *
 * Phase 5A status: methods exist with stub bodies so the module compiles
 * on Windows-less CI. Phase 5B (Mac required) replaces these with real
 * AuthorizationCenter + ManagedSettingsStore calls.
 *
 * Phase 5B TODO checklist:
 *   1. Add Family Controls capability in Xcode → entitlements file.
 *   2. Add NSFamilyControlsUsageDescription to Info.plist.
 *   3. Implement `requestAuthorization` via AuthorizationCenter.shared.requestAuthorization(for: .individual).
 *   4. Replace `startBlocking` with code that resolves bundleIds → ApplicationTokens
 *      via FamilyActivityPicker (presented from an iOS-only mode-edit screen)
 *      and writes them to ManagedSettingsStore().shield.applications.
 *      NOTE: Apple does not let third-party apps map bundleId → ApplicationToken
 *      programmatically. The user MUST select apps via FamilyActivityPicker,
 *      and we store the resulting opaque tokens (per mode, in a new
 *      `apps_ios_tokens` column — see plan).
 *   5. Add a Shield Configuration extension target with a
 *      ShieldConfigurationDataSource subclass that renders Momentum-branded
 *      shield UI (dark bg, #01BAEF accent, "<App> is locked", "Tap your
 *      Momentum tag to end the session.").
 */
@available(iOS 16.0, *)
enum ScreenTimeBridge {
  static let store = ManagedSettingsStore()

  static func isAvailable() -> Bool {
    // Phase 5A: always false. Phase 5B: return AuthorizationCenter.shared.authorizationStatus == .approved.
    return false
  }

  static func requestAuthorization() async throws -> String {
    // Phase 5A: no-op. Phase 5B:
    //   try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
    //   return AuthorizationCenter.shared.authorizationStatus == .approved ? "authorized" : "denied"
    return "denied"
  }

  static func startBlocking(bundleIds: [String], blockType: String) throws {
    // Phase 5A: no-op. Phase 5B: write resolved tokens to store.shield.applications.
    // Whitelist semantics use store.shield.applicationCategories with .specific(...).
  }

  static func stopBlocking() throws {
    // Phase 5A: no-op. Phase 5B: store.clearAllSettings()
  }

  static func isBlocking() -> Bool {
    // Phase 5A: always false. Phase 5B: store.shield.applications != nil && !store.shield.applications!.isEmpty
    return false
  }
}
#else
@available(iOS 16.0, *)
enum ScreenTimeBridge {
  static func isAvailable() -> Bool { false }
  static func requestAuthorization() async throws -> String { "denied" }
  static func startBlocking(bundleIds: [String], blockType: String) throws {}
  static func stopBlocking() throws {}
  static func isBlocking() -> Bool { false }
}
#endif
