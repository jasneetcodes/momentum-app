import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StatusBar, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Display } from '../../components/Display';
import { MonoLabel } from '../../components/MonoLabel';
import { SlabButton } from '../../components/SlabButton';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useModeSessionStore } from '../../stores/modeSessionStore';
import { useNfcStore, type NfcTag } from '../../stores/nfcStore';
import type { ManageTagsNavProp } from '../../navigation/types';

function formatUid(uid: string) {
  return uid.match(/.{1,2}/g)?.join(':') ?? uid;
}

export default function ManageTagsScreen() {
  const navigation = useNavigation<ManageTagsNavProp>();
  const { barStyle, bg, ink, muted, faint, border, accent, surface } = useThemeColors();
  const tags = useNfcStore((s) => s.tags);
  const loading = useNfcStore((s) => s.loading);
  const fetchTags = useNfcStore((s) => s.fetchTags);
  const deleteTag = useNfcStore((s) => s.deleteTag);
  // A tag in use can't be deleted — the real rule (deleteTag() already
  // enforces this server-side via 'active_session'); surfaced here too so
  // it's visible before the user even tries, matching the design's "A tag
  // in use cannot be deleted" footnote.
  const activeSession = useModeSessionStore((s) => s.activeSession);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const handleDelete = (tag: NfcTag) => {
    Alert.alert(
      'Delete tag?',
      `"${tag.label ?? formatUid(tag.uid)}" will be removed. You can register it again later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(tag.id);
            const err = await deleteTag(tag.id);
            setDeletingId(null);
            if (err === 'active_session') {
              Alert.alert(
                'End your session first',
                'You have an active Lock In session. End it before deleting any tags.',
              );
            } else if (err) {
              Alert.alert('Could not delete tag', 'Please try again.');
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={['top']}>
      <StatusBar barStyle={barStyle} />

      <View style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12}
            style={{ width: 48, height: 48, borderWidth: 1.5, borderColor: border, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="chevron-back" size={26} color={ink} />
          </Pressable>
          <Display size={34} weight="black" color={ink} uppercase letterSpacing={-34 * 0.03}>Tags</Display>
        </View>
        <Pressable
          onPress={() => navigation.navigate('NFCRegister')}
          hitSlop={12}
          style={{ width: 52, height: 52, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="add" size={32} color={bg} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ paddingHorizontal: 24 }}>
          <MonoLabel color={accent} size={12} letterSpacing={12 * 0.22} style={{ marginBottom: 14 }}>
            {tags.length} registered
          </MonoLabel>

          {tags.length === 0 && !loading ? (
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <Ionicons name="radio-outline" size={40} color={accent} style={{ marginBottom: 16 }} />
              <Display size={20} weight="bold" color={ink} style={{ textAlign: 'center' }}>No tags registered</Display>
              <MonoLabel color={muted} size={12} uppercase={false} style={{ textAlign: 'center', marginTop: 10, marginBottom: 24 }}>
                Register your Momentum tag to start dismissing alarms and locking in.
              </MonoLabel>
              <SlabButton label="Add your first tag" onPress={() => navigation.navigate('NFCRegister')} />
            </View>
          ) : (
            <View style={{ gap: 2 }}>
              {tags.map((tag) => {
                const disabled = deletingId === tag.id || !!activeSession;
                return (
                  <View
                    key={tag.id}
                    style={{ backgroundColor: surface, padding: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderLeftWidth: 5, borderLeftColor: accent }}
                  >
                    <View style={{ flex: 1 }}>
                      <Display size={24} weight="extrabold" color={ink} letterSpacing={-24 * 0.015} numberOfLines={1}>
                        {tag.label ?? 'Untitled tag'}
                      </Display>
                      <MonoLabel color={muted} size={13} letterSpacing={13 * 0.1} uppercase={false} style={{ marginTop: 8 }}>
                        {formatUid(tag.uid)}
                      </MonoLabel>
                      {activeSession && (
                        <MonoLabel color={accent} size={12} letterSpacing={12 * 0.14} style={{ marginTop: 10 }}>
                          Session running — locked
                        </MonoLabel>
                      )}
                    </View>
                    <Pressable
                      onPress={() => handleDelete(tag)}
                      disabled={disabled}
                      style={{ width: 48, height: 48, borderWidth: 1.5, borderColor: disabled ? border : '#3A2A2C', alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1 }}
                    >
                      <Ionicons name="trash-outline" size={22} color={disabled ? faint : '#EF4444'} />
                    </Pressable>
                  </View>
                );
              })}
              <Pressable
                onPress={() => navigation.navigate('NFCRegister')}
                style={{ borderWidth: 1.5, borderStyle: 'dashed', borderColor: border, padding: 22, marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 16 }}
              >
                <View style={{ width: 44, height: 44, backgroundColor: accent + '24', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="add" size={26} color={accent} />
                </View>
                <View>
                  <Display size={19} weight="extrabold" color={ink}>Add a tag</Display>
                  <MonoLabel color={faint} size={12} letterSpacing={12 * 0.1} style={{ marginTop: 4 }}>Scan a new tag</MonoLabel>
                </View>
              </Pressable>
              <MonoLabel color={faint} size={12} letterSpacing={12 * 0.08} uppercase={false} style={{ lineHeight: 20, marginTop: 22 }}>
                A tag in use cannot be deleted. End the session first.
              </MonoLabel>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
