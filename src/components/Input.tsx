import { useColorScheme, View, TextInput, type TextInputProps } from 'react-native';
import { Text } from './Text';

interface Props extends TextInputProps {
  label?: string;
  className?: string;
}

export function Input({ label, className = '', ...rest }: Props) {
  const isDark = useColorScheme() === 'dark';
  return (
    <View>
      {label ? (
        <Text variant="muted" className="mb-1.5">
          {label}
        </Text>
      ) : null}
      <TextInput
        className={`bg-surface dark:bg-surface-dark text-ink dark:text-ink-dark rounded-xl px-4 py-3.5 text-base ${className}`}
        placeholderTextColor={isDark ? '#888888' : '#717171'}
        {...rest}
      />
    </View>
  );
}
