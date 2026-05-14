import ExpoModulesCore

/**
 * Expo module entry for AlarmKit. The actual AlarmKit framework calls live
 * in `AlarmKitBridge.swift`, fully guarded by `#if canImport(AlarmKit)` +
 * `@available(iOS 26.0, *)`. This file is the JS-facing surface: it routes
 * to the guarded bridge when running on iOS 26+, otherwise returns sentinel
 * "unavailable" values so the JS dispatcher falls back to notifications.
 */
public class MomentumAlarmKitModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MomentumAlarmKit")

    AsyncFunction("isAlarmKitAvailable") { () -> Bool in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        return AlarmKitBridge.isAvailable()
      }
      #endif
      return false
    }

    AsyncFunction("requestAuthorization") { () async throws -> String in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        return try await AlarmKitBridge.requestAuthorization()
      }
      #endif
      return "denied"
    }

    AsyncFunction("scheduleAlarm") { (input: [String: Any]) async throws in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        try await AlarmKitBridge.schedule(input)
      }
      #endif
    }

    AsyncFunction("cancelAlarm") { (id: String) async throws in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        try await AlarmKitBridge.cancel(id: id)
      }
      #endif
    }

    AsyncFunction("cancelAll") { () async throws in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        try await AlarmKitBridge.cancelAll()
      }
      #endif
    }

    AsyncFunction("stopAlarm") { (id: String) async throws in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        try await AlarmKitBridge.stop(id: id)
      }
      #endif
    }
  }
}
