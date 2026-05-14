# iOS Alarm Workflow — Phase 4 (iOS) Implementation Plan

## Context

Phase 4 is complete on Android — alarms fire reliably across all four
app/screen-state combinations, bypass silent mode / DND via `STREAM_ALARM`,
and dismiss via NFC. This plan covers the iOS counterpart.

iOS has two paths:

- **iOS 26+** — Apple's new **AlarmKit** framework (WWDC 2025) gives true
  alarm-clock behaviour: rings through Silent/Focus, full-screen lock-screen
  alert, runs natively without the app open. This is the equivalent of the
  Notifee + foreground-service combo on Android.
- **iOS < 26** — no AlarmKit available. The best achievable is an aggressive
  **notification barrage** with `timeSensitive` interruption level.

Decisions confirmed:
- Full AlarmKit + fallback scope.
- No regular Mac access right now → plan splits into **Phase A (Windows-doable)**
  and **Phase B (Mac-required)**.

The previous iOS scheduler ([src/services/scheduler/ios.ts](../src/services/scheduler/ios.ts))
was a one-shot stub using `expo-notifications` — single notification, no
barrage, generic sound, no AlarmKit branch. JS scaffolding (alarmStore,
AlarmRingingScreen, NFC service, deep-link routing) is already platform-agnostic
and ready to receive iOS-driven alarm events.

---

## Architecture (3 layers)

```
                ┌────────────────────────────────────────┐
                │      src/services/scheduler/ios.ts     │
                │  (dispatcher: checks AlarmKit ready)   │
                └───────────┬─────────────────┬──────────┘
                            │                 │
              iOS 26+ ────► │                 │ ◄──── iOS 15–25
                            ▼                 ▼
            ┌────────────────────────┐   ┌────────────────────────┐
            │ momentum-alarm-kit     │   │ Notification barrage   │
            │ (native Swift module)  │   │ (expo-notifications)   │
            │                        │   │                        │
            │ AlarmManager.shared    │   │ 5 × timeSensitive      │
            │ Alarm.Schedule.fixed   │   │ spaced 30s apart       │
            │ OpenMomentumAlarmIntent│   │ custom .caf sound      │
            └────────────┬───────────┘   └───────────┬────────────┘
                         │                           │
                         └────────────┬──────────────┘
                                      ▼
                         momentum://alarm/<id> deep link
                                      │
                                      ▼
                              AlarmRingingScreen
                              (NFC scan + dismiss)
```

---

## Phase A — Windows-doable (DONE)

### A1. Enhanced notification barrage (iOS < 26 fallback)

Replace the one-shot notification in `ios.ts` with a 5-notification barrage:

- Spaced 30s apart, all carrying the same `alarmId`.
- `interruptionLevel: 'timeSensitive'` on every one (bypasses Focus + DND
  once user grants the entitlement).
- `categoryIdentifier: 'alarm'` for proper Lock Screen rendering.
- `sound: '<alarm.sound>.caf'` — references a bundled audio file (Phase B
  task to actually drop the files into the Xcode bundle; Phase A just wires
  the filename).
- `cancelAlarm()` cancels all 5 (iterates by `alarmId`).

### A2. AlarmKit native module skeleton

Created the Expo module structure so the import path exists and the
dispatcher in `ios.ts` can branch. Swift files contain guarded stubs that
compile on Windows-less CI (returning `false` for `isAlarmKitAvailable`).

```
modules/momentum-alarm-kit/
├── package.json                          # local workspace package
├── expo-module.config.json               # Expo module manifest
├── index.ts                              # TS interface (the JS surface)
├── ios/
│   ├── MomentumAlarmKitModule.swift      # Expo module entry, defines bridge
│   ├── AlarmKitBridge.swift              # Real AlarmKit calls — fully
│   │                                     #   guarded by #if canImport(AlarmKit)
│   │                                     #   + @available(iOS 26.0, *)
│   └── OpenMomentumAlarmIntent.swift     # AppIntent for the "Open Momentum"
│                                         #   secondary button (deep-links
│                                         #   to momentum://alarm/<id>)
```

