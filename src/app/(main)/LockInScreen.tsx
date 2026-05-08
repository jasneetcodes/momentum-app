import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StatusBar, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { Text } from '../../components/Text';
import { useThemeColors } from '../../hooks/useThemeColors';

export default function LockInScreen() {
  const { isDark, barStyle, ink, muted } = useThemeColors();

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark" edges={['top']}>
      <StatusBar barStyle={barStyle} />
      <View className="flex-1 px-6 pt-4">
        <View className="items-center">
          <Text variant="muted" className="text-sm">Locked in today — 0h 0m</Text>
        </View>

        <Pressable className="mt-8 self-center flex-row items-center gap-2">
          <Text variant="heading" className="text-2xl">Select a mode</Text>
          <Ionicons name="chevron-down" size={20} color={ink} />
        </Pressable>
        <Text variant="muted" className="text-center text-sm mt-2">
          Create a mode to start
        </Text>

        <View className="flex-1 items-center justify-center">
          <View className="w-56 h-56 rounded-full bg-surface dark:bg-surface-dark items-center justify-center">
            <Ionicons name="hardware-chip-outline" size={80} color={muted} />
          </View>
          <Text variant="muted" className="text-xs mt-6 uppercase tracking-wider">
            Tag preview
          </Text>
        </View>

        <View className="pb-2">
          <Button label="Lock In" fullWidth disabled />
        </View>
      </View>
    </SafeAreaView>
  );
}
