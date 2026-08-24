# Momentum App — Claude Code Instructions

## In-Progress Work Log

### 2026-05-15 — Phase 5: Brick Mode (Lock In) + unified app blocking

**Current branch:** `phase5`. Phase 4 (alarms) is merged to `main`.

**Phase split** (mirrors the Phase 4 iOS A/B split):
- **Phase 5A (Windows-doable, implemented, awaiting device testing)** —
  full Android-side blocking, all UI, schema, JS state/services. iOS gets
  a no-op skeleton module that compiles but does nothing.
- **Phase 5B (Mac-required, deferred)** — fill in
  `modules/momentum-screen-time/ios/ScreenTimeBridge.swift` with real
  FamilyControls / ManagedSettings calls. Requires Mac + Xcode + iOS 16+
  physical device. Documented in detail in
  [docs/block-flow-ios.md](docs/block-flow-ios.md) and the plan file.

**What Phase 5A ships (ready to test):**
- `modes` table + `mode_sessions` RLS migrations
  (`supabase/phase5_modes.sql` — MUST run in Supabase SQL editor before
  testing).
- `modeStore` (CRUD + persisted `selectedModeId`) and
  `modeSessionStore` (hydrate-on-launch, activate, deactivate via NFC,
  emergency unblock, totals).
- Android native module under `android/app/src/main/java/com/momentumapp/`:
  - `AppBlockingService` (AccessibilityService) — detects window changes
  - `AppBlockingForegroundService` — `START_STICKY`, persistent
    notification, survives task removal and OOM
  - `BlockedAppActivity` — full-screen Momentum-branded takeover when
    the user opens a blocked app
  - `AppBlockingBootReceiver` — restores blocking after device reboot
  - `AppBlockingState` — SharedPreferences-backed persisted state
    (blocked set survives uninstall+reinstall — package name remains in
    the set so re-installed apps are immediately blocked again)
- LockInScreen: default state + active state (darker UI, live HH:MM:SS
  timer, pulsing ring, NFC scan loop, emergency unblock).
- CreateModeScreen: label + block_type + app picker, defaults to
  social-media apps.
- HomeScreen: active session banner showing mode label + live elapsed time.
- Conflict guards:
  - Mode activation rejected during active post-alarm block
  - Alarm dismissal during active mode skips PostAlarmBlock entirely
    (mode is already blocking; no second block needed)
  - AlarmSetupScreen validates next fire time isn't inside an active
    block window

**Permissions to grant before testing on Android:**
1. Open the app, tap "Lock In" — the permission modal appears.
2. Tap "Open Settings" → Accessibility → enable Momentum.
3. Return to the app and tap "Lock In" again to activate.

**Testing checklist:** see Phase 5A section of the plan file at
`~/.claude/plans/currently-when-1-when-glistening-eagle.md` (15 steps
covering takeover, reinstall-doesn't-bypass, reboot survival, conflict
rules, emergency unblock).

