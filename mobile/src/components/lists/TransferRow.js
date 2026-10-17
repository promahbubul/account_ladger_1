import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../../constants/theme';
import { formatCurrency, formatDate } from '../../utils/formatters';

export const TransferRow = ({ item, onPress }) => {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={styles.card}
    >
      <View style={styles.topRow}>
        <View style={styles.iconBox}>
          <Ionicons name="swap-horizontal" size={18} color={COLORS.warning} />
        </View>
        <View style={styles.accountCol}>
          <Text style={styles.accountsText}>
            {item.sourceAccountName || 'Source'} → {item.destinationAccountName || 'Destination'}
          </Text>
          <Text style={styles.date}>{formatDate(item.date)}</Text>
        </View>
        <Text style={styles.amount}>
          {formatCurrency(item.amount)}
        </Text>
      </View>
      {item.description ? (
        <Text style={styles.desc} numberOfLines={1}>
          {item.description}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.warningLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  accountCol: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  accountsText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  date: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  amount: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.warning,
  },
  desc: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
});
