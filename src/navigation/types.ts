import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type MainTabsParamList = {
  Home: undefined;
  Alarms: undefined;
  LockIn: undefined;
  Analytics: undefined;
};

export type MainStackParamList = {
  MainTabs: undefined;
  Settings: undefined;
  ManageTags: undefined;
  NFCRegister: undefined;
  AlarmSetup: { alarmId?: string };
  AlarmRinging: { alarmId: string };
  PostAlarmBlock: { alarmId: string };
};

export type RootNavProp = NativeStackNavigationProp<MainStackParamList>;

export type HomeNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabsParamList, 'Home'>,
  NativeStackNavigationProp<MainStackParamList>
>;

export type AlarmsNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabsParamList, 'Alarms'>,
  NativeStackNavigationProp<MainStackParamList>
>;

export type SettingsNavProp = NativeStackNavigationProp<MainStackParamList, 'Settings'>;
export type ManageTagsNavProp = NativeStackNavigationProp<MainStackParamList, 'ManageTags'>;
