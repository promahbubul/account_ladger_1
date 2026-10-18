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

        {/* Unboxed Net Savings & Flow */}
        <View style={styles.savingsHero}>
          <Text style={styles.kpiTitle}>NET CASH FLOW (SAVINGS)</Text>
          <Text style={[styles.kpiValue, { color: data.netSavings >= 0 ? COLORS.success : COLORS.danger }]}>
            {formatCurrency(data.netSavings)}
          </Text>

          <View style={styles.flowMetricsRow}>
            <View style={styles.flowMetricItem}>
              <View style={[styles.flowDot, { backgroundColor: COLORS.success }]} />
              <Text style={styles.flowKey}>Inflow</Text>
              <Text style={[styles.flowVal, { color: COLORS.success }]}>{formatCurrency(data.totalIncome)}</Text>
            </View>

            <View style={styles.flowDivider} />

            <View style={styles.flowMetricItem}>
              <View style={[styles.flowDot, { backgroundColor: COLORS.danger }]} />
              <Text style={styles.flowKey}>Outflow</Text>
              <Text style={[styles.flowVal, { color: COLORS.danger }]}>{formatCurrency(data.totalExpense)}</Text>
            </View>
          </View>
        </View>

        {/* Account Assets Breakdown */}
        <Text style={styles.sectionHeader}>ASSETS BY ACCOUNT TYPE</Text>
        <View style={styles.breakdownSection}>
          <View style={styles.breakdownRow}>
            <View style={styles.assetHeader}>
              <View style={[styles.iconBox, { backgroundColor: COLORS.successLight }]}>
                <Ionicons name="cash-outline" size={16} color={COLORS.success} />
              </View>
              <Text style={styles.assetName}>Cash on Hand</Text>
            </View>
            <Text style={styles.assetVal}>{formatCurrency(data.totalCash)}</Text>
          </View>

          <View style={styles.breakdownRow}>
            <View style={styles.assetHeader}>
              <View style={[styles.iconBox, { backgroundColor: COLORS.primaryLight }]}>
                <Ionicons name="business-outline" size={16} color={COLORS.primary} />
              </View>
              <Text style={styles.assetName}>Bank Accounts</Text>
            </View>
            <Text style={styles.assetVal}>{formatCurrency(data.totalBank)}</Text>
          </View>

          <View style={styles.breakdownRow}>
            <View style={styles.assetHeader}>
              <View style={[styles.iconBox, { backgroundColor: COLORS.purpleLight }]}>
                <Ionicons name="phone-portrait-outline" size={16} color={COLORS.purple} />
              </View>
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
        </View>

        {/* Lending Balance */}
        <Text style={styles.sectionHeader}>LOANS & OBLIGATIONS</Text>
        <View style={styles.breakdownSection}>
          <View style={styles.breakdownRow}>
            <View style={styles.assetHeader}>
              <View style={[styles.iconBox, { backgroundColor: COLORS.primaryLight }]}>
                <Ionicons name="arrow-up-circle-outline" size={16} color={COLORS.primary} />
              </View>
              <Text style={styles.assetName}>Receivables (Money Lent)</Text>
            </View>
            <Text style={[styles.assetVal, { color: COLORS.primary }]}>{formatCurrency(data.totalReceivables)}</Text>
          </View>

          <View style={[styles.breakdownRow, { borderBottomWidth: 0 }]}>
            <View style={styles.assetHeader}>
              <View style={[styles.iconBox, { backgroundColor: COLORS.warningLight }]}>
                <Ionicons name="arrow-down-circle-outline" size={16} color={COLORS.warning} />
              </View>
              <Text style={styles.assetName}>Payables (Money Borrowed)</Text>
            </View>
            <Text style={[styles.assetVal, { color: COLORS.warning }]}>{formatCurrency(data.totalPayables)}</Text>
          </View>
        </View>

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
    paddingBottom: SPACING.xxl,
  },
  savingsHero: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  kpiTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
  },
  kpiValue: {
    fontSize: FONT_SIZE.hero,
    fontWeight: '800',
    letterSpacing: -0.6,
    marginVertical: 4,
  },
  flowMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceGhost,
    borderWidth: 1,
    borderColor: COLORS.borderHairline,
    borderRadius: RADIUS.full,
    paddingVertical: 7,
    paddingHorizontal: 16,
    marginTop: SPACING.sm,
  },
  flowMetricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  flowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  flowKey: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  flowVal: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
  },
  flowDivider: {
    width: 1,
    height: 14,
    backgroundColor: COLORS.borderHairline,
    marginHorizontal: SPACING.md,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.6,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
    paddingHorizontal: SPACING.xs,
  },
  breakdownSection: {
    borderTopWidth: 1,
    borderTopColor: COLORS.borderHairline,
    marginBottom: SPACING.lg,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderHairline,
  },
  assetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assetName: {
    fontSize: FONT_SIZE.xs + 1,
    color: COLORS.text,
    fontWeight: '500',
  },
  assetVal: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.text,
  },
  exportBtn: {
    marginTop: SPACING.md,
    marginBottom: SPACING.xxl,
  },
});
