import { Text as RNText, type TextProps } from 'react-native';
import { FONTS } from '../constants/fonts';

interface Props extends TextProps {
  color: string;
  size?: number;
  weight?: 'regular' | 'medium' | 'bold';
  /** Most mono labels in this system are uppercase with wide tracking (.14em–.3em) — opt out for the rare non-uppercase use (e.g. a UID). */
  uppercase?: boolean;
  /** Overrides the default wide tracking — pass 0 for values like a UID that shouldn't spread out. */
  letterSpacing?: number;
}

const familyByWeight = {
  regular: FONTS.monoRegular,
  medium: FONTS.monoMedium,
  bold: FONTS.monoBold,
};

/**
 * JetBrains Mono caption/label — recurs on every screen in the redesigned
 * system (section headers, stat tags, meta rows). See CLAUDE.md "Brand &
 * Visual Design".
 */
export function MonoLabel({
  color,
  size = 12,
  weight = 'bold',
  uppercase = true,
  letterSpacing,
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
          letterSpacing: letterSpacing ?? size * 0.16,
          textTransform: uppercase ? 'uppercase' : 'none',
        },
        style,
      ]}
      {...rest}
    />
  );
}
