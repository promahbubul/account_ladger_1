import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE, themedStyles } from '../../constants/theme';
import { formatCurrency } from '../../utils/formatters';

// Memoized: re-renders only when its row or callback changes. onPress receives the row's account.
export const AccountRow = React.memo(function AccountRow({ account, onPress }) {
  const isBank = account.type === 'BANK';
  const isCash = account.type === 'CASH';

  const iconName = isBank ? 'business' : isCash ? 'cash' : 'phone-portrait';
  const typeLabel = isBank ? 'Bank' : isCash ? 'Cash' : 'Mobile';

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress ? () => onPress(account) : undefined}
      style={styles.row}
    >
      <View style={styles.leftCol}>
        <View style={styles.iconBox}>
          <Ionicons
            name={iconName}
            size={18}
            color={COLORS.textSecondary}
          />
        </View>
        <View style={styles.infoCol}>
          <Text style={styles.name} numberOfLines={1}>{account.name}</Text>
          <View style={styles.metaRow}>
            {account.providerName ? (
              <Text style={styles.provider} numberOfLines={1}>{account.providerName}</Text>
            ) : null}
            {account.accountNumber ? (
              <Text style={styles.accountNumber} numberOfLines={1}>
                {account.providerName ? ' • ' : ''}#{account.accountNumber.slice(-4)}
              </Text>
            ) : null}
            {!account.providerName && !account.accountNumber ? (
              <Text style={styles.provider}>{typeLabel} Account</Text>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.rightCol}>
        <Text style={[styles.balanceValue, account.currentBalance < 0 && { color: COLORS.danger }]}>
          {formatCurrency(account.currentBalance)}
        </Text>
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
    backgroundColor: COLORS.surfaceElevated,
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  infoCol: {
    flex: 1,
  },
  name: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  provider: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  accountNumber: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  rightCol: {
    alignItems: 'flex-end',
  },
  balanceValue: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.2,
  },
}));
