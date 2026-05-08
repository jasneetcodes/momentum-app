import './global.css';

import { NavigationContainer } from '@react-navigation/native';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AuthNavigator from './src/navigation/AuthNavigator';
import MainNavigator from './src/navigation/MainNavigator';
import { useAuthStore } from './src/stores/authStore';

export default function App() {
  const session = useAuthStore((s) => s.session);
  const initialized = useAuthStore((s) => s.initialized);
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    const unsubscribe = initialize();
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hold render until the persisted session is restored to prevent auth-stack flash
  if (!initialized) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0E0E0F', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#01BAEF" size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          {session ? <MainNavigator /> : <AuthNavigator />}
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
