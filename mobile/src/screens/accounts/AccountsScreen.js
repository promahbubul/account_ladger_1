import React, { useState, useCallback } from 'react';
import { View, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../../constants/theme';
import { Header } from '../../components/common/Header';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { AccountRow } from '../../components/lists/AccountRow';
import { EmptyState } from '../../components/common/EmptyState';
import { QueryErrorState } from '../../components/common/QueryStates';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { accountsApi } from '../../services/api/accounts.api';

export const AccountsScreen = ({ navigation }) => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const accountsQuery = useQuery({
    queryKey: ['accountsList', search],
    queryFn: () => accountsApi.getAccounts({ search }),
  });

  const onRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['accountsList'] });
  }, [queryClient]);

  const accounts = accountsQuery.data?.accounts || [];

  const openRow = useCallback((item) => navigation.navigate('AccountDetail', { account: item }), [navigation]);
  const renderRow = useCallback(({ item }) => <AccountRow account={item} onPress={openRow} />, [openRow]);

  return (
    <View style={styles.container}>
      <Header
        title="Accounts"
        showDateFilter={false}
        rightAction={
          <Button
            title="Add"
            size="sm"
            icon={<Ionicons name="add" size={16} color="#FFF" />}
            onPress={() => navigation.navigate('CreateAccount')}
          />
        }
      />

      <View style={styles.searchBox}>
        <Input
          placeholder="Search accounts..."
          value={search}
          onChangeText={setSearch}
          leftIcon={<Ionicons name="search" size={16} color={COLORS.textSecondary} />}
          style={{ marginBottom: 0 }}
        />
      </View>

      {accountsQuery.isLoading ? (
        <LoadingSpinner message="Loading accounts..." fullScreen />
      ) : (
        <FlatList
          data={accounts}
          keyExtractor={(item) => item.id}
          renderItem={renderRow}
          initialNumToRender={12}
          windowSize={7}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={accountsQuery.isRefetching}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            accountsQuery.isError ? (
              <QueryErrorState title="Could not load accounts" onRetry={() => accountsQuery.refetch()} />
            ) : (
              <EmptyState
                icon="wallet-outline"
                title="No accounts found"
                actionTitle="Create Account"
                onAction={() => navigation.navigate('CreateAccount')}
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
    paddingVertical: SPACING.xs,
    flexGrow: 1,
  },
});
