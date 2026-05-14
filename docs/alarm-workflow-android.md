# Alarm Workflow — Android

How a Momentum alarm wakes the device, shows the ringing screen, and plays
audio across all four app/screen-state combinations.

---

## Overview: Two Parallel Trigger Paths

Every alarm is scheduled with two independent mechanisms firing at the same
time. Each excels at a different state combination; together they cover all
four cases with no gaps.

| Path | Scheduled via | Best for |
|---|---|---|
| **Notifee full-screen intent** | `notifee.createTriggerNotification` with `fullScreenAction` | App killed or alive, **screen locked** |
| **AlarmManager → BroadcastReceiver → Foreground Service** | `AlarmAudioModule.scheduleAlarmActivity()` | App killed or alive, **screen unlocked** |

Both paths converge on the same outcome: `AlarmAudioService` running as a
foreground service (audio + activity launch) and `AlarmRingingScreen` open in
React Navigation.

**Relevant files**
- [src/services/scheduler/android.ts](../src/services/scheduler/android.ts) — JS scheduling
- [android/.../AlarmAudioModule.kt](../android/app/src/main/java/com/momentumapp/AlarmAudioModule.kt) — `scheduleAlarmActivity`, `cancelAlarmActivities`, `isKeyguardSecure`, `requestKeyguardDismiss`
- [android/.../AlarmTriggerReceiver.kt](../android/app/src/main/java/com/momentumapp/AlarmTriggerReceiver.kt) — BroadcastReceiver that starts the service
- [android/.../AlarmAudioService.kt](../android/app/src/main/java/com/momentumapp/AlarmAudioService.kt) — foreground service: audio + activity launch
- [android/.../MainActivity.kt](../android/app/src/main/java/com/momentumapp/MainActivity.kt) — lock-screen wake flags
- [src/services/alarmAudio.ts](../src/services/alarmAudio.ts) — JS bridge: `isKeyguardSecure`, `requestKeyguardDismiss`
- [src/app/AlarmRingingScreen.tsx](../src/app/AlarmRingingScreen.tsx) — keyguard dismissal logic + NFC scan loop

---

## The 4 Cases

### Case 1 — App alive, screen unlocked (most common)

**What fires:** Notifee delivers the trigger notification. The JS engine is
already running.

**Path:**
1. Notifee fires the `TIMESTAMP` trigger and emits a `DELIVERED` event.
2. `notifee.onForegroundEvent` in `android.ts` catches it.
3. JS calls `startNativeAlarmAudio(sound, alarmId)` → `AlarmAudioService.start()`.
4. JS calls `navigateToAlarmRinging(alarmId)` → React Navigation pushes
   `AlarmRingingScreen`.

The Notifee `fullScreenAction` and the AlarmManager broadcast both fire too,
but the activity is already in foreground so they are harmless no-ops (deduped
by `android:launchMode="singleTask"` on `MainActivity`).

---

### Case 2 — App alive, screen locked

**What fires:** Notifee's `fullScreenAction` full-screen intent. Android
honours `setFullScreenIntent()` as a true activity launch when the device is
locked or dozing.

**Path:**
1. Notifee fires the trigger and immediately launches `MainActivity` via the
   full-screen intent PendingIntent.
2. `MainActivity.applyAlarmWakeFlags()` runs on `onCreate` / `onNewIntent`:
   - `setShowWhenLocked(true)` — renders over the keyguard.
   - `setTurnScreenOn(true)` — wakes the display.
