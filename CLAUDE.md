# Momentum App — Claude Code Instructions

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
- Mode is activated by tapping NFC tag or pressing a button
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
- Primary colour: #1944F1
- Support light mode and dark mode
- Clean, minimal UI — energy and focus oriented

## Folder Conventions
- Screens → src/app/
- Business logic → src/services/
- Global state → src/stores/ (Zustand)
- Reusable UI → src/components/
- Never put business logic directly in components
- Always use TypeScript

## Supabase Tables
- profiles — user account + plan + emergency_unblocks_limit
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

## Current Build Priority (MVP)
1. Auth (signup/login)
2. NFC tag registration + validation against valid_tags
3. Alarm creation + NFC dismiss flow
4. 30-min default app block post-alarm
5. Mode creation (blacklist/whitelist + app picker)
6. Mode activation (NFC or button) + deactivation (NFC only)
7. Live session timer on ActiveModeScreen



## Folder Structure - Draft
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
│   └── constants/
│       ├── colors.ts               # #1944F1 and full palette
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


1. profiles
Extends Supabase's built-in auth.users table with Momentum-specific user data. Auto-created via a database trigger when a user signs up.

Columns

| Column                   | Type        | Description                                                                               |
| :----------------------- | :---------- | :---------------------------------------------------------------------------------------- |
| id                       | uuid (PK)   | User's unique ID. Foreign key to auth.users(id). Cascade deletes if auth user is deleted. |
| email                    | text        | User's email address. Mirrored from auth.users for easier access.                         |
| plan                     | text        | Subscription tier. Defaults to 'free'. Will become 'pro' when subscriptions are added.    |
| emergency_unblocks_limit | int         | How many emergency unblocks user gets per month. Defaults to 5. Pro users may get more.   |
| created_at               | timestamptz | When the user signed up.                                                                  |


Why this design
• Separates Supabase Auth concerns from Momentum-specific user data.
• plan column is ready for subscriptions without schema changes.
• emergency_unblocks_limit is configurable per user (not hardcoded).


2. valid_tags
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


3. nfc_tags
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


4. alarms
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


5. alarm_logs
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


6. modes
User-defined custom blocking configurations. Unlike alarms (time-based), modes are activated manually by the user — by tapping the NFC tag or pressing a button in the app.

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
• Mode = manual blocking config (activated by user tap/button, requires NFC to deactivate).
• Each has its own log table for tracking history.


7. mode_sessions
A historical record of every time a mode was activated and deactivated. Powers the visible timer, streaks, and analytics.

Columns

| Column                   | Type        | Description                                                               |
| :----------------------- | :---------- | :------------------------------------------------------------------------ |
| id                       | uuid (PK)   | Session ID.                                                               |
| user_id                  | uuid (FK)   | References profiles(id). Cascade deletes.                                |
| mode_id                  | uuid (FK)   | References modes(id). Cascade deletes if mode is deleted.                |
| activated_at             | timestamptz | When the session started. Defaults to now().                             |
| activated_via            | text        | How it was activated: 'nfc' or 'button'.                                 |
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
 
2. User taps NFC tag (or presses button) to activate
   - App verifies tag belongs to user (same nfc_tags check)
   - New row in mode_sessions
   - activated_at = now()
   - activated_via = 'nfc' or 'button'
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