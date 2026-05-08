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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Text } from '../../components/Text';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useAuthStore } from '../../stores/authStore';
import type { AuthStackParamList } from './WelcomeScreen';

type NavProp = NativeStackNavigationProp<AuthStackParamList, 'Signup'>;

export default function SignupScreen() {
  const navigation = useNavigation<NavProp>();
  const { signup, loading } = useAuthStore();
  const { barStyle } = useThemeColors();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);

  const handleSignup = async () => {
    setError(null);
    if (!firstName.trim() || !lastName.trim()) {
      setError('First and last name are required.');
      return;
    }
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
    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    const err = await signup(email.trim(), password, fullName);
    if (err) setError(err);
    else setPendingConfirmation(true);
  };

  if (pendingConfirmation) {
    return (
      <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark items-center justify-center px-8">
        <StatusBar barStyle={barStyle} />
        <View className="w-14 h-14 rounded-2xl items-center justify-center mb-6 bg-accent">
          <Text className="text-white text-xl font-bold">M</Text>
        </View>
        <Text variant="heading" className="mb-3 text-center">Check your inbox</Text>
        <Text variant="muted" className="text-base text-center">
          We sent a confirmation link to{' '}
          <Text className="font-semibold">{email}</Text>. Open it to activate your account.
        </Text>
        <Pressable className="mt-10" onPress={() => navigation.navigate('Login')}>
          <Text className="text-base font-semibold text-accent">Back to Log In</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <StatusBar barStyle={barStyle} />
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
              <Text variant="heading" className="text-3xl">Create account</Text>
              <Text variant="muted" className="text-base mt-2">Get started with Momentum.</Text>
            </View>

            <View className="gap-4">
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Input
                    label="First name"
                    placeholder="First"
                    value={firstName}
                    onChangeText={setFirstName}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                </View>
                <View className="flex-1">
                  <Input
                    label="Last name"
                    placeholder="Last"
                    value={lastName}
                    onChangeText={setLastName}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                </View>
              </View>
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
                placeholder="Min. 6 characters"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              <Input
                label="Confirm password"
                placeholder="Repeat your password"
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry
              />
            </View>

            {error ? (
              <Text className="text-red-500 text-sm mt-4">{error}</Text>
            ) : null}

            <Button
              label="Create Account"
              fullWidth
              loading={loading}
              onPress={handleSignup}
              className="mt-8"
            />

            <View className="flex-row justify-center mt-6">
              <Text variant="muted">Already have an account? </Text>
              <Pressable onPress={() => navigation.navigate('Login')}>
                <Text className="text-sm font-semibold text-accent">Log in</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
