import { Platform } from 'react-native';
import type { Alarm } from '../../stores/alarmStore';

import * as android from './android';
import * as ios from './ios';

const impl = Platform.OS === 'android' ? android : ios;

export const initializeNotifications = impl.initializeNotifications;
export const requestNotificationPermissions = impl.requestNotificationPermissions;
export const scheduleAlarm = impl.scheduleAlarm;
export const cancelAlarm = impl.cancelAlarm;
export const rescheduleAll = impl.rescheduleAll;

export type AlarmInput = Alarm;
