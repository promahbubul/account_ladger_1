import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../../constants/theme';
import { formatCurrency, formatDate } from '../../utils/formatters';

export const TransactionRow = ({ item, onPress }) => {
  const isIncome = item.type === 'INCOME';
  const isTransfer = item.type === 'TRANSFER';
  const isExpense = item.type === 'EXPENSE';

  const iconName = isIncome
    ? 'arrow-down-circle'
    : isTransfer
    ? 'repeat-outline'
    : 'arrow-up-circle';

  const iconColor = isIncome
    ? COLORS.success
    : isTransfer
    ? COLORS.warning
    : COLORS.danger;

  const sign = isIncome ? '+' : isExpense ? '-' : '';
  const amountColor = isIncome ? COLORS.success : isExpense ? COLORS.danger : COLORS.text;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={styles.row}
    >
      <View style={[styles.iconBox, { backgroundColor: isIncome ? COLORS.successLight : isExpense ? COLORS.dangerLight : COLORS.warningLight }]}>
        <Ionicons name={iconName} size={20} color={iconColor} />
      </View>

      <View style={styles.centerCol}>
        <Text style={styles.title} numberOfLines={1}>
          {item.description || item.category || 'Transaction'}
        </Text>
        <View style={styles.subRow}>
          <Text style={styles.accountName} numberOfLines={1}>
            {item.accountName || item.category || '-'}
          </Text>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.date}>{formatDate(item.date)}</Text>
        </View>
      </View>

      <View style={styles.rightCol}>
        <Text style={[styles.amount, { color: amountColor }]}>
          {`${sign}${formatCurrency(item.amount)}`}
        </Text>
        {item.subcategory ? (
          <Text style={styles.subcat} numberOfLines={1}>
            {item.subcategory}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  centerCol: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  title: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  accountName: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    maxWidth: 120,
  },
  bullet: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginHorizontal: 4,
  },
  date: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  rightCol: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
  },
  subcat: {
    fontSize: FONT_SIZE.xs - 1,
    color: COLORS.textMuted,
    marginTop: 2,
  },
});
