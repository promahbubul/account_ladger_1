import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE, themedStyles } from '../../constants/theme';
import { EmptyState } from './EmptyState';

// Full-size replacement for a list's empty state when its request failed.
export const QueryErrorState = ({ title = 'Could not load data', onRetry, style }) => (
  <EmptyState
    icon="alert-circle-outline"
    title={title}
    actionTitle="Try Again"
    onAction={onRetry}
    style={style}
  />
);

// Compact, tappable notice for screens that still show the rest of their content.
export const QueryErrorBanner = ({ message = 'Could not load data.', onRetry, style }) => (
  <TouchableOpacity
    style={[styles.banner, style]}
    activeOpacity={0.7}
    onPress={onRetry}
    accessibilityRole="button"
  >
    <Ionicons name="alert-circle-outline" size={16} color={COLORS.danger} />
    <Text style={styles.bannerText}>{message}</Text>
    <Text style={styles.bannerRetry}>Try Again</Text>
  </TouchableOpacity>
);

const styles = themedStyles(() => ({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.dangerLight,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  bannerText: {
    flex: 1,
    fontSize: FONT_SIZE.xs,
    color: COLORS.text,
  },
  bannerRetry: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: COLORS.danger,
  },
}));
