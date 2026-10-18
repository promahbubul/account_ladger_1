import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { adminApi } from '../../services/api/admin.api';
import { useAuth } from '../../context/AuthContext';

export const AdminDashboardScreen = ({ navigation }) => {
  const queryClient = useQueryClient();
  const { logout, user } = useAuth();
  const [logoutVisible, setLogoutVisible] = useState(false);

  const statsQuery = useQuery({
    queryKey: ['adminStats'],
    queryFn: () => adminApi.getStats(),
  });

  const dbStatusQuery = useQuery({
    queryKey: ['adminDbStatus'],
    queryFn: () => adminApi.getDbStatus(),
  });

  const onRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['adminStats'] });
    queryClient.invalidateQueries({ queryKey: ['adminDbStatus'] });
  }, [queryClient]);

  const stats = statsQuery.data?.stats || {
    totalUsers: 0,
    activeUsers: 0,
    totalTransactions: 0,
    totalAccounts: 0,
    totalVolume: 0,
  };

  const dbStatus = dbStatusQuery.data || {
    status: 'healthy',
    mode: 'postgres',
    connectedToPostgres: true,
  };

  return (
    <View style={styles.container}>
      <Header
        title="System Dashboard"
        showBack={false}
        showDateFilter={false}
        rightAction={
          <TouchableOpacity
            style={styles.headerProfileBtn}
            onPress={() => navigation.navigate('Profile')}
          >
            <Ionicons name="person-circle-outline" size={26} color={COLORS.primary} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={statsQuery.isRefetching || dbStatusQuery.isRefetching}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        <Card style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View>
              <Text style={styles.statusTitle}>Database Status</Text>
              <Text style={styles.statusSub}>Mode: {dbStatus.mode || 'PostgreSQL'}</Text>
            </View>
            <Badge
              label={dbStatus.connectedToPostgres ? 'CONNECTED' : 'DISCONNECTED'}
              variant={dbStatus.connectedToPostgres ? 'success' : 'danger'}
            />
          </View>
        </Card>

        <Text style={styles.sectionHeader}>System Metrics</Text>
        <View style={styles.kpiGrid}>
          <Card style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Total Users</Text>
            <Text style={styles.kpiVal}>{stats.totalUsers}</Text>
          </Card>
          <Card style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Active Users</Text>
            <Text style={[styles.kpiVal, { color: COLORS.success }]}>{stats.activeUsers}</Text>
          </Card>
          <Card style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Total Transactions</Text>
            <Text style={styles.kpiVal}>{stats.totalTransactions}</Text>
          </Card>
          <Card style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Total Accounts</Text>
            <Text style={styles.kpiVal}>{stats.totalAccounts}</Text>
          </Card>
        </View>

        <Text style={styles.sectionHeader}>System Navigation</Text>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <TouchableOpacity
            style={styles.navRow}
            onPress={() => navigation.navigate('AdminUsers')}
          >
            <View style={styles.navLeft}>
              <Ionicons name="people-outline" size={18} color={COLORS.purple} />
              <Text style={styles.navText}>Manage Registered Users</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navRow}
            onPress={() => navigation.navigate('AdminLogs')}
          >
            <View style={styles.navLeft}>
              <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.warning} />
              <Text style={styles.navText}>System Audit Logs</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navRow}
            onPress={() => navigation.navigate('AdminSettings')}
          >
            <View style={styles.navLeft}>
              <Ionicons name="settings-outline" size={18} color={COLORS.primary} />
              <Text style={styles.navText}>Global System Settings</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navRow}
            onPress={() => navigation.navigate('Profile')}
          >
            <View style={styles.navLeft}>
              <Ionicons name="person-outline" size={18} color={COLORS.text} />
              <Text style={styles.navText}>Profile & Preferences</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navRow, { borderBottomWidth: 0 }]}
            onPress={() => setLogoutVisible(true)}
          >
            <View style={styles.navLeft}>
              <Ionicons name="log-out-outline" size={18} color={COLORS.danger} />
              <Text style={[styles.navText, { color: COLORS.danger }]}>Sign Out</Text>
            </View>
          </TouchableOpacity>
        </Card>
      </ScrollView>

      <ConfirmModal
        visible={logoutVisible}
        title="Sign Out"
        message="Are you sure you want to sign out of the administrator panel?"
        confirmText="Sign Out"
        onConfirm={logout}
        onCancel={() => setLogoutVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  statusCard: {
    marginBottom: SPACING.lg,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  statusSub: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  sectionHeader: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    letterSpacing: 0.5,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  kpiBox: {
    flexBasis: '48%',
    flexGrow: 1,
    marginBottom: 0,
    padding: SPACING.md,
  },
  kpiLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  kpiVal: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 4,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  navLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  navText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  headerProfileBtn: {
    padding: 2,
  },
});
