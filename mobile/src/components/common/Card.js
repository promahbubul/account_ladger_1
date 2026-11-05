import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, RADIUS, themedStyles } from '../../constants/theme';

export const Card = ({
  children,
  style,
  onPress,
  elevated = false,
  borderless = false,
  padding = true,
}) => {
  const cardStyles = [
    styles.card,
    elevated && styles.elevated,
    borderless && styles.borderless,
    !padding && styles.noPadding,
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={onPress}
        style={cardStyles}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View style={cardStyles}>
      {children}
    </View>
  );
};

const styles = themedStyles(() => ({
  card: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  elevated: {
    backgroundColor: COLORS.surfaceElevated,
  },
  borderless: {
    borderWidth: 0,
    borderColor: 'transparent',
  },
  noPadding: {
    padding: 0,
  },
}));
