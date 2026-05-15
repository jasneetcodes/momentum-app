import ExpoModulesCore

/**
 * Expo module entry for Screen Time / FamilyControls. The actual
 * framework calls live in `ScreenTimeBridge.swift`, fully guarded by
 * `#if canImport(FamilyControls)` + `@available(iOS 16.0, *)`. This file
 * is the JS-facing surface: it routes to the guarded bridge when running
 * on iOS 16+ with FamilyControls available, otherwise returns sentinel
 * "unavailable" values so the JS facade falls through to a no-op.
 *
 * Phase 5A: bridge methods return sentinel values (isAvailable=false,
 * etc.) because the Swift bridge has stubbed bodies. Phase 5B (Mac
 * required) fills in the real FamilyControls calls.
 */
public class MomentumScreenTimeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MomentumScreenTime")

    AsyncFunction("isAvailable") { () -> Bool in
      #if canImport(FamilyControls)
      if #available(iOS 16.0, *) {
        return ScreenTimeBridge.isAvailable()
      }
      #endif
      return false
    }

    AsyncFunction("requestAuthorization") { () async throws -> String in
      #if canImport(FamilyControls)
      if #available(iOS 16.0, *) {
        return try await ScreenTimeBridge.requestAuthorization()
      }
      #endif
      return "denied"
    }

    AsyncFunction("startBlocking") { (bundleIds: [String], blockType: String) async throws in
      #if canImport(FamilyControls)
      if #available(iOS 16.0, *) {
        try ScreenTimeBridge.startBlocking(bundleIds: bundleIds, blockType: blockType)
      }
      #endif
    }

    AsyncFunction("stopBlocking") { () async throws in
      #if canImport(FamilyControls)
      if #available(iOS 16.0, *) {
        try ScreenTimeBridge.stopBlocking()
      }
      #endif
    }

    AsyncFunction("isBlocking") { () -> Bool in
      #if canImport(FamilyControls)
      if #available(iOS 16.0, *) {
        return ScreenTimeBridge.isBlocking()
      }
      #endif
      return false
    }
  }
}
