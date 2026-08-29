import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StatusBar, View } from 'react-native';
import { previewAlarmSound, stopPreviewSound } from '../../services/sound';
import { ensureFullScreenIntentGranted } from '../../services/permissions';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppPicker } from '../../components/AppPicker';
import { Display } from '../../components/Display';
import { Input } from '../../components/Input';
import { MonoLabel } from '../../components/MonoLabel';
import { Slab } from '../../components/Slab';
import { SlabButton } from '../../components/SlabButton';
import { DEFAULT_BLOCKED_APPS, SOCIAL_MEDIA_APPS } from '../../constants/apps';
import { ALARM_SOUNDS, DEFAULT_SOUND } from '../../constants/sounds';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useAlarmStore } from '../../stores/alarmStore';
import { useAlarmLogStore } from '../../stores/alarmLogStore';
import type { MainStackParamList } from '../../navigation/types';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
// Mon=1 ... Sat=6, Sun=0 (Postgres convention). UI is Mon-first.
const DAY_VALUES = [1, 2, 3, 4, 5, 6, 0];

const DURATION_PRESETS = [15, 30, 45, 60, 90];

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

function formatTimeParts(date: Date): { hhmm: string; period: string } {
  const hours = date.getHours();
  const mins = String(date.getMinutes()).padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return { hhmm: `${displayHours}:${mins}`, period };
}

/**
 * Next clock fire for `time` and `days` (pg-weekday array; [] = one-off).
 * Returns null only if all days have been pruned away (should not happen
 * in normal use).
 */
function computeNextFire(time: Date, days: number[]): Date | null {
  const now = new Date();
  const candidate = new Date(now);
  candidate.setHours(time.getHours(), time.getMinutes(), 0, 0);

  if (days.length === 0) {
    if (candidate <= now) candidate.setDate(candidate.getDate() + 1);
    return candidate;
  }

  for (let i = 0; i < 7; i++) {
    const d = new Date(candidate);
    d.setDate(candidate.getDate() + i);
    if (days.includes(d.getDay()) && d > now) return d;
  }
  return null;
}

