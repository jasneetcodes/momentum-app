# Plan: Native NFC Setup for Physical Device Testing

## Context
`react-native-nfc-manager` v3.17.2 is installed and JS code is complete (Phase 2). Autolinking will handle native module registration. However, both Android and iOS are missing platform-specific NFC declarations that are required before the app will even launch without crashing on a real device.

The goal is to add the minimal native config needed so the app can be built and tested on a physical device.

---

## Android (1 change needed)

**File:** `android/app/src/main/AndroidManifest.xml`

Add NFC permission inside the `<manifest>` block, alongside the existing `INTERNET` / `VIBRATE` permissions:

```xml
<uses-permission android:name="android.permission.NFC" />
```

That's all — autolinking handles the rest. No intent filters needed: `react-native-nfc-manager` uses foreground dispatch internally when `requestTechnology()` is called.

**Build + test:** `npm run android` on a physical device. The scan flow in NFCRegisterScreen will work end-to-end.

---

## iOS (3 changes needed — all manual, no Xcode required)

### 1. Info.plist — usage description
**File:** `ios/momentumapp/Info.plist`

Add inside the root `<dict>`:
```xml
<key>NFCReaderUsageDescription</key>
<string>Momentum uses NFC to read your Momentum tag for alarm dismissal and session control.</string>
```

### 2. Entitlements file — NFC capability
**Create:** `ios/momentumapp/momentumapp.entitlements`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.developer.nfc.readersession.formats</key>
    <array>
        <string>NDEF</string>
    </array>
</dict>
</plist>
```

### 3. Xcode project — link entitlements to the target
This cannot be done by editing a file — it requires one action in Xcode:

1. Open `ios/momentumapp.xcodeproj` in Xcode
2. Select the `momentumapp` target → **Signing & Capabilities** tab
3. Click **+ Capability** → add **Near Field Communication Tag Reading**
4. Xcode will auto-detect and link the `.entitlements` file you created

> NFC capability requires an Apple Developer account (free or paid). The app must be signed with a provisioning profile that includes NFC. This means a **physical device + real Bundle ID** — iOS Simulator cannot test NFC at all.

### After those changes:
```bash
cd ios && pod install && cd ..
npm run ios -- --device
```

---

## Critical Notes

| Platform | Simulator support | Works with free dev account |
|---|---|---|
| Android | ❌ No NFC in emulator | ✅ Yes |
| iOS | ❌ No NFC in simulator | ⚠️ Requires paid ($99/yr) Apple Developer account for NFC entitlement |

**Recommended testing order:**
1. Start with Android physical device — fastest path, free, no Xcode needed
2. iOS requires paid Apple dev account just for NFC; defer until Android is confirmed working

---

## Files to modify
- `android/app/src/main/AndroidManifest.xml` — 1 line added
- `ios/momentumapp/Info.plist` — 2 lines added
- `ios/momentumapp/momentumapp.entitlements` — new file (created)
- Xcode project file — 1 manual step in Xcode GUI (no text-edit equivalent)
