import React, { useState } from 'react';
import { showMessage } from '../../utils/notify';
import { View, Text, ScrollView, Modal } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, RADIUS, themedStyles } from '../../constants/theme';
import { Header } from '../../components/common/Header';
import { ProviderField } from '../../components/common/ProviderField';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Input } from '../../components/common/Input';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { accountsApi } from '../../services/api/accounts.api';

export const AccountDetailScreen = ({ route, navigation }) => {
  const queryClient = useQueryClient();
  const initialAccount = route.params?.account;

  const [account, setAccount] = useState(initialAccount);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [archiveVisible, setArchiveVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);

  // Edit fields
  const [name, setName] = useState(initialAccount?.name || '');
  const [providerName, setProviderName] = useState(initialAccount?.providerName || '');
  const [accountNumber, setAccountNumber] = useState(initialAccount?.accountNumber || '');

  if (!account) return null;

  const handleUpdate = async () => {
    if (!name.trim()) {
      showMessage('Validation Error', 'Account name cannot be empty.');
      return;
    }

    setEditLoading(true);
    try {
      const updated = await accountsApi.updateAccount(account.id, {
        name: name.trim(),
        providerName: providerName.trim() || null,
        accountNumber: accountNumber.trim() || null,
      });

      const newAccount = updated?.account || {
        ...account,
        name: name.trim(),
        providerName: providerName.trim() || null,
        accountNumber: accountNumber.trim() || null,
      };

      setAccount(newAccount);
      queryClient.invalidateQueries({ queryKey: ['accountsList'] });
      queryClient.invalidateQueries({ queryKey: ['accountsOverview'] });
      setEditVisible(false);
    } catch (err) {
      showMessage('Error', err.message || 'Failed to update account.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await accountsApi.deleteAccount(account.id);
      queryClient.invalidateQueries({ queryKey: ['accountsList'] });
      queryClient.invalidateQueries({ queryKey: ['accountsOverview'] });
      setDeleteVisible(false);
      navigation.goBack();
    } catch (err) {
      showMessage('Error', err.message || 'Cannot delete account with existing transactions.');
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async () => {
    setLoading(true);
    try {
      await accountsApi.archiveAccount(account.id);
      queryClient.invalidateQueries({ queryKey: ['accountsList'] });
      queryClient.invalidateQueries({ queryKey: ['accountsOverview'] });
      setArchiveVisible(false);
      navigation.goBack();
    } catch (err) {
      showMessage('Error', err.message || 'Failed to update account archive status.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title={account.name} showBack onBack={() => navigation.goBack()} showDateFilter={false} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Hero Balance Section */}
        <View style={styles.heroSection}>
          <View style={styles.badgeRow}>
            <Badge label={account.type} variant="primary" />
            <Badge label={account.status || 'ACTIVE'} variant={account.status === 'ARCHIVED' ? 'warning' : 'success'} />
          </View>

          <Text style={styles.balanceLabel}>CURRENT BALANCE</Text>
          <Text style={styles.balanceVal}>{formatCurrency(account.currentBalance)}</Text>
        </View>

        {/* Details Section */}
        <View style={styles.detailsSection}>
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Opening Balance</Text>
            <Text style={styles.infoVal}>{formatCurrency(account.openingBalance)}</Text>
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
        </View>

        <View style={styles.actionButtons}>
          <Button
            title="Transfer Funds"
            variant="secondary"
            icon={<Ionicons name="swap-horizontal" size={18} color={COLORS.text} />}
            onPress={() => navigation.navigate('CreateTransfer', { sourceAccountId: account.id })}
            style={styles.mb}
          />

          <Button
            title="Edit Details"
            variant="outline"
            icon={<Ionicons name="create-outline" size={18} color={COLORS.text} />}
            onPress={() => {
              setName(account.name || '');
              setProviderName(account.providerName || '');
              setAccountNumber(account.accountNumber || '');
              setEditVisible(true);
            }}
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

      {/* Edit Modal */}
      <Modal visible={editVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Account Details</Text>

            <Input
              label="Account Name *"
              autoCapitalize="words"
              placeholder="e.g. City Bank Primary"
              value={name}
              onChangeText={setName}
            />

            {account.type !== 'CASH' ? (
              <ProviderField type={account.type} value={providerName} onChange={setProviderName} />
            ) : null}

            <Input
              label="Account Number (Optional)"
              placeholder="e.g. 1102938475"
              value={accountNumber}
              onChangeText={setAccountNumber}
            />

            <View style={styles.modalBtnRow}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setEditVisible(false)}
                style={styles.modalBtn}
              />
              <Button
                title="Save Changes"
                onPress={handleUpdate}
                loading={editLoading}
                style={styles.modalBtn}
              />
            </View>
          </View>
        </View>
      </Modal>

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

const styles = themedStyles(() => ({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    marginBottom: SPACING.md,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  balanceLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.6,
  },
  balanceVal: {
    fontSize: FONT_SIZE.hero,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
    marginVertical: SPACING.xs,
  },
  detailsSection: {
    marginBottom: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderHairline,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderHairline,
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
    marginTop: SPACING.sm,
  },
  mb: {
    marginBottom: SPACING.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  modalCard: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  modalTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.lg,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  modalBtn: {
    flex: 1,
  },
}));
