import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet, TouchableOpacity } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme';
import { Header } from '../../components/common/Header';
import { Input } from '../../components/common/Input';
import { TransactionRow } from '../../components/lists/TransactionRow';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { transactionsApi } from '../../services/api/transactions.api';
import { useDateFilter } from '../../context/DateFilterContext';

export const TransactionsScreen = ({ navigation }) => {
  const queryClient = useQueryClient();
  const { startDate, endDate } = useDateFilter();

  const [typeFilter, setTypeFilter] = useState('ALL'); // ALL | INCOME | EXPENSE | TRANSFER
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filters = [
    { id: 'ALL', label: 'All' },
    { id: 'INCOME', label: 'Income' },
    { id: 'EXPENSE', label: 'Expense' },
    { id: 'TRANSFER', label: 'Transfer' },
  ];

  const transactionsQuery = useQuery({
    queryKey: ['transactionsList', typeFilter, startDate, endDate, search, page],
    queryFn: () => transactionsApi.getTransactions({
      type: typeFilter,
      startDate,
      endDate,
      search,
      page,
      limit: 50,
    }),
  });

  const onRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['transactionsList'] });
  }, [queryClient]);

  const items = transactionsQuery.data?.items || [];
  const totalCount = transactionsQuery.data?.totalCount ?? items.length;
  const hasNextPage = Boolean(transactionsQuery.data?.hasNextPage);

  return (
    <View style={styles.container}>
      <Header title="Transactions" showDateFilter={true} />

      <View style={styles.searchBox}>
        <Input
          placeholder="Search transactions..."
          value={search}
          onChangeText={(val) => {
            setSearch(val);
            setPage(1);
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
              setPage(1);
            }}
          >
            <Text style={[styles.filterText, typeFilter === f.id && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {transactionsQuery.isLoading && page === 1 ? (
        <LoadingSpinner message="Loading ledger..." fullScreen />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TransactionRow
              item={item}
              onPress={() => navigation.navigate('TransactionDetail', { transaction: item })}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={transactionsQuery.isRefetching}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          }
          ListFooterComponent={
            hasNextPage ? (
              <TouchableOpacity
                style={styles.loadMoreBtn}
                onPress={() => setPage((p) => p + 1)}
              >
                <Text style={styles.loadMoreText}>Load More</Text>
              </TouchableOpacity>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="receipt-outline"
              title="No transactions found"
              description="No ledger activity recorded for this period."
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
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
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
  loadMoreBtn: {
    padding: SPACING.md,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  loadMoreText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
    fontWeight: '700',
  },
});
