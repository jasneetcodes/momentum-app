import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StatusBar, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { Text } from '../../components/Text';
import { useThemeColors } from '../../hooks/useThemeColors';

export default function AlarmsScreen() {
  const { isDark, barStyle, ink } = useThemeColors();

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark" edges={['top']}>
      <StatusBar barStyle={barStyle} />
      <View className="flex-1 px-6 pt-4">
        <View className="flex-row items-center justify-between">
          <Text variant="heading" className="text-3xl">Alarms</Text>
          <Pressable hitSlop={12} className="p-2">
            <Ionicons name="add" size={28} color={ink} />
          </Pressable>
        </View>

        <View className="flex-1 items-center justify-center px-6">
          <Text variant="heading" className="text-2xl text-center">
            No alarms yet
          </Text>
          <Text variant="muted" className="text-base text-center mt-3 mb-8">
            Set your first alarm.{'\n'}No snooze. No excuses.
          </Text>
          <Button label="Create alarm" />
        </View>
      </View>
    </SafeAreaView>
  );
}
