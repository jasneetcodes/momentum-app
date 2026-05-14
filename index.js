import { registerRootComponent } from 'expo';
import notifee, { EventType } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules } from 'react-native';

import App from './App';

const ACTIVE_ALARM_KEY = '@momentum/activeAlarmId';

/**
 * Notifee background event handler.
 *
 * Runs in headless JS — fires whether the app is foreground, background, or
 * fully killed. When an alarm trigger fires we want two things to happen
 * within ~1 s, *before* the React UI is necessarily ready:
 *
 *   1. Start the native foreground audio service so the loud alarm-stream
 *      MediaPlayer kicks in (bypasses ringer-silent + DND).
 *   2. Persist `activeAlarmId` so any later UI entry path (full-screen-intent
 *      activity launch, user tapping the launcher icon, resume from recents)
 *      can route straight to AlarmRinging.
 *
 * Without this handler the alarm just shows a silent notification card and
 * relies on the user to tap it — exactly the bug we're fixing.
 */
notifee.onBackgroundEvent(async ({ type, detail }) => {
  const alarmId = detail.notification?.data?.alarmId;
  const sound = detail.notification?.data?.sound;
  if (!alarmId) return;

  // Only act on actual deliveries (the trigger time elapsed) — NOT on
  // TRIGGER_NOTIFICATION_CREATED, which fires every time we schedule a
  // notification (e.g. when rescheduleAll runs on app open).
  if (type === EventType.DELIVERED) {
    try {
      await AsyncStorage.setItem(ACTIVE_ALARM_KEY, String(alarmId));
    } catch {}
    try {
      await NativeModules.MomentumAlarmAudio?.start(
        String(sound ?? 'chime'),
        String(alarmId),
      );
    } catch {}
  }
});

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
