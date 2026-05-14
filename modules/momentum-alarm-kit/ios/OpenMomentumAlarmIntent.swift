import Foundation

#if canImport(AppIntents) && canImport(AlarmKit)
import AppIntents
import UIKit

/**
 * AppIntent bound to AlarmKit's "secondary button" — when the user taps
 * "Open Momentum" on the alarm alert, this fires and deep-links into the
 * app at `momentum://alarm/<id>`, which React Navigation routes to
 * AlarmRingingScreen for the NFC dismiss flow.
 *
 * PHASE B WORK — Apple's AppIntent API for AlarmKit's custom buttons may
 * differ slightly from the WWDC 2025 announcement. Verify against shipping
 * docs and adjust the `perform()` return type if needed.
 */
@available(iOS 26.0, *)
struct OpenMomentumAlarmIntent: AppIntent {
  static let title: LocalizedStringResource = "Open Momentum"
  static let openAppWhenRun: Bool = true

  @Parameter(title: "Alarm ID")
  var alarmId: String

  init() {}

  init(alarmId: String) {
    self.alarmId = alarmId
  }

  func perform() async throws -> some IntentResult {
    guard let url = URL(string: "momentum://alarm/\(alarmId)") else {
      return .result()
    }
    await MainActor.run {
      UIApplication.shared.open(url, options: [:], completionHandler: nil)
    }
    return .result()
  }
}

#endif
