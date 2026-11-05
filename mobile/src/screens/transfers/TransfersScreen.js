import React, { useState, useCallback } from 'react';
import { View, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../../constants/theme';
import { Header } from '../../components/common/Header';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { TransferRow } from '../../components/lists/TransferRow';
import { EmptyState } from '../../components/common/EmptyState';
import { usePagedQuery } from '../../hooks/usePagedQuery';
import { LoadMoreFooter } from '../../components/common/LoadMoreFooter';
import { QueryErrorState } from '../../components/common/QueryStates';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { showMessage } from '../../utils/notify';
import { formatCurrency } from '../../utils/formatters';
import { transfersApi } from '../../services/api/transfers.api';

export const TransfersScreen = ({ navigation }) => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [reversing, setReversing] = useState(null);
  const [reverseLoading, setReverseLoading] = useState(false);

  const transfersQuery = usePagedQuery({
    queryKey: ['transfersList', search],
    paging: 'cursor',
    fetchPage: (cursor) => transfersApi.getTransfers({ search, cursor, limit: 50 }),
  });

  const onRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['transfersList'] });
  }, [queryClient]);

  const items = transfersQuery.items;

  const handleReverse = async () => {
    setReverseLoading(true);
    try {
      await transfersApi.deleteTransfer(reversing.id);
      // Balances changed, so everything that shows them must reload.
      queryClient.invalidateQueries();
      setReversing(null);
    } catch (err) {
      setReversing(null);
      showMessage('Could not reverse', err.message || 'Please try again.');
    } finally {
      setReverseLoading(false);
    }
  };

  const renderRow = useCallback(({ item }) => <TransferRow item={item} onPress={setReversing} />, []);

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
          renderItem={renderRow}
          initialNumToRender={12}
          windowSize={7}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={transfersQuery.isRefetching}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          }
          ListFooterComponent={<LoadMoreFooter query={transfersQuery} />}
          ListEmptyComponent={
            transfersQuery.isError ? (
              <QueryErrorState title="Could not load transfers" onRetry={() => transfersQuery.refetch()} />
            ) : (
              <EmptyState
                icon="swap-horizontal-outline"
                title="No transfers yet"
                actionTitle="Create Transfer"
                onAction={() => navigation.navigate('CreateTransfer')}
              />
            )
          }
        />
      )}

      <ConfirmModal
        visible={Boolean(reversing)}
        title="Reverse Transfer"
        message={reversing ? `Move ${formatCurrency(reversing.amount)} back to ${reversing.sourceAccountName || 'the source account'} and delete this transfer?` : ''}
        confirmText="Reverse"
        loading={reverseLoading}
        onConfirm={handleReverse}
        onCancel={() => setReversing(null)}
      />
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
