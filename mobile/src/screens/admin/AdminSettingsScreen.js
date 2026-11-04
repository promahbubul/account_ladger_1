import React, { useState } from 'react';
import { showMessage } from '../../utils/notify';
import { View, Text, StyleSheet, ScrollView, Switch } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { COLORS, SPACING, FONT_SIZE } from '../../constants/theme';
import { Header } from '../../components/common/Header';
import { QueryErrorState } from '../../components/common/QueryStates';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { adminApi } from '../../services/api/admin.api';

export const AdminSettingsScreen = ({ navigation }) => {
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ['adminSettings'],
    queryFn: () => adminApi.getSettings(),
  });

  const [allowRegistration, setAllowRegistration] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [auditLogging, setAuditLogging] = useState(true);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (settingsQuery.data?.settings) {
      const s = settingsQuery.data.settings;
      setAllowRegistration(s.allowUserRegistration !== false);
      setMaintenanceMode(Boolean(s.maintenanceMode));
      setAuditLogging(s.auditLoggingEnabled !== false);
    }
  }, [settingsQuery.data]);

  const handleSave = async () => {
    setLoading(true);
    try {
      await adminApi.updateSettings({
        allowUserRegistration: allowRegistration,
        maintenanceMode,
        auditLoggingEnabled: auditLogging,
      });
      queryClient.invalidateQueries({ queryKey: ['adminSettings'] });
      showMessage('Success', 'System settings saved.');
    } catch (err) {
      showMessage('Error', err.message || 'Failed to update system settings.');
    } finally {
      setLoading(false);
    }
  };

  if (settingsQuery.isError && !settingsQuery.data) {
    return (
      <View style={styles.container}>
        <Header title="System Settings" showBack onBack={() => navigation.goBack()} showDateFilter={false} />
        <QueryErrorState title="Could not load settings" onRetry={() => settingsQuery.refetch()} />
      </View>
    );
  }

  if (settingsQuery.isLoading) {
    return (
      <View style={styles.container}>
        <Header title="System Settings" showBack onBack={() => navigation.goBack()} showDateFilter={false} />
        <LoadingSpinner message="Loading settings..." fullScreen />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="System Settings" showBack onBack={() => navigation.goBack()} showDateFilter={false} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card>
          <View style={styles.switchRow}>
            <View style={{ flex: 1, marginRight: SPACING.md }}>
              <Text style={styles.switchTitle}>Allow User Self-Registration</Text>
            </View>
            <Switch
              value={allowRegistration}
              onValueChange={setAllowRegistration}
              trackColor={{ false: COLORS.border, true: COLORS.primary }}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={{ flex: 1, marginRight: SPACING.md }}>
              <Text style={styles.switchTitle}>Maintenance Mode</Text>
              <Text style={styles.switchSub}>When enabled, standard user ledger access is temporarily locked.</Text>
            </View>
            <Switch
              value={maintenanceMode}
              onValueChange={setMaintenanceMode}
              trackColor={{ false: COLORS.border, true: COLORS.danger }}
            />
          </View>

          <View style={[styles.switchRow, { borderBottomWidth: 0 }]}>
            <View style={{ flex: 1, marginRight: SPACING.md }}>
              <Text style={styles.switchTitle}>Audit Logging</Text>
            </View>
            <Switch
              value={auditLogging}
              onValueChange={setAuditLogging}
              trackColor={{ false: COLORS.border, true: COLORS.primary }}
            />
          </View>

          <Button
            title="Save System Settings"
            onPress={handleSave}
            loading={loading}
            style={{ marginTop: SPACING.lg }}
          />
        </Card>
      </ScrollView>
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  switchTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.text,
  },
  switchSub: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
});