**Phase 5B blockers (do NOT start until Mac access):**
- FamilyControls capability + entitlement (Xcode)
- Shield Configuration extension target (custom Momentum branding on
  Apple's system shield)
- `apps_ios_tokens` schema migration (`supabase/phase5b_ios_tokens.sql`)
- New iOS-only app picker screen wrapping Apple's `FamilyActivityPicker`
  (Apple does not let us map bundle IDs → ApplicationTokens; user MUST
  pick via Apple's system UI)

**Architectural note for future Claude sessions:** the AccessibilityService
reads `AppBlockingState` from SharedPreferences on every window-state
event rather than holding it in memory. This is intentional — it's the
mechanism that lets blocking survive JS bundle teardown, OOM kills, and
reboots. Do not optimize this with an in-memory cache without
understanding the survivability contract documented in
[docs/block-flow-android.md](docs/block-flow-android.md).

---

### 2026-05-14 — Alarm activity launch when app killed + phone unlocked (NOT WORKING)

**Working scenarios (Android, on Pixel):**
- App killed + phone LOCKED → AlarmRingingScreen shows over lock screen, audio plays, persists after unlock. ✓
- App alive (background) + phone unlocked → AlarmRingingScreen force-opens, audio plays. ✓
- Lock screen NFC: `requestDismissKeyguard` prompts for biometric so NFC works after auth. ✓

**Broken scenario:**
- App killed + phone UNLOCKED → only the silent Notifee notification shows. Alarm audio may or may not start (unclear from latest test). The AlarmRingingScreen does NOT auto-open. User must tap the notification to enter the app.

**What's been tried:**
1. `AlarmAudioService.launchMainActivity()` — calling `startActivity()` from the foreground service after `startForeground()`. Android 12+ removed this exemption, so it silently fails on the test Pixel.
2. `AlarmManager.setAlarmClock()` with an Activity PendingIntent (current state in `AlarmAudioModule.scheduleAlarmActivity`). Wired into `scheduler/android.ts`. User reports still not working — Activity PendingIntents from `setAlarmClock` appear to be silently dropped on this Pixel build.

**Next planned attempt:**
Switch `setAlarmClock` to a Broadcast PendingIntent + a new `AlarmActivityReceiver` (matches Google Clock / Sleep-as-Android pattern):
- `AlarmActivityReceiver.kt` (new) — `BroadcastReceiver` that on `onReceive` calls `startActivity(MainActivity)` with the `momentum://alarm/{id}` deep link and `alarm_full_screen=true` extra. Android grants a ~10s BAL-allowed window after a `setAlarmClock` broadcast fires, during which `startActivity` is permitted regardless of app state.
- Register receiver in `AndroidManifest.xml` (`exported="false"`).
- Update `AlarmAudioModule.scheduleAlarmActivity` to use `PendingIntent.getBroadcast(...)` targeting the new receiver (instead of `getActivity`).
- Update `cancelAlarmActivities` to match the new PendingIntent shape.

**To test the next attempt:** delete and re-create the test alarm after rebuilding so the new `scheduleAlarmActivity` path is actually used (old AlarmManager schedules from prior builds won't have the broadcast PI).

**Branch:** `phase4`. The setAlarmClock + activity PI changes are committed; the broadcast-receiver refactor has NOT been started yet.

---

## What is Momentum
Momentum is a React Native (Expo Bare Workflow) alarm + focus app 
paired with a physical NFC tag. It has two core MVP features:

### 1. Alarm Mode
- Alarm cannot be dismissed without tapping the Momentum NFC tag
- Once dismissed, social media apps are blocked for 30 minutes
- The post-dismiss block can be linked to a custom Mode

### 2. Brick Mode
- User creates custom Momentum Modes (e.g. "Studying", "Family Time")
- Each mode has a list of apps to block (blacklist) or allow (whitelist)
- Mode is activated by pressing a button (button only — NFC-to-activate was considered and explicitly dropped)
- Mode can ONLY be deactivated by tapping the NFC tag
- A visible timer runs for the duration of the session
- Sessions are stored for streaks and analytics

## Tech Stack
- React Native + Expo Bare Workflow
- Supabase (auth + database)
- NFC: react-native-nfc-manager
- iOS app blocking: Screen Time API (native Swift module)
- Android app blocking: Accessibility Service (native Kotlin)
- State management: Zustand
- Styling: NativeWind (Tailwind for RN)

## Brand
- Support light mode and dark mode
- Clean, minimal UI — energy and focus oriented
- NOTE: Currently using `darkMode: 'media'` in tailwind.config.js (follows OS preference).
  Future: add a manual theme override toggle (force light / force dark) in Settings screen.
  To implement, switch back to `darkMode: 'class'` and manage a `.dark` class via a themeStore.

## Folder Conventions
- Screens → src/app/
- Business logic → src/services/
- Global state → src/stores/ (Zustand)
- Reusable UI → src/components/
- Never put business logic directly in components
- Always use TypeScript

## Supabase Tables
- profiles — user account + name + plan + emergency_unblocks_limit
- valid_tags — pre-registered Momentum hardware UIDs
- nfc_tags — tag UID bound to user account
- alarms — alarm config, linked to nfc_tag and optional mode
- alarm_logs — every alarm fire/dismiss event
- modes — user's custom blocking configs (blacklist or whitelist)
- mode_sessions — every brick mode activation/deactivation + duration

## Key Business Logic
- NFC tag UID must exist in valid_tags before registration is allowed
- Emergency unblocks = profiles.emergency_unblocks_limit minus count 
  of mode_sessions where deactivated_via = 'emergency' this month
- Default post-alarm block uses DEFAULT_BLOCKED_APPS from constants/apps.ts
- Only NFC tap can deactivate an active mode session

## Auth Screens

Signup form fields (in order): First name | Last name (side-by-side row), Email, Password, Confirm password
- First + last name are combined as "First Last" and saved to profiles.name
- Home screen greeting uses first name only (profiles.name.split(' ')[0])
- Login form: Email, Password

## Current Build Priority (MVP)
1. Auth (signup/login)
2. NFC tag registration + validation against valid_tags
3. Alarm creation + NFC dismiss flow
4. 30-min default app block post-alarm
5. Mode creation (blacklist/whitelist + app picker)
6. Mode activation (button only) + deactivation (NFC only)
7. Live session timer on ActiveModeScreen

## Brand & Visual Design

Colour

Primary accent: #01BAEF (cyan-blue)

Background (dark mode): near-black, ~#0E0E0F
Surface cards (dark mode): ~#1A1A1B
Primary text (dark mode): #FFFFFF pure white
Secondary text (dark mode): ~#888 muted grey

Background (light mode): off-white with cream shift, #F9F7F5
Surface cards (light mode): #FFFFFF pure white
Primary text (light mode): #1A1A1A Deep charcoal
Secondary text (light mode): ~#717171 Mid-grey

The accent colour (#01BAEF) is used for: primary buttons, active toggles, streak dots,
the NFC tap pulse animation, and selected tab indicators. Use it sparingly — it should
always draw the eye to the one thing worth tapping.

Aesthetic principles

High-contrast, minimal. Every screen should feel intentional and uncluttered.
Large typography for key numbers (time, streak count, timer). Let the numbers breathe.
The physical NFC tag product photo is a hero UI element on the Lock In screen.
It must always render crisply — use a high-res asset, never stretch or distort it.
When a Lock In session is active, the UI shifts into a visibly darker, more locked-down
state. This visual shift is intentional — it communicates the mode change without words.
Empty states must feel considered, not lazy. Use a single short line of copy that sells
the product concept (e.g. "Set your first alarm. No snooze. No excuses.").
No decorative gradients, no glow effects, no heavy shadows. Flat surfaces only.
Spacing is generous. Never cram elements — whitespace communicates premium quality.


Navigation Structure
Bottom tab bar — 4 tabs

Home — Dashboard. Good morning greeting, streak, next alarm, active session banner.
Alarms — Alarm list and creation.
Lock In — Mode selector, NFC tag hero image, Lock In CTA.
Analytics — Weekly stats, streak history, session log.

There is no dedicated "You" or "Profile" tab. Settings are accessed via a gear icon
in the top-right corner of the Home screen. This keeps the tab bar focused on actions,
not configuration.

Screen Specs
Home 

Top bar: user first name greeting left ("Good morning, Alex") — derived from profile.name split on space, gear icon top-right
Streak row: current streak count prominent, weekly dot track (7 dots, filled = active day)
Next alarm card: time in large type, day pills (M T W T F S S), NFC tag label as subtitle
Active session banner: shown only when a Lock In session is running — tapping it goes to
the Lock In tab. Shows mode name and live elapsed time.
Stats strip: today's total focus time, all-time alarm streak count
Gear icon navigates to Settings screen (pushed, not a tab)

Settings 

Pushed from Home gear icon — not a bottom tab
Account card: shows full name on top line, email below it, plan badge (Free / Pro) on right
NFC tag manager: list of registered tags with labels, add new tag, delete tag
Notification preferences
Emergency unblocks remaining this month
Sign out
App version

Alarms 

List of alarm cards, each showing:

Time in large type
Day pills for repeat days (greyed if not active)
Active/inactive toggle (right side)
Alarm label as card subtitle


Tap card to edit, swipe left to delete
(+) button top-right to create new alarm
Empty state: short motivational copy + create button

Create/Edit Alarm 

Bottom sheet (modal)
Time picker: scroll picker, large
Day selector: M T W T F S S pill toggles
Label: optional text input
Block type toggle: Blacklist (block these apps) / Whitelist (allow only these)
App picker: scrollable list of installed apps, search bar, category filters.
- Default apps already selected (Social Media Apps) and CANNOT BE UNSELECTED!
Block duration: default 30 min selected, slider to adjust. MINIMUM 15 MINUTES BLOCK!
Alarm sound: picker showing 6 pre-loaded sounds (Chime, Bell, Pulse, Siren, etc.)
- Each sound has a play button for preview at full volume. Default: Chime.


Lock In 
This is the core screen of the product. Design it accordingly.
Default state (no active session):

Top: "Locked in today — Xh Xm" in muted smaller text
Mode selector: shows the most recently used mode. Tapping opens a dropdown listing all
saved modes + "Create new mode" at the bottom. Selecting a mode updates the display but
does NOT start a session.
Below mode name: "Blocking X apps" or "X apps allowed" in muted text depedning on block type
Center hero: Momentum NFC tag product photo — large, centred, crisp
Bottom: full-width "Lock In" primary button (#01BAEF fill)

Tapping "Lock In" starts the session immediately (activated_via = 'button')
Button is the only way to start a session — NFC-to-activate was considered and
explicitly dropped. NFC is used only to end an active session (see below).

Active session state:

UI shifts darker — background deepens, surfaces lower contrast
Top: "Locked in today — Xh Xm" updates live
Mode name + "Blocking X apps" or "X apps allowed" remain visible below the tag photo
Center hero: same NFC tag photo, but with a pulsing ring around it to indicate
"tap here to finish"
Timer counting up (HH:MM:SS) displayed above the tag photo
Bottom: button text changes to "Tap your tag to finish" — button is non-interactive,
serves as instruction only
Emergency unblock: small muted text link below the button ("Emergency unblock — X remaining")
Tapping requires confirmation modal before executing.

Create Mode 

Pushed from Lock In dropdown → "Create new mode"
Mode name input (required)
Block type toggle: Blacklist (block these apps) / Whitelist (allow only these)
App picker: scrollable list of installed apps, search bar, category filters
(Social, Video, Games, Productivity, etc.)
Save — mode immediately becomes the selected mode on Lock In screen

Analytics 

Avg daily Lock In time — large, week-over-week delta below it
Weekly bar chart — focus minutes per day, this week vs last week comparison
Streak card: current streak / longest streak / total sessions
Alarm stats: dismissal rate, avg seconds from ring to NFC tap
Emergency unblocks used this month
Session history: scrollable list — date, mode name, duration, how it ended (nfc / emergency)


Full-Screen Flows (no tab bar)
Alarm Ringing 

Full-screen takeover. Tab bar hidden. No back gesture.
Alarm time in the largest possible type — dominates the screen
Alarm label below in muted smaller text
"Tap your Momentum tag" instruction centred below
Pulsing NFC ring animation around the instruction
Screen stays on at full brightness. Volume cannot be silenced via the app.
NO visible dismiss button. NFC tap is the only intended exit.
Emergency unblock: rendered in the smallest legible text at the very bottom of the screen.
Hard to find intentionally — it's a last resort, not a feature.

Post-Alarm Block 

Auto-pushes immediately after alarm is dismissed via NFC
Countdown timer in large type — MM:SS remaining
Short line of motivational copy in muted text below the timer
(e.g. "You're up. Make it count." — keep it short and dry, never cheesy)
App icon row showing what's currently blocked
No skip. No close. Timer must complete.
Auto-navigates to Home when timer hits zero

NFC Tag Setup 

Stepped flow, pushed from Settings → Manage tags → Add tag
Step 1: illustration/animation prompting user to hold tag to back of phone
Step 2: reading UID — spinner, "Reading your tag..."
Step 3: validating UID against valid_tags — "Checking your tag..."
Step 4: name your tag — text input with suggestions (Kitchen, Desk, Bathroom)
Error state (UID not in valid_tags): "This doesn't look like a Momentum tag.
Make sure you're using the tag that came with your order."
Success: tag saved to nfc_tags, user returned to Settings


Component Notes
NFC tag product photo

Asset path: src/assets/images/momentum-tag.png (to be provided)
Always render at its natural aspect ratio — never stretch
On Lock In active state, wrap with an animated pulsing ring:
a semi-transparent #01BAEF ring that scales from 1.0 to 1.15 and fades out, looping

Mode dropdown (Lock In screen)

Shows most recently used mode first, then all others sorted by last used
"Create new mode" always last in list
Selecting a mode saves it as the preferred mode (persisted locally via Zustand)
New mode selection does NOT start a session — user must tap "Lock In" to begin

Active session state persistence

If user navigates away from Lock In tab during an active session, a persistent banner
appears at the top of Home showing mode name + live elapsed time
Tapping the banner returns to Lock In tab
Session is NOT interrupted by navigation

Emergency unblock confirmation modal

Triggered from: Lock In active state link, or alarm ringing screen (extreme bottom)
Shows: "This will use 1 of your X remaining emergency unblocks this month."
Two buttons: "Cancel" and "End session anyway"
On confirm: deactivated_via = 'emergency', session closed, apps unblocked

## Folder Structure - Draft (Used as a guide not concrete)
momentum-app/
├── android/                        # Native Android project (Kotlin)
│   └── app/src/main/java/
│       └── MomentumAccessibility.kt  # Accessibility service for app blocking
├── ios/                            # Native iOS project (Swift)
│   └── MomentumScreenTime.swift    # Screen Time API module
├── src/
│   ├── app/                        # Screens
│   │   ├── (auth)/
│   │   │   ├── LoginScreen.tsx
│   │   │   └── SignupScreen.tsx
│   │   ├── (main)/
│   │   │   ├── HomeScreen.tsx      # Dashboard + active alarm display
│   │   │   ├── AlarmSetupScreen.tsx
│   │   │   ├── NFCRegisterScreen.tsx
│   │   │   └── SettingsScreen.tsx
│   │   └── AlarmFiringScreen.tsx   # Fullscreen alarm UI
│   ├── components/
│   │   ├── AlarmCard.tsx
│   │   ├── NFCScanner.tsx
│   │   └── BlockingOverlay.tsx
│   ├── services/
│   │   ├── supabase.ts             # Supabase client init
│   │   ├── nfc.ts                  # NFC read/write logic
│   │   ├── alarm.ts                # Alarm scheduling logic
│   │   └── appBlocking.ts          # iOS Screen Time / Android bridge
│   ├── stores/
│   │   ├── authStore.ts            # Zustand — user auth state
│   │   └── alarmStore.ts           # Zustand — alarm config state
│   ├── hooks/
│   │   ├── useNFC.ts
│   │   ├── useAlarm.ts
│   │   └── useAppBlocking.ts
│   ├── types/
│   │   └── index.ts                # Shared TypeScript types
|   ├── assets/
|   |   └── sounds/
|   |       └── chime.wav          # default sounds stored here
│   └── constants/
│       ├── colors.ts               # full palette
│       └── config.ts               # App-wide config values
├── supabase/
│   └── schema.sql                  # DB schema for Supabase
├── .env                            # Supabase URL + anon key
├── app.json
├── tailwind.config.js
├── tsconfig.json
└── CLAUDE.md                       # 👈 Instructions for Claude Code





## Database Schema and Worflow

MOMENTUM
Database Schema Reference
Tables, columns, and how they work together




Overview
Momentum's database is built on Supabase (PostgreSQL) and consists of 7 tables. The schema is split into three logical groups:

    • Identity & Hardware: profiles, valid_tags, nfc_tags
    • Alarm System: alarms, alarm_logs
    • Mode (Brick) System: modes, mode_sessions


Table Relationships at a Glance

valid_tags          (your hardware registry)
    |
    | (uid must exist here before registration)
    v
nfc_tags            (tag bound to a user)
    |
    | user_id ------> profiles
    |
    | (referenced by logs/sessions when tag is used)
    v
alarm_logs          (when alarms fired and were dismissed)
mode_sessions       (when modes were activated/deactivated)
 
profiles
   |
   +---> alarms       (one user, many alarms)
   |
   +---> modes        (one user, many modes)
   |
   +---> alarm_logs   (history of alarm events)
   |
   +---> mode_sessions (history of mode events)


### 1. profiles
Extends Supabase's built-in auth.users table with Momentum-specific user data. Auto-created via a database trigger when a user signs up.

Columns

| Column                   | Type        | Description                                                                               |
| :----------------------- | :---------- | :---------------------------------------------------------------------------------------- |
| id                       | uuid (PK)   | User's unique ID. Foreign key to auth.users(id). Cascade deletes if auth user is deleted. |
| email                    | text        | User's email address. Mirrored from auth.users for easier access.                         |
| name                     | text        | User's full name ("First Last"). Collected at signup via two separate fields (first + last), concatenated before saving. Home screen greets with first name only (split on space).  |
| plan                     | text        | Subscription tier. Defaults to 'free'. Will become 'pro' when subscriptions are added.    |
| emergency_unblocks_limit | int         | How many emergency unblocks user gets per month. Defaults to 5. Pro users may get more.   |
| created_at               | timestamptz | When the user signed up.                                                                  |


Why this design
• Separates Supabase Auth concerns from Momentum-specific user data.
• plan column is ready for subscriptions without schema changes.
• emergency_unblocks_limit is configurable per user (not hardcoded).


### 2. valid_tags
The registry of all genuine Momentum NFC tags. Before shipping a tag, you scan its UID and add it here. This prevents random NFC stickers from being registered as Momentum tags.

Columns

| Column        | Type          | Description                                                                            |
| :------------ | :------------ | :------------------------------------------------------------------------------------- |
| id            | uuid (PK)     | Internal record ID.                                                                    |
| uid           | text (unique) | The physical UID baked into the NFC tag at the factory. Permanent and unique.          |
| is_registered | bool          | Flips to true once a user claims this tag. Helps you know what's still in circulation. |
| created_at    | timestamptz   | When you added this tag to the registry.                                               |



Workflow
1. You receive tags from Alibaba.
2. You scan each tag with a simple NFC reader app.
3. You bulk insert UIDs into valid_tags.
4. You ship the tags to customers.
5. When a customer registers, the app verifies the UID exists here.


### 3. nfc_tags
The binding between a physical Momentum tag and a user account. Created when the user taps and registers their tag for the first time.

Columns

| Column     | Type        | Description                                                   |
| :--------- | :---------- | :------------------------------------------------------------ |
| id         | uuid (PK)   | Internal ID for this binding.                                 |
| user_id    | uuid (FK)   | References profiles(id). Cascade deletes if user is deleted.  |
| uid        | text        | (FK) References valid_tags(uid). Must already exist there.    |
| label      | text        | Optional user-given name (e.g. 'Kitchen Tag' 'Bathroom Tag'). |
| created_at | timestamptz | When the user registered this tag.                            |

Why this design
• A user can register multiple tags (different placements).
• A tag can only belong to one user at a time (uid is unique).
• Labels make analytics richer (e.g. 'most-used tag is Kitchen').


### 4. alarms
The user's alarm configurations. Each row defines a single alarm: when it fires, what gets blocked when it's dismissed, and for how long.

Columns

| Column                 | Type          | Description                                                                              |
| :--------------------- | :------------ | :--------------------------------------------------------------------------------------- |
| id                     | uuid (PK)     | Alarm ID.                                                                                |
| user_id                | uuid (FK)     | References profiles(id). Cascade deletes.                                               |
| label                  | text          | Optional name (e.g. 'Morning Alarm', 'Workout').                                        |
| time                   | time          | What time the alarm fires (e.g. 07:00:00).                                              |
| days_of_week           | int[]         | Array of days (0=Sunday, 6=Saturday). Empty = one-off alarm.                            |
| is_active              | bool          | Whether the alarm is currently enabled. Defaults to true.                               |
| block_type             | text          | 'blacklist' (block these apps) or 'whitelist' (allow only these apps). Defaults to blacklist. |
| apps                   | text[]        | Array of app bundle IDs to block (or allow if whitelist).                               |
| block_duration_minutes | int           | How long to block apps after dismissal. Defaults to 30.                                 |
| created_at             | timestamptz   | When the alarm was created.                                                             |
| sound                  | text         | 'chime'  'bell'  'pulse'  'siren'  etc. Defaults to 'chime'.                             |


### 5. alarm_logs
A historical record of every alarm event. Tracks when alarms fired, when they were dismissed, which tag was used, and the resulting block window.

Columns

| Column                     | Type        | Description                                                                                 |
| :------------------------- | :---------- | :------------------------------------------------------------------------------------------- |
| id                         | uuid (PK)   | Log entry ID.                                                                               |
| user_id                    | uuid (FK)   | References profiles(id).                                                                    |
| alarm_id                   | uuid (FK)   | References alarms(id). Set to null if alarm is deleted.                                     |
| triggered_at               | timestamptz | When the alarm fired.                                                                       |
| dismissed_at               | timestamptz | When the user dismissed it. Null = still ringing.                                           |
| dismissed_via              | text        | How it was dismissed: 'nfc' or 'emergency' or null.                                         |
| dismissed_via_uid          | text        | Raw UID string of the tag used. Permanent record even if tag is later deleted.              |
| dismissed_via_nfc_tag_id   | uuid (FK)   | References nfc_tags(id). Set null if tag is deleted. For relational queries.                |
| block_started_at           | timestamptz | When the post-alarm app block started.                                                      |
| block_ends_at              | timestamptz | When the block automatically ends (block_started_at + block_duration_minutes).               |
| block_completed            | bool        | Flips to true when the timer naturally completes.                                           |

Why both dismissed_via_uid and dismissed_via_nfc_tag_id?
• The UID string is permanent. Even if the tag is unregistered or deleted later, the historical record stays intact.
• The foreign key allows rich relational queries like 'how many times did I dismiss using my Kitchen Tag?'.
• Best of both worlds: permanence + relational power.


### 6. modes
User-defined custom blocking configurations. Unlike alarms (time-based), modes are activated manually by the user — by pressing a button in the app (NFC-to-activate was considered and explicitly dropped; NFC is used only to deactivate).

Columns

| Column     | Type        | Description                                                                   |
| :--------- | :---------- | :---------------------------------------------------------------------------- |
| id         | uuid (PK)   | Mode ID.                                                                      |
| user_id    | uuid (FK)   | References profiles(id). Cascade deletes.                                    |
| label      | text        | User-given name (e.g. 'Studying', 'Family Time', 'After Hours').             |
| icon       | text        | Optional emoji or icon name for UI display.                                  |
| colour     | text        | Optional hex color for the mode's card in UI.                                |
| block_type | text        | 'blacklist' (block these) or 'whitelist' (allow only these). Defaults to blacklist. |
| apps       | text[]      | Array of app bundle IDs to block or allow.                                   |
| is_active  | bool        | Whether the mode is enabled (defaults to true). Inactive modes don't show in UI. |
| created_at | timestamptz | When the mode was created.                                                   |

Modes vs Alarms
• Alarm = time-based trigger (fires at 7am, requires NFC to dismiss).
• Mode = manual blocking config (activated by button, requires NFC to deactivate).
• Each has its own log table for tracking history.


### 7. mode_sessions
A historical record of every time a mode was activated and deactivated. Powers the visible timer, streaks, and analytics.

Columns

| Column                   | Type        | Description                                                               |
| :----------------------- | :---------- | :------------------------------------------------------------------------ |
| id                       | uuid (PK)   | Session ID.                                                               |
| user_id                  | uuid (FK)   | References profiles(id). Cascade deletes.                                |
| mode_id                  | uuid (FK)   | References modes(id). Cascade deletes if mode is deleted.                |
| activated_at             | timestamptz | When the session started. Defaults to now().                             |
| activated_via            | text        | How it was activated. Always 'button' in practice — NFC-to-activate was considered and explicitly dropped. Column stays generic text rather than a DB enum in case that changes. |
| deactivated_at           | timestamptz | When the session ended. Null = still active.                             |
| deactivated_via          | text        | 'nfc' (normal) or 'emergency' (used an emergency unblock) or null.       |
| deactivated_via_uid      | text        | Raw UID string of the tag used to deactivate. Permanent record.          |
| deactivated_via_nfc_tag_id | uuid (FK) | References nfc_tags(id). Set null if tag is deleted.                    |
| duration_minutes         | int         | Computed when deactivated. Used for streaks and analytics.               |
| created_at               | timestamptz | When the row was inserted.                                                |


How It All Works Together

Alarm Flow
1. User creates alarm (row in alarms table)
   - time: 07:00
   - apps: [Instagram, TikTok, ...]
   - block_duration_minutes: 30
 
2. At 7am, alarm fires
   - New row in alarm_logs
   - triggered_at = now()
   - dismissed_at = null
 
3. User taps NFC tag
   - App reads UID
   - App checks: SELECT * FROM nfc_tags
                 WHERE uid = X AND user_id = currentUser.id
   - Match found = legitimate Momentum tag owned by user
 
4. Update the alarm_logs row:
   - dismissed_at = now()
   - dismissed_via = 'nfc'
   - dismissed_via_uid = 'A1:B2:C3:D4'
   - dismissed_via_nfc_tag_id = (uuid of nfc_tags row)
   - block_started_at = now()
   - block_ends_at = now() + 30 minutes
 
5. App activates blocking on device for 30 minutes
 
6. After 30 min, automatic deactivation:
   - block_completed = true
   - Apps are unblocked


Mode (Brick) Flow
1. User creates mode (row in modes table)
   - label: 'Studying'
   - apps: [Instagram, YouTube, TikTok]
   - block_type: 'blacklist'
 
2. User presses the "Lock In" button to activate
   - New row in mode_sessions
   - activated_at = now()
   - activated_via = 'button'
   - deactivated_at = null
 
3. App activates blocking on device
   - Visible timer in app counting up from activated_at
 
4. User taps NFC tag to deactivate
   - App verifies tag again
   - Update mode_sessions row:
     - deactivated_at = now()
     - deactivated_via = 'nfc'
     - deactivated_via_uid = 'A1:B2:C3:D4'
     - deactivated_via_nfc_tag_id = (uuid)
     - duration_minutes = (deactivated_at - activated_at) in minutes
 
5. App deactivates blocking on device
 
6. Session is complete and stored for analytics/streaks


Emergency Unblock Logic
Calculated at query time, not stored separately. The data lives in mode_sessions.

-- How many emergency unblocks used this month?
SELECT COUNT(*) FROM mode_sessions
WHERE user_id = currentUser.id
  AND deactivated_via = 'emergency'
  AND activated_at >= date_trunc('month', now());
 
-- Remaining emergency unblocks:
remaining = profiles.emergency_unblocks_limit - count_above
 
-- If user tries to deactivate without NFC:
IF remaining > 0:
  Allow it, set deactivated_via = 'emergency'
ELSE:
  Block, show "No emergency unblocks remaining"


Key Design Decisions

Why valid_tags exists
Prevents users from registering random non-Momentum NFC stickers. Protects hardware revenue and the sunk-cost commitment effect.

Why ownership check is profile-level (not tag-level)
Any of a user's registered tags should be able to dismiss any of their alarms or modes. Verification happens by checking nfc_tags WHERE uid = X AND user_id = currentUser.id.

Why both UID string and FK in logs
UID string is permanent (survives tag deletion). FK enables rich relational queries (e.g. group by tag label). Storing both gives flexibility without redundancy concerns.

Why alarms and modes are separate
Alarms are time-based triggers. Modes are manual user-activated configs. Different lifecycles, different UX, different analytics. Forcing them into one table created funky logic, so they stay independent.

Why blocking config lives in alarms (not a separate table)
The block_type, apps, and block_duration_minutes columns on alarms define the post-dismissal behaviour. The alarm_logs row records when the block actually happened. No separate alarm_block_sessions table needed.


Momentum — Database Schema Reference
7 tables, designed for the MVP and future-proofed for Pro features.