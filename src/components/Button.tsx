import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

const containerByVariant: Record<Variant, string> = {
  primary: 'bg-accent active:opacity-80',
  secondary: 'bg-surface dark:bg-surface-dark active:opacity-70',
  ghost: 'bg-transparent active:opacity-60',
};

const labelByVariant: Record<Variant, string> = {
  primary: 'text-white',
  secondary: 'text-ink dark:text-ink-dark',
  ghost: 'text-accent',
};

const sizeClass: Record<Size, string> = {
  sm: 'px-4 py-2 rounded-xl',
  md: 'px-6 py-3.5 rounded-2xl',
  lg: 'px-8 py-5 rounded-2xl',
};

const labelSize: Record<Size, string> = {
  sm: 'text-sm font-medium',
  md: 'text-base font-semibold',
  lg: 'text-lg font-semibold',
};

interface Props extends Omit<PressableProps, 'children'> {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  className?: string;
}

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  className = '',
  ...rest
}: Props) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      disabled={isDisabled}
      className={`${containerByVariant[variant]} ${sizeClass[size]} ${fullWidth ? 'w-full' : ''} ${isDisabled ? 'opacity-50' : ''} items-center justify-center ${className}`}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#fff' : '#01BAEF'} />
      ) : (
        <Text className={`${labelByVariant[variant]} ${labelSize[size]}`}>{label}</Text>
      )}
    </Pressable>
  );
}
