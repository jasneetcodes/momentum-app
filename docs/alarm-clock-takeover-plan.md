# True alarm-clock behavior (Android + iOS)

## Context

Right now alarms just send a `Time-Sensitive` local notification via `expo-notifications`. Tapping it opens the app to `AlarmRingingScreen` which plays the looping sound — but the phone never *rings* on its own. Silent mode, Focus, or just being asleep all defeat it. The goal is real alarm-clock behavior: rings loudly even on a locked silent phone, auto-takes-over the lock screen, and requires NFC to fully dismiss.

The two platforms need fundamentally different machinery:

- **Android** — permissive. With `@notifee/react-native` + a native wake flag and a foreground audio service, we get the full Sleep-as-Android / Alarmy experience.
- **iOS** — historically locked down. Apple's new **AlarmKit** framework (iOS 26+, WWDC 2025) finally exposes the same alarm capabilities the system Clock app uses: rings through Silent + Focus, full-screen lock-screen alert, custom button to open the app. We wrap it in a native Swift Expo module. For iOS 25 and below we degrade to a notification barrage.

## Critical files to be modified

### New files
- `src/services/scheduler/index.ts` — platform-dispatching facade (replaces existing `src/services/scheduler.ts` content)
- `src/services/scheduler/android.ts` — Notifee implementation
- `src/services/scheduler/ios.ts` — AlarmKit native module wrapper + iOS fallback
- `modules/momentum-alarm-kit/` — Expo native module for iOS AlarmKit
  - `ios/MomentumAlarmKitModule.swift`
  - `ios/AlarmKitBridge.swift` (the actual AlarmKit calls, isolated for `#if canImport(AlarmKit)` guard)
  - `expo-module.config.json`
  - `index.ts` (TS interface)
- `android/app/src/main/java/com/momentumapp/AlarmAudioService.kt` — Android foreground service that loops the alarm audio while ringing

### Edited files
- `src/services/scheduler.ts` — becomes a thin re-export of `./scheduler/index`
- `src/stores/alarmStore.ts` — no changes (already calls scheduleAlarm/cancelAlarm)
- `src/app/AlarmRingingScreen.tsx` — stop foreground audio service on dismiss (Android), call AlarmKit `stop` on dismiss (iOS)
- `App.js` — register deep-link handler `momentum://alarm/{id}` → navigates to AlarmRinging
- `app.json` — add `scheme: "momentum"`, add the new module plugin, drop `expo-notifications` plugin
- `android/app/src/main/java/com/momentumapp/MainActivity.kt` — add `setShowWhenLocked(true)` + `setTurnScreenOn(true)` in `onCreate`; add `KeyguardManager.requestDismissKeyguard` for older APIs
- `android/app/src/main/AndroidManifest.xml` — add `USE_FULL_SCREEN_INTENT` permission + register `AlarmAudioService` + register deep-link intent filter
- `ios/momentumapp/Info.plist` — add `NSAlarmKitUsageDescription` key, `CFBundleURLTypes` for the `momentum` scheme
- `ios/momentumapp/momentumapp.entitlements` — add AlarmKit capability key (`com.apple.developer.alarmkit` once verified against Apple docs)
- `package.json` — add `@notifee/react-native`, drop `expo-notifications` (or keep for non-alarm use)

## Approach

### 1. Android — Notifee + wake flags + foreground audio service

**Reuse existing:** `src/services/sound.ts` already wires `expo-av` for looping playback. We continue using it on the React side after the app opens, but ALSO need a native foreground service for the case where the screen is locked and the JS bundle isn't yet running (audio must start the instant the alarm fires).

**Notifee config per alarm:**
```ts
notifee.createTriggerNotification({
  id: `alarm-${alarm.id}-${dayIndex}`,
  title: alarm.label || 'Alarm',
  body: 'Tap your Momentum tag to dismiss.',
  data: { alarmId: alarm.id },
  android: {
    channelId: 'alarms',
    importance: AndroidImportance.HIGH,
    category: AndroidCategory.ALARM,
    fullScreenAction: { id: 'default', launchActivity: 'default' },
    pressAction: { id: 'default', launchActivity: 'default' },
    loopSound: true,
    sound: `alarms/${alarm.sound}`,
    ongoing: true,
    autoCancel: false,
  },
}, {
  type: TriggerType.TIMESTAMP,
  timestamp: nextFireTime(alarm, dayIndex).getTime(),
  alarmManager: { allowWhileIdle: true },
});
```

