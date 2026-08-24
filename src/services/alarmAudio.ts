import { NativeModules, Platform } from 'react-native';

interface AlarmAudioBridge {
  start: (soundRes: string, alarmId: string) => Promise<void>;
  stop: () => Promise<void>;
  canUseFullScreenIntent: () => Promise<boolean>;
  openFullScreenIntentSettings: () => Promise<boolean>;
  isKeyguardSecure: () => Promise<boolean>;
  requestKeyguardDismiss: () => Promise<void>;
  canScheduleExactAlarms: () => Promise<boolean>;
  openExactAlarmSettings: () => Promise<boolean>;
  isIgnoringBatteryOptimizations: () => Promise<boolean>;
  requestIgnoreBatteryOptimizations: () => Promise<boolean>;
}

const Native = NativeModules.MomentumAlarmAudio as AlarmAudioBridge | undefined;

/** Start the native foreground alarm audio loop. Android only. No-op elsewhere. */
export async function startNativeAlarmAudio(soundId: string, alarmId: string): Promise<void> {
  if (Platform.OS !== 'android' || !Native) return;
  try {
    await Native.start(soundId, alarmId);
  } catch {}
}

/** Stop the native foreground alarm audio loop. Android only. No-op elsewhere. */
export async function stopNativeAlarmAudio(): Promise<void> {
  if (Platform.OS !== 'android' || !Native) return;
  try {
    await Native.stop();
  } catch {}
}

/** Android 14+ requires user grant of USE_FULL_SCREEN_INTENT. Returns true otherwise. */
export async function canUseFullScreenIntent(): Promise<boolean> {
  if (Platform.OS !== 'android' || !Native) return true;
  try {
    return await Native.canUseFullScreenIntent();
  } catch {
    return true;
  }
}

/** Open the system Settings page where the user grants USE_FULL_SCREEN_INTENT. */
export async function openFullScreenIntentSettings(): Promise<boolean> {
  if (Platform.OS !== 'android' || !Native) return false;
  try {
    return await Native.openFullScreenIntentSettings();
  } catch {
    return false;
  }
}

/** Returns true if the device has a PIN/pattern/biometric lock screen. Android only. */
export async function isKeyguardSecure(): Promise<boolean> {
  if (Platform.OS !== 'android' || !Native) return false;
  try {
    return await Native.isKeyguardSecure();
  } catch {
    return false;
  }
}

/**
 * Request the keyguard to dismiss — call when the user taps the NFC ring on
 * the alarm screen. On devices with no PIN this is a no-op; on PIN/biometric
 * devices it triggers the authentication prompt. Android only.
 */
export async function requestKeyguardDismiss(): Promise<void> {
  if (Platform.OS !== 'android' || !Native) return;
  try {
    await Native.requestKeyguardDismiss();
  } catch {}
}

/** Android 12+ requires "Alarms & reminders" access for exact alarms to fire on schedule. */
export async function canScheduleExactAlarms(): Promise<boolean> {
  if (Platform.OS !== 'android' || !Native) return true;
  try {
    return await Native.canScheduleExactAlarms();
  } catch {
    return true;
  }
}

/** Opens the system "Alarms & reminders" settings page where the user grants exact-alarm access. */
export async function openExactAlarmSettings(): Promise<boolean> {
  if (Platform.OS !== 'android' || !Native) return false;
  try {
    return await Native.openExactAlarmSettings();
  } catch {
    return false;
  }
}

/** Whether Momentum is exempt from battery optimization. Recommended, not required. */
export async function isIgnoringBatteryOptimizations(): Promise<boolean> {
  if (Platform.OS !== 'android' || !Native) return true;
  try {
    return await Native.isIgnoringBatteryOptimizations();
  } catch {
    return true;
  }
}

/** Opens the system "ignore battery optimizations" prompt for this app. */
export async function requestIgnoreBatteryOptimizations(): Promise<boolean> {
  if (Platform.OS !== 'android' || !Native) return false;
  try {
    return await Native.requestIgnoreBatteryOptimizations();
  } catch {
    return false;
  }
}
