import { Platform, requireNativeModule } from 'expo-modules-core';

/**
 * Native bridge to Apple's Screen Time API (FamilyControls +
 * ManagedSettings, iOS 16+). This is the only path to per-app blocking on
 * iOS; there is no Android-equivalent "block any installed package by
 * name" surface.
 *
 * Phase 5A status: module compiles but `isAvailable()` returns false and
 * all methods are no-ops. Phase 5B (Mac-required) fills in the real Swift
 * bridge — requesting authorization, presenting FamilyActivityPicker for
 * per-mode app selection, and writing ApplicationTokens to
 * `ManagedSettingsStore().shield.applications`.
 *
 * Apple-imposed limitation: ApplicationTokens are install-bound. If a user
 * uninstalls a blocked app and reinstalls it during a session, the new
 * install gets a fresh token that isn't in our shielded set, so it opens
 * normally. We cannot prevent this. Android does not have this gap.
 */

export type ScreenTimeAuthStatus = 'authorized' | 'denied' | 'notDetermined';

interface ScreenTimeNativeBridge {
  isAvailable: () => Promise<boolean>;
  requestAuthorization: () => Promise<ScreenTimeAuthStatus>;
  startBlocking: (bundleIds: string[], blockType: 'blacklist' | 'whitelist') => Promise<void>;
  stopBlocking: () => Promise<void>;
  isBlocking: () => Promise<boolean>;
}

let Native: ScreenTimeNativeBridge | null = null;
function getNative(): ScreenTimeNativeBridge | null {
  if (Native) return Native;
  if (Platform.OS !== 'ios') return null;
  try {
    Native = requireNativeModule<ScreenTimeNativeBridge>('MomentumScreenTime');
    return Native;
  } catch {
    return null;
  }
}

/** True only on iOS 16+ with FamilyControls authorization granted. Always false on Android. */
export async function isAvailable(): Promise<boolean> {
  const n = getNative();
  if (!n) return false;
  try {
    return await n.isAvailable();
  } catch {
    return false;
  }
}

export async function requestAuthorization(): Promise<ScreenTimeAuthStatus> {
  const n = getNative();
  if (!n) return 'denied';
  return n.requestAuthorization();
}

export async function startBlocking(
  bundleIds: string[],
  blockType: 'blacklist' | 'whitelist',
): Promise<void> {
  const n = getNative();
  if (!n) return;
  await n.startBlocking(bundleIds, blockType);
}

export async function stopBlocking(): Promise<void> {
  const n = getNative();
  if (!n) return;
  await n.stopBlocking();
}

export async function isBlocking(): Promise<boolean> {
  const n = getNative();
  if (!n) return false;
  try {
    return await n.isBlocking();
  } catch {
    return false;
  }
}
