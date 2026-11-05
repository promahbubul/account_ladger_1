import React, { useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, RADIUS, themedStyles } from '../../constants/theme';
import { Header } from '../../components/common/Header';
import { Amount } from '../../components/common/Amount';
import { QueryErrorBanner } from '../../components/common/QueryStates';
import { Button } from '../../components/common/Button';
import { BarList } from '../../components/charts/BarList';
import { MonthlyBars } from '../../components/charts/MonthlyBars';
import { reportsApi } from '../../services/api/reports.api';
import { useDateFilter } from '../../context/DateFilterContext';
import { getTodayISO } from '../../utils/formatters';
import { saveJsonFile } from '../../utils/saveJsonFile';
import { showMessage } from '../../utils/notify';

export const ReportsScreen = () => {
  const queryClient = useQueryClient();
  const { startDate, endDate } = useDateFilter();

  const reportsQuery = useQuery({
    queryKey: ['reportsSummary', startDate, endDate],
    queryFn: () => reportsApi.getSummary({ startDate, endDate }),
  });

  // Nested under the summary key, so every screen that refreshes the summary refreshes this too.
  const analyticsQuery = useQuery({
    queryKey: ['reportsSummary', 'analytics', startDate, endDate],
    queryFn: () => reportsApi.getAnalytics({ startDate, endDate }),
  });

  const onRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['reportsSummary'] });
  }, [queryClient]);

  const data = reportsQuery.data || {};
  const isLoading = reportsQuery.isLoading;

  const handleExportBackup = async () => {
    try {
      const backup = await reportsApi.exportData();
      await saveJsonFile(`accountledger-backup-${getTodayISO()}.json`, backup);
    } catch (err) {
      showMessage('Export Failed', err.message || 'Could not export ledger data.');
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
        {reportsQuery.isError && !reportsQuery.data ? (
          <QueryErrorBanner message="Could not load this report." onRetry={() => reportsQuery.refetch()} />
        ) : null}

        {/* Unboxed Net Savings & Flow */}
        <View style={styles.savingsHero}>
          <Text style={styles.kpiTitle}>NET CASH FLOW (SAVINGS)</Text>
          <Amount
            value={data.netSavings}
            isLoading={isLoading}
            skeletonWidth={170}
            skeletonHeight={34}
            style={[styles.kpiValue, { color: data.netSavings < 0 ? COLORS.danger : COLORS.success }]}
          />

          <View style={styles.flowMetricsRow}>
            <View style={styles.flowMetricItem}>
              <Text style={styles.flowKey}>Inflow</Text>
              <Amount value={data.totalIncome} isLoading={isLoading} style={[styles.flowVal, { color: COLORS.success }]} />
            </View>

            <View style={styles.flowDivider} />

            <View style={styles.flowMetricItem}>
              <Text style={styles.flowKey}>Outflow</Text>
              <Amount value={data.totalExpense} isLoading={isLoading} style={[styles.flowVal, { color: COLORS.danger }]} />
            </View>
          </View>
        </View>

        {analyticsQuery.isError && !analyticsQuery.data ? (
          <QueryErrorBanner message="Could not load the charts." onRetry={() => analyticsQuery.refetch()} />
        ) : (
          <View>
            <Text style={styles.sectionHeader}>EXPENSE BY CATEGORY</Text>
            <View style={styles.chartSection}>
              <BarList
                rows={(analyticsQuery.data?.byCategory || []).map((row) => ({ key: row.name, label: row.name, value: row.amount }))}
                isLoading={analyticsQuery.isLoading}
                emptyMessage="No expenses in this period."
              />
            </View>

            <Text style={styles.sectionHeader}>INCOME VS EXPENSE, LAST 12 MONTHS</Text>
            <View style={styles.chartSection}>
              <MonthlyBars months={analyticsQuery.data?.monthly} isLoading={analyticsQuery.isLoading} />
            </View>
          </View>
        )}

        {/* Account Assets Breakdown */}
        <Text style={styles.sectionHeader}>ASSETS BY ACCOUNT TYPE</Text>
        <View style={styles.breakdownSection}>
          <View style={styles.breakdownRow}>
            <View style={styles.assetHeader}>
              <View style={styles.iconBox}>
                <Ionicons name="cash-outline" size={16} color={COLORS.textSecondary} />
              </View>
              <Text style={styles.assetName}>Cash on Hand</Text>
            </View>
            <Amount value={data.totalCash} isLoading={isLoading} style={styles.assetVal} />
          </View>

          <View style={styles.breakdownRow}>
            <View style={styles.assetHeader}>
              <View style={styles.iconBox}>
                <Ionicons name="business-outline" size={16} color={COLORS.textSecondary} />
              </View>
              <Text style={styles.assetName}>Bank Accounts</Text>
            </View>
            <Amount value={data.totalBank} isLoading={isLoading} style={styles.assetVal} />
          </View>

          <View style={styles.breakdownRow}>
            <View style={styles.assetHeader}>
              <View style={styles.iconBox}>
                <Ionicons name="phone-portrait-outline" size={16} color={COLORS.textSecondary} />
              </View>
              <Text style={styles.assetName}>Mobile Banking</Text>
            </View>
            <Amount value={data.totalMobile} isLoading={isLoading} style={styles.assetVal} />
          </View>

          <View style={[styles.breakdownRow, { borderBottomWidth: 0, paddingTop: SPACING.md }]}>
            <Text style={[styles.assetName, { fontWeight: '700' }]}>Total Net Worth</Text>
            <Amount
              value={data.netWorth}
              isLoading={isLoading}
              style={[styles.assetVal, { fontWeight: '800' }]}
            />
          </View>
        </View>

        {/* Lending Balance */}
        <Text style={styles.sectionHeader}>LOANS & OBLIGATIONS</Text>
        <View style={styles.breakdownSection}>
          <View style={styles.breakdownRow}>
            <View style={styles.assetHeader}>
              <View style={styles.iconBox}>
                <Ionicons name="arrow-up-circle-outline" size={16} color={COLORS.textSecondary} />
              </View>
              <Text style={styles.assetName}>Receivables (Money Lent)</Text>
            </View>
            <Amount value={data.totalReceivables} isLoading={isLoading} style={styles.assetVal} />
          </View>

          <View style={[styles.breakdownRow, { borderBottomWidth: 0 }]}>
            <View style={styles.assetHeader}>
              <View style={styles.iconBox}>
                <Ionicons name="arrow-down-circle-outline" size={16} color={COLORS.textSecondary} />
              </View>
              <Text style={styles.assetName}>Payables (Money Borrowed)</Text>
            </View>
            <Amount value={data.totalPayables} isLoading={isLoading} style={styles.assetVal} />
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

const styles = themedStyles(() => ({
  chartSection: {
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.xs,
  },
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
    alignSelf: 'stretch',
    marginTop: SPACING.lg,
  },
  flowMetricItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    gap: 2,
  },
  flowKey: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  flowVal: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
  },
  flowDivider: {
    width: 1,
    height: 28,
    backgroundColor: COLORS.border,
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
    backgroundColor: COLORS.surfaceElevated,
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
}));