**TS surface in `index.ts`:**
```ts
export type AlarmKitInput = {
  id: string;
  fireDate: number;         // epoch ms
  weekdays?: number[];      // [] | undefined = one-off
  title: string;
  sound: string;            // 'chime' | 'bell' | ...
};

export function isAlarmKitAvailable(): Promise<boolean>;          // false on iOS < 26
export function requestAuthorization(): Promise<'authorized' | 'denied' | 'notDetermined'>;
export function scheduleAlarm(input: AlarmKitInput): Promise<void>;
export function cancelAlarm(id: string): Promise<void>;
export function cancelAll(): Promise<void>;
export function stopAlarm(id: string): Promise<void>;             // called on NFC dismiss
```

In Phase A, the Swift `isAlarmKitAvailable()` returns the result of an
availability check that compiles to `false` until the AlarmKit framework is
linked in Phase B — the dispatcher always falls through to the notification
barrage. This let the architecture land on Windows.

### A3. Dispatcher in ios.ts

```ts
import * as AlarmKit from 'momentum-alarm-kit';

export async function scheduleAlarm(alarm: Alarm): Promise<void> {
  await cancelAlarm(alarm.id);
  if (!alarm.is_active) return;

  if (await AlarmKit.isAlarmKitAvailable()) {
    await scheduleViaAlarmKit(alarm);   // Phase B activates this branch
  } else {
    await scheduleViaBarrage(alarm);    // Phase A barrage
  }
}
```

`cancelAlarm()` and `rescheduleAll()` mirror the branch.

### A4. Info.plist additions

```xml
<key>NSAlarmKitUsageDescription</key>
<string>Momentum schedules alarms that ring through Silent and Focus modes
so you can't sleep through them.</string>

<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>momentum</string>
    </array>
  </dict>
</array>
```

The URL scheme is currently configured only in `app.json` linking config —
making it explicit in Info.plist guarantees AlarmKit's AppIntent can open it.

### A5. AlarmRingingScreen — call `stopAlarm` on iOS

The screen calls `AlarmKit.stopAlarm(alarm.id)` on both NFC-success and
emergency-dismiss paths. Safe no-op on iOS < 26 and on Android.

---

## Phase B — Mac-required (defer until Mac access)

### B1. AlarmKit Swift implementation

Inside `modules/momentum-alarm-kit/ios/AlarmKitBridge.swift`:

```swift
#if canImport(AlarmKit)
import AlarmKit

@available(iOS 26.0, *)
enum AlarmKitBridge {
  static func isAvailable() -> Bool { true }
  static func requestAuthorization() async throws -> AuthorizationStatus { ... }
  static func schedule(_ input: AlarmKitInput) async throws { ... }
  static func cancel(id: String) async throws { ... }
  static func stop(id: String) async throws { ... }
}
#endif
```

Key AlarmKit calls:
- `AlarmManager.shared.requestAuthorization()`
- `Alarm.Schedule.fixed(Date(timeIntervalSince1970: fireDate / 1000))` for
  one-offs; `Alarm.Schedule.relative(...)` for weekday recurrence.
- `AlarmPresentation.Alert(title:, stopButton:, secondaryButton:)` where the
  secondary button is bound to `OpenMomentumAlarmIntent`.
- `AlarmManager.shared.schedule(...)` with the presentation + schedule.

### B2. OpenMomentumAlarmIntent AppIntent

```swift
@available(iOS 26.0, *)
struct OpenMomentumAlarmIntent: AppIntent {
  static let title: LocalizedStringResource = "Open Momentum"
  static let openAppWhenRun = true

  @Parameter(title: "Alarm ID") var alarmId: String

  func perform() async throws -> some IntentResult {
    let url = URL(string: "momentum://alarm/\(alarmId)")!
    await UIApplication.shared.open(url)
    return .result()
  }
}
```

### B3. Entitlement

Add to [ios/momentumapp/momentumapp.entitlements](../ios/momentumapp/momentumapp.entitlements):
```xml
<key>com.apple.developer.alarmkit</key>
<true/>
```

**CRITICAL TODO:** verify the exact entitlement key against current Apple
docs before submitting to TestFlight — Apple may have renamed it. If the key
differs, only this one line needs updating.

### B4. Custom alarm sound files

The existing sounds are in `src/assets/sounds/` (WAV). For iOS notifications
and AlarmKit they must be:
- ≤ 30 seconds
- CAF or WAV format
- Dropped into the Xcode project (added to "Copy Bundle Resources" build phase)

Convert with `afconvert` on Mac:
```
afconvert -f caff -d aac chime.wav chime.caf
```

### B5. Podfile target

