import { Alert, Linking, Platform } from 'react-native';
import {
  canUseFullScreenIntent,
  openFullScreenIntentSettings,
} from './alarmAudio';

/**
 * On Android 14+ the `USE_FULL_SCREEN_INTENT` permission is special-access.
 * If the user hasn't granted it, alarms can fire as notifications but won't
 * launch our full-screen UI on the lock screen. Prompts the user once, opens
 * the system Settings screen, returns true if (now) granted.
 */
export async function ensureFullScreenIntentGranted(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  const ok = await canUseFullScreenIntent();
  if (ok) return true;

  return new Promise((resolve) => {
    Alert.alert(
      'Allow full-screen alarms',
      'Momentum needs the "Full-screen alerts" permission so your alarm can ring over the lock screen. Tap Open Settings and toggle it on.',
      [
        { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
        {
          text: 'Open Settings',
          onPress: async () => {
            const opened = await openFullScreenIntentSettings();
            if (!opened) {
              // Fallback: notification settings page
              Linking.openSettings().catch(() => {});
            }
            resolve(false); // User has to come back manually; we'll re-check on next save
          },
        },
      ],
    );
  });
}
