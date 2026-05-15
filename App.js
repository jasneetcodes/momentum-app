import './global.css';

import { NavigationContainer } from '@react-navigation/native';
import notifee from '@notifee/react-native';
import React, { useEffect } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AuthNavigator from './src/navigation/AuthNavigator';
import MainNavigator from './src/navigation/MainNavigator';
import { navigationRef, navigateToAlarmRinging } from './src/navigation/ref';
import {
  initializeNotifications,
  requestNotificationPermissions,
} from './src/services/scheduler';
import { useAuthStore } from './src/stores/authStore';
import { useAlarmLogStore } from './src/stores/alarmLogStore';
import { useModeSessionStore } from './src/stores/modeSessionStore';
import { useModeStore } from './src/stores/modeStore';

async function reconcileActiveAlarm() {
  const store = useAlarmLogStore.getState();
  const persistedId = await store.loadActiveAlarmId();

  // Source of truth: a CURRENTLY displayed alarm notification. If none is
  // displayed, the alarm is no longer firing — clear any stale persisted id
  // and bail. This guards against a previous session leaving `activeAlarmId`
  // set without a real running alarm.
  let displayedId = null;
  try {
    const displayed = await notifee.getDisplayedNotifications();
    for (const d of displayed) {
      const candidate = d.notification?.data?.alarmId;
      if (candidate) {
        displayedId = String(candidate);
        break;
      }
    }
  } catch {}

  if (!displayedId) {
    // No active alarm notification. Wipe any stale persisted id.
    if (persistedId) await store.setActiveAlarmId(null);
    return;
  }

  // Keep the store in sync with the OS truth
  if (persistedId !== displayedId) await store.setActiveAlarmId(displayedId);

  const current = navigationRef.getCurrentRoute?.();
  if (current?.name === 'AlarmRinging') return;
  navigateToAlarmRinging(displayedId);
}

export default function App() {
  const session = useAuthStore((s) => s.session);
  const initialized = useAuthStore((s) => s.initialized);
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    const unsubscribe = initialize();
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    initializeNotifications();
    requestNotificationPermissions();
  }, []);

  // After the navigation tree is ready, reconcile any in-flight alarm.
  // Also rerun whenever the app comes back to the foreground.
  useEffect(() => {
    if (!session) return;
    reconcileActiveAlarm();
    // Hydrate mode session: on Android the FGS may have kept blocking alive
    // while the JS bundle was dead. Pull the open session (if any) so the
    // UI shows the correct state.
    useModeSessionStore.getState().hydrate();
    useModeStore.getState().loadSelectedMode();
    useModeStore.getState().fetchModes();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        reconcileActiveAlarm();
        useModeSessionStore.getState().hydrate();
      }
    });
    return () => sub.remove();
  }, [session]);

  // Hold render until the persisted session is restored to prevent auth-stack flash
  if (!initialized) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0E0E0F', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#01BAEF" size="large" />
      </View>
    );
  }

  const linking = {
    prefixes: ['momentum://'],
    config: {
      screens: {
        AlarmRinging: 'alarm/:alarmId',
      },
    },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer
          ref={navigationRef}
          linking={linking}
          onReady={() => {
            if (session) reconcileActiveAlarm();
          }}
        >
          {session ? <MainNavigator /> : <AuthNavigator />}
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
