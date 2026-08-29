import {
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_600SemiBold,
  Archivo_700Bold,
  Archivo_800ExtraBold,
  Archivo_900Black,
} from '@expo-google-fonts/archivo';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';

/** Passed directly to useFonts() in App.js. */
export const FONT_ASSETS = {
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_600SemiBold,
  Archivo_700Bold,
  Archivo_800ExtraBold,
  Archivo_900Black,
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
};

/**
 * Named weights for use in style={{ fontFamily: FONTS.archivoBlack }}.
 * Archivo drives every display number/headline; JetBrains Mono drives
 * every uppercase label/caption/stat-tag. See CLAUDE.md "Brand & Visual
 * Design" for the full system these belong to.
 */
export const FONTS = {
  archivoRegular: 'Archivo_400Regular',
  archivoMedium: 'Archivo_500Medium',
  archivoSemiBold: 'Archivo_600SemiBold',
  archivoBold: 'Archivo_700Bold',
  archivoExtraBold: 'Archivo_800ExtraBold',
  archivoBlack: 'Archivo_900Black',
  monoRegular: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
} as const;
