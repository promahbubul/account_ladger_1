import React, { useState, useCallback } from 'react';
import { View, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../../constants/theme';
import { Header } from '../../components/common/Header';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { TransactionRow } from '../../components/lists/TransactionRow';
import { EmptyState } from '../../components/common/EmptyState';
import { usePagedQuery } from '../../hooks/usePagedQuery';
import { LoadMoreFooter } from '../../components/common/LoadMoreFooter';
import { QueryErrorState } from '../../components/common/QueryStates';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { transactionsApi } from '../../services/api/transactions.api';
import { useDateFilter } from '../../context/DateFilterContext';

export const IncomeScreen = ({ navigation }) => {
  const queryClient = useQueryClient();
  const { startDate, endDate } = useDateFilter();
  const [search, setSearch] = useState('');

  const incomeQuery = usePagedQuery({
    queryKey: ['incomeList', startDate, endDate, search],
    paging: 'cursor',
    fetchPage: (cursor) => transactionsApi.getTransactions({
      type: 'INCOME',
      startDate,
      endDate,
      search,
      cursor,
      limit: 50,
    }),
  });

  const onRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['incomeList'] });
  }, [queryClient]);

  const items = incomeQuery.items;

  const openRow = useCallback((item) => navigation.navigate('TransactionDetail', { transaction: item }), [navigation]);
  const renderRow = useCallback(({ item }) => <TransactionRow item={item} onPress={openRow} />, [openRow]);

  return (
    <View style={styles.container}>
      <Header
        title="Income"
        showBack
        onBack={() => navigation.goBack()}
        showDateFilter={true}
        rightAction={
          <Button
            title="Add"
            size="sm"
            icon={<Ionicons name="add" size={16} color="#FFF" />}
            onPress={() => navigation.navigate('AddIncome')}
          />
        }
      />

      <View style={styles.searchBox}>
        <Input
          placeholder="Search income records..."
          value={search}
          onChangeText={setSearch}
          leftIcon={<Ionicons name="search" size={16} color={COLORS.textSecondary} />}
          style={{ marginBottom: 0 }}
        />
      </View>

      {incomeQuery.isLoading ? (
        <LoadingSpinner message="Loading income records..." fullScreen />
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
              refreshing={incomeQuery.isRefetching}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          }
          ListFooterComponent={<LoadMoreFooter query={incomeQuery} />}
          ListEmptyComponent={
            incomeQuery.isError ? (
              <QueryErrorState title="Could not load income" onRetry={() => incomeQuery.refetch()} />
            ) : (
              <EmptyState
                icon="arrow-down-circle-outline"
                title="No income records"
                actionTitle="Add Income"
                onAction={() => navigation.navigate('AddIncome')}
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
  searchBox: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  listContent: {
    flexGrow: 1,
  },
});
