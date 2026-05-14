# Alarm Workflow — iOS

How a Momentum alarm wakes the device, shows the ringing screen, and plays
audio on iOS. The model splits on iOS version because Apple's `AlarmKit`
framework (WWDC 2025) is the only path to true alarm-clock behaviour, and it
only exists on iOS 26+.

---

## Overview: Two Independent Backends, One Dispatcher

The shared scheduler facade ([src/services/scheduler.ts](../src/services/scheduler.ts))
routes all platform calls into [src/services/scheduler/ios.ts](../src/services/scheduler/ios.ts),
which dispatches each alarm to one of two backends at scheduling time:

| Backend | OS range | What rings the phone | Status |
|---|---|---|---|
| **AlarmKit** | iOS 26+ | Native `AlarmManager.shared` — system alert, rings through Silent/Focus, Lock-Screen takeover | Skeleton in place; Swift bodies pending Phase B (Mac required) |
| **Notification barrage** | iOS 15–25 | 5 × `expo-notifications` with `interruptionLevel: 'timeSensitive'`, spaced 30 s apart | Active |

Both backends converge on the same outcome: `momentum://alarm/<id>` deep link
→ React Navigation → `AlarmRingingScreen` → NFC dismiss → `PostAlarmBlock`.

**Relevant files**
- [src/services/scheduler/ios.ts](../src/services/scheduler/ios.ts) — dispatcher + barrage scheduler
- [modules/momentum-alarm-kit/index.ts](../modules/momentum-alarm-kit/index.ts) — JS bridge to AlarmKit
- [modules/momentum-alarm-kit/ios/MomentumAlarmKitModule.swift](../modules/momentum-alarm-kit/ios/MomentumAlarmKitModule.swift) — Expo module entry
- [modules/momentum-alarm-kit/ios/AlarmKitBridge.swift](../modules/momentum-alarm-kit/ios/AlarmKitBridge.swift) — guarded AlarmKit calls
- [modules/momentum-alarm-kit/ios/OpenMomentumAlarmIntent.swift](../modules/momentum-alarm-kit/ios/OpenMomentumAlarmIntent.swift) — AppIntent for the "Open Momentum" button
- [src/app/AlarmRingingScreen.tsx](../src/app/AlarmRingingScreen.tsx) — NFC scan + dismiss logic
- [ios/momentumapp/Info.plist](../ios/momentumapp/Info.plist) — usage descriptions + URL scheme
- [ios/momentumapp/momentumapp.entitlements](../ios/momentumapp/momentumapp.entitlements) — NFC + AlarmKit (Phase B) capabilities

---

## Path 1 — AlarmKit (iOS 26+)

### Scheduling

`scheduler/ios.ts` checks `AlarmKit.isAlarmKitAvailable()`. If `true`, it
calls `AlarmKit.scheduleAlarm({ id, fireDate, weekdays, title, sound })`.
The native side translates this into AlarmKit primitives:

- `Alarm.Schedule.fixed(Date)` for one-off alarms.
- `Alarm.Schedule.relative(...)` with weekly recurrence for repeating alarms.
- `AlarmPresentation.Alert` with **two buttons**:
  - **Stop** (mandatory — Apple does not allow alarm-class apps to remove
    this; tapping it dismisses without entering the app).
  - **Open Momentum** (secondary), bound to the custom `OpenMomentumAlarmIntent`
    AppIntent. Tapping it deep-links to `momentum://alarm/<id>`.
- `AlarmManager.shared.schedule(id:schedule:attributes:)` registers the alarm.

### Firing

At the scheduled time, iOS itself rings the alarm — the app does not need to
be open or even running. The system displays the AlarmKit alert full-screen
on the Lock Screen (and in the Dynamic Island on supported devices), plays
the alarm sound through `STREAM_ALARM`-equivalent routing, and bypasses
Silent / Focus.

### User reaches the app

Two user-initiated paths into the app:

1. **Tap "Open Momentum"** → `OpenMomentumAlarmIntent.perform()` opens
   `momentum://alarm/<id>` → React Navigation pushes `AlarmRingingScreen`.
