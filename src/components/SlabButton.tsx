import { ActivityIndicator, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { useThemeColors } from '../hooks/useThemeColors';
import { FONTS } from '../constants/fonts';
import { MonoLabel } from './MonoLabel';

type Variant = 'primary' | 'secondary';

interface Props extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: Variant;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Full-bleed rectangular button — zero border radius, accent fill for
 * primary actions, bordered outline for secondary. Replaces Button for
 * every redesigned screen. Label uses the Archivo Black display face
 * (not JetBrains Mono) per the canvas — CTAs read as bold statements, not
 * mono captions.
 */
export function SlabButton({ label, variant = 'primary', loading = false, fullWidth, disabled, style, ...rest }: Props) {
  const { accent, ink, border } = useThemeColors();
  const isDisabled = disabled || loading;
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      disabled={isDisabled}
      style={[
        {
          paddingVertical: isPrimary ? 22 : 20.5,
          paddingHorizontal: 24,
          alignItems: 'center',
          justifyContent: 'center',
          width: fullWidth ? '100%' : undefined,
          backgroundColor: isPrimary ? accent : 'transparent',
          borderWidth: isPrimary ? 0 : 1.5,
          borderColor: border,
          opacity: isDisabled ? 0.5 : 1,
        },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? '#0E0E0F' : accent} />
      ) : (
        <MonoLabel
          color={isPrimary ? '#0E0E0F' : ink}
          size={19}
          weight="bold"
          letterSpacing={19 * 0.06}
          style={{ fontFamily: FONTS.archivoExtraBold, lineHeight: 19 }}
        >
          {label}
        </MonoLabel>
      )}
    </Pressable>
  );
}
