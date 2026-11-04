import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, SPACING, FONT_SIZE } from '../../constants/theme';
import { formatCurrency } from '../../utils/formatters';
import { Skeleton } from '../common/Skeleton';

const PLOT_HEIGHT = 120;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SERIES = [
  { key: 'income', label: 'Income', color: COLORS.chartPrimary },
  { key: 'expense', label: 'Expense', color: COLORS.chartSecondary },
];

const monthLabel = (month) => MONTHS[Number(month.slice(5, 7)) - 1];
const fullMonthLabel = (month) => `${monthLabel(month)} ${month.slice(0, 4)}`;

// Two series on one shared axis. Tapping a month reads out its exact values; a table is one tap away.
export const MonthlyBars = ({ months = [], isLoading = false }) => {
  const [selected, setSelected] = useState(null);
  const [showTable, setShowTable] = useState(false);

  if (isLoading) return <Skeleton width="100%" height={PLOT_HEIGHT + 60} />;

  const max = Math.max(...months.flatMap((m) => [m.income, m.expense]), 0);
  if (max === 0) return <Text style={styles.empty}>No income or expenses in these 12 months.</Text>;

  const active = months.find((m) => m.month === selected) || months[months.length - 1];

  return (
    <View>
      <View style={styles.legend}>
        {SERIES.map((series) => (
          <View key={series.key} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: series.color }]} />
            <Text style={styles.legendText}>{series.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.readout}>
        <Text style={styles.readoutMonth}>{fullMonthLabel(active.month)}</Text>
        <Text style={styles.readoutValues}>
          {SERIES.map((series) => `${series.label} ${formatCurrency(active[series.key])}`).join('   ')}
        </Text>
      </View>

      <View style={styles.plot}>
        {months.map((m) => {
          const isActive = m.month === active.month;
          return (
            <TouchableOpacity
              key={m.month}
              style={styles.group}
              activeOpacity={0.7}
              onPress={() => setSelected(m.month)}
              accessibilityRole="button"
              accessibilityLabel={`${fullMonthLabel(m.month)}: income ${formatCurrency(m.income)}, expense ${formatCurrency(m.expense)}`}
            >
              <View style={[styles.bars, isActive && styles.barsActive]}>
                {SERIES.map((series) => (
                  <View
                    key={series.key}
                    style={[
                      styles.bar,
                      {
                        backgroundColor: series.color,
                        height: m[series.key] > 0 ? Math.max((m[series.key] / max) * PLOT_HEIGHT, 2) : 0,
                      },
                    ]}
                  />
                ))}
              </View>
              <Text style={[styles.axisLabel, isActive && styles.axisLabelActive]}>{monthLabel(m.month)[0]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity onPress={() => setShowTable((value) => !value)} accessibilityRole="button" style={styles.tableToggle}>
        <Text style={styles.tableToggleText}>{showTable ? 'Hide table' : 'View as table'}</Text>
      </TouchableOpacity>

      {showTable ? (
        <View>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.tableHead, styles.tableFirst]}>Month</Text>
            <Text style={[styles.tableCell, styles.tableHead]}>Income</Text>
            <Text style={[styles.tableCell, styles.tableHead]}>Expense</Text>
          </View>
          {[...months].reverse().map((m) => (
            <View key={m.month} style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.tableFirst]}>{fullMonthLabel(m.month)}</Text>
              <Text style={styles.tableCell}>{formatCurrency(m.income)}</Text>
              <Text style={styles.tableCell}>{formatCurrency(m.expense)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  legend: {
    flexDirection: 'row',
    gap: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  readout: {
    marginBottom: SPACING.md,
  },
  readoutMonth: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  readoutValues: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
    fontVariant: ['tabular-nums'],
  },
  plot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderBottomWidth: 0,
  },
  group: {
    flex: 1,
    alignItems: 'center',
    minHeight: 44,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 2,
    height: PLOT_HEIGHT,
    alignSelf: 'stretch',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    paddingHorizontal: 1,
  },
  barsActive: {
    backgroundColor: COLORS.surfaceGhost,
  },
  bar: {
    width: 6,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  axisLabel: {
    fontSize: FONT_SIZE.xs - 1,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  axisLabelActive: {
    color: COLORS.text,
    fontWeight: '700',
  },
  tableToggle: {
    alignSelf: 'flex-start',
    paddingVertical: SPACING.sm,
    marginTop: SPACING.xs,
  },
  tableToggleText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.primary,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  tableCell: {
    flex: 1,
    fontSize: FONT_SIZE.xs,
    color: COLORS.text,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  tableFirst: {
    textAlign: 'left',
    color: COLORS.textSecondary,
  },
  tableHead: {
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  empty: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    paddingVertical: SPACING.md,
  },
});
