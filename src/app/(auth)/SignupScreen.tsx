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

type NavProp = NativeStackNavigationProp<AuthStackParamList, 'Signup'>;

export default function SignupScreen() {
  const navigation = useNavigation<NavProp>();
  const { signup, loading } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);

  const handleSignup = async () => {
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError('Email and password are required.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    const err = await signup(email.trim(), password);
    if (err) {
      setError(err);
    } else {
      // Supabase requires email confirmation by default — session stays null.
      // The root navigator will auto-redirect once the session is established.
      setPendingConfirmation(true);
    }
  };

  if (pendingConfirmation) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-zinc-950 items-center justify-center px-8">
        <StatusBar barStyle="light-content" />
        <View
          className="w-14 h-14 rounded-2xl items-center justify-center mb-6"
          style={{ backgroundColor: '#1944F1' }}
        >
          <Text className="text-white text-xl font-bold">M</Text>
        </View>
        <Text className="text-zinc-900 dark:text-white text-2xl font-bold mb-3 text-center">
          Check your inbox
        </Text>
        <Text className="text-zinc-500 dark:text-zinc-400 text-base text-center leading-relaxed">
          We sent a confirmation link to{' '}
          <Text className="font-semibold text-zinc-800 dark:text-zinc-200">{email}</Text>. Open it
          to activate your account.
        </Text>
        <TouchableOpacity
          className="mt-10"
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.7}
        >
          <Text className="text-base font-semibold" style={{ color: '#1944F1' }}>
            Back to Log In
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

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
                Create account
              </Text>
              <Text className="text-zinc-500 dark:text-zinc-400 text-base mt-2">
                Get started with Momentum.
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
                  placeholder="Min. 6 characters"
                  placeholderTextColor="#71717a"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>

              <View>
                <Text className="text-zinc-600 dark:text-zinc-400 text-sm font-medium mb-1.5">
                  Confirm password
                </Text>
                <TextInput
                  className="bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-xl px-4 py-3.5 text-base"
                  placeholder="Repeat your password"
                  placeholderTextColor="#71717a"
                  value={confirm}
                  onChangeText={setConfirm}
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
              onPress={handleSignup}
              activeOpacity={0.85}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-semibold text-base">Create Account</Text>
              )}
            </TouchableOpacity>

            {/* Footer */}
            <View className="flex-row justify-center mt-6">
              <Text className="text-zinc-500 dark:text-zinc-400 text-sm">
                Already have an account?{' '}
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')} activeOpacity={0.7}>
                <Text className="text-sm font-semibold" style={{ color: '#1944F1' }}>
                  Log in
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
