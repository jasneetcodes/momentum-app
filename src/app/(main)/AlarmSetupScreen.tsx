import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React, { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StatusBar, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { Text } from '../../components/Text';
import { DEFAULT_BLOCKED_APPS, SOCIAL_MEDIA_APPS } from '../../constants/apps';
import { ALARM_SOUNDS, DEFAULT_SOUND } from '../../constants/sounds';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useAlarmStore } from '../../stores/alarmStore';
import type { MainStackParamList } from '../../navigation/types';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
// Mon=1 ... Sat=6, Sun=0 (Postgres convention). UI is Mon-first.
const DAY_VALUES = [1, 2, 3, 4, 5, 6, 0];

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];

type RouteProps = RouteProp<MainStackParamList, 'AlarmSetup'>;

function platformBundleIds(): Set<string> {
  const ids = new Set<string>();
  for (const app of DEFAULT_BLOCKED_APPS) {
    ids.add(Platform.OS === 'ios' ? app.ios : app.android);
  }
  return ids;
}

function parseTime(time: string): Date {
  const [hh, mm] = time.split(':').map(Number);
  const d = new Date();
  d.setHours(hh, mm, 0, 0);
  return d;
}

function formatTime(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}:00`;
}

function formatTimeDisplay(date: Date): string {
  const hours = date.getHours();
  const mins = String(date.getMinutes()).padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${mins} ${period}`;
}

