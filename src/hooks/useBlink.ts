import { useEffect } from 'react';
import { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

/**
 * Hard-cut opacity blink (1 → .25, step not fade) — matches the design's
 * `@keyframes blink{0%,49%{opacity:1}50%,100%{opacity:.25}}`, used on
 * "ALARM ACTIVE" and "LOCKED IN · {mode}" status indicators.
 */
export function useBlink() {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 490 }),
        withTiming(0.25, { duration: 10 }),
        withTiming(0.25, { duration: 490 }),
        withTiming(1, { duration: 10 }),
      ),
      -1,
      false,
    );
  }, [opacity]);

  return useAnimatedStyle(() => ({ opacity: opacity.value }));
}