3. React Navigation deep-links on `momentum://alarm/<id>` → `AlarmRingingScreen`.
4. `notifee.onForegroundEvent` fires for DELIVERED → starts `AlarmAudioService`.
5. `AlarmRingingScreen` mounts → keyguard dismissal logic runs (see
   [Keyguard Dismissal & NFC Activation](#keyguard-dismissal--nfc-activation)).

The AlarmManager broadcast also fires, re-enters via `singleTask` (no-op) and
attempts `AlarmAudioService.start()` — safe duplicate call, service is already
running.

---

### Case 3 — App killed, screen locked

**What fires:** Notifee's `fullScreenAction` full-screen intent (same mechanism
as Case 2). Android allows the activity launch because the keyguard is active.

**Path:**
1. Notifee delivers the trigger notification and launches `MainActivity` via
   the full-screen intent.
2. The React/JS engine cold-starts. `notifee.onForegroundEvent` fires for
   DELIVERED → starts `AlarmAudioService` → audio begins.
3. `MainActivity.applyAlarmWakeFlags()` applies `setShowWhenLocked` /
   `setTurnScreenOn` as in Case 2 (no `requestDismissKeyguard` here).
4. React Navigation deep-links to `AlarmRingingScreen`.
5. `AlarmRingingScreen` mounts → keyguard dismissal logic runs (see
   [Keyguard Dismissal & NFC Activation](#keyguard-dismissal--nfc-activation)).

The AlarmManager broadcast also fires, starts `AlarmAudioService` (duplicate,
no-op), and its own `launchMainActivity()` call re-enters `singleTask`.

---

### Case 4 — App killed, screen unlocked *(previously the broken case)*

**Why the locked path fails here:** `setFullScreenIntent()` only launches the
activity as a full-screen takeover when the device is **locked**. On an
unlocked interactive screen Android degrades it to a heads-up notification —
this is intentional OS behaviour to prevent apps from hijacking the foreground.
A `PendingIntent.getActivity(...)` fired from AlarmManager is blocked by
Android 10+ Background Activity Launch (BAL) restrictions when the screen is
on.

**What fires instead:** `AlarmManager.setAlarmClock()` fires a
`PendingIntent.getBroadcast(...)` targeting `AlarmTriggerReceiver`.

**Path:**
1. AlarmManager fires `AlarmTriggerReceiver.onReceive()`.
2. The receiver calls `AlarmAudioService.start(soundRes, alarmId)`.
3. Starting a **foreground service grants a BAL exemption window**. Within
   that window `AlarmAudioService.launchMainActivity()` calls `startActivity()`
   with the `momentum://alarm/<id>` deep-link URI — this succeeds on an
   unlocked screen.
4. `MainActivity` cold-starts. React Navigation deep-links to
   `AlarmRingingScreen`. The foreground event handler starts audio (or audio
   is already playing from the service).

Notifee also fires and shows a heads-up notification as a fallback, which the
user can tap to open the app if the activity launch is delayed or suppressed by
an OEM.

---

## How It Bypasses Silent Mode and Do Not Disturb

### Audio stream: `STREAM_ALARM` at max volume

`AlarmAudioService` routes `MediaPlayer` through `AudioAttributes.USAGE_ALARM`
on the `STREAM_ALARM` stream. Android guarantees this stream:

- Ignores **ringer-silent / vibrate-only mode**.
- Is not suppressed by **Do Not Disturb (DND)** when the alarm stream volume
  is above zero (system Clock behaviour — Android treats `USAGE_ALARM` as
  exempted from DND by design).
- Bypasses most third-party "focus" or "bedtime" modes at the OS level.

The service pins the stream to max volume at start (`setStreamVolume(STREAM_ALARM, maxVol, 0)`)
and restores the original level on stop, so the user's ringer setting is
preserved after dismissal.

### Notification channel: `bypassDnd: true`, `CATEGORY_ALARM`

The Notifee channel (`CHANNEL_ID = "alarms"`) is created with:
```ts
bypassDnd: true           // channel-level DND override
importance: HIGH          // ensures heads-up delivery
visibility: PUBLIC        // shows on lock screen without redacting content
```
Combined with `AndroidCategory.ALARM` on the notification itself, the OS
treats these notifications as alarm-class events exempt from DND policies.

### `USE_FULL_SCREEN_INTENT` permission

Declared in `AndroidManifest.xml`. On Android 14+ this permission requires
explicit user grant via Settings → Special app access → Alarms & reminders.
`AlarmAudioModule.canUseFullScreenIntent()` checks this at runtime so the UI
can prompt if missing.

### `SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM`

Both declared. `setAlarmClock()` requires exact-alarm permission and bypasses
Doze / Battery Saver delays. The alarm fires at the exact millisecond regardless
of power-saving states (this is the same permission the system Clock app uses).

### Screen wake

`MainActivity.applyAlarmWakeFlags()` uses `setTurnScreenOn(true)` (API 27+) or
`FLAG_TURN_SCREEN_ON` (older) to force the display on when the alarm launches
the activity. `WAKE_LOCK` permission is declared in the manifest to support
this.

---

## Notification vs. Full-Screen Activity

When the alarm fires on a **locked** screen the ringing screen is what the
user sees — there is no visible notification UI. On an **unlocked** screen
Notifee will show a heads-up banner (because the full-screen intent degrades),
but `AlarmAudioService` simultaneously launches the activity from the
foreground-service BAL exemption, so the full-screen ringing UI appears on top.
The heads-up notification remains visible but becomes irrelevant.

The ongoing notification posted by `AlarmAudioService` itself
(`CHANNEL_ID = "alarms_audio_service"`, `IMPORTANCE_LOW`) is a required
foreground-service notification. It is intentionally low-importance so it sits
quietly in the shade and does not duplicate the alarm ringing UI.

---

## Keyguard Dismissal & NFC Activation

`requestDismissKeyguard()` is **not** called from `MainActivity` — it is
called from JS inside `AlarmRingingScreen` based on the device's lock type.
This lets the alarm UI render cleanly before any authentication prompt appears.

### How it works

On mount, `AlarmRingingScreen` calls `isKeyguardSecure()` (wraps
`KeyguardManager.isKeyguardSecure()`):

- **Returns `false` — no PIN / swipe lock**: `requestKeyguardDismiss()` is
  called immediately. The keyguard vanishes instantly (no prompt), the activity
  gains window focus, and the NFC scan loop already running on mount begins
  reading tags right away. No user interaction needed beyond tapping the tag.

- **Returns `true` — PIN, pattern, or biometric**: nothing is called on mount.
  The alarm screen renders over the keyguard with the ringing UI fully visible.
  The NFC ring area and "Tap your Momentum tag" instruction are wrapped in a
  `Pressable`. When the user taps that area, `requestKeyguardDismiss()` fires —
  the PIN/biometric prompt appears. After the user authenticates, the keyguard
  dismisses, the activity gains focus, and the NFC scan loop (retrying in the
  background at ~600 ms intervals) reads the tag on the next cycle.

### Why the scan loop retries while keyguard is active

`NfcManager.requestTechnology()` requires the activity to own window focus.
While the keyguard is active on a PIN-protected device, each retry throws an
error (no focus), which the `catch` block in `startScan()` silently swallows
and reschedules after 600 ms. Once the keyguard is dismissed, the next retry
succeeds and waits for a tag. No manual restart of the scan is needed.

### UX summary by lock type

| Device lock | What the user experiences |
|---|---|
| None / swipe | Alarm fires → screen shows → NFC reads immediately (no tap needed) |
| Fingerprint / face | Alarm fires → screen shows → user taps ring → biometric prompt → ~0.5 s scan → NFC reads |
| PIN / pattern | Alarm fires → screen shows → user taps ring → PIN prompt → enter PIN → NFC reads |

**Relevant code**
- `isKeyguardSecure` / `requestKeyguardDismiss` — `AlarmAudioModule.kt` + `src/services/alarmAudio.ts`
- Mount `useEffect` + `Pressable` ring — `AlarmRingingScreen.tsx`

---

## Cancellation

Both scheduled items must be cancelled when an alarm is toggled off, edited, or
deleted:

```
cancelAlarm(alarmId)
  → notifee.cancelTriggerNotification(...)   // cancels the full-screen-intent path
  → AlarmAudio.cancelAlarmActivities(...)    // cancels all AlarmManager broadcasts
                                              // (weekday slots -1..6)
```

`cancelAlarmActivities` cancels by reconstructing the same
`PendingIntent.getBroadcast(...)` with `FLAG_NO_CREATE` — if the PendingIntent
doesn't exist it is a no-op.

---

## Dismissal

1. User taps NFC tag on `AlarmRingingScreen`.
2. NFC service reads the UID and verifies ownership against `nfc_tags`.
3. `alarmLogStore.dismissActiveAlarm('nfc', uid)` writes the dismiss record to
   Supabase.
4. `AlarmAudioService.stop()` is called from JS (stops MediaPlayer, restores
   volume, removes foreground notification, stops itself).
5. Navigation pushes `PostAlarmBlock` with the block countdown.

Emergency dismissal follows the same path except step 2 is skipped and
`dismissed_via = 'emergency'` is written instead.
