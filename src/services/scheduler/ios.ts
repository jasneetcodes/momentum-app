/**
 * iOS scheduler — interim implementation using `expo-notifications`.
 *
 * This will be replaced in a later phase with a native AlarmKit module
 * (iOS 26+) and a notification-barrage fallback for iOS < 26. The current
 * code mirrors the previous behavior so the platform dispatcher in
 * `./index.ts` works end-to-end without breaking iOS builds.
 */
import * as Notifications from 'expo-notifications';
import type { Alarm } from '../../stores/alarmStore';
import { navigateToAlarmRinging } from '../../navigation/ref';

let initialized = false;

function extractAlarmId(n: Notifications.Notification): string | null {
  const data = n.request.content.data as { alarmId?: unknown } | undefined;
  return typeof data?.alarmId === 'string' ? data.alarmId : null;
}

export async function initializeNotifications(): Promise<void> {
  if (initialized) return;
  initialized = true;

  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const alarmId = extractAlarmId(notification);
      if (alarmId) {
        navigateToAlarmRinging(alarmId);
        return {
          shouldShowAlert: false,
          shouldShowBanner: false,
          shouldShowList: false,
          shouldPlaySound: false,
          shouldSetBadge: false,
        };
      }
      return {
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      };
    },
  });

  Notifications.addNotificationResponseReceivedListener((response) => {
    const alarmId = extractAlarmId(response.notification);
    if (alarmId) navigateToAlarmRinging(alarmId);
  });

  Notifications.addNotificationReceivedListener((notification) => {
    const alarmId = extractAlarmId(notification);
    if (alarmId) navigateToAlarmRinging(alarmId);
  });

  const last = await Notifications.getLastNotificationResponseAsync();
  if (last) {
    const alarmId = extractAlarmId(last.notification);
    if (alarmId) navigateToAlarmRinging(alarmId);
  }
}

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return status === 'granted';
}

async function buildTriggers(alarm: Alarm): Promise<Notifications.NotificationTriggerInput[]> {
  const [hh, mm] = alarm.time.split(':').map(Number);

  if (alarm.days_of_week.length === 0) {
    const fire = new Date();
    fire.setSeconds(0, 0);
    fire.setHours(hh, mm, 0, 0);
    if (fire.getTime() <= Date.now()) fire.setDate(fire.getDate() + 1);
    return [{ type: Notifications.SchedulableTriggerInputTypes.DATE, date: fire }];
  }

  return alarm.days_of_week.map((pgDay) => ({
    type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
    weekday: pgDay + 1,
    hour: hh,
    minute: mm,
  }));
}

export async function scheduleAlarm(alarm: Alarm): Promise<void> {
  await cancelAlarm(alarm.id);
  if (!alarm.is_active) return;

  const title = alarm.label?.trim() || 'Alarm';
  const body = 'Tap your Momentum tag to dismiss.';
  for (const trigger of await buildTriggers(alarm)) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { alarmId: alarm.id },
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.MAX,
        interruptionLevel: 'timeSensitive',
      },
      trigger,
    });
  }
}

export async function cancelAlarm(alarmId: string): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    const data = n.content.data as { alarmId?: unknown } | undefined;
    if (data?.alarmId === alarmId) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
}

export async function rescheduleAll(alarms: Alarm[]): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const a of alarms) {
    if (a.is_active) await scheduleAlarm(a);
  }
}
