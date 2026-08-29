import { Text as RNText, type TextProps } from 'react-native';
import { FONTS } from '../constants/fonts';

type Weight = 'medium' | 'semibold' | 'bold' | 'extrabold' | 'black';

const familyByWeight: Record<Weight, string> = {
  medium: FONTS.archivoMedium,
  semibold: FONTS.archivoSemiBold,
  bold: FONTS.archivoBold,
  extrabold: FONTS.archivoExtraBold,
  black: FONTS.archivoBlack,
};

interface Props extends TextProps {
  /** Font size in px — display numbers/headlines are one-off per screen (26px screen titles up to 132px the streak number), not a small fixed scale. */
  size: number;
  weight?: Weight;
  color: string;
  /** Defaults to a tight -0.03em, matching the system's negative tracking on display type. */
  letterSpacing?: number;
  lineHeight?: number;
  /** Most headlines are uppercase in this system, but not all (e.g. Home's greeting) — opt in per instance. */
  uppercase?: boolean;
}

/**
 * Archivo display type — every big number and headline in the redesigned
 * system. See CLAUDE.md "Brand & Visual Design" for the full type system.
 */
export function Display({
  size,
  weight = 'black',
  color,
  letterSpacing,
  lineHeight,
  uppercase = false,
  style,
  ...rest
}: Props) {
  return (
    <RNText
      style={[
        {
          fontFamily: familyByWeight[weight],
          fontSize: size,
          color,
          letterSpacing: letterSpacing ?? -size * 0.03,
          lineHeight,
          textTransform: uppercase ? 'uppercase' : 'none',
        },
        style,
      ]}
      {...rest}
    />
  );
}
