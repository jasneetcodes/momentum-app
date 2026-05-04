# Momentum App — Claude Code Instructions

## What is Momentum
Momentum is a React Native (Expo Bare Workflow) alarm + focus app 
paired with a physical NFC tag. It has two core MVP features:

### 1. Alarm Mode
- Alarm cannot be dismissed without tapping the Momentum NFC tag
- Once dismissed, social media apps are blocked for 30 minutes
- The post-dismiss block can be linked to a custom Mode

### 2. Brick Mode
- User creates custom Modes (e.g. "Studying", "Family Time")
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