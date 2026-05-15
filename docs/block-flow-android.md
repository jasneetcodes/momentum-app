# App Blocking Workflow — Android

How Momentum blocks selected apps during a Lock In session or a post-alarm
window, and how the system survives app kill / device reboot / app
uninstall+reinstall.

---

## Overview: One Service, Two Callers

App blocking is one mechanism with two callers:

1. **Mode sessions** ([src/app/(main)/LockInScreen.tsx](../src/app/(main)/LockInScreen.tsx))
   — activated manually, deactivated by NFC tap (or emergency unblock).
2. **Post-alarm blocks** ([src/app/PostAlarmBlockScreen.tsx](../src/app/PostAlarmBlockScreen.tsx))
   — auto-started when an alarm is dismissed, auto-ended when the
   countdown hits zero.

Both call into the same JS facade ([src/services/appBlocking.ts](../src/services/appBlocking.ts))
which routes to the native Kotlin module on Android.

| Caller | Trigger to start | Trigger to end |
|---|---|---|
| Mode session | "Lock In" button tap (or future NFC activation) | NFC tag tap on LockInScreen, or emergency unblock |
| Post-alarm block | Successful NFC dismiss on AlarmRingingScreen | Countdown reaches zero, or screen unmount |

---

## Architecture

```
┌───────────────────────────────────────────────┐
│         src/services/appBlocking.ts           │   JS facade
└──────────────────────┬────────────────────────┘
                       │
                       ▼
┌───────────────────────────────────────────────┐
│         AppBlockingModule.kt                  │   @ReactMethod bridge
│  startBlocking / stopBlocking / isBlocking    │
│  isAccessibilityServiceEnabled / openSettings │
└──────────────────────┬────────────────────────┘
                       │
       ┌───────────────┼───────────────┐
       │               │               │
       ▼               ▼               ▼
 AppBlocking      AppBlocking     AppBlockingState
 ForegroundSvc    Service         (SharedPreferences)
   ↓ keeps           ↓ blocks         ↑ persisted set
   process alive     foreground       read on every event,
   + persistent      apps via         survives process death
   notification      BlockedAppActivity
                     launch
```

**Relevant files**

- [src/services/appBlocking.ts](../src/services/appBlocking.ts) — JS facade
- [android/app/src/main/java/com/momentumapp/AppBlockingModule.kt](../android/app/src/main/java/com/momentumapp/AppBlockingModule.kt) — JS bridge
- [android/app/src/main/java/com/momentumapp/AppBlockingService.kt](../android/app/src/main/java/com/momentumapp/AppBlockingService.kt) — AccessibilityService that detects window changes
- [android/app/src/main/java/com/momentumapp/AppBlockingForegroundService.kt](../android/app/src/main/java/com/momentumapp/AppBlockingForegroundService.kt) — keeps the process alive, START_STICKY
- [android/app/src/main/java/com/momentumapp/AppBlockingState.kt](../android/app/src/main/java/com/momentumapp/AppBlockingState.kt) — SharedPreferences-backed persisted state
- [android/app/src/main/java/com/momentumapp/BlockedAppActivity.kt](../android/app/src/main/java/com/momentumapp/BlockedAppActivity.kt) — full-screen takeover screen
- [android/app/src/main/java/com/momentumapp/AppBlockingBootReceiver.kt](../android/app/src/main/java/com/momentumapp/AppBlockingBootReceiver.kt) — restores blocking after device reboot
- [android/app/src/main/res/xml/app_blocking_service_config.xml](../android/app/src/main/res/xml/app_blocking_service_config.xml) — AccessibilityService meta-config
- [android/app/src/main/res/layout/activity_blocked_app.xml](../android/app/src/main/res/layout/activity_blocked_app.xml) — takeover screen layout
- [android/app/src/main/AndroidManifest.xml](../android/app/src/main/AndroidManifest.xml) — service registrations + permissions

---

## Permission Flow

Android Accessibility Services **cannot** be granted programmatically — the
user must enable Momentum in Settings → Accessibility. Both callers gate
on this:

1. `appBlocking.isPermissionGranted()` checks
   `Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES` for our component.
2. If `false`, the UI shows an Alert: "Momentum needs Accessibility access
   to block apps during your session." with an "Open Settings" action.
3. `appBlocking.requestPermission()` opens `Settings.ACTION_ACCESSIBILITY_SETTINGS`.
4. After the user toggles it on and returns, the calling flow proceeds.

