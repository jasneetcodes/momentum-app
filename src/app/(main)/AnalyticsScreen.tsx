import React from 'react';
import { ScrollView, StatusBar, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { useThemeColors } from '../../hooks/useThemeColors';

export default function AnalyticsScreen() {
  const { barStyle } = useThemeColors();

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark" edges={['top']}>
      <StatusBar barStyle={barStyle} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-6 pt-4">
          <Text variant="heading" className="text-3xl">Analytics</Text>

          <View className="mt-8">
            <Text variant="label" className="mb-3">Average daily focus</Text>
            <Card>
              <Text className="text-5xl font-bold text-ink dark:text-ink-dark">0h 0m</Text>
              <Text variant="muted" className="text-sm mt-2">No data yet — start a Lock In session</Text>
            </Card>
          </View>

          <View className="mt-8 flex-row gap-3">
            <Card className="flex-1">
              <Text variant="muted" className="text-xs">Current streak</Text>
              <Text className="text-2xl font-bold text-ink dark:text-ink-dark mt-2">0</Text>
            </Card>
            <Card className="flex-1">
              <Text variant="muted" className="text-xs">Longest</Text>
              <Text className="text-2xl font-bold text-ink dark:text-ink-dark mt-2">0</Text>
            </Card>
            <Card className="flex-1">
              <Text variant="muted" className="text-xs">Sessions</Text>
              <Text className="text-2xl font-bold text-ink dark:text-ink-dark mt-2">0</Text>
            </Card>
          </View>

          <View className="mt-8">
            <Text variant="label" className="mb-3">Session history</Text>
            <Card>
              <Text variant="muted" className="text-sm text-center py-8">
                Your sessions will appear here
              </Text>
            </Card>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