2. **Tap "Stop"** → alarm dismissed without entering the app. The user
   doesn't see `AlarmRingingScreen`; on next app open the absence of an
   `nfc` dismiss row in `alarm_logs` lets the server treat the fire as an
   emergency-unblock-equivalent.

### Dismissal

`AlarmRingingScreen` runs the existing NFC scan loop. On a successful tap:

1. NFC service reads UID and verifies ownership against `nfc_tags`.
2. `alarmLogStore.dismissNfc(alarm, uid)` writes the dismiss record.
3. `AlarmKit.stopAlarm(alarm.id)` is called from JS — this is `AlarmManager.shared.stop(id:)`
   on the native side, which silences the still-ringing alarm.
4. Navigation pushes `PostAlarmBlock`.

Emergency dismissal calls the same `AlarmKit.stopAlarm(id)` after `dismissEmergency()`.

---

## Path 2 — Notification Barrage (iOS 15–25)

iOS without AlarmKit gives you a notification, not a takeover. To approximate
alarm-clock behaviour we fan out **5 notifications spaced 30 seconds apart**,
all with the same `alarmId` in their data payload.

### Scheduling

For each fire time (today's date for one-off, or each weekday for recurring),
`scheduler/ios.ts` schedules 5 `expo-notifications` entries:

```ts
{
  content: {
    title: alarm.label || 'Alarm',
    body: 'Tap your Momentum tag to dismiss.',
    data: { alarmId: alarm.id },
    sound: `${alarm.sound}.caf`,            // bundled audio (Phase B drops the .caf)
    interruptionLevel: 'timeSensitive',
    categoryIdentifier: 'alarm',
  },
  trigger: { type: DATE, date: fire + i * 30s },   // i = 0..4
}
```

### Firing

At each of the 5 trigger times iOS posts a notification:

- `interruptionLevel: 'timeSensitive'` — bypasses Focus modes (including Sleep
  Focus) when the user has granted the Time Sensitive Notifications permission.
- `categoryIdentifier: 'alarm'` — instructs iOS to render with alarm-class
  styling on the Lock Screen.
- `sound: chime.caf` — plays the chosen alarm sound at default notification
  volume. (Limitation: cannot exceed the system notification volume; this is
  not as loud as AlarmKit's `STREAM_ALARM`-equivalent.)

If the user does not respond to the first notification, the second fires
30 s later, then the third, and so on — five aggressive prompts within
2 minutes. This makes the alarm hard to sleep through even without AlarmKit.

### User reaches the app

Tapping any of the 5 notifications fires
`Notifications.addNotificationResponseReceivedListener` → `navigateToAlarmRinging(alarmId)`
→ `AlarmRingingScreen`. The remaining notifications cancel automatically
when the alarm is dismissed (see Cancellation below).

### Dismissal

Identical to AlarmKit's path from step 1 onward. `AlarmKit.stopAlarm(id)`
is a safe no-op on iOS < 26, so the existing call in `AlarmRingingScreen`
does nothing here — the notifications are cancelled by
`Notifications.cancelScheduledNotificationAsync` inside `cancelAlarm`.

---

## How It Bypasses Silent Mode and Do Not Disturb

### AlarmKit path

AlarmKit is treated by iOS as alarm-class media (same privilege bucket as
the system Clock app):

- **Silent / Ring switch** — ignored. AlarmKit rings at the alarm volume
  the user set in Settings → Sounds & Haptics.
- **Focus modes (Sleep, Do Not Disturb, Work, etc.)** — all bypassed by
  default. Apple categorises alarms as "Time Critical" at the system level.
- **Low Power Mode** — alarm still fires; iOS schedules it at the kernel
  level.
- **App killed / device rebooted before fire time** — AlarmKit alarms
  survive both. They live in the system alarm registry, not in the app
  process.

### Notification barrage path

Weaker, but still bypasses most user settings:

- **Silent / Ring switch** — bypassed; iOS plays notification sounds for
  `timeSensitive` notifications even on silent in most contexts.
- **Focus modes** — bypassed when the user has granted the Time Sensitive
  Notifications permission (prompted on first install). Without that
  permission, Focus modes can suppress the notifications.
- **Do Not Disturb** — same as Focus: bypassed with permission.
- **Low Power Mode** — notifications still fire.
- **App killed** — notifications still fire; they live in the system
  notification scheduler, not in the app.
- **Device reboot** — notifications survive reboot.

### iOS-level permissions required

| Setting | Where granted | What it unlocks |
|---|---|---|
| Notifications (alert + sound) | First app launch | Notifications appear at all |
| Time Sensitive Notifications | Settings → Notifications → Momentum | Bypass of Focus / DND for the barrage path |
| AlarmKit authorization | First scheduled alarm (iOS 26+) | AlarmKit can schedule + ring |
| `NSAlarmKitUsageDescription` | Declared in Info.plist | Required for AlarmKit permission prompt |

---

## NFC on iOS — Different UX from Android

`react-native-nfc-manager` is the same library on both platforms, but the
OS-level NFC UX differs:

- **Android**: when `AlarmRingingScreen` calls `readTagUid()`, the device
  silently activates the NFC reader. The user just taps the physical tag.
- **iOS**: `readTagUid()` triggers the **system NFC sheet** — a modal that
  says "Hold iPhone near the item" with a Cancel button. The user taps the
  physical tag *and* dismisses the sheet (the sheet auto-dismisses on a
  successful read).

This is enforced by Apple and cannot be removed. The current
`AlarmRingingScreen` UX is acceptable on iOS — the system sheet acts as a
clear "tap your tag now" indicator. No code change required, but worth
knowing for design discussions.

---

## Cancellation

Both backends cancel on alarm toggle off / edit / delete via the same JS
entry point:

```
cancelAlarm(alarmId)
  → AlarmKit.cancelAlarm(alarmId)                    // no-op on iOS < 26
  → Notifications.getAllScheduledNotificationsAsync  // find matching alarmId
  → cancelScheduledNotificationAsync for each        // cancels all 5 barrage entries
```

`rescheduleAll` cancels everything across both backends and rebuilds from
the current alarm list. Cheap and safe to call repeatedly — both paths are
idempotent.

---

## Dismissal Flow (Both Backends)

1. User on `AlarmRingingScreen`. NFC scan loop is running.
2. User taps NFC tag → system NFC sheet completes → UID returned to JS.
3. JS verifies UID against `nfc_tags` (Supabase RLS-enforced).
4. `alarmLogStore.dismissNfc(alarm, uid)` writes the dismiss record.
5. `AlarmKit.stopAlarm(alarm.id)` is called — on iOS 26+ this silences the
   ringing AlarmKit alarm; on iOS < 26 it is a no-op.
6. Any pending notifications for this alarm are cancelled.
7. Navigation pushes `PostAlarmBlock` with the block countdown.

Emergency dismissal skips step 3 and writes `dismissed_via = 'emergency'`.

---

## Current Status & Phase B Outlook

**Phase A (shipped):**
- 5-notification barrage active on all iOS versions.
- AlarmKit module compiles and links; `isAlarmKitAvailable()` returns `false`
  until Phase B fills in the Swift bodies.
- Info.plist + `momentum://` URL scheme registered.
- `AlarmRingingScreen` calls `AlarmKit.stopAlarm(id)` on dismiss (safe no-op).

**Phase B (pending Mac access):**
- Fill in `AlarmKitBridge.swift` with real `AlarmManager.shared` calls.
- Add `com.apple.developer.alarmkit` entitlement (verify exact key with Apple
  docs at implementation time).
- Convert `src/assets/sounds/*.wav` → `.caf` via `afconvert`, add to Xcode
  "Copy Bundle Resources".
- Test on physical iOS 26+ device (simulator AlarmKit support is incomplete).

See [docs/alarm-ios-plan.md](alarm-ios-plan.md) for the full implementation
plan and Phase B execution checklist.
