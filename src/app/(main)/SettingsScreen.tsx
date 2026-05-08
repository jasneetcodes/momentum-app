import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { Pressable, ScrollView, StatusBar, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useAuthStore } from '../../stores/authStore';

interface RowProps {
  label: string;
  value?: string;
  onPress?: () => void;
}

function Row({ label, value, onPress }: RowProps) {
  const { muted } = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className="flex-row items-center justify-between py-4 active:opacity-60"
    >
      <Text className="text-base">{label}</Text>
      <View className="flex-row items-center gap-2">
        {value ? <Text variant="muted" className="text-sm">{value}</Text> : null}
        {onPress ? <Ionicons name="chevron-forward" size={18} color={muted} /> : null}
      </View>
    </Pressable>
  );
}

function Divider() {
  return <View className="h-px bg-muted/15 dark:bg-muted-dark/15" />;
}

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { isDark, barStyle, ink } = useThemeColors();
  const profile = useAuthStore((s) => s.profile);
  const logout = useAuthStore((s) => s.logout);

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark" edges={['top']}>
      <StatusBar barStyle={barStyle} />
      <View className="px-6 pt-4 pb-3 flex-row items-center gap-4">
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} className="p-1">
          <Ionicons name="chevron-back" size={26} color={ink} />
        </Pressable>
        <Text variant="heading" className="text-2xl">Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="px-6 pt-4">
          <Card>
            <View className="flex-row items-center justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-base font-semibold" numberOfLines={1}>
                  {profile?.name ?? profile?.email ?? 'Account'}
                </Text>
                <Text variant="muted" className="text-xs mt-1">{profile?.email ?? ''}</Text>
              </View>
              <View className="px-3 py-1 rounded-full bg-accent/10">
                <Text className="text-xs font-semibold text-accent">FREE</Text>
              </View>
            </View>
          </Card>

          <Text variant="label" className="mt-8 mb-2">NFC tags</Text>
          <Card className="p-0">
            <View className="px-5">
              <Row label="Manage tags" value="0 registered" onPress={() => {}} />
              <Divider />
              <Row label="Add new tag" onPress={() => {}} />
            </View>
          </Card>

          <Text variant="label" className="mt-8 mb-2">Account</Text>
          <Card className="p-0">
            <View className="px-5">
              <Row label="Notifications" onPress={() => {}} />
              <Divider />
              <Row label="Emergency unblocks" value="5 left" />
              <Divider />
              <Row label="App version" value="1.0.0" />
            </View>
          </Card>

          <View className="mt-10">
            <Button label="Log out" variant="secondary" fullWidth onPress={logout} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
