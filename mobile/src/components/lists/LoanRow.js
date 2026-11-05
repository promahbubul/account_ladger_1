import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE, themedStyles } from '../../constants/theme';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Badge } from '../common/Badge';

// Memoized: re-renders only when its row or callback changes. onPress receives the row's loan.
export const LoanRow = React.memo(function LoanRow({ loan, onPress }) {
  const isLent = loan.type === 'LENT';
  const isSettled = loan.status === 'SETTLED' || loan.outstandingPrincipal <= 0;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress ? () => onPress(loan) : undefined}
      style={styles.row}
    >
      <View style={styles.leftCol}>
        <View style={[styles.iconBox, { backgroundColor: isLent ? COLORS.primaryLight : COLORS.warningLight }]}>
          <Ionicons
            name={isLent ? 'arrow-up-circle-outline' : 'arrow-down-circle-outline'}
            size={20}
            color={isLent ? COLORS.primary : COLORS.warning}
          />
        </View>
        <View style={styles.personCol}>
          <Text style={styles.counterparty}>{loan.counterpartyName}</Text>
          <View style={styles.subRow}>
            <Text style={styles.typeLabel}>{isLent ? 'Lent' : 'Borrowed'}</Text>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.date}>{formatDate(loan.startDate)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.rightCol}>
        <Text style={[styles.amount, { color: isLent ? COLORS.primary : COLORS.warning }]}>
          {formatCurrency(loan.outstandingPrincipal)}
        </Text>
        <Badge
          label={isSettled ? 'Settled' : 'Active'}
          variant={isSettled ? 'success' : 'default'}
          style={styles.statusBadge}
        />
      </View>
    </TouchableOpacity>
  );
});

const styles = themedStyles(() => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderHairline,
    backgroundColor: 'transparent',
  },
  leftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: SPACING.md,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  personCol: {
    flex: 1,
  },
  counterparty: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  typeLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontWeight: '500',
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
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  statusBadge: {
    marginTop: 4,
  },
}));