The Accessibility grant persists across app updates and reboots — it's a
system-level grant tied to the package. Reinstalling the app revokes it.

---

## Mode Session Lifecycle

1. User taps **Lock In** → `LockInScreen.handleLockIn()` runs
2. Conflict check: if `alarm_logs.block_ends_at > now()`, reject with a
   message naming the conflicting end time
3. Permission check: if Accessibility off, prompt the user → return
4. `modeSessionStore.activate(mode, 'button')` writes the
   `mode_sessions` row (Supabase)
5. `appBlocking.startBlocking(mode.apps, mode.block_type, mode.label)`
   → `AppBlockingModule.startBlocking()`:
   - Writes blocked set + block_type + session_label into
     [AppBlockingState](../android/app/src/main/java/com/momentumapp/AppBlockingState.kt)
     via SharedPreferences
   - Starts [AppBlockingForegroundService](../android/app/src/main/java/com/momentumapp/AppBlockingForegroundService.kt)
     which posts a persistent low-priority notification "Locked in —
     `<mode label>`"
6. UI switches to the active state (darker background, live HH:MM:SS
   timer, pulsing ring, "Tap your tag to finish")
7. `LockInScreen.startScan()` starts the NFC read loop on the screen
8. User taps registered NFC tag → `modeSessionStore.deactivateNfc(uid)`
   writes the row (Supabase) → `appBlocking.stopBlocking()` clears
   `AppBlockingState` and stops the FGS → UI returns to default state

---

## Post-Alarm Block Lifecycle

1. Alarm fires → AlarmRingingScreen → user taps NFC to dismiss
2. `alarmLogStore.dismissNfc(alarm, uid)` writes the dismiss row and
   computes `block_ends_at` = now + `block_duration_minutes`
3. **Mode-priority check**: if a mode session is active, AlarmRingingScreen
   navigates to Home (not PostAlarmBlock) — mode is already blocking, no
   need for a second block on top.
4. Otherwise navigation → `PostAlarmBlockScreen`
5. On mount: `appBlocking.startBlocking(alarm.apps, alarm.block_type,
   alarm.label || 'Post-alarm block')`
6. Countdown ticks each second until `block_ends_at`
7. Timer reaches 0 → `appBlocking.stopBlocking()` → `markBlockComplete()`
   → navigate to Home

---

## How Blocking Works Under the Hood

`AppBlockingService` extends `AccessibilityService` and listens for
`AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED`. On every event:

1. Read the foreground package name from the event
2. Read the persisted `AppBlockingState` from SharedPreferences
3. If `isBlocking == false`: return
4. If package is whitelisted (own package, launcher, system Settings,
   dialer, system UI): return — we never block these
5. Compute `shouldBlock`:
   - blacklist mode → `packages.contains(pkg)`
   - whitelist mode → `!packages.contains(pkg)`
6. If yes, launch [BlockedAppActivity](../android/app/src/main/java/com/momentumapp/BlockedAppActivity.kt)
   with `FLAG_ACTIVITY_NEW_TASK | FLAG_ACTIVITY_CLEAR_TOP |
   FLAG_ACTIVITY_NO_HISTORY` and an `EXTRA_PACKAGE_NAME` extra so the
   takeover screen can show the blocked app's label and icon.

Reading state on **every event** (rather than holding it in memory) is
the key to surviving process death: when Android kills our process for
memory and restarts the AccessibilityService later, the next event reads
the up-to-date persisted state with no JS round-trip and no missing
config.

### Whitelisted system exceptions

These packages are never blocked, even if listed in a user's blacklist:

```
com.google.android.apps.nexuslauncher  (Pixel launcher)
com.android.launcher                   (AOSP)
com.android.launcher3
com.android.settings                   (so user can reach Accessibility)
com.android.permissioncontroller
com.google.android.permissioncontroller
com.android.dialer                     (emergency call)
com.google.android.dialer
com.android.systemui
android
```

Plus `com.momentumapp` itself — we don't block ourselves.

---

## The Blocked-App Takeover Screen

`BlockedAppActivity` is a native Android Activity (not React) so it
displays instantly without a JS-bridge round-trip.

UI:

- App icon resolved from `packageManager.getApplicationIcon(pkg)` (falls
  back to a lock icon if the package was uninstalled)
