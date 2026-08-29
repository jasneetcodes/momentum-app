import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';

interface RingProps {
  size: number;
  color: string;
  delayMs?: number;
}

function Ring({ size, color, delayMs = 0 }: RingProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    scale.value = withDelay(delayMs, withRepeat(withTiming(1.4, { duration: 1500, easing: Easing.inOut(Easing.ease) }), -1, false));
    opacity.value = withDelay(delayMs, withRepeat(withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) }), -1, false));
  }, [scale, opacity, delayMs]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2.5,
          borderColor: color,
        },
        style,
      ]}
    />
  );
}

interface Props {
  size: number;
  color: string;
  /** Number of staggered rings — Alarm Ringing uses 2, Add Tag/Lock In idle use 1. */
  rings?: 1 | 2;
  children?: React.ReactNode;
}

/**
 * The pulsing-ring "tap your tag" motif — used on Alarm Ringing, Add Tag,
 * and Lock In's idle state. Same expanding-ring approach already proven
 * in the pre-redesign LockInScreen; this is the shared, restyled version.
 */
export function PulsingRing({ size, color, rings = 1, children }: Props) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Ring size={size} color={color} />
      {rings === 2 && <Ring size={size} color={color} delayMs={750} />}
      {children}
    </View>
  );
}
