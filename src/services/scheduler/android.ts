import notifee, {
  AndroidCategory,
  AndroidImportance,
  AndroidVisibility,
  AuthorizationStatus,
  EventType,
  TriggerType,
  type TimestampTrigger,
} from '@notifee/react-native';
import { NativeModules } from 'react-native';
import type { Alarm } from '../../stores/alarmStore';
import { navigateToAlarmRinging } from '../../navigation/ref';
import { useAlarmLogStore } from '../../stores/alarmLogStore';
import { startNativeAlarmAudio } from '../alarmAudio';

const AlarmAudio = NativeModules.MomentumAlarmAudio;

const CHANNEL_ID = 'alarms';
const LAUNCH_ACTIVITY = 'com.momentumapp.MainActivity';

let initialized = false;

function nextOccurrence(timeHHMM: string, pgWeekday?: number): Date {
  const [hh, mm] = timeHHMM.split(':').map(Number);
  const now = new Date();
  const fire = new Date(now);
  fire.setSeconds(0, 0);
  fire.setHours(hh, mm, 0, 0);

  if (pgWeekday === undefined) {
    if (fire.getTime() <= now.getTime()) fire.setDate(fire.getDate() + 1);
    return fire;
  }
  const currentDow = now.getDay();
  let dayDelta = (pgWeekday - currentDow + 7) % 7;
  if (dayDelta === 0 && fire.getTime() <= now.getTime()) dayDelta = 7;
  fire.setDate(fire.getDate() + dayDelta);
  return fire;
}

function notificationIdFor(alarmId: string, pgWeekday: number | null): string {
  return pgWeekday === null ? `alarm-${alarmId}-once` : `alarm-${alarmId}-d${pgWeekday}`;
}

export async function initializeNotifications(): Promise<void> {
  if (initialized) return;
  initialized = true;

  // Silent channel — the foreground service is the only audio source. We keep
  // vibration off here too; the lock-screen notification is just metadata.
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Alarms',
    importance: AndroidImportance.HIGH,
    sound: undefined,
    vibration: false,
    bypassDnd: true,
    visibility: AndroidVisibility.PUBLIC,
  });

  // Foreground event handler — fires when the app is open and a notification
  // is delivered, or when the user taps a notification while the app is
  // running. Background headless deliveries are handled in `index.js`.
  //
  // IMPORTANT: do NOT listen for TRIGGER_NOTIFICATION_CREATED — that event
  // fires every time we *schedule* a notification (e.g. when rescheduleAll
  // runs on app open), not when it actually fires. Listening to it would
  // re-trigger the alarm UI on every save/refresh.
  notifee.onForegroundEvent(async ({ type, detail }) => {
    const alarmId = detail.notification?.data?.alarmId;
    const sound = detail.notification?.data?.sound;
    if (!alarmId) return;

    if (type === EventType.DELIVERED || type === EventType.PRESS) {
      await useAlarmLogStore.getState().setActiveAlarmId(String(alarmId));
      startNativeAlarmAudio(String(sound ?? 'chime'), String(alarmId)).catch(() => {});
      navigateToAlarmRinging(String(alarmId));
    }
  });

  // Cold-launch via notification tap
  const initial = await notifee.getInitialNotification();
  if (initial?.notification?.data?.alarmId) {
    const id = String(initial.notification.data.alarmId);
    await useAlarmLogStore.getState().setActiveAlarmId(id);
    navigateToAlarmRinging(id);
  }
}

export async function requestNotificationPermissions(): Promise<boolean> {
  const settings = await notifee.requestPermission();
  return settings.authorizationStatus === AuthorizationStatus.AUTHORIZED;
}

/** Read-only check — does not prompt. Used by onboarding to render current status. */
export async function checkNotificationPermissions(): Promise<boolean> {
  const settings = await notifee.getNotificationSettings();
  return settings.authorizationStatus === AuthorizationStatus.AUTHORIZED;
}

async function scheduleOne(alarm: Alarm, pgWeekday: number | null): Promise<void> {
  const fire = nextOccurrence(alarm.time, pgWeekday ?? undefined);
  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: fire.getTime(),
    alarmManager: { allowWhileIdle: true },
  };

  await notifee.createTriggerNotification(
    {
      id: notificationIdFor(alarm.id, pgWeekday),
      title: alarm.label?.trim() || 'Alarm',
      body: 'Tap your Momentum tag to dismiss.',
      // `sound` is read by the background handler to start the foreground
      // service with the right audio resource — it is NOT used by Notifee to
      // play a notification sound (we explicitly silence the channel).
      data: { alarmId: alarm.id, pgWeekday: pgWeekday ?? '', sound: alarm.sound },
      android: {
        channelId: CHANNEL_ID,
        category: AndroidCategory.ALARM,
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        smallIcon: 'ic_launcher',
        color: '#01BAEF',
        ongoing: true,
        autoCancel: false,
        fullScreenAction: { id: 'default', launchActivity: LAUNCH_ACTIVITY },
        pressAction: { id: 'default', launchActivity: LAUNCH_ACTIVITY },
      },
    },
    trigger,
  );

  // setAlarmClock() fires AlarmTriggerReceiver, which starts AlarmAudioService
  // as a foreground service. The foreground service has a Background Activity
  // Launch exemption window, so its startActivity() call into MainActivity
  // succeeds even when the app is killed and the screen is unlocked — the
  // case where Notifee's fullScreenAction degrades to a silent heads-up.
  AlarmAudio?.scheduleAlarmActivity(fire.getTime(), alarm.id, pgWeekday ?? -1, alarm.sound).catch(() => {});
}

export async function scheduleAlarm(alarm: Alarm): Promise<void> {
  await cancelAlarm(alarm.id);
  if (!alarm.is_active) return;

  if (alarm.days_of_week.length === 0) {
    await scheduleOne(alarm, null);
    return;
  }
  for (const dow of alarm.days_of_week) {
    await scheduleOne(alarm, dow);
  }
}

export async function cancelAlarm(alarmId: string): Promise<void> {
  const all = await notifee.getTriggerNotificationIds();
  const mine = all.filter((id) => id.startsWith(`alarm-${alarmId}-`));
  for (const id of mine) {
    await notifee.cancelTriggerNotification(id);
  }
  AlarmAudio?.cancelAlarmActivities(alarmId).catch(() => {});
}

export async function rescheduleAll(alarms: Alarm[]): Promise<void> {
  const all = await notifee.getTriggerNotificationIds();
  for (const id of all) {
    if (id.startsWith('alarm-')) await notifee.cancelTriggerNotification(id);
  }
  for (const a of alarms) {
    if (a.is_active) await scheduleAlarm(a);
  }
}
