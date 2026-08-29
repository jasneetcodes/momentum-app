/**
 * Theme tokens used in two places:
 * - NativeWind classes (via tailwind.config.js — keep hex values in sync)
 * - useThemeColors() for literal-color APIs (ActivityIndicator, StatusBar, etc.)
 */

export const accent = '#01BAEF';
export const hazard = '#EF4444'; // blocked-state red — same in both modes

export interface ThemeColors {
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  accent: string;
  /** Slab/row borders and dividers throughout the redesigned system. */
  border: string;
  /** Disabled / struck-through text (e.g. a blocked app's name). */
  faint: string;
  hazard: string;
}

export const lightTheme: ThemeColors = {
  bg: '#F9F7F5',
  surface: '#FFFFFF',
  ink: '#1A1A1A',
  muted: '#717171',
  accent,
  border: '#E2DFDA',
  faint: '#9A9A96',
  hazard,
};

export const darkTheme: ThemeColors = {
  bg: '#0E0E0F',
  surface: '#1A1A1B',
  ink: '#FFFFFF',
  muted: '#888888',
  accent,
  border: '#2A2A2C',
  faint: '#5A5A5C',
  hazard,
};


