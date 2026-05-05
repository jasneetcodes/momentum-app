import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Text } from '../../components/Text';
import { useAuthStore } from '../../stores/authStore';
import type { AuthStackParamList } from './WelcomeScreen';

type NavProp = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

export default function LoginScreen() {
  const navigation = useNavigation<NavProp>();
  const { login, loading } = useAuthStore();
  const isDark = useColorScheme() === 'dark';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required.');
      return;
    }
    const err = await login(email.trim(), password);
    if (err) setError(err);
  };

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-1 px-6 pt-8 pb-10">
            <Pressable onPress={() => navigation.goBack()}>
              <Text variant="muted" className="text-base">← Back</Text>
            </Pressable>

            <View className="mt-10 mb-8">
              <Text variant="heading" className="text-3xl">Welcome back</Text>
              <Text variant="muted" className="text-base mt-2">Log in to your account.</Text>
            </View>

            <View className="gap-4">
              <Input
                label="Email"
                placeholder="you@example.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Input
                label="Password"
                placeholder="Your password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            {error ? (
              <Text className="text-red-500 text-sm mt-4">{error}</Text>
            ) : null}

            <Button
              label="Log In"
              fullWidth
              loading={loading}
              onPress={handleLogin}
              className="mt-8"
            />

            <View className="flex-row justify-center mt-6">
              <Text variant="muted">Don't have an account? </Text>
              <Pressable onPress={() => navigation.navigate('Signup')}>
                <Text className="text-sm font-semibold text-accent">Sign up</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
