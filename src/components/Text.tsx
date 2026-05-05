import { Text as RNText, type TextProps } from 'react-native';

type Variant = 'display' | 'heading' | 'body' | 'muted' | 'label';

const variantClass: Record<Variant, string> = {
  display: 'text-6xl font-bold text-ink dark:text-ink-dark',
  heading: 'text-2xl font-semibold text-ink dark:text-ink-dark',
  body: 'text-base text-ink dark:text-ink-dark',
  muted: 'text-sm text-muted dark:text-muted-dark',
  label: 'text-xs uppercase tracking-wider text-muted dark:text-muted-dark',
};

interface Props extends TextProps {
  variant?: Variant;
  className?: string;
}

export function Text({ variant = 'body', className = '', ...rest }: Props) {
  return <RNText className={`${variantClass[variant]} ${className}`} {...rest} />;
}
