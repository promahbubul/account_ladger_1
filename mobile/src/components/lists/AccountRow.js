import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../../constants/theme';
import { formatCurrency } from '../../utils/formatters';
import { Badge } from '../common/Badge';

export const AccountRow = ({ account, onPress }) => {
  const isBank = account.type === 'BANK';
  const isCash = account.type === 'CASH';
  const isMobile = account.type === 'MOBILE_BANKING';

  const iconName = isBank ? 'business-outline' : isCash ? 'cash-outline' : 'phone-portrait-outline';
  const badgeVariant = isBank ? 'primary' : isCash ? 'success' : 'purple';
  const typeLabel = isBank ? 'Bank' : isCash ? 'Cash' : 'Mobile Banking';

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={styles.card}
    >
      <View style={styles.topRow}>
        <View style={styles.titleRow}>
          <View style={styles.iconBox}>
            <Ionicons name={iconName} size={18} color={COLORS.primary} />
          </View>
          <View>
            <Text style={styles.name}>{account.name}</Text>
            {account.providerName ? (
              <Text style={styles.provider}>{account.providerName}</Text>
            ) : null}
          </View>
        </View>
        <Badge label={typeLabel} variant={badgeVariant} />
      </View>

      <View style={styles.balanceRow}>
        <Text style={styles.balanceLabel}>Current Balance</Text>
        <Text style={[styles.balanceValue, account.currentBalance < 0 && { color: COLORS.danger }]}>
          {formatCurrency(account.currentBalance, account.currency)}
        </Text>
      </View>

      {account.accountNumber ? (
        <Text style={styles.accountNumber}>A/C: {account.accountNumber}</Text>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  name: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  provider: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: SPACING.xs,
  },
  balanceLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  balanceValue: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  accountNumber: {
    fontSize: FONT_SIZE.xs - 1,
    color: COLORS.textMuted,
    marginTop: 4,
  },
});
