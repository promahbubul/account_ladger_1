import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme';
import { Header } from '../../components/common/Header';
import { Amount } from '../../components/common/Amount';
import { Skeleton } from '../../components/common/Skeleton';
import { QueryErrorBanner } from '../../components/common/QueryStates';
import { TransactionRow } from '../../components/lists/TransactionRow';
import { reportsApi } from '../../services/api/reports.api';
import { accountsApi } from '../../services/api/accounts.api';
import { transactionsApi } from '../../services/api/transactions.api';
import { formatCurrency } from '../../utils/formatters';
import { useDateFilter } from '../../context/DateFilterContext';

const QUICK_ACTIONS = [
  { route: 'AddIncome', label: 'Income', icon: 'arrow-down-outline' },
  { route: 'AddExpense', label: 'Expense', icon: 'arrow-up-outline' },
  { route: 'BulkExpense', label: 'Bulk', icon: 'list-outline' },
  { route: 'CreateTransfer', label: 'Transfer', icon: 'swap-horizontal-outline' },
];

const ACCOUNT_TYPE_LABELS = {
  BANK: 'Bank',
  CASH: 'Cash',
  MOBILE_BANKING: 'Mobile Banking',
};

const DASHBOARD_ACCOUNT_LIMIT = 4;

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
    queryFn: () => transactionsApi.getTransactions({ limit: 5, startDate, endDate }),
  });

  const refreshing = summaryQuery.isRefetching || accountsQuery.isRefetching || recentTxQuery.isRefetching;

  const onRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['reportsSummary'] });
    queryClient.invalidateQueries({ queryKey: ['accountsOverview'] });
    queryClient.invalidateQueries({ queryKey: ['recentTransactions'] });
  }, [queryClient]);

  const summary = summaryQuery.data || {};

  const accounts = accountsQuery.data?.accounts || [];
  const recentTransactions = (recentTxQuery.data?.items || []).slice(0, 5);

  return (
    <View style={styles.container}>
      <Header title="Dashboard" showDateFilter={true} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {summaryQuery.isError && !summaryQuery.data ? (
          <QueryErrorBanner message="Could not load your balance." onRetry={() => summaryQuery.refetch()} />
        ) : null}

        {/* Unboxed Hero Balance Header */}
        <View style={styles.balanceHeroSection}>
          <Text style={styles.balanceLabel}>TOTAL BALANCE</Text>
          <Amount
            value={summary.netWorth}
            isLoading={summaryQuery.isLoading}
            skeletonWidth={190}
            skeletonHeight={40}
            style={styles.balanceAmount}
          />

          <View style={styles.flowMetricsRow}>
            <TouchableOpacity
              style={styles.flowMetricItem}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('IncomeScreen')}
            >
              <Text style={styles.flowMetricLabel}>Income</Text>
              <Amount
                value={summary.totalIncome}
                isLoading={summaryQuery.isLoading}
                skeletonWidth={84}
                skeletonHeight={18}
                style={[styles.flowMetricValue, { color: COLORS.success }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              />
            </TouchableOpacity>

            <View style={styles.flowMetricDivider} />

            <TouchableOpacity
              style={styles.flowMetricItem}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('ExpensesScreen')}
            >
              <Text style={styles.flowMetricLabel}>Expense</Text>
              <Amount
                value={summary.totalExpense}
                isLoading={summaryQuery.isLoading}
                skeletonWidth={84}
                skeletonHeight={18}
                style={[styles.flowMetricValue, { color: COLORS.danger }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Actions Bar */}
        <View style={styles.quickActionsRow}>
          {QUICK_ACTIONS.map((action, index) => (
            <TouchableOpacity
              key={action.route}
              style={[styles.actionBtn, index > 0 && styles.actionBtnDivider]}
              activeOpacity={0.7}
              onPress={() => navigation.navigate(action.route)}
            >
              <Ionicons name={action.icon} size={20} color={COLORS.text} />
              <Text style={styles.actionText}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Accounts Overview */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Accounts</Text>
          <TouchableOpacity onPress={() => navigation.navigate('AccountsTab')}>
            <Text style={styles.seeAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.accountsList}>
          {accountsQuery.isLoading ? (
            [0, 1, 2].map((index) => (
              <View key={index} style={[styles.accountRow, index > 0 && styles.accountRowDivider]}>
                <View style={styles.accountRowInfo}>
                  <Skeleton width={110} height={14} />
                  <Skeleton width={70} height={10} style={styles.skeletonSubline} />
                </View>
                <Skeleton width={72} height={14} />
              </View>
            ))
          ) : accountsQuery.isError && !accountsQuery.data ? (
            <QueryErrorBanner
              message="Could not load accounts."
              onRetry={() => accountsQuery.refetch()}
              style={styles.sectionBanner}
            />
          ) : accounts.length === 0 ? (
            <View style={styles.accountCardEmpty}>
              <Text style={styles.emptyText}>No accounts found</Text>
              <TouchableOpacity onPress={() => navigation.navigate('CreateAccount')} accessibilityRole="button">
                <Text style={styles.emptyAction}>Create your first account</Text>
              </TouchableOpacity>
            </View>
          ) : (
            accounts.slice(0, DASHBOARD_ACCOUNT_LIMIT).map((acc, index) => (
              <TouchableOpacity
                key={acc.id}
                style={[styles.accountRow, index > 0 && styles.accountRowDivider]}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('AccountDetail', { account: acc })}
              >
                <View style={styles.accountRowInfo}>
                  <Text style={styles.accountRowName} numberOfLines={1}>{acc.name}</Text>
                  <Text style={styles.accountRowType}>{ACCOUNT_TYPE_LABELS[acc.type] || acc.type}</Text>
                </View>
                <Text
                  style={[styles.accountRowBalance, Number(acc.currentBalance) < 0 && { color: COLORS.danger }]}
                  numberOfLines={1}
                >
                  {formatCurrency(acc.currentBalance)}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>

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
          {recentTxQuery.isLoading ? (
            [0, 1, 2].map((index) => (
              <View key={index} style={styles.recentSkeletonRow}>
                <View style={styles.accountRowInfo}>
                  <Skeleton width={130} height={14} />
                  <Skeleton width={90} height={10} style={styles.skeletonSubline} />
                </View>
                <Skeleton width={64} height={14} />
              </View>
            ))
          ) : recentTxQuery.isError && !recentTxQuery.data ? (
            <QueryErrorBanner
              message="Could not load recent transactions."
              onRetry={() => recentTxQuery.refetch()}
            />
          ) : recentTransactions.length === 0 ? (
            <View style={styles.emptyRecentBox}>
              <Text style={styles.emptyText}>No recent transactions</Text>
              <TouchableOpacity onPress={() => navigation.navigate('AddExpense')} accessibilityRole="button">
                <Text style={styles.emptyAction}>Add your first expense</Text>
              </TouchableOpacity>
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
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    marginVertical: SPACING.lg,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.md,
    gap: 6,
  },
  actionBtnDivider: {
    borderLeftWidth: 1,
    borderLeftColor: COLORS.border,
  },
  actionText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '500',
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
  accountsList: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  accountRowDivider: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  accountRowInfo: {
    flex: 1,
    marginRight: SPACING.md,
  },
  accountRowName: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  accountRowType: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  accountRowBalance: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
    fontVariant: ['tabular-nums'],
  },
  skeletonSubline: {
    marginTop: 6,
  },
  sectionBanner: {
    marginVertical: SPACING.md,
  },
  recentSkeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xs,
  },
  emptyAction: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.primary,
    marginTop: SPACING.sm,
  },
  accountCardEmpty: {
    paddingVertical: SPACING.xl,
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
