import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

interface Props {
  height?: number;
  color: string;
  background: string;
  reverse?: boolean;
  stripeWidth?: number;
  gap?: number;
}

/**
 * The "marching hazard stripe" bar used on Alarm Ringing and Post-Alarm
 * Block. RN has no equivalent to CSS's animated repeating-linear-gradient
 * background-position, so this approximates it with skewed bars tiled
 * across a translating row, clipped by overflow:hidden — a diagonal
 * stripe illusion built from plain Views, no SVG dependency needed.
 */
export function HazardStripes({ height = 14, color, background, reverse = false, stripeWidth = 12, gap = 12 }: Props) {
  const period = stripeWidth + gap;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(reverse ? -1 : 1, { duration: 1600, easing: Easing.linear }),
      -1,
      false,
    );
  }, [progress, reverse]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * period }],
  }));

  const tileCount = 60; // enough bars to cover a couple of screen-widths either direction of the translate

  return (
    <View style={{ height, backgroundColor: background, overflow: 'hidden' }}>
      <Animated.View
        style={[
          { flexDirection: 'row', position: 'absolute', left: -period * 2, top: -height },
          animatedStyle,
        ]}
      >
        {Array.from({ length: tileCount }).map((_, i) => (
          <View
            key={i}
            style={{
              width: stripeWidth,
              height: height * 3,
              backgroundColor: color,
              marginRight: gap,
              transform: [{ skewX: '-45deg' }],
            }}
          />
        ))}
      </Animated.View>
    </View>
  );
}
