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
};

export type HomeNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabsParamList, 'Home'>,
  NativeStackNavigationProp<MainStackParamList>
>;

export type SettingsNavProp = NativeStackNavigationProp<MainStackParamList, 'Settings'>;
export type ManageTagsNavProp = NativeStackNavigationProp<MainStackParamList, 'ManageTags'>;
