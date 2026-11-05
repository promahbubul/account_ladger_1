import React, { useState, useCallback } from 'react';
import { showMessage } from '../../utils/notify';
import { View, Text, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { usePagedQuery } from '../../hooks/usePagedQuery';
import { LoadMoreFooter } from '../../components/common/LoadMoreFooter';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, RADIUS, themedStyles } from '../../constants/theme';
import { Header } from '../../components/common/Header';
import { Input } from '../../components/common/Input';
import { Badge } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { QueryErrorState } from '../../components/common/QueryStates';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { adminApi } from '../../services/api/admin.api';

export const AdminUsersScreen = ({ navigation }) => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [toggleVisible, setToggleVisible] = useState(false);

  const usersQuery = usePagedQuery({
    queryKey: ['adminUsersList', search],
    paging: 'cursor',
    fetchPage: (cursor) => adminApi.getUsers({ search, cursor, limit: 50 }),
  });

  const onRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['adminUsersList'] });
  }, [queryClient]);

  const users = usersQuery.items;

  const handleToggleStatus = async () => {
    if (!selectedUser) return;
    try {
      await adminApi.toggleUserStatus(selectedUser.id);
      queryClient.invalidateQueries({ queryKey: ['adminUsersList'] });
      setToggleVisible(false);
      setSelectedUser(null);
    } catch (err) {
      showMessage('Error', err.message || 'Failed to update user status.');
    }
  };

  return (
    <View style={styles.container}>
      <Header title="User Management" showBack onBack={() => navigation.goBack()} showDateFilter={false} />

      <View style={styles.searchBox}>
        <Input
          placeholder="Search users by name, email, or username..."
          value={search}
          onChangeText={setSearch}
          leftIcon={<Ionicons name="search" size={16} color={COLORS.textSecondary} />}
          style={{ marginBottom: 0 }}
        />
      </View>

      {usersQuery.isLoading ? (
        <LoadingSpinner message="Loading users..." fullScreen />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.userCard}>
              <View style={styles.userHeader}>
                <View>
                  <Text style={styles.userName}>{item.fullName || item.username}</Text>
                  <Text style={styles.userEmail}>{item.email}</Text>
                </View>
                <Badge
                  label={item.isActive ? 'ACTIVE' : 'DEACTIVATED'}
                  variant={item.isActive ? 'success' : 'danger'}
                />
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaText}>Role: {item.role}</Text>
                <Text style={styles.metaText}>Verified: {item.emailVerified ? 'Yes' : 'No'}</Text>
                <TouchableOpacity
                  style={styles.toggleBtn}
                  onPress={() => {
                    setSelectedUser(item);
                    setToggleVisible(true);
                  }}
                >
                  <Text style={styles.toggleText}>
                    {item.isActive ? 'Deactivate' : 'Activate'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={<LoadMoreFooter query={usersQuery} />}
          refreshControl={
            <RefreshControl
              refreshing={usersQuery.isRefetching}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            usersQuery.isError ? (
              <QueryErrorState title="Could not load users" onRetry={() => usersQuery.refetch()} />
            ) : (
              <EmptyState
                icon="people-outline"
                title="No users found"
              />
            )
          }
        />
      )}

      <ConfirmModal
        visible={toggleVisible}
        title={selectedUser?.isActive ? 'Deactivate User' : 'Activate User'}
        message={`Are you sure you want to ${selectedUser?.isActive ? 'deactivate' : 'activate'} user "${selectedUser?.username}"?`}
        confirmText={selectedUser?.isActive ? 'Deactivate' : 'Activate'}
        isDanger={selectedUser?.isActive}
        onConfirm={handleToggleStatus}
        onCancel={() => {
          setToggleVisible(false);
          setSelectedUser(null);
        }}
      />
    </View>
  );
};

const styles = themedStyles(() => ({
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
  userCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.xs,
  },
  userName: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.text,
  },
  userEmail: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: SPACING.xs,
  },
  metaText: {
    fontSize: FONT_SIZE.xs - 1,
    color: COLORS.textMuted,
  },
  toggleBtn: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: RADIUS.xs,
    backgroundColor: COLORS.surfaceElevated,
  },
  toggleText: {
    fontSize: FONT_SIZE.xs - 1,
    fontWeight: '600',
    color: COLORS.primary,
  },
}));
