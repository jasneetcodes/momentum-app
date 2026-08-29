import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StatusBar, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Display } from '../../components/Display';
import { MonoLabel } from '../../components/MonoLabel';
import { Slab } from '../../components/Slab';
import { SlabButton } from '../../components/SlabButton';
import { useThemeColors } from '../../hooks/useThemeColors';
import { emergencyUnblocksUsedThisMonth } from '../../services/emergencyUnblocks';
import { useAuthStore } from '../../stores/authStore';
import { useNfcStore } from '../../stores/nfcStore';
import type { SettingsNavProp } from '../../navigation/types';

const DEFAULT_EMERGENCY_LIMIT = 5; // mirrors profiles.emergency_unblocks_limit default

interface RowProps {
  label: string;
  value?: string;
  onPress?: () => void;
}

function Row({ label, value, onPress }: RowProps) {
  const { ink, muted } = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={{ paddingHorizontal: 24, paddingVertical: 21, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
    >
      <Display size={19} weight="semibold" color={ink}>{label}</Display>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {value ? <MonoLabel color={muted} size={13} letterSpacing={13 * 0.1}>{value}</MonoLabel> : null}
        {onPress ? <Ionicons name="chevron-forward" size={20} color={muted} /> : null}
      </View>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const navigation = useNavigation<SettingsNavProp>();
  const { barStyle, bg, ink, muted, border, accent, surface } = useThemeColors();
  const profile = useAuthStore((s) => s.profile);
  const logout = useAuthStore((s) => s.logout);
  const tags = useNfcStore((s) => s.tags);
  const fetchTags = useNfcStore((s) => s.fetchTags);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const tagCountLabel = `${tags.length} REGISTERED`;

  const emergencyLimit = profile?.emergency_unblocks_limit ?? DEFAULT_EMERGENCY_LIMIT;
  const [emergencyUsed, setEmergencyUsed] = useState(0);
  useFocusEffect(
    useCallback(() => {
      emergencyUnblocksUsedThisMonth().then(setEmergencyUsed);
    }, []),
  );
  const emergencyRemaining = Math.max(0, emergencyLimit - emergencyUsed);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={['top']}>
      <StatusBar barStyle={barStyle} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 18 }}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={{ width: 48, height: 48, borderWidth: 1.5, borderColor: border, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="chevron-back" size={26} color={ink} />
        </Pressable>
        <Display size={34} weight="black" color={ink} uppercase letterSpacing={-34 * 0.03}>Settings</Display>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ paddingHorizontal: 24 }}>
          <Slab style={{ padding: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingRight: 16 }}>
              <Display size={22} weight="extrabold" color={ink} letterSpacing={-22 * 0.015} numberOfLines={1}>
                {profile?.name ?? profile?.email ?? 'Account'}
              </Display>
              <MonoLabel color={muted} size={13} letterSpacing={13 * 0.06} uppercase={false} style={{ marginTop: 6 }}>
                {profile?.email ?? ''}
              </MonoLabel>
            </View>
            <View style={{ backgroundColor: accent, paddingHorizontal: 12, paddingVertical: 8 }}>
              <MonoLabel color={bg} size={12} letterSpacing={12 * 0.16}>Certified</MonoLabel>
            </View>
          </Slab>

          <MonoLabel color={accent} size={12} letterSpacing={12 * 0.22} style={{ marginTop: 28, marginBottom: 14 }}>NFC tags</MonoLabel>
          <View style={{ gap: 2 }}>
            <View style={{ backgroundColor: surface }}>
              <Row label="Manage tags" value={tagCountLabel} onPress={() => navigation.navigate('ManageTags')} />
            </View>
            <View style={{ backgroundColor: surface }}>
              <Row label="Add new tag" onPress={() => navigation.navigate('NFCRegister')} />
            </View>
          </View>

          <MonoLabel color={accent} size={12} letterSpacing={12 * 0.22} style={{ marginTop: 26, marginBottom: 14 }}>Account</MonoLabel>
          <View style={{ gap: 2 }}>
            <View style={{ backgroundColor: surface }}>
              <Row label="Notifications" />
            </View>
            <View style={{ backgroundColor: surface, paddingHorizontal: 24, paddingVertical: 21, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Display size={19} weight="semibold" color={ink}>Emergency unblocks</Display>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                <Display size={22} weight="black" color={accent}>{emergencyRemaining}</Display>
                <MonoLabel color={muted} size={12} letterSpacing={12 * 0.14}>left</MonoLabel>
              </View>
            </View>
            <View style={{ backgroundColor: surface }}>
              <Row label="Version" value="1.0.0" />
            </View>
          </View>

          <View style={{ marginTop: 30 }}>
            <SlabButton label="Log out" variant="secondary" fullWidth onPress={logout} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
