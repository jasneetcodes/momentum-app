import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import LoginScreen from './src/app/(auth)/LoginScreen';
import SignupScreen from './src/app/(auth)/SignupScreen';
import WelcomeScreen from './src/app/(auth)/WelcomeScreen';
import { useAuthStore } from './src/stores/authStore';

const AuthStack = createNativeStackNavigator();
const AppStack = createNativeStackNavigator();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Welcome">
      <AuthStack.Screen name="Welcome" component={WelcomeScreen} />
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Signup" component={SignupScreen} />
    </AuthStack.Navigator>
  );
}

// Temporary placeholder — swap out each screen as MVP features are built
function PlaceholderHome() {
  const logout = useAuthStore((s) => s.logout);
  return (
    <View style={{ flex: 1, backgroundColor: '#09090b', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 8 }}>
        Momentum
      </Text>
      <Text style={{ color: '#71717a', fontSize: 14, marginBottom: 32 }}>
        Main app — coming soon
      </Text>
      <TouchableOpacity
        onPress={logout}
        style={{
          paddingHorizontal: 24,
          paddingVertical: 12,
          borderRadius: 12,
          backgroundColor: '#1944F1',
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

function AppNavigator() {
  return (
    <AppStack.Navigator screenOptions={{ headerShown: false }}>
      <AppStack.Screen name="Home" component={PlaceholderHome} />
    </AppStack.Navigator>
  );
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

  // Hold render until the persisted session is restored to prevent auth-stack flash
  if (!initialized) {
    return (
      <View style={{ flex: 1, backgroundColor: '#09090b', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#1944F1" size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          {session ? <AppNavigator /> : <AuthNavigator />}
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
