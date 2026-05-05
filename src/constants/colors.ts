/**
 * Theme tokens used in two places:
 * - NativeWind classes (via tailwind.config.js — keep hex values in sync)
 * - useThemeColors() for literal-color APIs (ActivityIndicator, StatusBar, etc.)
 */

export const accent = '#01BAEF';

export const lightTheme = {
  bg: '#F9F7F5',
  surface: '#FFFFFF',
  ink: '#1A1A1A',
  muted: '#717171',
  accent,
} as const;

export const darkTheme = {
  bg: '#0E0E0F',
  surface: '#1A1A1B',
  ink: '#FFFFFF',
  muted: '#888888',
  accent,
} as const;

export type ThemeColors = typeof lightTheme;
