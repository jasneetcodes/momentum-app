import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import AlarmsScreen from '../app/(main)/AlarmsScreen';
import AnalyticsScreen from '../app/(main)/AnalyticsScreen';
import HomeScreen from '../app/(main)/HomeScreen';
import LockInScreen from '../app/(main)/LockInScreen';
import { useThemeColors } from '../hooks/useThemeColors';
import type { MainTabsParamList } from './types';

const Tab = createBottomTabNavigator<MainTabsParamList>();

type TabName = keyof MainTabsParamList;

const ICON_MAP: Record<TabName, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  Home: { active: 'home', inactive: 'home-outline' },
  Alarms: { active: 'alarm', inactive: 'alarm-outline' },
  LockIn: { active: 'lock-closed', inactive: 'lock-closed-outline' },
  Analytics: { active: 'stats-chart', inactive: 'stats-chart-outline' },
};

export default function MainTabs() {
  const colors = useThemeColors();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.isDark ? '#1A1A1B' : '#EAEAEA',
          borderTopWidth: 0.5,
          height: 84,
          paddingTop: 8,
          paddingBottom: 24,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = ICON_MAP[route.name as TabName];
          return (
            <Ionicons
              name={focused ? icons.active : icons.inactive}
              size={size}
              color={color}
            />
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Alarms" component={AlarmsScreen} />
      <Tab.Screen
        name="LockIn"
        component={LockInScreen}
        options={{ tabBarLabel: 'Lock In' }}
      />
      <Tab.Screen name="Analytics" component={AnalyticsScreen} />
    </Tab.Navigator>
  );
}
