import { Platform, requireNativeModule } from 'expo-modules-core';

/**
 * Native bridge to Apple's AlarmKit framework (iOS 26+, WWDC 2025).
 *
 * AlarmKit is the only path to "true" alarm-clock behaviour on iOS — rings
 * through Silent + Focus, shows full-screen on the Lock Screen, runs natively
 * without the app open. The framework was introduced at WWDC 2025 and is
 * gated behind iOS 26+ at runtime AND build time.
 *
 * On iOS < 26 (or Android, or when AlarmKit headers aren't available at
 * build time) `isAlarmKitAvailable()` returns false and the caller should
 * fall back to expo-notifications. The dispatcher in
 * `src/services/scheduler/ios.ts` handles that branch.
 */

export type AlarmKitInput = {
  /** Stable alarm id from the alarms table — used to dedupe + cancel. */
  id: string;
  /** Fire time as epoch ms. For weekly recurrence pass the next occurrence. */
  fireDate: number;
  /** [] or undefined = one-off. Otherwise array of pgWeekday values (0=Sun..6=Sat). */
  weekdays?: number[];
  /** Notification title shown in the AlarmKit alert. */
  title: string;
  /** Sound id matching a bundled .caf file (chime, bell, pulse, siren, ...). */
  sound: string;
};

export type AlarmKitAuthStatus = 'authorized' | 'denied' | 'notDetermined';

interface AlarmKitNativeBridge {
  isAlarmKitAvailable: () => Promise<boolean>;
  requestAuthorization: () => Promise<AlarmKitAuthStatus>;
  scheduleAlarm: (input: AlarmKitInput) => Promise<void>;
  cancelAlarm: (id: string) => Promise<void>;
  cancelAll: () => Promise<void>;
  stopAlarm: (id: string) => Promise<void>;
}

// Load the native module lazily and tolerate it being unlinked (Android,
// pre-build, etc.) — that's a normal state, not an error.
let Native: AlarmKitNativeBridge | null = null;
function getNative(): AlarmKitNativeBridge | null {
  if (Native) return Native;
  if (Platform.OS !== 'ios') return null;
  try {
    Native = requireNativeModule<AlarmKitNativeBridge>('MomentumAlarmKit');
    return Native;
  } catch {
    return null;
  }
}

/** True only on iOS 26+ with the framework linked. Always false on Android. */
export async function isAlarmKitAvailable(): Promise<boolean> {
  const n = getNative();
  if (!n) return false;
  try {
    return await n.isAlarmKitAvailable();
  } catch {
    return false;
  }
}

export async function requestAuthorization(): Promise<AlarmKitAuthStatus> {
  const n = getNative();
  if (!n) return 'denied';
  return n.requestAuthorization();
}

export async function scheduleAlarm(input: AlarmKitInput): Promise<void> {
  const n = getNative();
  if (!n) return;
  await n.scheduleAlarm(input);
}

export async function cancelAlarm(id: string): Promise<void> {
  const n = getNative();
  if (!n) return;
  await n.cancelAlarm(id);
}

export async function cancelAll(): Promise<void> {
  const n = getNative();
  if (!n) return;
  await n.cancelAll();
}

export async function stopAlarm(id: string): Promise<void> {
  const n = getNative();
  if (!n) return;
  await n.stopAlarm(id);
}