For recurring alarms (weekly), schedule one entry per selected day with the next-occurrence timestamp; on `AlarmRingingScreen` mount, re-schedule the same weekday for next week (Notifee doesn't have a true `WEEKLY` trigger — manual reschedule is the standard pattern).

**MainActivity changes** add lock-screen takeover so the full-screen intent actually wakes + shows over the keyguard.

**Foreground service** (`AlarmAudioService.kt`) is started by Notifee's full-screen intent receiver. It plays `alarm.sound` on a loop at max stream volume via `MediaPlayer` with `AudioAttributes.USAGE_ALARM`. Stops when the JS app sends a stop event through a native module bridge (which it does on successful NFC dismiss).

### 2. iOS — AlarmKit native module

**The wrapper module** (`modules/momentum-alarm-kit`) exposes:
```ts
export const isAlarmKitAvailable: () => boolean // iOS >= 26
export const requestAuthorization: () => Promise<'authorized' | 'denied'>
export const scheduleAlarm: (input: AlarmKitInput) => Promise<void>
export const cancelAlarm: (id: string) => Promise<void>
export const cancelAll: () => Promise<void>
```

**Swift bridge** wraps `AlarmKit.AlarmManager.shared`:
- Authorization via `requestAuthorization()`
- Schedule with `Alarm.Schedule.fixed(date)` for one-off, `Alarm.Schedule.relative(...)` with weekly recurrence for repeating
- `AlarmPresentation.Alert(title:, stopButton:, secondaryButton:)` where the **secondary button** is bound to a custom `OpenMomentumAlarmIntent` AppIntent (lives in the same module). That intent's `perform()` opens `momentum://alarm/{id}` → React Navigation deep link → `AlarmRingingScreen`.
- The mandatory Stop button is a forced concession to Apple's UX (we can't fully require NFC at OS level — Apple won't allow that). When Stop is pressed without entering the app, we treat it as an emergency-unblock-equivalent server-side once the user next opens the app and we see the alarm fired but no NFC dismiss log exists.

**iOS < 26 fallback** lives in `src/services/scheduler/ios.ts`: if `isAlarmKitAvailable()` returns false, schedule via `expo-notifications` as a barrage — 5 consecutive `TimeSensitive` notifications spaced 30s apart, each with `sound: alarm.sound + '.caf'`. The user gets aggressive alerting + tap-to-open, just not the full alarm-clock experience.

### 3. Deep linking glue

Add `linking` config to `NavigationContainer` in `App.js`:
```ts
const linking = {
  prefixes: ['momentum://'],
  config: {
    screens: {
      AlarmRinging: 'alarm/:alarmId',
    },
  },
};
```
Both platforms' full-screen-intent / AlarmKit-intent paths route through this single entry, so `AlarmRingingScreen` is the one source of truth for the in-app NFC dismiss UX.

### 4. Permissions/entitlements (manually patched native files, since this is bare workflow)

- Android: `USE_FULL_SCREEN_INTENT`, foreground service declaration with `foregroundServiceType="mediaPlayback"`
- iOS: `NSAlarmKitUsageDescription` in Info.plist, AlarmKit entitlement key in `momentumapp.entitlements`

## Sequence (so we don't break the build mid-way)

1. **Android-only first.** Land Notifee + foreground service + wake flags + manifest changes. Test end-to-end on Pixel (alarm rings on locked silent phone, NFC dismisses). This is ~1 working day and unblocks immediate testing.
2. **Deep-link plumbing.** Add scheme + `linking` config. Both platforms benefit, and it's a small change that's easy to verify.
3. **iOS native module scaffold.** Generate the Expo module skeleton, add Info.plist + entitlement, wire JS surface to no-op stubs. Verifies build before any AlarmKit calls.
4. **iOS AlarmKit implementation.** Authorization, schedule, cancel, custom intent button → deep link. Verify on iOS 26 device.
5. **iOS fallback (iOS < 26).** Barrage scheduler via `expo-notifications`.

## Verification

**Android (Pixel):**
1. Build: `npm run android`
2. Grant notification permission on first launch
3. Create an alarm for 90 seconds from now
4. Press the phone's power button to lock + black the screen
5. Mute the phone (silent mode)
6. Wait — at the scheduled time the phone should: vibrate, scream the alarm sound, light up the screen, and present `AlarmRingingScreen` over the lock screen with the pulsing NFC ring
7. Tap NFC tag → audio stops, navigates to `PostAlarmBlock`, countdown runs

**iOS 26 device (when available):**
1. Build via Xcode against iPhone running iOS 26+
2. Grant AlarmKit authorization when first scheduling an alarm
3. Set up the same 90s alarm test
4. Lock + silence the phone, wait
5. Expected: AlarmKit system alert rings through silent mode, shows on Lock Screen + Dynamic Island. Tapping "Open Momentum" deep-links to `AlarmRingingScreen`. NFC dismiss flow runs as before.
6. Test the OS Stop button: confirm we record this as an emergency-style dismissal on the next app open.

**iOS 25 fallback (simulator or older device):**
1. Confirm `isAlarmKitAvailable()` returns false
2. Schedule an alarm; expect 5 consecutive time-sensitive notifications, each with the chosen alarm sound
3. Tap any → deep-links to `AlarmRingingScreen`

## Risks / open items

- **Apple's exact entitlement key for AlarmKit** — need to verify against current developer docs before final commit. Plan currently assumes `com.apple.developer.alarmkit` based on Apple's naming conventions; real key may differ.
- **AlarmKit may require iOS 26+ even at build time** (`#if canImport(AlarmKit)` and `@available(iOS 26.0, *)` guards everywhere). Plan handles this with availability checks; verify Xcode/iOS toolchain on the user's Mac supports it.
- **The user works dev-only on a Windows Pixel-first setup.** iOS work requires a Mac for the actual build/test cycle. Phase 1 (Android) is fully testable on the existing setup; iOS Phases 3–5 effectively need Mac access. Worth confirming before scheduling that work.
- **NFC-only dismissal cannot be enforced on iOS** — AlarmKit always offers a Stop button. The plan accepts this and treats Stop-without-NFC as an emergency-unblock-equivalent. Same trade-off would apply to Android's notification "Stop" action; we mitigate by simply not offering one.
