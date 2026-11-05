import React from 'react';
import { View, Text } from 'react-native';
import { COLORS, SPACING, FONT_SIZE, themedStyles } from '../../constants/theme';
import { formatCurrency } from '../../utils/formatters';
import { Skeleton } from '../common/Skeleton';

const MAX_ROWS = 8;

// Ranked magnitudes for one measure: a single hue, longest bar first, each value labelled in text ink.
export const BarList = ({ rows = [], isLoading = false, emptyMessage = 'Nothing to show yet.', valueFormatter = formatCurrency }) => {
  if (isLoading) {
    return (
      <View>
        {[0, 1, 2].map((index) => (
          <View key={index} style={styles.row}>
            <Skeleton width={`${70 - index * 15}%`} height={12} />
            <Skeleton width="100%" height={8} style={styles.skeletonBar} />
          </View>
        ))}
      </View>
    );
  }

  const positive = rows.filter((row) => row.value > 0);
  if (positive.length === 0) return <Text style={styles.empty}>{emptyMessage}</Text>;

  // Long tails fold into "Other" rather than shrinking every bar.
  const sorted = [...positive].sort((a, b) => b.value - a.value);
  const shown = sorted.length > MAX_ROWS ? sorted.slice(0, MAX_ROWS - 1) : sorted;
  const rest = sorted.slice(shown.length);
  const display = rest.length
    ? [...shown, { key: '__other', label: `Other (${rest.length})`, value: rest.reduce((sum, row) => sum + row.value, 0) }]
    : shown;
  const max = Math.max(...display.map((row) => row.value));

  return (
    <View>
      {display.map((row) => (
        <View
          key={row.key ?? row.label}
          style={styles.row}
          accessible
          accessibilityLabel={`${row.label}: ${valueFormatter(row.value)}`}
        >
          <View style={styles.textRow}>
            <Text style={styles.label} numberOfLines={1}>{row.label}</Text>
            <Text style={styles.value}>{valueFormatter(row.value)}</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.bar, { width: `${Math.max((row.value / max) * 100, 1)}%` }]} />
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = themedStyles(() => ({
  row: {
    marginBottom: SPACING.md,
  },
  textRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  label: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginRight: SPACING.md,
  },
  value: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 8,
  },
  bar: {
    height: 8,
    backgroundColor: COLORS.chartPrimary,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  skeletonBar: {
    marginTop: 6,
  },
  empty: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    paddingVertical: SPACING.md,
  },
}));
