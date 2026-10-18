import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet, TouchableOpacity } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme';
import { Header } from '../../components/common/Header';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { LoanRow } from '../../components/lists/LoanRow';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { loansApi } from '../../services/api/loans.api';
import { formatCurrency, formatDate } from '../../utils/formatters';

export const LoansScreen = ({ navigation }) => {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('LOANS'); // LOANS | REPAYMENTS
  const [typeFilter, setTypeFilter] = useState('ALL'); // ALL | LENT | BORROWED
  const [search, setSearch] = useState('');

  const loansQuery = useQuery({
    queryKey: ['loansList', typeFilter, search],
    queryFn: () => loansApi.getLoans({ type: typeFilter, search }),
    enabled: activeTab === 'LOANS',
  });

  const repaymentsQuery = useQuery({
    queryKey: ['repaymentsList', search],
    queryFn: () => loansApi.getRepayments({ search }),
    enabled: activeTab === 'REPAYMENTS',
  });

  const onRefresh = useCallback(() => {
    if (activeTab === 'LOANS') queryClient.invalidateQueries({ queryKey: ['loansList'] });
    else queryClient.invalidateQueries({ queryKey: ['repaymentsList'] });
  }, [activeTab, queryClient]);

  const loans = loansQuery.data?.items || [];
  const repayments = repaymentsQuery.data?.items || [];

  return (
    <View style={styles.container}>
      <Header
        title="Lending & Borrowing"
        showBack
        onBack={() => navigation.goBack()}
        showDateFilter={false}
        rightAction={
          <Button
            title="New Loan"
            size="sm"
            icon={<Ionicons name="add" size={16} color="#FFF" />}
            onPress={() => navigation.navigate('CreateLoan')}
          />
        }
      />

      <View style={styles.segmentedContainer}>
        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'LOANS' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('LOANS')}
          >
            <Text style={[styles.segmentText, activeTab === 'LOANS' && styles.segmentTextActive]}>Loans</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'REPAYMENTS' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('REPAYMENTS')}
          >
            <Text style={[styles.segmentText, activeTab === 'REPAYMENTS' && styles.segmentTextActive]}>Repayments</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Input
          placeholder={activeTab === 'LOANS' ? 'Search by person name...' : 'Search repayments...'}
          value={search}
          onChangeText={setSearch}
          leftIcon={<Ionicons name="search" size={16} color={COLORS.textSecondary} />}
          style={{ marginBottom: 0 }}
        />
      </View>

      {activeTab === 'LOANS' && (
        <View style={styles.filterPills}>
          {['ALL', 'LENT', 'BORROWED'].map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.pill, typeFilter === t && styles.pillActive]}
              onPress={() => setTypeFilter(t)}
            >
              <Text style={[styles.pillText, typeFilter === t && styles.pillTextActive]}>
                {t === 'ALL' ? 'All' : t === 'LENT' ? 'Lent (Receivable)' : 'Borrowed (Payable)'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {activeTab === 'LOANS' ? (
        loansQuery.isLoading ? (
          <LoadingSpinner message="Loading loans..." fullScreen />
        ) : (
          <FlatList
            data={loans}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <LoanRow
                loan={item}
                onPress={() => navigation.navigate('AddRepayment', { loan: item })}
              />
            )}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={loansQuery.isRefetching}
                onRefresh={onRefresh}
                tintColor={COLORS.primary}
              />
            }
            ListEmptyComponent={
              <EmptyState
                icon="cash-outline"
                title="No loans found"
                description="Keep track of money lent to friends or borrowed from creditors."
                actionTitle="Create Loan"
                onAction={() => navigation.navigate('CreateLoan')}
              />
            }
          />
        )
      ) : repaymentsQuery.isLoading ? (
        <LoadingSpinner message="Loading repayments..." fullScreen />
      ) : (
        <FlatList
          data={repayments}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.repaymentRow}>
              <View>
                <Text style={styles.repCounterparty}>{item.counterpartyName || 'Loan'}</Text>
                <Text style={styles.repDate}>{formatDate(item.date)}</Text>
              </View>
              <Text style={styles.repAmount}>+{formatCurrency(item.amount)}</Text>
            </View>
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={repaymentsQuery.isRefetching}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="receipt-outline"
              title="No repayment records"
              description="Repayments made towards loans will appear here."
            />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  segmentedContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceGhost,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.borderHairline,
    padding: 3,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: RADIUS.full,
  },
  segmentBtnActive: {
    backgroundColor: COLORS.primary,
  },
  segmentText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  segmentTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  searchBox: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xs,
  },
  filterPills: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
    gap: 6,
  },
  pill: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    backgroundColor: COLORS.surfaceGhost,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.borderHairline,
  },
  pillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  pillText: {
    fontSize: FONT_SIZE.xs - 1,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  pillTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  listContent: {
    flexGrow: 1,
  },
  repaymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderHairline,
  },
  repCounterparty: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  repDate: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  repAmount: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.success,
    letterSpacing: -0.2,
  },
});
