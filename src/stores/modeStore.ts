import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { supabase } from '../services/supabase';
import { fetchModes as fetchModesRemote } from '../services/mode';

export interface Mode {
  id: string;
  user_id: string;
  label: string;
  icon: string | null;
  colour: string | null;
  block_type: 'blacklist' | 'whitelist';
  apps: string[];
  is_active: boolean;
  created_at: string;
}

export type ModeInput = Omit<Mode, 'id' | 'user_id' | 'is_active' | 'created_at'>;

const SELECTED_MODE_KEY = '@momentum/selectedModeId';

interface ModeState {
  modes: Mode[];
  selectedModeId: string | null;
  loading: boolean;
  fetchModes: () => Promise<void>;
  createMode: (input: ModeInput) => Promise<{ id: string | null; error: string | null }>;
  updateMode: (id: string, input: Partial<ModeInput>) => Promise<string | null>;
  deleteMode: (id: string) => Promise<string | null>;
  selectMode: (id: string) => Promise<void>;
  loadSelectedMode: () => Promise<void>;
  selectedMode: () => Mode | null;
  reset: () => void;
}

export const useModeStore = create<ModeState>((set, get) => ({
  modes: [],
  selectedModeId: null,
  loading: false,

  fetchModes: async () => {
    set({ loading: true });
    const modes = await fetchModesRemote();
    set({ loading: false, modes });
    // If no selection yet, default to the most recently created mode.
    if (!get().selectedModeId && modes.length > 0) {
      await get().selectMode(modes[0].id);
    }
  },

  createMode: async (input) => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return { id: null, error: 'not_authenticated' };

    const { data, error } = await supabase
      .from('modes')
      .insert({ ...input, user_id: auth.user.id })
      .select()
      .single();
    if (error || !data) return { id: null, error: error?.message ?? 'unknown' };
    await get().fetchModes();
    await get().selectMode((data as Mode).id);
    return { id: (data as Mode).id, error: null };
  },

  updateMode: async (id, input) => {
    const { error } = await supabase
      .from('modes')
      .update(input)
      .eq('id', id);
    if (error) return error.message;
    await get().fetchModes();
    return null;
  },

  deleteMode: async (id) => {
    const { error } = await supabase.from('modes').delete().eq('id', id);
    if (error) return error.message;
    set({ modes: get().modes.filter((m) => m.id !== id) });
    if (get().selectedModeId === id) {
      const next = get().modes[0]?.id ?? null;
      if (next) await get().selectMode(next);
      else {
        set({ selectedModeId: null });
        await AsyncStorage.removeItem(SELECTED_MODE_KEY);
      }
    }
    return null;
  },

  selectMode: async (id) => {
    set({ selectedModeId: id });
    try { await AsyncStorage.setItem(SELECTED_MODE_KEY, id); } catch {}
  },

  loadSelectedMode: async () => {
    try {
      const id = await AsyncStorage.getItem(SELECTED_MODE_KEY);
      if (id) set({ selectedModeId: id });
    } catch {}
  },

  selectedMode: () => {
    const id = get().selectedModeId;
    if (!id) return null;
    return get().modes.find((m) => m.id === id) ?? null;
  },

  reset: () => set({ modes: [], selectedModeId: null, loading: false }),
}));
