import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Text } from '../components/Text';
import { useThemeColors } from '../hooks/useThemeColors';
import { useAuthStore } from '../stores/authStore';

/**
 * Shown instead of the main app whenever authStore.recoveryMode is true —
 * i.e. the user arrived via a "forgot password" email link, which sets a
 * real (short-lived) session via supabase.auth.setSession(). Deliberately
 * not part of AuthNavigator: it requires that active session to call
 * updateUser(), so it's gated at the App.js root alongside OnboardingScreen.
 */
export default function ResetPasswordScreen() {
  const { barStyle } = useThemeColors();
  const updateUserPassword = useAuthStore((s) => s.updateUserPassword);
  const setRecoveryMode = useAuthStore((s) => s.setRecoveryMode);
  const logout = useAuthStore((s) => s.logout);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    const err = await updateUserPassword(password);
    setLoading(false);
    if (err) {
      setError(err);
      return;
    }
    Alert.alert('Password updated', 'You can now use your new password to log in.');
    setRecoveryMode(false);
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
          <View className="flex-1 px-6 pt-8 pb-10 justify-center">
            <Text variant="heading" className="text-3xl">Set a new password</Text>
            <Text variant="muted" className="text-base mt-2">
              Choose a new password for your account.
            </Text>

            <View className="gap-4 mt-8">
              <Input
                label="New password"
                placeholder="New password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              <Input
                label="Confirm password"
                placeholder="Confirm password"
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry
              />
            </View>

            {error ? (
              <Text className="text-red-500 text-sm mt-4">{error}</Text>
            ) : null}

            <Button
              label="Update password"
              fullWidth
              loading={loading}
              onPress={handleSubmit}
              className="mt-8"
            />

            <Pressable onPress={logout} className="mt-6 self-center">
              <Text variant="muted" className="text-sm">Cancel</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
