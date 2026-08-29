import { View, type ViewProps } from 'react-native';
import { useThemeColors } from '../hooks/useThemeColors';

interface Props extends ViewProps {
  /** Fill color — defaults to the theme's surface. Pass accent for a full-bleed accent slab (e.g. "next alarm"). */
  background?: string;
  /** Left accent border (an active alarm, a registered tag) — 0 to omit. */
  borderLeftColor?: string;
  borderLeftWidth?: number;
  style?: ViewProps['style'];
}

/**
 * The redesigned system's core surface — zero border radius, flat fill,
 * no shadow. Replaces Card for every redesigned screen; Card stays as-is
 * for the parts of the app this pass doesn't touch (native takeover
 * screens, onboarding). See CLAUDE.md "Brand & Visual Design".
 */
export function Slab({ background, borderLeftColor, borderLeftWidth, style, children, ...rest }: Props) {
  const { surface } = useThemeColors();
  return (
    <View
      style={[
        {
          backgroundColor: background ?? surface,
          borderLeftWidth: borderLeftColor ? (borderLeftWidth ?? 5) : 0,
          borderLeftColor: borderLeftColor ?? 'transparent',
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
