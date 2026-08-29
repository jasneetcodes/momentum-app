import './global.css';

import { NavigationContainer } from '@react-navigation/native';
import notifee from '@notifee/react-native';
import { useFonts } from 'expo-font';
import React, { useEffect } from 'react';
import { ActivityIndicator, AppState, Linking, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FONT_ASSETS } from './src/constants/fonts';
import AuthNavigator from './src/navigation/AuthNavigator';
import MainNavigator from './src/navigation/MainNavigator';
import OnboardingScreen from './src/app/OnboardingScreen';
import ResetPasswordScreen from './src/app/ResetPasswordScreen';
import { navigationRef, navigateToAlarmRinging } from './src/navigation/ref';
import { initializeNotifications } from './src/services/scheduler';
import { supabase } from './src/services/supabase';
import { useAuthStore } from './src/stores/authStore';
import { useAlarmLogStore } from './src/stores/alarmLogStore';
import { useModeSessionStore } from './src/stores/modeSessionStore';
import { useModeStore } from './src/stores/modeStore';
import { useOnboardingStore } from './src/stores/onboardingStore';

// Manual fragment parser — deliberately not URLSearchParams, which isn't
// guaranteed to be polyfilled on Hermes in this project. Handles
// "momentum://reset-password#access_token=...&refresh_token=...&type=recovery",
// the shape Supabase's implicit-flow recovery redirect produces.
function parseUrlFragment(url) {
  const hashIndex = url.indexOf('#');
  if (hashIndex === -1) return {};
  const fragment = url.slice(hashIndex + 1);
  const params = {};
  for (const pair of fragment.split('&')) {
    if (!pair) continue;
    const [key, value] = pair.split('=');
    if (!key) continue;
    params[decodeURIComponent(key)] = value ? decodeURIComponent(value) : '';
  }
  return params;
}

/**
 * Handles the "forgot password" email link. Supabase's implicit-flow
 * recovery redirect carries the session tokens in the URL fragment rather
 * than a query string, and — unlike verifyOtp()/PKCE — a plain setSession()
 * call here does NOT make the SDK emit a tagged PASSWORD_RECOVERY event, so
 * "we're in recovery mode" has to be our own flag, set directly from the
 * type=recovery param before the session state updates (avoids a one-frame
 * flash of the main app).
 */
async function handleIncomingUrl(url) {
  if (!url) return;
  const params = parseUrlFragment(url);
  if (params.type !== 'recovery' || !params.access_token || !params.refresh_token) return;

  useAuthStore.getState().setRecoveryMode(true);
  await supabase.auth.setSession({
    access_token: params.access_token,
    refresh_token: params.refresh_token,
  });
}

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
  const [fontsLoaded] = useFonts(FONT_ASSETS);

  const session = useAuthStore((s) => s.session);
  const initialized = useAuthStore((s) => s.initialized);
  const initialize = useAuthStore((s) => s.initialize);
  const recoveryMode = useAuthStore((s) => s.recoveryMode);

  const onboardingCompleted = useOnboardingStore((s) => s.completed);
  const onboardingHydrated = useOnboardingStore((s) => s.hydrated);
  const hydrateOnboarding = useOnboardingStore((s) => s.hydrate);

  useEffect(() => {
    const unsubscribe = initialize();
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    hydrateOnboarding();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    initializeNotifications();
  }, []);

  // Password-recovery deep link — cold start (app was killed) and
  // warm/background (app already running) both need handling.
  useEffect(() => {
    Linking.getInitialURL().then((url) => { if (url) handleIncomingUrl(url); });
    const sub = Linking.addEventListener('url', ({ url }) => handleIncomingUrl(url));
    return () => sub.remove();
  }, []);

  // After the navigation tree is ready, reconcile any in-flight alarm.
  // Also rerun whenever the app comes back to the foreground. Gated on
  // onboarding being complete and not being in password-recovery mode —
  // MainNavigator (and its AlarmRinging route) isn't mounted in either of
  // those states, so navigating there would fail.
  useEffect(() => {
    if (!session || !onboardingCompleted || recoveryMode) return;
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
  }, [session, onboardingCompleted, recoveryMode]);

  // Hold render until fonts are loaded and the persisted session + onboarding
  // flag are restored, to prevent an auth-stack / onboarding flash and to
  // guarantee Archivo/JetBrains Mono never silently fall back to a system
  // font on first paint.
  if (!fontsLoaded || !initialized || !onboardingHydrated) {
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
            if (session && onboardingCompleted && !recoveryMode) reconcileActiveAlarm();
          }}
        >
          {session ? (
            recoveryMode ? (
              <ResetPasswordScreen />
            ) : onboardingCompleted ? (
              <MainNavigator />
            ) : (
              <OnboardingScreen />
            )
          ) : (
            <AuthNavigator />
          )}
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
