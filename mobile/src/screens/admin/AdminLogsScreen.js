import React, { useCallback } from 'react';
import { View, Text, FlatList, RefreshControl } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { usePagedQuery } from '../../hooks/usePagedQuery';
import { LoadMoreFooter } from '../../components/common/LoadMoreFooter';
import { COLORS, SPACING, FONT_SIZE, RADIUS, themedStyles } from '../../constants/theme';
import { Header } from '../../components/common/Header';
import { Badge } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { QueryErrorState } from '../../components/common/QueryStates';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { adminApi } from '../../services/api/admin.api';
import { formatDate } from '../../utils/formatters';

export const AdminLogsScreen = ({ navigation }) => {
  const queryClient = useQueryClient();

  const logsQuery = usePagedQuery({
    queryKey: ['adminAuditLogs'],
    paging: 'cursor',
    fetchPage: (cursor) => adminApi.getAuditLogs({ cursor, limit: 50 }),
  });

  const onRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['adminAuditLogs'] });
  }, [queryClient]);

  const logs = logsQuery.items;

  return (
    <View style={styles.container}>
      <Header title="Audit Logs" showBack onBack={() => navigation.goBack()} showDateFilter={false} />

      {logsQuery.isLoading ? (
        <LoadingSpinner message="Loading audit logs..." fullScreen />
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item, idx) => item.id || String(idx)}
          renderItem={({ item }) => (
            <View style={styles.logCard}>
              <View style={styles.logHeader}>
                <Badge label={item.action || 'ACTION'} variant="primary" />
                <Text style={styles.logDate}>{formatDate(item.createdAt)}</Text>
              </View>
              <Text style={styles.logDetails}>{item.details || item.entityType || '-'}</Text>
              <View style={styles.logFooter}>
                <Text style={styles.logUser}>{item.userEmail || item.userId || 'System'}</Text>
                {item.ipAddress ? (
                  <Text style={styles.logIp}>IP: {item.ipAddress}</Text>
                ) : null}
              </View>
            </View>
          )}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={<LoadMoreFooter query={logsQuery} />}
          refreshControl={
            <RefreshControl
              refreshing={logsQuery.isRefetching}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            logsQuery.isError ? (
              <QueryErrorState title="Could not load audit logs" onRetry={() => logsQuery.refetch()} />
            ) : (
              <EmptyState
                icon="shield-outline"
                title="No audit logs"
              />
            )
          }
        />
      )}
    </View>
  );
};

const styles = themedStyles(() => ({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listContent: {
    padding: SPACING.lg,
    flexGrow: 1,
  },
  logCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  logDate: {
    fontSize: FONT_SIZE.xs - 1,
    color: COLORS.textMuted,
  },
  logDetails: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.text,
    marginVertical: 4,
  },
  logFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  logUser: {
    fontSize: FONT_SIZE.xs - 2,
    color: COLORS.textSecondary,
  },
  logIp: {
    fontSize: FONT_SIZE.xs - 2,
    color: COLORS.textMuted,
  },
}));
