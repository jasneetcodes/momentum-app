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
};

export type HomeNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabsParamList, 'Home'>,
  NativeStackNavigationProp<MainStackParamList>
>;
