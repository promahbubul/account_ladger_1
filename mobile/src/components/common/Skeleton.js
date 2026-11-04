import React, { useEffect, useRef } from 'react';
import { Animated, Platform } from 'react-native';
import { COLORS, RADIUS } from '../../constants/theme';

export const Skeleton = ({ width = 72, height = 14, style }) => {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const useNativeDriver = Platform.OS !== 'web';
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver }),
        Animated.timing(opacity, { toValue: 0.45, duration: 650, useNativeDriver }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View
      accessibilityLabel="Loading"
      style={[{ width, height, opacity, borderRadius: RADIUS.sm, backgroundColor: COLORS.borderLight }, style]}
    />
  );
};
