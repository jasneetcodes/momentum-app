import { create } from 'zustand';
import { supabase } from '../services/supabase';

export interface NfcTag {
  id: string;
  user_id: string;
  uid: string;
  label: string | null;
  created_at: string;
}

export type RegisterError =
  | 'invalid_tag'
  | 'already_registered'
  | 'active_session'
  | 'unknown';

interface NfcState {
  tags: NfcTag[];
  loading: boolean;
  fetchTags: () => Promise<void>;
  registerTag: (uid: string, label: string) => Promise<RegisterError | null>;
  deleteTag: (tagId: string) => Promise<RegisterError | null>;
  reset: () => void;
}

export const useNfcStore = create<NfcState>((set, get) => ({
  tags: [],
  loading: false,

  fetchTags: async () => {
    set({ loading: true });
    const { data } = await supabase
      .from('nfc_tags')
      .select('*')
      .order('created_at', { ascending: false });
    set({ loading: false, tags: (data as NfcTag[]) ?? [] });
  },

  registerTag: async (uid, label) => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return 'unknown';

    const { error } = await supabase.from('nfc_tags').insert({
      user_id: auth.user.id,
      uid,
      label: label.trim() || null,
    });

    if (error) {
      if (error.code === '23503') return 'invalid_tag';
      if (error.code === '23505') return 'already_registered';
      return 'unknown';
    }

    await get().fetchTags();
    return null;
  },

  deleteTag: async (tagId) => {
    const { data: active } = await supabase
      .from('mode_sessions')
      .select('id')
      .is('deactivated_at', null)
      .limit(1);

    if (active && active.length > 0) return 'active_session';

    const { error } = await supabase.from('nfc_tags').delete().eq('id', tagId);
    if (error) return 'unknown';

    await get().fetchTags();
    return null;
  },

  reset: () => set({ tags: [], loading: false }),
}));