export default function AlarmSetupScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const editingId = route.params?.alarmId;

  const { barStyle, ink, accent, muted } = useThemeColors();
  const alarms = useAlarmStore((s) => s.alarms);
  const createAlarm = useAlarmStore((s) => s.createAlarm);
  const updateAlarm = useAlarmStore((s) => s.updateAlarm);

  const editing = useMemo(
    () => (editingId ? alarms.find((a) => a.id === editingId) : null),
    [editingId, alarms],
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

  const [time, setTime] = useState<Date>(() =>
    editing ? parseTime(editing.time) : (() => {
      const d = new Date();
      d.setHours(7, 0, 0, 0);
      return d;
    })(),
  );
  const [days, setDays] = useState<number[]>(editing?.days_of_week ?? []);
  const [label, setLabel] = useState(editing?.label ?? '');
  const [blockType, setBlockType] = useState<'blacklist' | 'whitelist'>(
    editing?.block_type ?? 'blacklist',
  );
  const [selectedApps, setSelectedApps] = useState<Set<string>>(() => {
    if (editing) {
      // Editing: load saved apps. Enforce invariants silently.
      const saved = new Set(editing.apps);
      if (editing.block_type === 'blacklist') {
        platformDefaults.forEach((id) => saved.add(id));
      } else {
        platformDefaults.forEach((id) => saved.delete(id));
      }
      return saved;
    }
    // New alarm: blacklist defaults selected, whitelist starts empty
    return new Set(Array.from(platformDefaults));
  });
  const [duration, setDuration] = useState<number>(editing?.block_duration_minutes ?? 30);
  const [sound, setSound] = useState<string>(editing?.sound ?? DEFAULT_SOUND);
  const [showPicker, setShowPicker] = useState(Platform.OS === 'ios');
  const [saving, setSaving] = useState(false);

  const handleBlockTypeChange = (type: 'blacklist' | 'whitelist') => {
    setBlockType(type);
    if (type === 'blacklist') {
      // Re-add defaults to the block list
      setSelectedApps((prev) => {
        const next = new Set(prev);
        platformDefaults.forEach((id) => next.add(id));
        return next;
      });
    } else {
      // Whitelist: remove defaults (they're always blocked; can't be allowed)
      setSelectedApps((prev) => {
        const next = new Set(prev);
        platformDefaults.forEach((id) => next.delete(id));
        return next;
      });
    }
  };

  const toggleDay = (day: number) => {
    setDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  };

  // Defaults are locked in both modes:
  // - Blacklist: can't unselect (always blocked)
  // - Whitelist: can't select (always blocked, not allowed)
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
    setSaving(true);
    const input = {
      label: label.trim() || null,
      time: formatTime(time),
      days_of_week: days,
      is_active: editing?.is_active ?? true,
      block_type: blockType,
      apps: Array.from(selectedApps),
      block_duration_minutes: duration,
      sound,
    };

    const err = editing
      ? await updateAlarm(editing.id, input)
      : await createAlarm(input);

    setSaving(false);
    if (err) {
      Alert.alert('Could not save alarm', err);
      return;
    }
    navigation.goBack();
  };

  const onTimeChange = (_event: unknown, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (selectedDate) setTime(selectedDate);
  };

  const appsHeaderHint =
    blockType === 'blacklist' ? 'Social apps always blocked' : 'Social apps always blocked';

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark" edges={['top']}>
      <StatusBar barStyle={barStyle} />

      <View className="px-6 pt-4 pb-3 flex-row items-center justify-between">
        <View className="flex-row items-center gap-4 flex-1">
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} className="p-1">
            <Ionicons name="close" size={26} color={ink} />
          </Pressable>
          <Text variant="heading" className="text-2xl">
            {editing ? 'Edit alarm' : 'New alarm'}
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
      >
        <Card className="items-center py-6">
          {Platform.OS === 'ios' ? (
            <DateTimePicker
              value={time}
              mode="time"
              display="spinner"
              onChange={onTimeChange}
              themeVariant={undefined}
            />
          ) : (
            <>
              <Pressable onPress={() => setShowPicker(true)}>
                <Text className="text-6xl font-bold text-ink dark:text-ink-dark">
                  {formatTimeDisplay(time)}
                </Text>
              </Pressable>
              <Text variant="muted" className="text-sm mt-2">Tap to change</Text>
              {showPicker && (
                <DateTimePicker
                  value={time}
                  mode="time"
                  display="default"
                  onChange={onTimeChange}
                />
              )}
            </>
          )}
        </Card>

        <Text variant="label" className="mt-6 mb-3">Repeat</Text>
        <View className="flex-row gap-2">
          {DAY_LABELS.map((day, i) => {
            const value = DAY_VALUES[i];
            const active = days.includes(value);
            return (
              <Pressable
                key={i}
                onPress={() => toggleDay(value)}
                className="flex-1 items-center justify-center py-3 rounded-xl"
                style={{
                  backgroundColor: active ? accent : 'transparent',
                  borderWidth: 1,
                  borderColor: active ? accent : muted + '40',
                }}
              >
                <Text
                  className="text-sm font-semibold"
                  style={{ color: active ? '#fff' : ink }}
                >
                  {day}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {days.length === 0 && (
          <Text variant="muted" className="text-xs mt-2">One-off alarm — fires once.</Text>
        )}

        <Text variant="label" className="mt-8 mb-3">Label</Text>
        <Input
          placeholder="e.g. Morning routine"
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
          <Text variant="muted" className="text-xs">{appsHeaderHint}</Text>
        </View>
        <Card className="p-0">
          {platformAppList.map((app, i) => {
            const isLocked = platformDefaults.has(app.bundleId);
            const isSelected = selectedApps.has(app.bundleId);
            const lockedSubtext =
              blockType === 'blacklist' ? 'Default — Always blocked' : 'Default — Always blocked';
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
                    <Text variant="muted" className="text-xs mt-0.5">{lockedSubtext}</Text>
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

        <Text variant="label" className="mt-8 mb-3">Block duration</Text>
        <View className="flex-row flex-wrap gap-2">
          {DURATION_PRESETS.map((mins) => {
            const active = duration === mins;
            return (
              <Pressable
                key={mins}
                onPress={() => setDuration(mins)}
                className="px-4 py-2.5 rounded-xl"
                style={{
                  backgroundColor: active ? accent : 'transparent',
                  borderWidth: 1,
                  borderColor: active ? accent : muted + '40',
                }}
              >
                <Text
                  className="text-sm font-semibold"
                  style={{ color: active ? '#fff' : ink }}
                >
                  {mins} min
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text variant="label" className="mt-8 mb-3">Sound</Text>
        <Card className="p-0">
          {ALARM_SOUNDS.map((s, i) => {
            const active = sound === s.id;
            return (
              <Pressable
                key={s.id}
                onPress={() => setSound(s.id)}
                className="flex-row items-center justify-between px-5 py-4 active:opacity-60"
                style={{
                  borderBottomWidth: i < ALARM_SOUNDS.length - 1 ? 1 : 0,
                  borderBottomColor: muted + '20',
                }}
              >
                <Text className="text-base">{s.name}</Text>
                {active && <Ionicons name="checkmark" size={20} color={accent} />}
              </Pressable>
            );
          })}
        </Card>

        <Button
          label={editing ? 'Save changes' : 'Create alarm'}
          fullWidth
          loading={saving}
          onPress={handleSave}
          className="mt-10"
        />
      </ScrollView>
    </SafeAreaView>
  );
}
