import React, { useState } from 'react';
import { showMessage } from '../../utils/notify';
import { View, Text, StyleSheet, ScrollView, Modal } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme';
import { Header } from '../../components/common/Header';
import { Select } from '../../components/common/Select';
import { accountsApi } from '../../services/api/accounts.api';
import { categoriesApi } from '../../services/api/categories.api';
import { getSelectableCategories } from '../../utils/categories';
import { DateField } from '../../components/common/DateField';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Input } from '../../components/common/Input';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { formatCurrency, formatDate, parseAmount } from '../../utils/formatters';
import { transactionsApi } from '../../services/api/transactions.api';
import { KeyboardView } from '../../components/common/KeyboardView';

export const TransactionDetailScreen = ({ route, navigation }) => {
  const queryClient = useQueryClient();
  const initialTx = route.params?.transaction;

  const [tx, setTx] = useState(initialTx);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);

  // Edit form state
  const [description, setDescription] = useState(initialTx?.description || '');
  const [amount, setAmount] = useState(String(initialTx?.amount || ''));
  const [date, setDate] = useState(initialTx?.date ? String(initialTx.date).slice(0, 10) : '');
  const [reference, setReference] = useState(initialTx?.reference || '');

  const [accountId, setAccountId] = useState(initialTx?.accountId || '');
  const [category, setCategory] = useState(initialTx?.category || '');
  const [subcategory, setSubcategory] = useState(initialTx?.subcategory || '');

  const isCategorized = initialTx?.type === 'INCOME' || initialTx?.type === 'EXPENSE';
  const accountsQuery = useQuery({
    queryKey: ['accountsList'],
    queryFn: () => accountsApi.getAccounts(),
    enabled: editVisible && isCategorized,
  });
  const categoriesQuery = useQuery({
    queryKey: ['categoriesList'],
    queryFn: () => categoriesApi.getCategories(),
    enabled: editVisible && isCategorized,
  });
  const categories = getSelectableCategories(categoriesQuery.data?.categories, initialTx?.type);
  // A category or subcategory that was since archived must stay visible until it is changed.
  const categoryNames = categories.map((c) => c.name);
  const categoryOptions = [...new Set([...(category ? [category] : []), ...categoryNames])].map((name) => ({ value: name, label: name }));
  const subcategoryNames = categories.find((c) => c.name === category)?.subcategories || [];
  const subcategoryOptions = [...new Set([...(subcategory ? [subcategory] : []), ...subcategoryNames])].map((name) => ({ value: name, label: name }));

  if (!tx) return null;

  const isIncome = tx.type === 'INCOME';
  const isExpense = tx.type === 'EXPENSE';
  const amountColor = isIncome ? COLORS.success : isExpense ? COLORS.danger : COLORS.warning;

  const handleUpdate = async () => {
    const numAmount = parseAmount(amount);
    if (numAmount === null) {
      showMessage('Validation Error', 'Please enter a valid amount greater than 0.');
      return;
    }
    if (!date.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      showMessage('Validation Error', 'Please enter a valid date in YYYY-MM-DD format.');
      return;
    }
    if (!description.trim()) {
      showMessage('Validation Error', 'Description cannot be empty.');
      return;
    }

    setEditLoading(true);
    try {
      const updated = await transactionsApi.updateTransaction(tx.id, {
        date: date.trim(),
        amount: numAmount,
        description: description.trim(),
        reference: reference.trim() || null,
        ...(isCategorized ? { accountId, category, subcategory: subcategory || null } : {}),
      });

      const newTx = updated?.transaction || {
        ...tx,
        date: date.trim(),
        amount: numAmount,
        description: description.trim(),
        reference: reference.trim() || null,
        ...(isCategorized ? { accountId, category, subcategory: subcategory || null } : {}),
      };

      setTx(newTx);
      queryClient.invalidateQueries({ queryKey: ['transactionsList'] });
      queryClient.invalidateQueries({ queryKey: ['incomeList'] });
      queryClient.invalidateQueries({ queryKey: ['expensesList'] });
      queryClient.invalidateQueries({ queryKey: ['reportsSummary'] });
      queryClient.invalidateQueries({ queryKey: ['accountsOverview'] });
      queryClient.invalidateQueries({ queryKey: ['accountsList'] });
      queryClient.invalidateQueries({ queryKey: ['recentTransactions'] });
      setEditVisible(false);
    } catch (err) {
      showMessage('Error', err.message || 'Failed to update transaction.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await transactionsApi.deleteTransaction(tx.id);
      queryClient.invalidateQueries({ queryKey: ['transactionsList'] });
      queryClient.invalidateQueries({ queryKey: ['incomeList'] });
      queryClient.invalidateQueries({ queryKey: ['expensesList'] });
      queryClient.invalidateQueries({ queryKey: ['reportsSummary'] });
      queryClient.invalidateQueries({ queryKey: ['accountsOverview'] });
      queryClient.invalidateQueries({ queryKey: ['recentTransactions'] });
      setDeleteVisible(false);
      navigation.goBack();
    } catch (err) {
      showMessage('Error', err.message || 'Failed to delete transaction.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Transaction Details" showBack onBack={() => navigation.goBack()} showDateFilter={false} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Unboxed Hero Amount Header */}
        <View style={styles.heroSection}>
          <Badge
            label={tx.type}
            variant={isIncome ? 'success' : isExpense ? 'danger' : 'warning'}
            style={{ marginBottom: SPACING.sm }}
          />

          <Text style={[styles.amountHero, { color: amountColor }]}>
            {isIncome ? '+' : isExpense ? '-' : ''}{formatCurrency(tx.amount)}
          </Text>

          <Text style={styles.descHero}>{tx.description || tx.category || 'Transaction'}</Text>
        </View>

        {/* Details Section */}
        <View style={styles.detailsSection}>
          <View style={styles.row}>
            <Text style={styles.key}>Date</Text>
            <Text style={styles.val}>{formatDate(tx.date)}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.key}>Account</Text>
            <Text style={styles.val}>{tx.accountName || '-'}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.key}>Category</Text>
            <Text style={styles.val}>{tx.category || '-'}</Text>
          </View>

          {tx.subcategory ? (
            <View style={styles.row}>
              <Text style={styles.key}>Subcategory</Text>
              <Text style={styles.val}>{tx.subcategory}</Text>
            </View>
          ) : null}

          {tx.reference ? (
            <View style={styles.row}>
              <Text style={styles.key}>Reference</Text>
              <Text style={styles.val}>{tx.reference}</Text>
            </View>
          ) : null}

          <View style={styles.row}>
            <Text style={styles.key}>Status</Text>
            <Text style={[styles.val, { color: COLORS.success }]}>{tx.status || 'COMPLETED'}</Text>
          </View>
        </View>

        <View style={styles.actionButtons}>
          <Button
            title="Edit Details"
            variant="secondary"
            icon={<Ionicons name="create-outline" size={18} color={COLORS.text} />}
            onPress={() => {
              setDescription(tx.description || '');
              setAmount(String(tx.amount || ''));
              setDate(tx.date ? String(tx.date).slice(0, 10) : '');
              setReference(tx.reference || '');
              setEditVisible(true);
            }}
            style={styles.mb}
          />

          <Button
            title="Delete Transaction"
            variant="danger"
            icon={<Ionicons name="trash-outline" size={18} color={COLORS.surface} />}
            onPress={() => setDeleteVisible(true)}
          />
        </View>
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={editVisible} transparent animationType="fade">
        <KeyboardView style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Transaction</Text>
            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">

            <Input
              label="Amount *"
              placeholder="0.00"
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
            />

            <DateField
              label="Date *"
              value={date}
              onChange={setDate}
            />

            <Input
              label="Description *"
              autoCapitalize="sentences"
              placeholder="e.g. Weekly grocery shopping"
              value={description}
              onChangeText={setDescription}
            />

            <Input
              label="Reference (Optional)"
              placeholder="e.g. Receipt #1234"
              value={reference}
              onChangeText={setReference}
            />

            {isCategorized ? (
              <>
                <Select
                  label="Account *"
                  value={accountId}
                  options={(accountsQuery.data?.accounts || []).map((acc) => ({ value: acc.id, label: acc.name }))}
                  onChange={setAccountId}
                  loading={accountsQuery.isLoading}
                  placeholder={tx.accountName || 'Select an account'}
                />
                <Select
                  label="Category *"
                  value={category}
                  options={categoryOptions}
                  onChange={(name) => {
                    setCategory(name);
                    setSubcategory('');
                  }}
                  loading={categoriesQuery.isLoading}
                  placeholder="Select a category"
                />
                {subcategoryOptions.length > 0 ? (
                  <Select
                    label="Subcategory"
                    value={subcategory}
                    options={subcategoryOptions}
                    onChange={setSubcategory}
                    allowClear
                    placeholder="Optional"
                  />
                ) : null}
              </>
            ) : null}
            </ScrollView>

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
        </KeyboardView>
      </Modal>

      <ConfirmModal
        visible={deleteVisible}
        title="Delete Transaction"
        message="Are you sure you want to delete this transaction? Balance adjustments will be automatically recalculated."
        onConfirm={handleDelete}
        onCancel={() => setDeleteVisible(false)}
        loading={loading}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  modalScroll: {
    maxHeight: 460,
  },
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
    paddingVertical: SPACING.xl,
    marginBottom: SPACING.md,
  },
  amountHero: {
    fontSize: FONT_SIZE.hero,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  descHero: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  detailsSection: {
    marginBottom: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderHairline,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderHairline,
  },
  key: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  val: {
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
});
