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
    queryFn: () => transactionsApi.getTransactions({ limit: 5, startDate, endDate }),
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
  const recentTransactions = recentTxQuery.data?.items || [];

  return (
    <View style={styles.container}>
      <Header title="Dashboard" showDateFilter={true} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* Net Worth Card */}
        <Card style={styles.netWorthCard}>
          <Text style={styles.cardSubtitle}>TOTAL BALANCE (NET WORTH)</Text>
          <Text style={styles.netWorthAmount}>{formatCurrency(summary.netWorth)}</Text>

          <View style={styles.kpiRow}>
            <View style={styles.kpiItem}>
              <View style={styles.kpiHeader}>
                <Ionicons name="arrow-down-circle" size={14} color={COLORS.success} />
                <Text style={styles.kpiLabel}>Income</Text>
              </View>
              <Text style={[styles.kpiValue, { color: COLORS.success }]}>
                {formatCurrency(summary.totalIncome)}
              </Text>
            </View>

            <View style={styles.kpiDivider} />

            <View style={styles.kpiItem}>
              <View style={styles.kpiHeader}>
                <Ionicons name="arrow-up-circle" size={14} color={COLORS.danger} />
                <Text style={styles.kpiLabel}>Expenses</Text>
              </View>
              <Text style={[styles.kpiValue, { color: COLORS.danger }]}>
                {formatCurrency(summary.totalExpense)}
              </Text>
            </View>
          </View>
        </Card>

        {/* Quick Actions Bar */}
        <View style={styles.quickActionsRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('AddIncome')}
          >
            <View style={[styles.actionIconBox, { backgroundColor: COLORS.successLight }]}>
              <Ionicons name="add" size={20} color={COLORS.success} />
            </View>
            <Text style={styles.actionText}>Income</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('AddExpense')}
          >
            <View style={[styles.actionIconBox, { backgroundColor: COLORS.dangerLight }]}>
              <Ionicons name="remove" size={20} color={COLORS.danger} />
            </View>
            <Text style={styles.actionText}>Expense</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('BulkExpense')}
          >
            <View style={[styles.actionIconBox, { backgroundColor: COLORS.purpleLight }]}>
              <Ionicons name="layers-outline" size={20} color={COLORS.purple} />
            </View>
            <Text style={styles.actionText}>Bulk</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
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
            <Card style={styles.accountCardEmpty}>
              <Text style={styles.emptyText}>No accounts found</Text>
            </Card>
          ) : (
            accounts.map((acc) => (
              <Card
                key={acc.id}
                style={styles.accountMiniCard}
                onPress={() => navigation.navigate('AccountDetail', { account: acc })}
              >
                <Text style={styles.miniAccName} numberOfLines={1}>{acc.name}</Text>
                <Text style={styles.miniAccBalance}>{formatCurrency(acc.currentBalance, acc.currency)}</Text>
                <Text style={styles.miniAccType}>{acc.type}</Text>
              </Card>
            ))
          )}
        </ScrollView>

        {/* Receivables & Payables Summary */}
        {(summary.totalReceivables > 0 || summary.totalPayables > 0) ? (
          <View style={styles.loanSummaryRow}>
            <View style={[styles.loanBox, { backgroundColor: COLORS.surfaceElevated }]}>
              <Text style={styles.loanBoxLabel}>Lent (Receivable)</Text>
              <Text style={[styles.loanBoxVal, { color: COLORS.primary }]}>
                {formatCurrency(summary.totalReceivables)}
              </Text>
            </View>
            <View style={[styles.loanBox, { backgroundColor: COLORS.surfaceElevated }]}>
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
  },
  netWorthCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  cardSubtitle: {
    fontSize: FONT_SIZE.xs - 1,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },
  netWorthAmount: {
    fontSize: FONT_SIZE.title,
    fontWeight: '800',
    color: COLORS.text,
    marginVertical: SPACING.sm,
  },
  kpiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: SPACING.xs,
  },
  kpiItem: {
    flex: 1,
  },
  kpiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  kpiLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  kpiValue: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
  kpiDivider: {
    width: 1,
    height: 30,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.md,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xl,
  },
  actionBtn: {
    alignItems: 'center',
    flex: 1,
  },
  actionIconBox: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  actionText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.text,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  seeAllText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.primary,
  },
  horizontalAccounts: {
    gap: SPACING.sm,
    paddingBottom: SPACING.lg,
  },
  accountMiniCard: {
    width: 140,
    padding: SPACING.md,
    marginBottom: 0,
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
  },
  miniAccType: {
    fontSize: FONT_SIZE.xs - 2,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
  },
  accountCardEmpty: {
    padding: SPACING.md,
    width: 200,
    alignItems: 'center',
  },
  loanSummaryRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  loanBox: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  loanBoxLabel: {
    fontSize: FONT_SIZE.xs - 1,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  loanBoxVal: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
  },
  recentList: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
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
