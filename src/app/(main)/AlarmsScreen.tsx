import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect } from 'react';
import { Alert, Pressable, ScrollView, StatusBar, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useAlarmStore, type Alarm } from '../../stores/alarmStore';
import { useAlarmLogStore } from '../../stores/alarmLogStore';
import type { AlarmsNavProp } from '../../navigation/types';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_VALUES = [1, 2, 3, 4, 5, 6, 0];

function formatTimeDisplay(time: string): string {
  const [hh, mm] = time.split(':').map(Number);
  const period = hh >= 12 ? 'PM' : 'AM';
  const displayHours = hh % 12 || 12;
  return `${displayHours}:${String(mm).padStart(2, '0')} ${period}`;
}

interface AlarmCardProps {
  alarm: Alarm;
  onToggle: (id: string, value: boolean) => void;
  onPress: () => void;
  onLongPress: () => void;
}

function AlarmCard({ alarm, onToggle, onPress, onLongPress }: AlarmCardProps) {
  const { accent, muted } = useThemeColors();
  const isOneOff = alarm.days_of_week.length === 0;

  return (
    <Pressable onLongPress={onLongPress} onPress={onPress}>
      <Card style={{ opacity: alarm.is_active ? 1 : 0.5 }}>
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="text-4xl font-bold text-ink dark:text-ink-dark">
              {formatTimeDisplay(alarm.time)}
            </Text>
            {alarm.label && (
              <Text variant="muted" className="text-sm mt-1">{alarm.label}</Text>
            )}
            <View className="flex-row gap-1.5 mt-3">
              {DAY_LABELS.map((day, i) => {
                const active = alarm.days_of_week.includes(DAY_VALUES[i]);
                return (
                  <View
                    key={i}
                    className="w-6 h-6 rounded-full items-center justify-center"
                    style={{
                      backgroundColor: active ? accent + '1A' : 'transparent',
                    }}
                  >
                    <Text
                      className="text-xs font-semibold"
                      style={{ color: active ? accent : muted }}
                    >
                      {day}
                    </Text>
                  </View>
                );
              })}
            </View>
            {isOneOff && (
              <Text variant="muted" className="text-xs mt-2">One-off</Text>
            )}
          </View>
          <Switch
            value={alarm.is_active}
            onValueChange={(v) => onToggle(alarm.id, v)}
            trackColor={{ false: muted + '40', true: accent }}
            thumbColor="#fff"
          />
        </View>
      </Card>
    </Pressable>
  );
}

export default function AlarmsScreen() {
  const navigation = useNavigation<AlarmsNavProp>();
  const { barStyle, ink } = useThemeColors();
  const alarms = useAlarmStore((s) => s.alarms);
  const fetchAlarms = useAlarmStore((s) => s.fetchAlarms);
  const toggleAlarm = useAlarmStore((s) => s.toggleAlarm);
  const deleteAlarm = useAlarmStore((s) => s.deleteAlarm);
  const fireAlarm = useAlarmLogStore((s) => s.fire);

  useEffect(() => {
    fetchAlarms();
  }, [fetchAlarms]);

  const confirmDelete = (alarm: Alarm) => {
    Alert.alert(
      'Delete alarm?',
      `"${alarm.label ?? formatTimeDisplay(alarm.time)}" will be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteAlarm(alarm.id),
        },
      ],
    );
  };

  const handleTestRing = async (alarm: Alarm) => {
    const log = await fireAlarm(alarm.id);
    if (!log) {
      Alert.alert('Could not start alarm', 'Please try again.');
      return;
    }
    navigation.navigate('AlarmRinging', { alarmId: alarm.id });
  };

  const handleLongPress = (alarm: Alarm) => {
    Alert.alert(alarm.label ?? formatTimeDisplay(alarm.time), undefined, [
      { text: 'Test ring', onPress: () => handleTestRing(alarm) },
      { text: 'Delete', style: 'destructive', onPress: () => confirmDelete(alarm) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark" edges={['top']}>
      <StatusBar barStyle={barStyle} />
      <View className="flex-row items-center justify-between px-6 pt-4 pb-2">
        <Text variant="heading" className="text-3xl">Alarms</Text>
        <Pressable
          onPress={() => navigation.navigate('AlarmSetup', {})}
          hitSlop={12}
          className="p-2"
        >
          <Ionicons name="add" size={28} color={ink} />
        </Pressable>
      </View>

      {alarms.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text variant="heading" className="text-2xl text-center">No alarms yet</Text>
          <Text variant="muted" className="text-base text-center mt-3 mb-8">
            Set your first alarm.{'\n'}No snooze. No excuses.
          </Text>
          <Button
            label="Create alarm"
            onPress={() => navigation.navigate('AlarmSetup', {})}
          />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40, paddingTop: 8 }}
        >
          <View className="gap-3">
            {alarms.map((alarm) => (
              <AlarmCard
                key={alarm.id}
                alarm={alarm}
                onToggle={toggleAlarm}
                onPress={() => navigation.navigate('AlarmSetup', { alarmId: alarm.id })}
                onLongPress={() => handleLongPress(alarm)}
              />
            ))}
          </View>
          <Text variant="muted" className="text-xs text-center mt-6">
            Long-press any alarm for options.
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
