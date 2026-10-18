import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../../constants/theme';

export const Badge = ({ label, variant = 'default', style, textStyle }) => {
  return (
    <View style={[styles.badge, styles[variant], style]}>
      <Text style={[styles.text, styles[`text_${variant}`], textStyle]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    alignSelf: 'flex-start',
  },
  default: {
    backgroundColor: COLORS.surfaceElevated,
  },
  success: {
    backgroundColor: COLORS.successLight,
  },
  danger: {
    backgroundColor: COLORS.dangerLight,
  },
  warning: {
    backgroundColor: COLORS.warningLight,
  },
  primary: {
    backgroundColor: COLORS.primaryLight,
  },
  purple: {
    backgroundColor: COLORS.purpleLight,
  },
  text: {
    fontSize: FONT_SIZE.xs - 1,
    fontWeight: '600',
  },
  text_default: {
    color: COLORS.textSecondary,
  },
  text_success: {
    color: COLORS.success,
  },
  text_danger: {
    color: COLORS.danger,
  },
  text_warning: {
    color: COLORS.warning,
  },
  text_primary: {
    color: COLORS.primary,
  },
  text_purple: {
    color: COLORS.purple,
  },
});
