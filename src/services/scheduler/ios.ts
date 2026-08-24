/**
 * iOS scheduler.
 *
 * Dispatches per-alarm to one of two backends:
 *
 *   1. AlarmKit (iOS 26+) — native framework, rings through Silent/Focus,
 *      Lock-Screen takeover. Implementation lives in `modules/momentum-alarm-kit`.
 *   2. Notification barrage (iOS 15–25) — 5 `timeSensitive` notifications
 *      spaced 30s apart starting at the fire time. Best-effort fallback —
 *      iOS won't give us a full takeover but timeSensitive bypasses Focus.
 *
 * The shared JS surface above (alarmStore, AlarmRingingScreen, NFC service,
 * deep-link routing) is platform-agnostic. Both paths converge on
 * `momentum://alarm/<id>` → AlarmRingingScreen.
 */
import * as Notifications from 'expo-notifications';
import type { Alarm } from '../../stores/alarmStore';
import { navigateToAlarmRinging } from '../../navigation/ref';
import * as AlarmKit from 'momentum-alarm-kit';

const BARRAGE_COUNT = 5;
const BARRAGE_INTERVAL_SECONDS = 30;

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
  if (status !== 'granted') return false;

  // If AlarmKit is available, ask for its authorization too. Independent of
  // the notification permission — AlarmKit has its own user-facing grant.
  if (await AlarmKit.isAlarmKitAvailable()) {
    await AlarmKit.requestAuthorization();
  }
  return true;
}

/** Read-only check — does not prompt. Used by onboarding to render current status. */
export async function checkNotificationPermissions(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

// ────────────────────────────────────────────────────────────────────────────
// Path 1: AlarmKit (iOS 26+)
// ────────────────────────────────────────────────────────────────────────────

function nextOccurrenceMs(timeHHMM: string, pgWeekday?: number): number {
  const [hh, mm] = timeHHMM.split(':').map(Number);
  const now = new Date();
  const fire = new Date(now);
  fire.setSeconds(0, 0);
  fire.setHours(hh, mm, 0, 0);

  if (pgWeekday === undefined) {
    if (fire.getTime() <= now.getTime()) fire.setDate(fire.getDate() + 1);
    return fire.getTime();
  }
  const currentDow = now.getDay();
  let dayDelta = (pgWeekday - currentDow + 7) % 7;
  if (dayDelta === 0 && fire.getTime() <= now.getTime()) dayDelta = 7;
  fire.setDate(fire.getDate() + dayDelta);
  return fire.getTime();
}

async function scheduleViaAlarmKit(alarm: Alarm): Promise<void> {
  const title = alarm.label?.trim() || 'Alarm';

  if (alarm.days_of_week.length === 0) {
    await AlarmKit.scheduleAlarm({
      id: alarm.id,
      fireDate: nextOccurrenceMs(alarm.time),
      title,
      sound: alarm.sound,
    });
    return;
  }

  // AlarmKit handles weekly recurrence natively via Alarm.Schedule.relative.
  // The native side reads `weekdays` to build the recurrence — we still send
  // a `fireDate` for the next occurrence as a fallback hint.
  await AlarmKit.scheduleAlarm({
    id: alarm.id,
    fireDate: nextOccurrenceMs(alarm.time, alarm.days_of_week[0]),
    weekdays: alarm.days_of_week,
    title,
    sound: alarm.sound,
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Path 2: Notification barrage (iOS 15–25)
// ────────────────────────────────────────────────────────────────────────────

function nextOccurrenceDate(timeHHMM: string, pgWeekday?: number): Date {
  return new Date(nextOccurrenceMs(timeHHMM, pgWeekday));
}

function buildBarrageTriggers(fire: Date): Notifications.NotificationTriggerInput[] {
  const triggers: Notifications.NotificationTriggerInput[] = [];
  for (let i = 0; i < BARRAGE_COUNT; i++) {
    const at = new Date(fire.getTime() + i * BARRAGE_INTERVAL_SECONDS * 1000);
    triggers.push({ type: Notifications.SchedulableTriggerInputTypes.DATE, date: at });
  }
  return triggers;
}

async function scheduleViaBarrage(alarm: Alarm): Promise<void> {
  const title = alarm.label?.trim() || 'Alarm';
  const body = 'Tap your Momentum tag to dismiss.';
  // Sound file must be bundled in the iOS app (Phase B: copy .caf into Xcode
  // project's Copy Bundle Resources). Until then iOS falls back to default.
  const sound = `${alarm.sound}.caf`;

  const fires: Date[] = alarm.days_of_week.length === 0
    ? [nextOccurrenceDate(alarm.time)]
    : alarm.days_of_week.map((dow) => nextOccurrenceDate(alarm.time, dow));

  for (const fire of fires) {
    for (const trigger of buildBarrageTriggers(fire)) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { alarmId: alarm.id },
          sound,
          interruptionLevel: 'timeSensitive',
          categoryIdentifier: 'alarm',
        },
        trigger,
      });
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────

export async function scheduleAlarm(alarm: Alarm): Promise<void> {
  await cancelAlarm(alarm.id);
  if (!alarm.is_active) return;

  if (await AlarmKit.isAlarmKitAvailable()) {
    await scheduleViaAlarmKit(alarm);
  } else {
    await scheduleViaBarrage(alarm);
  }
}

export async function cancelAlarm(alarmId: string): Promise<void> {
  // Cancel both paths regardless of which one scheduled — cheap and safe
  // (each is a no-op if the alarm wasn't scheduled there).
  await AlarmKit.cancelAlarm(alarmId);

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    const data = n.content.data as { alarmId?: unknown } | undefined;
    if (data?.alarmId === alarmId) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
}

export async function rescheduleAll(alarms: Alarm[]): Promise<void> {
  await AlarmKit.cancelAll();
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const a of alarms) {
    if (a.is_active) await scheduleAlarm(a);
  }
}
