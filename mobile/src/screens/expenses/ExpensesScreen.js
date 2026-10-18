import React, { useState, useCallback } from 'react';
import { View, FlatList, RefreshControl, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme';
import { Header } from '../../components/common/Header';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { TransactionRow } from '../../components/lists/TransactionRow';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { transactionsApi } from '../../services/api/transactions.api';
import { useDateFilter } from '../../context/DateFilterContext';

export const ExpensesScreen = ({ navigation }) => {
  const queryClient = useQueryClient();
  const { startDate, endDate } = useDateFilter();
  const [search, setSearch] = useState('');

  const expensesQuery = useQuery({
    queryKey: ['expensesList', startDate, endDate, search],
    queryFn: () => transactionsApi.getTransactions({
      type: 'EXPENSE',
      startDate,
      endDate,
      search,
    }),
  });

  const onRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['expensesList'] });
  }, [queryClient]);

  const items = expensesQuery.data?.items || [];

  return (
    <View style={styles.container}>
      <Header
        title="Expenses"
        showBack
        onBack={() => navigation.goBack()}
        showDateFilter={true}
        rightAction={
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Button
              title="Bulk"
              size="sm"
              variant="secondary"
              onPress={() => navigation.navigate('BulkExpense')}
            />
            <Button
              title="Add"
              size="sm"
              icon={<Ionicons name="add" size={16} color="#FFF" />}
              onPress={() => navigation.navigate('AddExpense')}
            />
          </View>
        }
      />

      <View style={styles.searchBox}>
        <Input
          placeholder="Search expenses..."
          value={search}
          onChangeText={setSearch}
          leftIcon={<Ionicons name="search" size={16} color={COLORS.textSecondary} />}
          style={{ marginBottom: 0 }}
        />
      </View>

      {expensesQuery.isLoading ? (
        <LoadingSpinner message="Loading expenses..." fullScreen />
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
              refreshing={expensesQuery.isRefetching}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="arrow-up-circle-outline"
              title="No expense records"
              description="No expenses found for the selected period or search criteria."
              actionTitle="Add Expense"
              onAction={() => navigation.navigate('AddExpense')}
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
  listContent: {
    flexGrow: 1,
  },
});
