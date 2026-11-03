import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { TransactionRow } from '../../components/lists/TransactionRow';
import { reportsApi } from '../../services/api/reports.api';
import { accountsApi } from '../../services/api/accounts.api';
import { transactionsApi } from '../../services/api/transactions.api';
import { formatCurrency } from '../../utils/formatters';
import { useDateFilter } from '../../context/DateFilterContext';

export const DashboardScreen = ({ navigation }) => {
  const queryClient = useQueryClient();
  const { startDate, endDate } = useDateFilter();

  const summaryQuery = useQuery({
    queryKey: ['reportsSummary', startDate, endDate],
    queryFn: () => reportsApi.getSummary({ startDate, endDate }),
  });

  const accountsQuery = useQuery({
    queryKey: ['accountsOverview'],
    queryFn: () => accountsApi.getAccounts(),
  });

  const recentTxQuery = useQuery({
    queryKey: ['recentTransactions', startDate, endDate],
    queryFn: () => transactionsApi.getTransactions({ limit: 50, startDate, endDate }),
  });

  const refreshing = summaryQuery.isRefetching || accountsQuery.isRefetching || recentTxQuery.isRefetching;

  const onRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['reportsSummary'] });
    queryClient.invalidateQueries({ queryKey: ['accountsOverview'] });
    queryClient.invalidateQueries({ queryKey: ['recentTransactions'] });
  }, [queryClient]);

  const summary = summaryQuery.data || {
    netWorth: 0,
    totalIncome: 0,
    totalExpense: 0,
    totalReceivables: 0,
    totalPayables: 0,
  };

  const accounts = accountsQuery.data?.accounts || [];
  const recentTransactions = (recentTxQuery.data?.items || []).slice(0, 5);

  return (
    <View style={styles.container}>
      <Header title="Dashboard" showDateFilter={true} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* Unboxed Hero Balance Header */}
        <View style={styles.balanceHeroSection}>
          <Text style={styles.balanceLabel}>TOTAL BALANCE</Text>
          <Text style={styles.balanceAmount}>{formatCurrency(summary.netWorth)}</Text>

          <View style={styles.flowMetricsRow}>
            <TouchableOpacity
              style={styles.flowMetricItem}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('IncomeScreen')}
            >
              <Text style={styles.flowMetricLabel}>Income</Text>
              <Text style={[styles.flowMetricValue, { color: COLORS.success }]} numberOfLines={1} adjustsFontSizeToFit>
                {formatCurrency(summary.totalIncome)}
              </Text>
            </TouchableOpacity>

            <View style={styles.flowMetricDivider} />

            <TouchableOpacity
              style={styles.flowMetricItem}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('ExpensesScreen')}
            >
              <Text style={styles.flowMetricLabel}>Expense</Text>
              <Text style={[styles.flowMetricValue, { color: COLORS.danger }]} numberOfLines={1} adjustsFontSizeToFit>
                {formatCurrency(summary.totalExpense)}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Actions Bar */}
        <View style={styles.quickActionsRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('AddIncome')}
          >
            <View style={[styles.actionIconBox, { backgroundColor: COLORS.successLight }]}>
              <Ionicons name="add" size={22} color={COLORS.success} />
            </View>
            <Text style={styles.actionText}>Income</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('AddExpense')}
          >
            <View style={[styles.actionIconBox, { backgroundColor: COLORS.dangerLight }]}>
              <Ionicons name="remove" size={22} color={COLORS.danger} />
            </View>
            <Text style={styles.actionText}>Expense</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('BulkExpense')}
          >
            <View style={[styles.actionIconBox, { backgroundColor: COLORS.purpleLight }]}>
              <Ionicons name="layers-outline" size={20} color={COLORS.purple} />
            </View>
            <Text style={styles.actionText}>Daily Bulk</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('CreateTransfer')}
          >
            <View style={[styles.actionIconBox, { backgroundColor: COLORS.warningLight }]}>
              <Ionicons name="swap-horizontal" size={20} color={COLORS.warning} />
            </View>
            <Text style={styles.actionText}>Transfer</Text>
          </TouchableOpacity>
        </View>

        {/* Accounts Overview */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Accounts</Text>
          <TouchableOpacity onPress={() => navigation.navigate('AccountsTab')}>
            <Text style={styles.seeAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalAccounts}>
          {accounts.length === 0 ? (
            <View style={styles.accountCardEmpty}>
              <Text style={styles.emptyText}>No accounts found</Text>
            </View>
          ) : (
            accounts.map((acc) => (
              <TouchableOpacity
                key={acc.id}
                style={styles.accountMiniCard}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('AccountDetail', { account: acc })}
              >
                <Text style={styles.miniAccName} numberOfLines={1}>{acc.name}</Text>
                <Text style={styles.miniAccBalance}>{formatCurrency(acc.currentBalance, acc.currency)}</Text>
                <Text style={styles.miniAccType}>{acc.type}</Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>

        {/* Receivables & Payables Summary */}
        {(summary.totalReceivables > 0 || summary.totalPayables > 0) ? (
          <View style={styles.loanSummaryRow}>
            <View style={styles.loanBox}>
              <Text style={styles.loanBoxLabel}>Lent (Receivable)</Text>
              <Text style={[styles.loanBoxVal, { color: COLORS.primary }]}>
                {formatCurrency(summary.totalReceivables)}
              </Text>
            </View>
            <View style={styles.loanBox}>
              <Text style={styles.loanBoxLabel}>Borrowed (Payable)</Text>
              <Text style={[styles.loanBoxVal, { color: COLORS.warning }]}>
                {formatCurrency(summary.totalPayables)}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Recent Transactions */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <TouchableOpacity onPress={() => navigation.navigate('TransactionsTab')}>
            <Text style={styles.seeAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.recentList}>
          {recentTransactions.length === 0 ? (
            <View style={styles.emptyRecentBox}>
              <Text style={styles.emptyText}>No recent transactions</Text>
            </View>
          ) : (
            recentTransactions.map((tx) => (
              <TransactionRow
                key={tx.id}
                item={tx}
                onPress={() => navigation.navigate('TransactionDetail', { transaction: tx })}
              />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  balanceHeroSection: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  balanceLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
  },
  balanceAmount: {
    fontSize: FONT_SIZE.hero,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.6,
    marginVertical: 4,
  },
  flowMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: SPACING.lg,
  },
  flowMetricItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
  },
  flowMetricLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    fontWeight: '500',
    marginBottom: 2,
  },
  flowMetricValue: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
  },
  flowMetricDivider: {
    width: 1,
    height: 28,
    backgroundColor: COLORS.border,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: SPACING.lg,
    paddingHorizontal: SPACING.xs,
  },
  actionBtn: {
    alignItems: 'center',
    flex: 1,
  },
  actionIconBox: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  actionText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.xs,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  seeAllText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.primary,
  },
  horizontalAccounts: {
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  accountMiniCard: {
    width: 136,
    padding: SPACING.md,
    backgroundColor: COLORS.surfaceGhost,
    borderWidth: 1,
    borderColor: COLORS.borderHairline,
    borderRadius: RADIUS.lg,
  },
  miniAccName: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  miniAccBalance: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.text,
    marginVertical: 4,
    letterSpacing: -0.2,
  },
  miniAccType: {
    fontSize: FONT_SIZE.xs - 2,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
  },
  accountCardEmpty: {
    padding: SPACING.md,
    width: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loanSummaryRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginVertical: SPACING.sm,
  },
  loanBox: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surfaceGhost,
    borderWidth: 1,
    borderColor: COLORS.borderHairline,
  },
  loanBoxLabel: {
    fontSize: FONT_SIZE.xs - 1,
    color: COLORS.textSecondary,
    marginBottom: 3,
  },
  loanBoxVal: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
  },
  recentList: {
    marginTop: SPACING.xs,
  },
  emptyRecentBox: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
});
