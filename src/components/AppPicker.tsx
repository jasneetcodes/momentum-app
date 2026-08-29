import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, View } from 'react-native';
import { Input } from './Input';
import { Text } from './Text';
import { useThemeColors } from '../hooks/useThemeColors';
import { useInstalledAppsStore } from '../stores/installedAppsStore';

export interface AppPickerDefault {
  id: string;
  name: string;
}

interface Row {
  id: string;
  name: string;
  locked: boolean;
}

interface AppPickerProps {
  /** Rendered above the search bar and app list — scrolls with everything else. */
  header?: React.ReactNode;
  /** Rendered below the app list — e.g. duration/sound pickers, the save button. */
  footer?: React.ReactNode;
  selected: Set<string>;
  onToggle: (id: string) => void;
  /** The always-locked, always-selected apps (the 7 social defaults) — shown first. */
  defaultApps: AppPickerDefault[];
  /** Subtitle shown on locked rows, e.g. "Default — Always blocked". */
  lockedNote: string;
}

/**
 * Shared app picker for Create Mode / Alarm Setup. Owns its own FlatList as
 * the screen's single scrollable surface (header/footer content scrolls
 * with it via ListHeaderComponent/ListFooterComponent) — deliberately not a
 * FlatList nested inside a ScrollView, which doesn't hold up at the
 * 150-300 real installed apps this now needs to render.
 */
export function AppPicker({ header, footer, selected, onToggle, defaultApps, lockedNote }: AppPickerProps) {
  const { accent, muted, surface } = useThemeColors();
  const apps = useInstalledAppsStore((s) => s.apps);
  const loading = useInstalledAppsStore((s) => s.loading);
  const loaded = useInstalledAppsStore((s) => s.loaded);
  const fetchApps = useInstalledAppsStore((s) => s.fetchApps);

  useEffect(() => {
    fetchApps();
  }, [fetchApps]);

  const [query, setQuery] = useState('');

  const rows: Row[] = useMemo(() => {
    const defaultIds = new Set(defaultApps.map((a) => a.id));
    const locked: Row[] = defaultApps.map((a) => ({ id: a.id, name: a.name, locked: true }));
    const rest: Row[] = apps
      .filter((a) => !defaultIds.has(a.packageName))
      .map((a) => ({ id: a.packageName, name: a.label, locked: false }));
    const all = [...locked, ...rest];
    if (!query.trim()) return all;
    const q = query.trim().toLowerCase();
    return all.filter((r) => r.name.toLowerCase().includes(q));
  }, [apps, defaultApps, query]);

  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.id}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
      ListHeaderComponent={
        <>
          {header}
          <View className="flex-row items-center justify-between mt-8 mb-3">
            <Text variant="label">Apps</Text>
            <Text variant="muted" className="text-xs">{lockedNote}</Text>
          </View>
          <Input
            placeholder="Search apps"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            className="mb-3"
          />
          {Platform.OS === 'ios' && (
            <Text variant="muted" className="text-xs mb-3">
              The full app list isn't available on iOS yet — only the defaults above can be selected.
            </Text>
          )}
          {Platform.OS === 'android' && loading && !loaded && (
            <View className="flex-row items-center gap-2 mb-3">
              <ActivityIndicator size="small" color={muted} />
              <Text variant="muted" className="text-xs">Loading installed apps…</Text>
            </View>
          )}
        </>
      }
      ListFooterComponent={footer ? <View className="mt-2">{footer}</View> : null}
      ListEmptyComponent={
        <Text variant="muted" className="text-sm text-center py-8">No apps match your search.</Text>
      }
      renderItem={({ item, index }) => {
        const isSelected = selected.has(item.id);
        const isFirst = index === 0;
        const isLast = index === rows.length - 1;
        return (
          <Pressable
            onPress={() => onToggle(item.id)}
            className="flex-row items-center justify-between px-5 py-4 active:opacity-60"
            style={{
              backgroundColor: surface,
              borderTopLeftRadius: isFirst ? 16 : 0,
              borderTopRightRadius: isFirst ? 16 : 0,
              borderBottomLeftRadius: isLast ? 16 : 0,
              borderBottomRightRadius: isLast ? 16 : 0,
              borderBottomWidth: isLast ? 0 : 1,
              borderBottomColor: muted + '20',
            }}
          >
            <View className="flex-1 pr-3">
              <Text className="text-base">{item.name}</Text>
              {item.locked && (
                <Text variant="muted" className="text-xs mt-0.5">{lockedNote}</Text>
              )}
            </View>
            <View
              className="w-6 h-6 rounded-md items-center justify-center"
              style={{
                backgroundColor: isSelected ? accent : 'transparent',
                borderWidth: 1.5,
                borderColor: isSelected ? accent : muted,
                opacity: item.locked ? 0.4 : 1,
              }}
            >
              {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
            </View>
          </Pressable>
        );
      }}
    />
  );
}
