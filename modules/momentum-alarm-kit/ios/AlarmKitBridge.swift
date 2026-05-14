import Foundation

#if canImport(AlarmKit)
import AlarmKit

/**
 * Real AlarmKit calls live here. The `#if canImport(AlarmKit)` guard means
 * this file is fully excluded from compilation on toolchains that don't
 * ship the AlarmKit framework (Xcode < 16, building against iOS 25 SDK).
 *
 * PHASE B WORK — when Mac access is available, fill in the bodies below.
 * See https://developer.apple.com/documentation/alarmkit (verify the actual
 * symbol names against current Apple docs — WWDC 2025 announcement names
 * may have shifted in the shipping SDK).
 */
@available(iOS 26.0, *)
enum AlarmKitBridge {
  static func isAvailable() -> Bool {
    // Phase A: returns true once linked. The JS dispatcher already gates
    // on the OS version check via `isAlarmKitAvailable()`.
    return true
  }

  static func requestAuthorization() async throws -> String {
    // TODO Phase B:
    //   let status = try await AlarmManager.shared.requestAuthorization()
    //   return mapStatusToString(status)   // "authorized" | "denied" | "notDetermined"
    return "notDetermined"
  }

  static func schedule(_ input: [String: Any]) async throws {
    // TODO Phase B:
    //   let id = input["id"] as! String
    //   let fireDate = Date(timeIntervalSince1970: (input["fireDate"] as! Double) / 1000)
    //   let title = input["title"] as! String
    //   let weekdays = input["weekdays"] as? [Int] ?? []
    //
    //   let schedule: Alarm.Schedule = weekdays.isEmpty
    //     ? .fixed(fireDate)
    //     : .relative(...)   // weekly recurrence
    //
    //   let stopButton = AlarmButton(text: "Stop", textColor: .white, systemImageName: "stop.fill")
    //   let openButton = AlarmButton(
    //     text: "Open Momentum",
    //     textColor: .white,
    //     systemImageName: "iphone.gen3"
    //   )
    //
    //   let presentation = AlarmPresentation.Alert(
    //     title: LocalizedStringResource(stringLiteral: title),
    //     stopButton: stopButton,
    //     secondaryButton: openButton,
    //     secondaryButtonBehavior: .custom(OpenMomentumAlarmIntent(alarmId: id))
    //   )
    //
    //   try await AlarmManager.shared.schedule(
    //     id: UUID(uuidString: id) ?? UUID(),
    //     schedule: schedule,
    //     attributes: AlarmAttributes(presentation: presentation, tintColor: .accent)
    //   )
  }

  static func cancel(id: String) async throws {
    // TODO Phase B:
    //   guard let uuid = UUID(uuidString: id) else { return }
    //   try await AlarmManager.shared.cancel(id: uuid)
  }

  static func cancelAll() async throws {
    // TODO Phase B:
    //   for alarm in try await AlarmManager.shared.alarms {
    //     try await AlarmManager.shared.cancel(id: alarm.id)
    //   }
  }

  static func stop(id: String) async throws {
    // TODO Phase B — called from JS after NFC dismiss:
    //   guard let uuid = UUID(uuidString: id) else { return }
    //   try await AlarmManager.shared.stop(id: uuid)
  }
}

#endif
