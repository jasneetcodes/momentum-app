import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect } from 'react';
import { Alert, Pressable, ScrollView, StatusBar, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Display } from '../../components/Display';
import { MonoLabel } from '../../components/MonoLabel';
import { Slab } from '../../components/Slab';
import { SlabButton } from '../../components/SlabButton';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useAlarmStore, type Alarm } from '../../stores/alarmStore';
import type { AlarmsNavProp } from '../../navigation/types';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_VALUES = [1, 2, 3, 4, 5, 6, 0];

function formatTimeDisplay(time: string): { hhmm: string; period: string } {
  const [hh, mm] = time.split(':').map(Number);
  const period = hh >= 12 ? 'PM' : 'AM';
  const displayHours = hh % 12 || 12;
  return { hhmm: `${displayHours}:${String(mm).padStart(2, '0')}`, period };
}

interface AlarmRowProps {
  alarm: Alarm;
  onToggle: (id: string, value: boolean) => void;
  onPress: () => void;
  onLongPress: () => void;
}

function AlarmRow({ alarm, onToggle, onPress, onLongPress }: AlarmRowProps) {
  const { accent, ink, muted, border, bg } = useThemeColors();
  const { hhmm, period } = formatTimeDisplay(alarm.time);
  const isOneOff = alarm.days_of_week.length === 0;

  return (
    <Pressable onLongPress={onLongPress} onPress={onPress}>
      <Slab
        borderLeftColor={alarm.is_active ? accent : border}
        style={{ padding: 22, opacity: alarm.is_active ? 1 : 0.5 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Display size={44} weight="black" color={ink} lineHeight={40}>{hhmm}</Display>
              <Display size={17} weight="extrabold" color={muted} letterSpacing={0} style={{ marginLeft: 4 }}>{period}</Display>
            </View>
            {alarm.label && (
              <MonoLabel color={accent} size={13} letterSpacing={13 * 0.16} style={{ marginTop: 10 }}>
                {alarm.label}
              </MonoLabel>
            )}
          </View>
          <Switch
            value={alarm.is_active}
            onValueChange={(v) => onToggle(alarm.id, v)}
            trackColor={{ false: border, true: accent }}
            thumbColor={bg}
          />
        </View>

        <View style={{ flexDirection: 'row', gap: 5, marginTop: 16 }}>
          {DAY_LABELS.map((day, i) => {
            const active = alarm.days_of_week.includes(DAY_VALUES[i]);
            return (
              <View
                key={i}
                style={{ flex: 1, paddingVertical: 9, alignItems: 'center', backgroundColor: active ? accent + '24' : 'transparent' }}
              >
                <MonoLabel color={active ? accent : muted} size={13}>{day}</MonoLabel>
              </View>
            );
          })}
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          <MonoLabel color={muted} size={12} letterSpacing={12 * 0.08} uppercase={false}>
            {alarm.apps.length} APPS {alarm.block_type === 'blacklist' ? 'BLOCKED' : 'ALLOWED'}
          </MonoLabel>
          <MonoLabel color={border} size={12}>|</MonoLabel>
          <MonoLabel color={muted} size={12} letterSpacing={12 * 0.08} uppercase={false}>{alarm.block_duration_minutes} MIN LOCK</MonoLabel>
          {isOneOff && (
            <>
              <MonoLabel color={border} size={12}>|</MonoLabel>
              <MonoLabel color={muted} size={12}>ONE-OFF</MonoLabel>
            </>
          )}
        </View>
      </Slab>
    </Pressable>
  );
}

export default function AlarmsScreen() {
  const navigation = useNavigation<AlarmsNavProp>();
  const { barStyle, bg, ink, muted, border, accent } = useThemeColors();
  const alarms = useAlarmStore((s) => s.alarms);
  const fetchAlarms = useAlarmStore((s) => s.fetchAlarms);
  const toggleAlarm = useAlarmStore((s) => s.toggleAlarm);
  const deleteAlarm = useAlarmStore((s) => s.deleteAlarm);

  useEffect(() => {
    fetchAlarms();
  }, [fetchAlarms]);

  const confirmDelete = (alarm: Alarm) => {
    Alert.alert(
      'Delete alarm?',
      `"${alarm.label ?? formatTimeDisplay(alarm.time).hhmm}" will be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteAlarm(alarm.id) },
      ],
    );
  };

  const handleLongPress = (alarm: Alarm) => {
    Alert.alert(alarm.label ?? formatTimeDisplay(alarm.time).hhmm, undefined, [
      { text: 'Delete', style: 'destructive', onPress: () => confirmDelete(alarm) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={['top']}>
      <StatusBar barStyle={barStyle} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 14 }}>
        <Display size={40} weight="black" color={ink} uppercase letterSpacing={-40 * 0.035}>Alarms</Display>
        <Pressable
          onPress={() => navigation.navigate('AlarmSetup', {})}
          hitSlop={12}
          style={{ width: 52, height: 52, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="add" size={32} color={bg} />
        </Pressable>
      </View>

      {alarms.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <Display size={22} weight="bold" color={ink} style={{ textAlign: 'center' }}>No alarms yet</Display>
          <MonoLabel color={muted} size={13} letterSpacing={0} uppercase={false} style={{ textAlign: 'center', lineHeight: 20, marginTop: 12, marginBottom: 32 }}>
            Set your first alarm.{'\n'}No snooze. No excuses.
          </MonoLabel>
          <SlabButton label="Create alarm" onPress={() => navigation.navigate('AlarmSetup', {})} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, paddingTop: 4 }}
        >
          <View style={{ gap: 2 }}>
            {alarms.map((alarm) => (
              <AlarmRow
                key={alarm.id}
                alarm={alarm}
                onToggle={toggleAlarm}
                onPress={() => navigation.navigate('AlarmSetup', { alarmId: alarm.id })}
                onLongPress={() => handleLongPress(alarm)}
              />
            ))}
          </View>
          <MonoLabel color={muted} size={12} letterSpacing={12 * 0.1} uppercase style={{ textAlign: 'center', marginTop: 20 }}>
            Long-press to delete
          </MonoLabel>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
