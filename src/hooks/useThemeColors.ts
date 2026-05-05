import { useColorScheme } from 'react-native';
import { darkTheme, lightTheme, type ThemeColors } from '../constants/colors';

export function useThemeColors(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkTheme : lightTheme;
}
