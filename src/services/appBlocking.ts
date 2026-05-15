import { NativeModules, Platform } from 'react-native';
import * as ScreenTime from 'momentum-screen-time';

/**
 * Platform facade for app blocking. Routes to the Android Accessibility
 * Service module on Android, the Screen Time module on iOS, and degrades
 * to no-ops on web / unsupported platforms.
 *
 * Both callers (mode sessions and post-alarm blocks) hit this one surface.
 * It is intentionally idempotent and safe to call repeatedly; start with
 * a fresh set replaces the previous set, stop is a no-op if not blocking.
 */

export type BlockType = 'blacklist' | 'whitelist';

interface AndroidBridge {
  startBlocking: (packages: string[], blockType: BlockType, sessionLabel: string) => Promise<void>;
  stopBlocking: () => Promise<void>;
  isBlocking: () => Promise<boolean>;
  isAccessibilityServiceEnabled: () => Promise<boolean>;
  openAccessibilitySettings: () => Promise<void>;
}

const AndroidNative = NativeModules.MomentumAppBlocking as AndroidBridge | undefined;

/**
 * Start blocking. Pass the platform-appropriate identifiers:
 *  - Android: package names (com.instagram.android, ...)
 *  - iOS (Phase 5B): bundle ids — currently no-op
 */
export async function startBlocking(
  bundleIds: string[],
  blockType: BlockType,
  sessionLabel: string,
): Promise<void> {
  if (Platform.OS === 'android' && AndroidNative) {
    try {
      await AndroidNative.startBlocking(bundleIds, blockType, sessionLabel);
    } catch {}
    return;
  }
  if (Platform.OS === 'ios') {
    try {
      if (await ScreenTime.isAvailable()) {
        await ScreenTime.startBlocking(bundleIds, blockType);
      }
    } catch {}
  }
  // web / unsupported: silent no-op
}

export async function stopBlocking(): Promise<void> {
  if (Platform.OS === 'android' && AndroidNative) {
    try { await AndroidNative.stopBlocking(); } catch {}
    return;
  }
  if (Platform.OS === 'ios') {
    try { await ScreenTime.stopBlocking(); } catch {}
  }
}

export async function isBlocking(): Promise<boolean> {
  if (Platform.OS === 'android' && AndroidNative) {
    try { return await AndroidNative.isBlocking(); } catch { return false; }
  }
  if (Platform.OS === 'ios') {
    try { return await ScreenTime.isBlocking(); } catch { return false; }
  }
  return false;
}

/**
 * Android: returns true if the user has enabled the Momentum Accessibility
 * Service in system Settings. iOS: returns true if FamilyControls auth is
 * granted (Phase 5B). Either way, callers should check this before showing
 * the "Lock In" button as functional, and trigger the onboarding modal
 * (or open settings) when false.
 */
export async function isPermissionGranted(): Promise<boolean> {
  if (Platform.OS === 'android' && AndroidNative) {
    try { return await AndroidNative.isAccessibilityServiceEnabled(); } catch { return false; }
  }
  if (Platform.OS === 'ios') {
    try { return await ScreenTime.isAvailable(); } catch { return false; }
  }
  return false;
}

/**
 * Android: opens the Accessibility settings page. iOS (Phase 5B): triggers
 * the authorization prompt via ScreenTime.requestAuthorization().
 */
export async function requestPermission(): Promise<void> {
  if (Platform.OS === 'android' && AndroidNative) {
    try { await AndroidNative.openAccessibilitySettings(); } catch {}
    return;
  }
  if (Platform.OS === 'ios') {
    try { await ScreenTime.requestAuthorization(); } catch {}
  }
}
