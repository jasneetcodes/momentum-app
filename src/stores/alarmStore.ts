import { create } from 'zustand';
import { supabase } from '../services/supabase';

export interface Alarm {
  id: string;
  user_id: string;
  label: string | null;
  time: string;
  days_of_week: number[];
  is_active: boolean;
  block_type: 'blacklist' | 'whitelist';
  apps: string[];
  block_duration_minutes: number;
  sound: string;
  created_at: string;
}

export type AlarmInput = Omit<Alarm, 'id' | 'user_id' | 'created_at'>;

interface AlarmState {
  alarms: Alarm[];
  loading: boolean;
  fetchAlarms: () => Promise<void>;
  createAlarm: (input: AlarmInput) => Promise<string | null>;
  updateAlarm: (id: string, input: Partial<AlarmInput>) => Promise<string | null>;
  deleteAlarm: (id: string) => Promise<string | null>;
  toggleAlarm: (id: string, isActive: boolean) => Promise<string | null>;
  reset: () => void;
}

export const useAlarmStore = create<AlarmState>((set, get) => ({
  alarms: [],
  loading: false,

  fetchAlarms: async () => {
    set({ loading: true });
    const { data } = await supabase
      .from('alarms')
      .select('*')
      .order('time', { ascending: true });
    set({ loading: false, alarms: (data as Alarm[]) ?? [] });
  },

  createAlarm: async (input) => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return 'not_authenticated';

    const { error } = await supabase.from('alarms').insert({
      ...input,
      user_id: auth.user.id,
    });
    if (error) return error.message;
    await get().fetchAlarms();
    return null;
  },

  updateAlarm: async (id, input) => {
    const { error } = await supabase.from('alarms').update(input).eq('id', id);
    if (error) return error.message;
    await get().fetchAlarms();
    return null;
  },

  deleteAlarm: async (id) => {
    const { error } = await supabase.from('alarms').delete().eq('id', id);
    if (error) return error.message;
    set({ alarms: get().alarms.filter((a) => a.id !== id) });
    return null;
  },

  toggleAlarm: async (id, isActive) => {
    set({
      alarms: get().alarms.map((a) =>
        a.id === id ? { ...a, is_active: isActive } : a,
      ),
    });
    const { error } = await supabase
      .from('alarms')
      .update({ is_active: isActive })
      .eq('id', id);
    if (error) {
      await get().fetchAlarms();
      return error.message;
    }
    return null;
  },

  reset: () => set({ alarms: [], loading: false }),
}));