Current target is 15.1. AlarmKit-guarded code compiles fine at 15.1 thanks
to `#if canImport(AlarmKit)` + `@available(iOS 26.0, *)`. **No Podfile bump
needed.** The module simply does nothing on iOS < 26.

---

## File map

### New files (Phase A)
- `modules/momentum-alarm-kit/package.json`
- `modules/momentum-alarm-kit/expo-module.config.json`
- `modules/momentum-alarm-kit/index.ts`
- `modules/momentum-alarm-kit/ios/MomentumAlarmKitModule.swift`
- `modules/momentum-alarm-kit/ios/AlarmKitBridge.swift` (stubbed bodies)
- `modules/momentum-alarm-kit/ios/OpenMomentumAlarmIntent.swift` (stubbed body)

### Modified files (Phase A)
- [src/services/scheduler/ios.ts](../src/services/scheduler/ios.ts) — dispatcher + barrage
- [src/app/AlarmRingingScreen.tsx](../src/app/AlarmRingingScreen.tsx) — call `stopAlarm` on dismiss
- [ios/momentumapp/Info.plist](../ios/momentumapp/Info.plist) — `NSAlarmKitUsageDescription` + `CFBundleURLTypes`
- [package.json](../package.json) — `"momentum-alarm-kit": "file:./modules/momentum-alarm-kit"`

### To modify (Phase B)
- `modules/momentum-alarm-kit/ios/AlarmKitBridge.swift` — fill in real AlarmKit calls
- `modules/momentum-alarm-kit/ios/OpenMomentumAlarmIntent.swift` — verify against shipping API
- [ios/momentumapp/momentumapp.entitlements](../ios/momentumapp/momentumapp.entitlements) — AlarmKit key
- Xcode project — add `.caf` sound files to "Copy Bundle Resources"

### Reused (no changes)
- [src/services/scheduler.ts](../src/services/scheduler.ts) — platform facade already routes correctly
- [src/stores/alarmStore.ts](../src/stores/alarmStore.ts) — calls `scheduleAlarm` platform-agnostically
- [src/services/nfc.ts](../src/services/nfc.ts) — `react-native-nfc-manager` already iOS-configured
- Deep-link routing in App.js / `navigateToAlarmRinging` — already in place

---

## Verification

### Phase A (no iOS 26 device needed)

Run on any iOS 15+ simulator or device:

1. Schedule an alarm 90 seconds out, kill the app.
2. Confirm 5 timeSensitive notifications fire ~30s apart starting at the
   scheduled time.
3. Tap any one → app opens → AlarmRingingScreen → NFC scan starts.
4. Tap NFC tag (or use emergency unblock in simulator) → all 5 notifications
   cancel; navigate to PostAlarmBlock.
5. Confirm `AlarmKit.isAlarmKitAvailable()` returns `false` and dispatcher
   takes the barrage branch (add a temporary log to verify).

### Phase B (needs Mac + iOS 26 device)

1. Build via Xcode against iPhone running iOS 26+.
2. First scheduling triggers AlarmKit authorization prompt.
3. Set 90s alarm, lock + silence phone, wait.
4. AlarmKit system alert appears on Lock Screen + Dynamic Island, rings
   through Silent and Focus.
5. Tap "Open Momentum" → AlarmRingingScreen via deep link.
6. NFC dismiss → `AlarmKit.stopAlarm(id)` succeeds → audio stops → PostAlarmBlock.
7. Verify Stop button path: tap Stop without opening app, then open app on
   next interaction → confirm alarm_logs has the fired event with no
   `dismissed_via='nfc'` row, treated as emergency-equivalent.

---

## Risks / open items

- **Apple's exact AlarmKit entitlement key** — assumed `com.apple.developer.alarmkit`.
  Verify against current Apple docs before submission. Single-line fix if wrong.
- **AlarmKit Swift API surface** — based on WWDC 2025 docs; real shipping API
  may have small differences. AlarmKitBridge.swift is the only file affected.
- **iOS notification barrage limits** — iOS may throttle 5 notifications in
  rapid succession in some Focus configurations. If observed in testing,
  reduce to 3 or change spacing.
- **NFC UX on iOS** — `react-native-nfc-manager` on iOS shows a system sheet
  ("Hold iPhone near tag") rather than continuous background scanning. This
  is OS-imposed and AlarmRingingScreen already handles it. No change needed,
  but the UX is different from Android.
- **Mac access required for Phase B** — Phase A ships and is useful in
  production for all iOS users until Mac time for Phase B.
