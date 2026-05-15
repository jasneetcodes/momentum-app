# App Blocking Workflow — iOS

How Momentum blocks selected apps during a Lock In session or a post-alarm
window on iOS. Splits into **Phase 5A (Windows-doable, current)** and
**Phase 5B (Mac-required, deferred)**.

---

## Current Status (Phase 5A)

The iOS native module skeleton ([modules/momentum-screen-time/](../modules/momentum-screen-time/))
compiles and links. `isAvailable()` always returns `false`, and all
blocking methods are no-ops. The JS facade in
[src/services/appBlocking.ts](../src/services/appBlocking.ts) detects
`Platform.OS === 'ios'`, calls `ScreenTime.isAvailable()`, and falls
through to a no-op since it returns false.

Practically that means on iOS today:

- The mode session UI fully works (start, timer, NFC deactivate, emergency)
- The post-alarm block UI fully works (countdown, motivational copy)
- **No OS-level app blocking is enforced** — the user can leave Momentum
  and use any app freely

This is intentional: shipping Phase 5A now means Android users get full
blocking immediately while we wait for Mac access to implement the
FamilyControls bridge for iOS.

---

## Why iOS Cannot Use Android's Approach

Android Accessibility Services let any app observe foreground app
changes and react. iOS has no equivalent — there is no public API for a
third-party app to detect "user just opened Instagram" or to dismiss
another app's window.

The only sanctioned path to on-device app blocking on iOS is the **Screen
Time API**, formally known as `FamilyControls` + `ManagedSettings` +
`DeviceActivity`. It's iOS 16+, requires a special entitlement, uses
opaque tokens instead of bundle IDs, and presents its own system UI when
a blocked app is opened.

---

## Architecture (Phase 5B target)

```
┌───────────────────────────────────────────────┐
│         src/services/appBlocking.ts           │   JS facade
└──────────────────────┬────────────────────────┘
                       │
                       ▼
┌───────────────────────────────────────────────┐
│         momentum-screen-time/index.ts         │   TS interface
└──────────────────────┬────────────────────────┘
                       │
                       ▼
┌───────────────────────────────────────────────┐
│   MomentumScreenTimeModule.swift              │   Expo module entry
│   guarded: #if canImport(FamilyControls)      │
│   + @available(iOS 16.0, *)                   │
└──────────────────────┬────────────────────────┘
                       │
                       ▼
┌───────────────────────────────────────────────┐
│   ScreenTimeBridge.swift                      │   Real FamilyControls
│   - AuthorizationCenter.shared.requestAuth..  │   calls. Phase 5A: stubs.
│   - ManagedSettingsStore().shield.applications│
│                                               │
│   ┌───────────────────────────────────────┐   │
│   │   Shield Configuration Extension      │   │   Custom Momentum
│   │   (separate target, App Group share)  │   │   branding on Apple's
│   │   - ShieldConfigurationDataSource     │   │   system shield overlay
│   └───────────────────────────────────────┘   │
└───────────────────────────────────────────────┘
```

---

## Authorization Flow (Phase 5B)

1. User taps "Lock In" → `appBlocking.isPermissionGranted()` checks
2. If false, `appBlocking.requestPermission()` calls
   `ScreenTime.requestAuthorization()` which triggers
   `AuthorizationCenter.shared.requestAuthorization(for: .individual)`
3. iOS shows a system prompt explaining what Screen Time access enables
4. User taps Allow → status becomes `.approved` → activation proceeds

The `NSFamilyControlsUsageDescription` Info.plist string is shown in
the system prompt.

---

## App Selection (Phase 5B)

**This is where iOS diverges sharply from Android.**

Apple does NOT let third-party apps map bundle IDs to ApplicationTokens.
The user MUST select apps via Apple's `FamilyActivityPicker`, which
hands back an opaque `FamilyActivitySelection` containing
`Set<ApplicationToken>` (and `Set<ActivityCategoryToken>` for whole
categories like "Social Networking").

Consequences:

- Our `constants/apps.ts` list is unused on iOS — there's no way to
  pre-select Instagram by bundle ID
- Each mode needs an iOS-specific app selection flow that presents
  `FamilyActivityPicker`
- We store the resulting tokens (base64-encoded) in a new column
  `modes.apps_ios_tokens` and `alarms.apps_ios_tokens`
- See `supabase/phase5b_ios_tokens.sql` (to be created in Phase 5B)

---

## Blocking Lifecycle (Phase 5B target)

1. User taps "Lock In" → permission check → activation
2. JS calls `appBlocking.startBlocking(bundleIds, blockType, label)`
3. iOS bridge: load `apps_ios_tokens` for the mode from local cache,
   deserialize into `Set<ApplicationToken>`, write to
   `ManagedSettingsStore().shield.applications = tokens`
4. Apple's system now intercepts every launch of those apps
5. User taps a blocked app → iOS shows the **Momentum-branded shield
   overlay** (see below)
6. NFC dismiss → JS calls `appBlocking.stopBlocking()` → bridge calls
   `store.clearAllSettings()` → blocked apps open normally again

---

## Custom Shield UI (iOS Equivalent of BlockedAppActivity)

iOS does NOT let us launch our own activity over a blocked app — the
system shield is Apple's UI. But iOS 16+ allows app-supplied
title/body/icon/buttons via `ShieldConfigurationDataSource`.

Phase 5B will add a **Shield Configuration extension target**
(`MomentumShield`) in Xcode, sharing an App Group with the main app to
read the current mode label.

