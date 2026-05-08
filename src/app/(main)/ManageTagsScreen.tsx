import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StatusBar, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Text } from '../../components/Text';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useNfcStore, type NfcTag } from '../../stores/nfcStore';
import type { ManageTagsNavProp } from '../../navigation/types';

function formatUid(uid: string) {
  return uid.match(/.{1,2}/g)?.join(':') ?? uid;
}

export default function ManageTagsScreen() {
  const navigation = useNavigation<ManageTagsNavProp>();
  const { barStyle, ink, muted, accent } = useThemeColors();
  const tags = useNfcStore((s) => s.tags);
  const loading = useNfcStore((s) => s.loading);
  const fetchTags = useNfcStore((s) => s.fetchTags);
  const deleteTag = useNfcStore((s) => s.deleteTag);
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
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark" edges={['top']}>
      <StatusBar barStyle={barStyle} />

      <View className="px-6 pt-4 pb-3 flex-row items-center justify-between">
        <View className="flex-row items-center gap-4 flex-1">
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} className="p-1">
            <Ionicons name="chevron-back" size={26} color={ink} />
          </Pressable>
          <Text variant="heading" className="text-2xl">NFC tags</Text>
        </View>
        <Pressable
          onPress={() => navigation.navigate('NFCRegister')}
          hitSlop={12}
          className="p-1"
        >
          <Ionicons name="add" size={28} color={accent} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="px-6 pt-4">
          {tags.length === 0 && !loading ? (
            <View className="items-center justify-center py-20">
              <View
                className="w-16 h-16 rounded-full items-center justify-center mb-6"
                style={{ backgroundColor: `${accent}1A` }}
              >
                <Ionicons name="radio-outline" size={32} color={accent} />
              </View>
              <Text variant="heading" className="text-center mb-2">No tags registered</Text>
              <Text variant="muted" className="text-center text-base px-4 mb-8">
                Register your Momentum tag to start dismissing alarms and locking in.
              </Text>
              <Button
                label="Add your first tag"
                onPress={() => navigation.navigate('NFCRegister')}
              />
            </View>
          ) : (
            <View className="gap-3">
              {tags.map((tag) => (
                <Card key={tag.id}>
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 pr-3">
                      <Text className="text-base font-semibold" numberOfLines={1}>
                        {tag.label ?? 'Untitled tag'}
                      </Text>
                      <Text variant="muted" className="text-xs mt-1" numberOfLines={1}>
                        {formatUid(tag.uid)}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => handleDelete(tag)}
                      disabled={deletingId === tag.id}
                      hitSlop={10}
                      className="p-2"
                    >
                      <Ionicons
                        name="trash-outline"
                        size={20}
                        color={deletingId === tag.id ? muted : '#EF4444'}
                      />
                    </Pressable>
                  </View>
                </Card>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
