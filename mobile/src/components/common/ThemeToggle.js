import React from 'react';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';

const STATES = {
  system: { icon: 'phone-portrait-outline', label: 'Theme: follows your device. Switch to light' },
  light: { icon: 'sunny-outline', label: 'Theme: light. Switch to dark' },
  dark: { icon: 'moon-outline', label: 'Theme: dark. Switch to follow your device' },
};

export const ThemeToggle = ({ style }) => {
  const { preference, cycleTheme } = useTheme();
  const { icon, label } = STATES[preference];
  return (
    <TouchableOpacity
      onPress={cycleTheme}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={style}
    >
      <Ionicons name={icon} size={20} color={COLORS.textSecondary} />
    </TouchableOpacity>
  );
};
