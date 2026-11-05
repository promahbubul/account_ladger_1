import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE, themedStyles } from '../../constants/theme';
import { formatCurrency, formatDate } from '../../utils/formatters';

// Memoized: re-renders only when its row or callback changes. onPress receives the row's item.
export const TransferRow = React.memo(function TransferRow({ item, onPress }) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress ? () => onPress(item) : undefined}
      style={styles.row}
    >
      <View style={styles.leftCol}>
        <View style={styles.iconBox}>
          <Ionicons name="swap-horizontal" size={18} color={COLORS.warning} />
        </View>
        <View style={styles.accountCol}>
          <Text style={styles.accountsText} numberOfLines={1}>
            {item.sourceAccountName || 'Source'} → {item.destinationAccountName || 'Destination'}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.date}>{formatDate(item.date)}</Text>
            {item.description ? (
              <>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.desc} numberOfLines={1}>
                  {item.description}
                </Text>
              </>
            ) : null}
          </View>
        </View>
      </View>
      <Text style={styles.amount}>
        {formatCurrency(item.amount)}
      </Text>
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
    backgroundColor: COLORS.warningLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  accountCol: {
    flex: 1,
  },
  accountsText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  date: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  bullet: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginHorizontal: 4,
  },
  desc: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    flex: 1,
  },
  amount: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.warning,
    letterSpacing: -0.2,
  },
}));