```swift
@available(iOS 16.0, *)
class MomentumShieldConfigurationDataSource: ShieldConfigurationDataSource {
  override func configuration(shielding application: Application) -> ShieldConfiguration {
    let appName = application.localizedDisplayName ?? "This app"
    return ShieldConfiguration(
      backgroundBlurStyle: .systemUltraThinMaterialDark,
      backgroundColor: UIColor(red: 0.055, green: 0.055, blue: 0.06, alpha: 1),  // #0E0E0F
      icon: UIImage(named: "MomentumLock"),
      title: ShieldConfiguration.Label(text: "\(appName) is locked", color: .white),
      subtitle: ShieldConfiguration.Label(
        text: "Tap your Momentum tag to end the session.",
        color: .lightGray
      ),
      primaryButtonLabel: ShieldConfiguration.Label(text: "Got it", color: .white),
      primaryButtonBackgroundColor: UIColor(red: 0.004, green: 0.729, blue: 0.937, alpha: 1)  // #01BAEF
    )
  }
}
```

This is the closest iOS gets to Android's `BlockedAppActivity`. The
container, transition, and dismissal behavior are all controlled by
iOS; we only get to render content inside Apple's overlay.

---

## Apple-Imposed Bypass: Uninstall + Reinstall

Unlike Android, iOS **DOES** have a guaranteed bypass:

1. User long-presses Instagram → Delete App → confirm
2. iOS invalidates Instagram's `ApplicationToken`
3. User re-installs Instagram from the App Store
4. The new install gets a fresh `ApplicationToken` that is NOT in our
   stored set
5. Instagram opens normally — no shield, no block

This is an Apple-imposed limitation of the Screen Time API. We cannot
prevent it short of Apple changing the framework. Documenting it loudly
here so it's not lost.

A future mitigation could be:

- Detect a previously-shielded app is no longer installed (no public
  API, but inferred from token resolution failures)
- Send an in-app notification ("We noticed you uninstalled <app>. Your
  session is still active — please don't reinstall it until your session
  ends.")

This is best-effort; it cannot be enforced.

---

## What Survives What (Phase 5B target)

| Event | Blocking continues? | Why |
|---|---|---|
| Momentum app force-quit / swiped from app switcher | ✅ Yes | `ManagedSettingsStore` is system-managed, runs independent of our app |
| Device reboot mid-session | ✅ Yes | Same — system-managed, not tied to our process |
| User uninstalls + reinstalls a blocked app | ❌ No | Apple-imposed (see above) |
| User uninstalls Momentum | ❌ No | Token entitlement revoked with app |
| User revokes Screen Time auth in Settings | ❌ No | Sanctioned escape hatch |

---

## Phase 5B Checklist (Mac-required)

When Mac access is available:

1. **Open the project in Xcode** (`ios/momentumapp.xcworkspace`)
2. **Add the Family Controls capability** to the main target
   (Signing & Capabilities → `+` → Family Controls). Confirm
   `com.apple.developer.family-controls` lands in
   `momentumapp.entitlements`.
3. **Add a Shield Configuration extension target**:
   - File → New → Target → Shield Configuration Extension
   - Name: `MomentumShield`
   - This creates a new bundle with its own Info.plist
4. **Add an App Group** shared between the main app and the extension
   so the extension can read the current mode label.
5. **Add `NSFamilyControlsUsageDescription` to Info.plist** with the
   copy: "Momentum blocks apps you select during Lock In sessions and
   after alarms, so you stay focused without willpower."
6. **Fill in `ScreenTimeBridge.swift`**:
   - `requestAuthorization` → `AuthorizationCenter.shared.requestAuthorization(for: .individual)`
   - `startBlocking` → take a deserialized `Set<ApplicationToken>`, set
     `store.shield.applications`
   - `stopBlocking` → `store.clearAllSettings()`
7. **Create the iOS-only app selection screen** wrapping
   `FamilyActivityPicker`. Reachable from `CreateModeScreen` on iOS
   in place of the bundle-ID app list.
8. **Add schema migration** `supabase/phase5b_ios_tokens.sql`:
   ```sql
   alter table public.modes add column apps_ios_tokens text[] default '{}';
   alter table public.alarms add column apps_ios_tokens text[] default '{}';
   ```
9. **Update `modeStore` / `alarmStore`** to round-trip
   `apps_ios_tokens` when on iOS.
10. **Test on a real iOS 16+ device**:
    - First activation triggers the system auth prompt
    - Open `FamilyActivityPicker`, select Instagram + TikTok
    - Start a Lock In session → opening Instagram shows the shield
    - Tap NFC tag → shield dismisses → Instagram opens normally
    - Repeat the post-alarm flow

---

## Relevant files

- [src/services/appBlocking.ts](../src/services/appBlocking.ts) — JS facade (already routes to ScreenTime on iOS)
- [modules/momentum-screen-time/index.ts](../modules/momentum-screen-time/index.ts) — TS interface (Phase 5A no-op)
- [modules/momentum-screen-time/ios/MomentumScreenTimeModule.swift](../modules/momentum-screen-time/ios/MomentumScreenTimeModule.swift) — Expo module entry
- [modules/momentum-screen-time/ios/ScreenTimeBridge.swift](../modules/momentum-screen-time/ios/ScreenTimeBridge.swift) — stubbed; Phase 5B fills bodies
- [ios/momentumapp/Info.plist](../ios/momentumapp/Info.plist) — needs `NSFamilyControlsUsageDescription` in Phase 5B
- [ios/momentumapp/momentumapp.entitlements](../ios/momentumapp/momentumapp.entitlements) — needs `com.apple.developer.family-controls` in Phase 5B

See also [block-flow-android.md](./block-flow-android.md) for the
Android counterpart, which is fully active today.
