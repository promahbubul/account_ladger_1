import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { accountsApi } from '../../services/api/accounts.api';

export const AccountDetailScreen = ({ route, navigation }) => {
  const queryClient = useQueryClient();
  const account = route.params?.account;

  const [deleteVisible, setDeleteVisible] = useState(false);
  const [archiveVisible, setArchiveVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!account) return null;

  const handleDelete = async () => {
    setLoading(true);
    try {
      await accountsApi.deleteAccount(account.id);
      queryClient.invalidateQueries({ queryKey: ['accountsList'] });
      queryClient.invalidateQueries({ queryKey: ['accountsOverview'] });
      setDeleteVisible(false);
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.message || 'Cannot delete account with existing transactions.');
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async () => {
    setLoading(true);
    try {
      await accountsApi.archiveAccount(account.id);
      queryClient.invalidateQueries({ queryKey: ['accountsList'] });
      setArchiveVisible(false);
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to update account archive status.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title={account.name} showBack onBack={() => navigation.goBack()} showDateFilter={false} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card>
          <View style={styles.badgeRow}>
            <Badge label={account.type} variant="primary" />
            <Badge label={account.status || 'ACTIVE'} variant={account.status === 'ARCHIVED' ? 'warning' : 'success'} />
          </View>

          <Text style={styles.balanceLabel}>Current Balance</Text>
          <Text style={styles.balanceVal}>{formatCurrency(account.currentBalance, account.currency)}</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Opening Balance</Text>
            <Text style={styles.infoVal}>{formatCurrency(account.openingBalance, account.currency)}</Text>
          </View>

          {account.providerName ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>Provider / Bank</Text>
              <Text style={styles.infoVal}>{account.providerName}</Text>
            </View>
          ) : null}

          {account.accountNumber ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>Account Number</Text>
              <Text style={styles.infoVal}>{account.accountNumber}</Text>
            </View>
          ) : null}

          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Created At</Text>
            <Text style={styles.infoVal}>{formatDate(account.createdAt)}</Text>
          </View>
        </Card>

        <View style={styles.actionButtons}>
          <Button
            title="Transfer Funds"
            variant="secondary"
            onPress={() => navigation.navigate('CreateTransfer', { sourceAccountId: account.id })}
            style={styles.mb}
          />

          <Button
            title={account.status === 'ARCHIVED' ? 'Restore Account' : 'Archive Account'}
            variant="outline"
            onPress={() => setArchiveVisible(true)}
            style={styles.mb}
          />

          <Button
            title="Delete Account"
            variant="danger"
            onPress={() => setDeleteVisible(true)}
          />
        </View>
      </ScrollView>

      <ConfirmModal
        visible={deleteVisible}
        title="Delete Account"
        message={`Are you sure you want to delete "${account.name}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteVisible(false)}
        loading={loading}
      />

      <ConfirmModal
        visible={archiveVisible}
        title={account.status === 'ARCHIVED' ? 'Restore Account' : 'Archive Account'}
        message={`Are you sure you want to ${account.status === 'ARCHIVED' ? 'restore' : 'archive'} this account?`}
        onConfirm={handleArchive}
        onCancel={() => setArchiveVisible(false)}
        isDanger={false}
        loading={loading}
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
  badgeRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  balanceLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  balanceVal: {
    fontSize: FONT_SIZE.title,
    fontWeight: '800',
    color: COLORS.text,
    marginVertical: SPACING.xs,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  infoKey: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  infoVal: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.text,
  },
  actionButtons: {
    marginTop: SPACING.md,
  },
  mb: {
    marginBottom: SPACING.md,
  },
});
