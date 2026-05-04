import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuthStore } from '../../stores/authStore';
import type { AuthStackParamList } from './WelcomeScreen';

type NavProp = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

export default function LoginScreen() {
  const navigation = useNavigation<NavProp>();
  const { login, loading } = useAuthStore();

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
    if (err) {
      setError(err);
    }
    // On success, the root navigator detects the new session and redirects automatically.
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-zinc-950">
      <StatusBar barStyle="light-content" />
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
            {/* Back */}
            <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
              <Text className="text-zinc-500 dark:text-zinc-400 text-base">← Back</Text>
            </TouchableOpacity>

            {/* Header */}
            <View className="mt-10 mb-8">
              <Text className="text-zinc-900 dark:text-white text-3xl font-bold">
                Welcome back
              </Text>
              <Text className="text-zinc-500 dark:text-zinc-400 text-base mt-2">
                Log in to your account.
              </Text>
            </View>

            {/* Form */}
            <View className="gap-4">
              <View>
                <Text className="text-zinc-600 dark:text-zinc-400 text-sm font-medium mb-1.5">
                  Email
                </Text>
                <TextInput
                  className="bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-xl px-4 py-3.5 text-base"
                  placeholder="you@example.com"
                  placeholderTextColor="#71717a"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View>
                <Text className="text-zinc-600 dark:text-zinc-400 text-sm font-medium mb-1.5">
                  Password
                </Text>
                <TextInput
                  className="bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-xl px-4 py-3.5 text-base"
                  placeholder="Your password"
                  placeholderTextColor="#71717a"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>
            </View>

            {/* Error */}
            {error ? (
              <Text className="text-red-500 text-sm mt-4">{error}</Text>
            ) : null}

            {/* Submit */}
            <TouchableOpacity
              className="w-full py-4 rounded-2xl items-center mt-8"
              style={{ backgroundColor: '#1944F1' }}
              onPress={handleLogin}
              activeOpacity={0.85}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-semibold text-base">Log In</Text>
              )}
            </TouchableOpacity>

            {/* Footer */}
            <View className="flex-row justify-center mt-6">
              <Text className="text-zinc-500 dark:text-zinc-400 text-sm">
                Don't have an account?{' '}
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Signup')} activeOpacity={0.7}>
                <Text className="text-sm font-semibold" style={{ color: '#1944F1' }}>
                  Sign up
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
