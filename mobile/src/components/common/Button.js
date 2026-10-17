import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../../constants/theme';

export const Button = ({
  title,
  onPress,
  variant = 'primary', // primary | secondary | danger | outline | ghost
  size = 'md', // sm | md | lg
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon,
}) => {
  const isActionDisabled = disabled || loading;

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      disabled={isActionDisabled}
      style={[
        styles.base,
        styles[variant],
        styles[`size_${size}`],
        isActionDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' || variant === 'ghost' ? COLORS.primary : COLORS.text} size="small" />
      ) : (
        <>
          {icon ? <>{icon}</> : null}
          <Text
            style={[
              styles.textBase,
              styles[`text_${variant}`],
              styles[`textSize_${size}`],
              icon ? { marginLeft: SPACING.sm } : null,
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
  },
  primary: {
    backgroundColor: COLORS.primary,
  },
  secondary: {
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  danger: {
    backgroundColor: COLORS.danger,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  size_sm: {
    paddingVertical: SPACING.xs + 2,
    paddingHorizontal: SPACING.md,
  },
  size_md: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  size_lg: {
    paddingVertical: SPACING.lg - 2,
    paddingHorizontal: SPACING.xl,
  },
  disabled: {
    opacity: 0.5,
  },
  textBase: {
    fontWeight: '600',
  },
  text_primary: {
    color: '#FFFFFF',
  },
  text_secondary: {
    color: COLORS.text,
  },
  text_danger: {
    color: '#FFFFFF',
  },
  text_outline: {
    color: COLORS.text,
  },
  text_ghost: {
    color: COLORS.textSecondary,
  },
  textSize_sm: {
    fontSize: FONT_SIZE.xs,
  },
  textSize_md: {
    fontSize: FONT_SIZE.sm,
  },
  textSize_lg: {
    fontSize: FONT_SIZE.md,
  },
});
