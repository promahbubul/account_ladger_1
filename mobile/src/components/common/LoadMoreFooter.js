import React from 'react';
import { Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { COLORS, SPACING, FONT_SIZE } from '../../constants/theme';

export const LoadMoreFooter = ({ query }) => {
  if (!query.hasNextPage && !query.isFetchNextPageError) return null;

  return (
    <TouchableOpacity
      style={styles.button}
      disabled={query.isFetchingNextPage}
      onPress={() => query.fetchNextPage()}
      accessibilityRole="button"
    >
      {query.isFetchingNextPage ? (
        <ActivityIndicator size="small" color={COLORS.primary} />
      ) : (
        <Text style={styles.text}>{query.isFetchNextPageError ? 'Could not load more. Try again' : 'Load More'}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
    fontWeight: '700',
  },
});