- Title: `"<App Name> is locked"` (label resolved via PackageManager)
- Subtitle: `"<Session Label> — tap your Momentum tag to end the session."`
- Footnote: `"Uninstalling and reinstalling won't help. Apps stay locked
  while you're locked in."`
- Single button: `"Back to home"` → starts `ACTION_MAIN` + `CATEGORY_HOME`
  intent and finishes the activity

Behavior:

- `launchMode="singleTask"` + `excludeFromRecents="true"`: consecutive
  blocked-app opens collapse into one instance; the takeover doesn't
  pollute the recents list
- `onBackPressed()` is overridden to invoke the home action (no back-to-
  blocked-app bypass)
- Re-tapping the blocked app from recents re-fires the takeover (the
  Accessibility event still fires)

---

## Why Uninstall + Reinstall Doesn't Bypass

The blocked-package list lives in **SharedPreferences**, not in the OS
installed-apps registry. The package name `com.instagram.android` stays
in the blocked set even if the app is uninstalled.

Sequence when a user tries to bypass:

1. User opens Settings → Apps → Instagram → Uninstall → app is removed
2. The package name `com.instagram.android` remains in our persisted set
3. User opens Play Store → installs Instagram again
4. User taps the Instagram icon → Android fires
   `TYPE_WINDOW_STATE_CHANGED` for `com.instagram.android`
5. `AppBlockingService` reads state, sees the package is still blocked,
   launches `BlockedAppActivity`
6. The user sees the takeover screen immediately — no grace window, no
   one-launch-free pass

This is the architectural property the user asked for. There is no API
to defeat it short of disabling our Accessibility Service entirely, which
requires going into system Settings (and is itself trackable as an
adversarial action if we ever want to detect it).

---

## What Survives What

| Event | Blocking continues? | How |
|---|---|---|
| Momentum app force-stopped from recents | ✅ Yes | `onTaskRemoved()` does NOT call `stopSelf`; FGS notification stays; Accessibility keeps watching |
| Momentum process killed for memory (OOM) | ✅ Yes | FGS is `START_STICKY` — Android restarts it; new instance reads persisted state and resumes |
| Device reboot mid-session | ✅ Yes | `AppBlockingBootReceiver` fires on `BOOT_COMPLETED`, restarts the FGS, which reads persisted state |
| User uninstalls a blocked app | ✅ Yes | Package name stays in `AppBlockingState`; reinstall + open → takeover |
| User disables Accessibility in Settings | ❌ No | This is the only end-user escape hatch; intentionally |
| Momentum app uninstalled | ❌ No | Accessibility grant is revoked with the package |

---

## Known Limitations

- **~100-200 ms race window** between the foreground app appearing and
  our `BlockedAppActivity` taking over. The user briefly sees the
  blocked app's splash or last-frame snapshot before the takeover
  appears. `notificationTimeout=50` in the AccessibilityService config
  is tuned to minimize this; cannot fully eliminate.
- **Settings → App Info → Open**: technically a user can navigate to the
  blocked app's App Info screen and tap Open. We whitelist
  `com.android.settings` so the user can reach Accessibility settings,
  which means the Settings UI itself is not blocked. A future
  enhancement could detect "App Info screen open for a blocked package"
  via `TYPE_WINDOW_CONTENT_CHANGED` and intercept it.
- **Cannot block split-screen / picture-in-picture** — only the
  foreground task receives `TYPE_WINDOW_STATE_CHANGED`. Background
  panels remain open until they're brought to focus.
- **Cannot block notifications** — the AccessibilityService blocks
  foreground activity, not notification posting. The user still sees
  notification banners from blocked apps. Tapping them does fire the
  takeover.
- **System apps** (Settings, Phone, Camera) — not blockable by design.
  Whitelisted explicitly.

---

## Future Enhancements

- Detect "Open" button taps on Settings → App Info → `<blocked pkg>` and
  intercept (close the gap above).
- Re-block Play Store pages for blocked apps so the user cannot even
  initiate a reinstall mid-session.
- Background NFC scanning so the tag can deactivate the session from any
  screen (not just LockInScreen). Currently scoped to LockInScreen for
  simplicity.

See [phase5 plan](./alarm-ios-plan.md) for context on how this fits the
overall MVP, and [block-flow-ios.md](./block-flow-ios.md) for the iOS
counterpart (deferred to Phase 5B).
