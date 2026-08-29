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

type NavProp = NativeStackNavigationProp<AuthStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen() {
  const navigation = useNavigation<NavProp>();
  const requestPasswordReset = useAuthStore((s) => s.requestPasswordReset);
  const { barStyle } = useThemeColors();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (!email.trim()) {
      setError('Enter your email address.');
      return;
    }
    setLoading(true);
    const err = await requestPasswordReset(email.trim());
    setLoading(false);
    if (err) {
      setError(err);
      return;
    }
    setSent(true);
  };

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
              <Text variant="heading" className="text-3xl">Reset password</Text>
              <Text variant="muted" className="text-base mt-2">
                {sent
                  ? "Check your email for a link to reset your password."
                  : "Enter your email and we'll send you a link to reset your password."}
              </Text>
            </View>

            {!sent && (
              <>
                <Input
                  label="Email"
                  placeholder="you@example.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                {error ? (
                  <Text className="text-red-500 text-sm mt-4">{error}</Text>
                ) : null}

                <Button
                  label="Send reset link"
                  fullWidth
                  loading={loading}
                  onPress={handleSubmit}
                  className="mt-8"
                />
              </>
            )}

            {sent && (
              <Button
                label="Back to login"
                variant="secondary"
                fullWidth
                onPress={() => navigation.navigate('Login')}
                className="mt-4"
              />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
