import { createNavigationContainerRef } from '@react-navigation/native';
import type { MainStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<MainStackParamList>();

export function navigateToAlarmRinging(alarmId: string) {
  if (navigationRef.isReady()) {
    navigationRef.navigate('AlarmRinging', { alarmId });
  } else {
    // Retry shortly — happens on cold launch from a notification tap
    setTimeout(() => navigateToAlarmRinging(alarmId), 250);
  }
}
