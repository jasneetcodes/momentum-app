import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React, { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StatusBar, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { Text } from '../../components/Text';
import { DEFAULT_BLOCKED_APPS, SOCIAL_MEDIA_APPS } from '../../constants/apps';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useModeStore } from '../../stores/modeStore';
import type { MainStackParamList } from '../../navigation/types';

type RouteProps = RouteProp<MainStackParamList, 'CreateMode'>;

function platformBundleIds(): Set<string> {
  const ids = new Set<string>();
  for (const app of DEFAULT_BLOCKED_APPS) {
    ids.add(Platform.OS === 'ios' ? app.ios : app.android);
  }
  return ids;
}

export default function CreateModeScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const editingId = route.params?.modeId;

  const { barStyle, ink, accent, muted } = useThemeColors();
  const modes = useModeStore((s) => s.modes);
  const createMode = useModeStore((s) => s.createMode);
  const updateMode = useModeStore((s) => s.updateMode);

  const editing = useMemo(
    () => (editingId ? modes.find((m) => m.id === editingId) : null),
    [editingId, modes],
  );

  const platformDefaults = useMemo(() => platformBundleIds(), []);
  const platformAppList = useMemo(
    () =>
      SOCIAL_MEDIA_APPS.map((a) => ({
        name: a.name,
        bundleId: Platform.OS === 'ios' ? a.ios : a.android,
      })),
    [],
  );

  const [label, setLabel] = useState(editing?.label ?? '');
  const [blockType, setBlockType] = useState<'blacklist' | 'whitelist'>(
    editing?.block_type ?? 'blacklist',
  );
  const [selectedApps, setSelectedApps] = useState<Set<string>>(() => {
    if (editing) {
      const saved = new Set(editing.apps);
      if (editing.block_type === 'blacklist') {
        platformDefaults.forEach((id) => saved.add(id));
      } else {
        platformDefaults.forEach((id) => saved.delete(id));
      }
      return saved;
    }
    return new Set(Array.from(platformDefaults));
  });
  const [saving, setSaving] = useState(false);

  const handleBlockTypeChange = (type: 'blacklist' | 'whitelist') => {
    setBlockType(type);
    setSelectedApps((prev) => {
      const next = new Set(prev);
      if (type === 'blacklist') platformDefaults.forEach((id) => next.add(id));
      else platformDefaults.forEach((id) => next.delete(id));
      return next;
    });
  };

  const toggleApp = (bundleId: string) => {
    if (platformDefaults.has(bundleId)) return;
    setSelectedApps((prev) => {
      const next = new Set(prev);
      if (next.has(bundleId)) next.delete(bundleId);
      else next.add(bundleId);
      return next;
    });
  };

  const handleSave = async () => {
    const trimmed = label.trim();
    if (!trimmed) {
      Alert.alert('Name your mode', 'Give this mode a label like "Studying" or "Family Time".');
      return;
    }
    setSaving(true);
    const input = {
      label: trimmed,
      icon: null,
      colour: null,
      block_type: blockType,
      apps: Array.from(selectedApps),
    };
    if (editing) {
      const err = await updateMode(editing.id, input);
      setSaving(false);
      if (err) { Alert.alert('Could not save', err); return; }
    } else {
      const { error } = await createMode(input);
      setSaving(false);
      if (error) { Alert.alert('Could not create mode', error); return; }
    }
    navigation.goBack();
  };

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark" edges={['top']}>
      <StatusBar barStyle={barStyle} />

      <View className="px-6 pt-4 pb-3 flex-row items-center gap-4">
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} className="p-1">
          <Ionicons name="close" size={26} color={ink} />
        </Pressable>
        <Text variant="heading" className="text-2xl">
          {editing ? 'Edit mode' : 'New mode'}
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
      >
        <Text variant="label" className="mt-2 mb-3">Name</Text>
        <Input
          placeholder="e.g. Studying"
          value={label}
          onChangeText={setLabel}
          autoCapitalize="sentences"
        />

        <Text variant="label" className="mt-8 mb-3">Block type</Text>
        <View className="flex-row gap-2">
          {(['blacklist', 'whitelist'] as const).map((type) => {
            const active = blockType === type;
            return (
              <Pressable
                key={type}
                onPress={() => handleBlockTypeChange(type)}
                className="flex-1 py-3 rounded-xl items-center"
                style={{
                  backgroundColor: active ? accent : 'transparent',
                  borderWidth: 1,
                  borderColor: active ? accent : muted + '40',
                }}
              >
                <Text
                  className="text-sm font-semibold capitalize"
                  style={{ color: active ? '#fff' : ink }}
                >
                  {type === 'blacklist' ? 'Block these' : 'Allow only these'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View className="flex-row items-center justify-between mt-8 mb-3">
          <Text variant="label">Apps</Text>
          <Text variant="muted" className="text-xs">Social apps always blocked</Text>
        </View>
        <Card className="p-0">
          {platformAppList.map((app, i) => {
            const isLocked = platformDefaults.has(app.bundleId);
            const isSelected = selectedApps.has(app.bundleId);
            return (
              <Pressable
                key={app.bundleId}
                onPress={() => toggleApp(app.bundleId)}
                className="flex-row items-center justify-between px-5 py-4 active:opacity-60"
                style={{
                  borderBottomWidth: i < platformAppList.length - 1 ? 1 : 0,
                  borderBottomColor: muted + '20',
                }}
              >
                <View className="flex-1">
                  <Text className="text-base">{app.name}</Text>
                  {isLocked && (
                    <Text variant="muted" className="text-xs mt-0.5">Default — Always blocked</Text>
                  )}
                </View>
                <View
                  className="w-6 h-6 rounded-md items-center justify-center"
                  style={{
                    backgroundColor: isSelected ? accent : 'transparent',
                    borderWidth: 1.5,
                    borderColor: isSelected ? accent : muted,
                    opacity: isLocked ? 0.4 : 1,
                  }}
                >
                  {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
              </Pressable>
            );
          })}
        </Card>

        <Button
          label={editing ? 'Save changes' : 'Create mode'}
          fullWidth
          loading={saving}
          onPress={handleSave}
          className="mt-10"
        />
      </ScrollView>
    </SafeAreaView>
  );
}
