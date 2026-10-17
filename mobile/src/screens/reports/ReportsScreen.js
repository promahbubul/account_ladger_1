import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { reportsApi } from '../../services/api/reports.api';
import { formatCurrency } from '../../utils/formatters';
import { useDateFilter } from '../../context/DateFilterContext';

export const ReportsScreen = () => {
  const queryClient = useQueryClient();
  const { startDate, endDate, formattedRangeLabel } = useDateFilter();

  const reportsQuery = useQuery({
    queryKey: ['reportsSummary', startDate, endDate],
    queryFn: () => reportsApi.getSummary({ startDate, endDate }),
  });

  const onRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['reportsSummary'] });
  }, [queryClient]);

  const data = reportsQuery.data || {
    netWorth: 0,
    totalIncome: 0,
    totalExpense: 0,
    netSavings: 0,
    totalCash: 0,
    totalBank: 0,
    totalMobile: 0,
    totalReceivables: 0,
    totalPayables: 0,
    totalTransactions: 0,
  };

  const handleExportBackup = async () => {
    try {
      const backup = await reportsApi.exportData();
      Alert.alert(
        'Ledger Backup Ready',
        `Generated full ledger backup containing ${backup.data.transactions?.length || 0} transactions and ${backup.data.accounts?.length || 0} accounts.`,
        [{ text: 'OK' }]
      );
    } catch (err) {
      Alert.alert('Export Failed', err.message || 'Could not export ledger data.');
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Reports" showDateFilter={true} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={reportsQuery.isRefetching}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        <Text style={styles.periodLabel}>REPORT FOR: {formattedRangeLabel.toUpperCase()}</Text>

        {/* Net Savings & Flow */}
        <Card style={styles.savingsCard}>
          <Text style={styles.kpiTitle}>NET CASH FLOW (SAVINGS)</Text>
          <Text style={[styles.kpiValue, { color: data.netSavings >= 0 ? COLORS.success : COLORS.danger }]}>
            {formatCurrency(data.netSavings)}
          </Text>

          <View style={styles.flowRow}>
            <View style={styles.flowCol}>
              <Text style={styles.flowKey}>Total Inflow</Text>
              <Text style={[styles.flowVal, { color: COLORS.success }]}>{formatCurrency(data.totalIncome)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.flowCol}>
              <Text style={styles.flowKey}>Total Outflow</Text>
              <Text style={[styles.flowVal, { color: COLORS.danger }]}>{formatCurrency(data.totalExpense)}</Text>
            </View>
          </View>
        </Card>

        {/* Account Assets Breakdown */}
        <Text style={styles.sectionHeader}>Assets by Account Type</Text>
        <Card>
          <View style={styles.breakdownRow}>
            <View style={styles.assetHeader}>
              <Ionicons name="cash-outline" size={16} color={COLORS.success} />
              <Text style={styles.assetName}>Cash on Hand</Text>
            </View>
            <Text style={styles.assetVal}>{formatCurrency(data.totalCash)}</Text>
          </View>

          <View style={styles.breakdownRow}>
            <View style={styles.assetHeader}>
              <Ionicons name="business-outline" size={16} color={COLORS.primary} />
              <Text style={styles.assetName}>Bank Accounts</Text>
            </View>
            <Text style={styles.assetVal}>{formatCurrency(data.totalBank)}</Text>
          </View>

          <View style={styles.breakdownRow}>
            <View style={styles.assetHeader}>
              <Ionicons name="phone-portrait-outline" size={16} color={COLORS.purple} />
              <Text style={styles.assetName}>Mobile Banking</Text>
            </View>
            <Text style={styles.assetVal}>{formatCurrency(data.totalMobile)}</Text>
          </View>

          <View style={[styles.breakdownRow, { borderBottomWidth: 0, paddingTop: SPACING.md }]}>
            <Text style={[styles.assetName, { fontWeight: '700' }]}>Total Net Worth</Text>
            <Text style={[styles.assetVal, { fontWeight: '800', color: COLORS.primary }]}>
              {formatCurrency(data.netWorth)}
            </Text>
          </View>
        </Card>

        {/* Lending Balance */}
        <Text style={styles.sectionHeader}>Loans Balance</Text>
        <Card>
          <View style={styles.breakdownRow}>
            <Text style={styles.assetName}>Receivables (Money Lent)</Text>
            <Text style={[styles.assetVal, { color: COLORS.primary }]}>{formatCurrency(data.totalReceivables)}</Text>
          </View>
          <View style={[styles.breakdownRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.assetName}>Payables (Money Borrowed)</Text>
            <Text style={[styles.assetVal, { color: COLORS.warning }]}>{formatCurrency(data.totalPayables)}</Text>
          </View>
        </Card>

        {/* Backup / Export */}
        <Button
          title="Export Ledger Backup (JSON)"
          variant="outline"
          icon={<Ionicons name="download-outline" size={18} color={COLORS.text} />}
          onPress={handleExportBackup}
          style={styles.exportBtn}
        />
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
  periodLabel: {
    fontSize: FONT_SIZE.xs - 1,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  savingsCard: {
    marginBottom: SPACING.lg,
  },
  kpiTitle: {
    fontSize: FONT_SIZE.xs - 1,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  kpiValue: {
    fontSize: FONT_SIZE.title,
    fontWeight: '800',
    marginVertical: SPACING.sm,
  },
  flowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: SPACING.xs,
  },
  flowCol: {
    flex: 1,
  },
  flowKey: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  flowVal: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
  },
  divider: {
    width: 1,
    height: 30,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.md,
  },
  sectionHeader: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  assetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  assetName: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.text,
  },
  assetVal: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  exportBtn: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.xxl,
  },
});
