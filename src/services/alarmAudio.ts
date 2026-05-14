import { NativeModules, Platform } from 'react-native';

interface AlarmAudioBridge {
  start: (soundRes: string, alarmId: string) => Promise<void>;
  stop: () => Promise<void>;
  canUseFullScreenIntent: () => Promise<boolean>;
  openFullScreenIntentSettings: () => Promise<boolean>;
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