export default function AlarmSetupScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const editingId = route.params?.alarmId;

  const { barStyle, bg, ink, muted, faint, border, accent, surface } = useThemeColors();
  const alarms = useAlarmStore((s) => s.alarms);
  const createAlarm = useAlarmStore((s) => s.createAlarm);
  const updateAlarm = useAlarmStore((s) => s.updateAlarm);
  const activeAlarmLog = useAlarmLogStore((s) => s.activeLog);

  const editing = useMemo(
    () => (editingId ? alarms.find((a) => a.id === editingId) : null),
    [editingId, alarms],
  );

  const platformDefaults = useMemo(() => platformBundleIds(), []);
  const defaultApps = useMemo(
    () =>
      SOCIAL_MEDIA_APPS.map((a) => ({
        id: Platform.OS === 'ios' ? a.ios : a.android,
        name: a.name,
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
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      stopPreviewSound();
    };
  }, []);

  const handlePreview = async (id: string) => {
    if (previewingId === id) {
      await stopPreviewSound();
      setPreviewingId(null);
      return;
    }
    setPreviewingId(id);
    try {
      await previewAlarmSound(id);
    } catch {
      setPreviewingId(null);
    }
  };

  const handleBlockTypeChange = (type: 'blacklist' | 'whitelist') => {
    setBlockType(type);
    if (type === 'blacklist') {
      setSelectedApps((prev) => {
        const next = new Set(prev);
        platformDefaults.forEach((id) => next.add(id));
        return next;
      });
    } else {
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
    // Conflict guard: cannot create/edit an alarm whose next fire falls inside
    // a currently-running post-alarm block window.
    const blockEnds = activeAlarmLog?.block_ends_at
      ? new Date(activeAlarmLog.block_ends_at)
      : null;
    if (blockEnds && !activeAlarmLog?.block_completed && blockEnds > new Date()) {
      const next = computeNextFire(time, days);
      if (next && next < blockEnds) {
        const blockEndsLabel = blockEnds.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        Alert.alert(
          'Conflicts with post-alarm block',
          `Your current post-alarm block runs until ${blockEndsLabel}. This alarm would fire inside that window. Pick a later time or wait for the block to finish.`,
        );
        return;
      }
    }

    // Ask for the lock-screen full-screen-alarm permission before saving.
    // On Android 13- and iOS this resolves true immediately.
    await ensureFullScreenIntentGranted();

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

  const { hhmm, period } = formatTimeParts(time);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={['top']}>
      <StatusBar barStyle={barStyle} />

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 18 }}>
        <Display size={34} weight="black" color={ink} uppercase letterSpacing={-34 * 0.03}>
          {editing ? 'Edit alarm' : 'New alarm'}
        </Display>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={{ width: 48, height: 48, borderWidth: 1.5, borderColor: border, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="close" size={26} color={ink} />
        </Pressable>
      </View>

      <AppPicker
        defaultApps={defaultApps}
        selected={selectedApps}
        onToggle={toggleApp}
        lockedNote="Social apps always blocked"
        header={
          <>
            <Slab background={accent} style={{ padding: 20 }}>
              <MonoLabel color="rgba(14,14,15,.6)" size={12} letterSpacing={12 * 0.22}>Fires at</MonoLabel>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 10 }}>
                <Display size={52} weight="black" color={bg} lineHeight={46}>{hhmm}</Display>
                <Display size={22} weight="extrabold" color={bg} letterSpacing={0} style={{ marginLeft: 6 }}>{period}</Display>
              </View>
              {Platform.OS === 'ios' ? (
                <DateTimePicker value={time} mode="time" display="spinner" onChange={onTimeChange} themeVariant={undefined} />
              ) : (
                <>
                  <Pressable onPress={() => setShowPicker(true)} style={{ marginTop: 12 }}>
                    <MonoLabel color="rgba(14,14,15,.7)" size={12} letterSpacing={12 * 0.14}>Tap to change</MonoLabel>
                  </Pressable>
                  {showPicker && <DateTimePicker value={time} mode="time" display="default" onChange={onTimeChange} />}
                </>
              )}
            </Slab>

            <MonoLabel color={muted} size={12} letterSpacing={12 * 0.22} style={{ marginTop: 24, marginBottom: 14 }}>Repeat</MonoLabel>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {DAY_LABELS.map((day, i) => {
                const value = DAY_VALUES[i];
                const active = days.includes(value);
                return (
                  <Pressable
                    key={i}
                    onPress={() => toggleDay(value)}
                    style={{ flex: 1, paddingVertical: 18, alignItems: 'center', backgroundColor: active ? accent : 'transparent', borderWidth: active ? 0 : 1.5, borderColor: border }}
                  >
                    <MonoLabel color={active ? bg : muted} size={15} weight="bold" letterSpacing={0}>{day}</MonoLabel>
                  </Pressable>
                );
              })}
            </View>
            {days.length === 0 && (
              <MonoLabel color={muted} size={11} uppercase={false} style={{ marginTop: 10 }}>One-off alarm — fires once.</MonoLabel>
            )}

            <MonoLabel color={muted} size={12} letterSpacing={12 * 0.22} style={{ marginTop: 24, marginBottom: 14 }}>Label</MonoLabel>
            <Input
              placeholder="e.g. Morning routine"
              value={label}
              onChangeText={setLabel}
              autoCapitalize="sentences"
            />

            <MonoLabel color={muted} size={12} letterSpacing={12 * 0.22} style={{ marginTop: 24, marginBottom: 14 }}>Block type</MonoLabel>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {(['blacklist', 'whitelist'] as const).map((type) => {
                const active = blockType === type;
                return (
                  <Pressable
                    key={type}
                    onPress={() => handleBlockTypeChange(type)}
                    style={{ flex: 1, paddingVertical: 14, alignItems: 'center', backgroundColor: active ? accent : 'transparent', borderWidth: active ? 0 : 1.5, borderColor: border }}
                  >
                    <MonoLabel color={active ? bg : ink} size={13}>
                      {type === 'blacklist' ? 'Block these' : 'Allow only these'}
                    </MonoLabel>
                  </Pressable>
                );
              })}
            </View>
          </>
        }
        footer={
          <>
            <MonoLabel color={muted} size={12} letterSpacing={12 * 0.22} style={{ marginTop: 24, marginBottom: 14 }}>Lock duration</MonoLabel>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {DURATION_PRESETS.map((mins) => {
                const active = duration === mins;
                return (
                  <Pressable
                    key={mins}
                    onPress={() => setDuration(mins)}
                    style={{ paddingHorizontal: 20, paddingVertical: 16.5, backgroundColor: active ? accent : 'transparent', borderWidth: active ? 0 : 1.5, borderColor: border }}
                  >
                    <MonoLabel color={active ? bg : muted} size={15} weight="bold" letterSpacing={0}>
                      {active ? `${mins} MIN` : mins}
                    </MonoLabel>
                  </Pressable>
                );
              })}
            </View>

            <MonoLabel color={muted} size={12} letterSpacing={12 * 0.22} style={{ marginTop: 24, marginBottom: 14 }}>Sound</MonoLabel>
            <View style={{ gap: 2 }}>
              {ALARM_SOUNDS.map((s) => {
                const active = sound === s.id;
                const previewing = previewingId === s.id;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => setSound(s.id)}
                    style={{ backgroundColor: surface, paddingHorizontal: 20, paddingVertical: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <Display size={18} weight="semibold" color={ink} style={{ flex: 1 }}>{s.name}</Display>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                      <Pressable onPress={() => handlePreview(s.id)} hitSlop={12}>
                        <Ionicons name={previewing ? 'stop-circle' : 'play-circle'} size={26} color={previewing ? accent : faint} />
                      </Pressable>
                      {active && <Ionicons name="checkmark" size={20} color={accent} />}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ marginTop: 24 }}>
              <SlabButton
                label={editing ? 'Save changes' : 'Create alarm'}
                fullWidth
                loading={saving}
                onPress={handleSave}
              />
            </View>
          </>
        }
      />
    </SafeAreaView>
  );
}
