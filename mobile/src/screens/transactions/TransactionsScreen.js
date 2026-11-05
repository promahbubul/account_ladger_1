import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet, TouchableOpacity } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme';
import { Header } from '../../components/common/Header';
import { Input } from '../../components/common/Input';
import { TransactionRow } from '../../components/lists/TransactionRow';
import { EmptyState } from '../../components/common/EmptyState';
import { usePagedQuery } from '../../hooks/usePagedQuery';
import { LoadMoreFooter } from '../../components/common/LoadMoreFooter';
import { QueryErrorState } from '../../components/common/QueryStates';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { transactionsApi } from '../../services/api/transactions.api';
import { useDateFilter } from '../../context/DateFilterContext';

export const TransactionsScreen = ({ navigation }) => {
  const queryClient = useQueryClient();
  const { startDate, endDate } = useDateFilter();

  const [typeFilter, setTypeFilter] = useState('ALL'); // ALL | INCOME | EXPENSE
  const [search, setSearch] = useState('');

  const filters = [
    { id: 'ALL', label: 'All' },
    { id: 'INCOME', label: 'Income' },
    { id: 'EXPENSE', label: 'Expense' },
  ];

  const transactionsQuery = usePagedQuery({
    queryKey: ['transactionsList', typeFilter, startDate, endDate, search],
    paging: 'cursor',
    fetchPage: (cursor) => transactionsApi.getTransactions({
      type: typeFilter,
      startDate,
      endDate,
      search,
      cursor,
      limit: 50,
    }),
  });

  const onRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['transactionsList'] });
  }, [queryClient]);

  const items = transactionsQuery.items;

  const openRow = useCallback((item) => navigation.navigate('TransactionDetail', { transaction: item }), [navigation]);
  const renderRow = useCallback(({ item }) => <TransactionRow item={item} onPress={openRow} />, [openRow]);

  return (
    <View style={styles.container}>
      <Header title="Transactions" showDateFilter={true} />

      {/* Prominent Quick Actions for Transactions */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.incomeBtn]}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('AddIncome')}
        >
          <Ionicons name="add-circle" size={18} color={COLORS.text} />
          <Text style={styles.actionBtnText}>Add Income</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.expenseBtn]}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('AddExpense')}
        >
          <Ionicons name="remove-circle" size={18} color={COLORS.text} />
          <Text style={styles.actionBtnText}>Add Expense</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchBox}>
        <Input
          placeholder="Search transactions..."
          value={search}
          onChangeText={(val) => {
            setSearch(val);
          }}
          leftIcon={<Ionicons name="search" size={16} color={COLORS.textSecondary} />}
          style={{ marginBottom: 0 }}
        />
      </View>

      <View style={styles.filtersRow}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f.id}
            style={[styles.filterChip, typeFilter === f.id && styles.filterChipActive]}
            onPress={() => {
              setTypeFilter(f.id);
            }}
          >
            <Text style={[styles.filterText, typeFilter === f.id && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {transactionsQuery.isLoading ? (
        <LoadingSpinner message="Loading ledger..." fullScreen />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderRow}
          initialNumToRender={12}
          windowSize={7}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={transactionsQuery.isRefetching}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          }
          ListFooterComponent={<LoadMoreFooter query={transactionsQuery} />}
          ListEmptyComponent={
            transactionsQuery.isError ? (
              <QueryErrorState title="Could not load transactions" onRetry={() => transactionsQuery.refetch()} />
            ) : (
              <EmptyState
                icon="receipt-outline"
                title="No transactions found"
              />
            )
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
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    gap: SPACING.sm,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  incomeBtn: {
    backgroundColor: COLORS.surface,
  },
  expenseBtn: {
    backgroundColor: COLORS.surface,
  },
  actionBtnText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.text,
  },
  searchBox: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  filtersRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
    gap: SPACING.xs,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceGhost,
    borderWidth: 1,
    borderColor: COLORS.borderHairline,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterText: {
    fontSize: FONT_SIZE.xs - 1,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#FFF',
  },
  listContent: {
    flexGrow: 1,
  },
});
