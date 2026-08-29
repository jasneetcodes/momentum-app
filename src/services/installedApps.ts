import { NativeModules, Platform } from 'react-native';

export interface InstalledApp {
  packageName: string;
  label: string;
}

interface InstalledAppsBridge {
  getInstalledApps: () => Promise<InstalledApp[]>;
}

const Native = NativeModules.MomentumInstalledApps as InstalledAppsBridge | undefined;

/**
 * Real launchable apps installed on the device, excluding system-essential
 * packages (already filtered out natively — see EssentialApps.kt).
 *
 * Android only. iOS has no API to enumerate installed apps — Apple doesn't
 * allow it, which is why iOS blocking (Phase 5B) is designed around
 * Apple's own private FamilyActivityPicker instead. Resolves to [] there;
 * callers fall back to the hardcoded defaults-only list.
 */
export async function getInstalledApps(): Promise<InstalledApp[]> {
  if (Platform.OS !== 'android' || !Native) return [];
  try {
    return await Native.getInstalledApps();
  } catch {
    return [];
  }
}
