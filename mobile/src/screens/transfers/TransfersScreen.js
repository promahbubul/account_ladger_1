import React, { useState, useCallback } from 'react';
import { View, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../../constants/theme';
import { Header } from '../../components/common/Header';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { TransferRow } from '../../components/lists/TransferRow';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { transfersApi } from '../../services/api/transfers.api';

export const TransfersScreen = ({ navigation }) => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const transfersQuery = useQuery({
    queryKey: ['transfersList', search],
    queryFn: () => transfersApi.getTransfers({ search }),
  });

  const onRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['transfersList'] });
  }, [queryClient]);

  const items = transfersQuery.data?.items || [];

  return (
    <View style={styles.container}>
      <Header
        title="Transfers"
        showBack
        onBack={() => navigation.goBack()}
        showDateFilter={false}
        rightAction={
          <Button
            title="Transfer"
            size="sm"
            icon={<Ionicons name="swap-horizontal" size={16} color="#FFF" />}
            onPress={() => navigation.navigate('CreateTransfer')}
          />
        }
      />

      <View style={styles.searchBox}>
        <Input
          placeholder="Search transfers..."
          value={search}
          onChangeText={setSearch}
          leftIcon={<Ionicons name="search" size={16} color={COLORS.textSecondary} />}
          style={{ marginBottom: 0 }}
        />
      </View>

      {transfersQuery.isLoading ? (
        <LoadingSpinner message="Loading transfers..." fullScreen />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TransferRow
              item={item}
              onPress={() => {}}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={transfersQuery.isRefetching}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="swap-horizontal-outline"
              title="No transfers yet"
              description="Move money between cash, bank, or mobile accounts easily."
              actionTitle="Create Transfer"
              onAction={() => navigation.navigate('CreateTransfer')}
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
    padding: SPACING.lg,
    flexGrow: 1,
  },
});
