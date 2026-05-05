import { View, type ViewProps } from 'react-native';

interface Props extends ViewProps {
  className?: string;
}

export function Card({ className = '', children, ...rest }: Props) {
  return (
    <View
      className={`bg-surface dark:bg-surface-dark rounded-2xl p-5 ${className}`}
      {...rest}
    >
      {children}
    </View>
  );
}
