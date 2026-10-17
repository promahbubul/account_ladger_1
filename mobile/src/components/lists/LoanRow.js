import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../../constants/theme';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Badge } from '../common/Badge';

export const LoanRow = ({ loan, onPress }) => {
  const isLent = loan.type === 'LENT';
  const isSettled = loan.status === 'SETTLED' || loan.outstandingPrincipal <= 0;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={styles.card}
    >
      <View style={styles.topRow}>
        <View style={styles.personCol}>
          <Text style={styles.counterparty}>{loan.counterpartyName}</Text>
          {loan.counterpartyContact ? (
            <Text style={styles.contact}>{loan.counterpartyContact}</Text>
          ) : null}
        </View>
        <View style={styles.badgeRow}>
          <Badge
            label={isLent ? 'Lent (Receivable)' : 'Borrowed (Payable)'}
            variant={isLent ? 'primary' : 'warning'}
            style={{ marginRight: 4 }}
          />
          <Badge
            label={isSettled ? 'Settled' : 'Active'}
            variant={isSettled ? 'success' : 'default'}
          />
        </View>
      </View>

      <View style={styles.detailsRow}>
        <View>
          <Text style={styles.label}>Outstanding</Text>
          <Text style={[styles.amount, { color: isLent ? COLORS.primary : COLORS.warning }]}>
            {formatCurrency(loan.outstandingPrincipal)}
          </Text>
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.label}>Principal: {formatCurrency(loan.principalAmount)}</Text>
          <Text style={styles.date}>Date: {formatDate(loan.startDate)}</Text>
        </View>
      </View>
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
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  personCol: {
    flex: 1,
  },
  counterparty: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.text,
  },
  contact: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  label: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  amount: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
  date: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
});
