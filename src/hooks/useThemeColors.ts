import { useColorScheme } from 'react-native';
import { darkTheme, lightTheme, type ThemeColors } from '../constants/colors';

export interface Theme extends ThemeColors {
  isDark: boolean;
  barStyle: 'light-content' | 'dark-content';
}

export function useThemeColors(): Theme {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const theme = isDark ? darkTheme : lightTheme;
  return {
    ...(theme),
    isDark,
    barStyle: isDark ? 'light-content' : 'dark-content',
  };
}
