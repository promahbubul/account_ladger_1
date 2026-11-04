import React, { useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme';
import { Header } from '../../components/common/Header';
import { DateField } from '../../components/common/DateField';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Select } from '../../components/common/Select';
import { QueryErrorBanner } from '../../components/common/QueryStates';
import { transactionsApi } from '../../services/api/transactions.api';
import { accountsApi } from '../../services/api/accounts.api';
import { categoriesApi } from '../../services/api/categories.api';
import { getTodayISO, formatCurrency, parseAmount, isValidISODate } from '../../utils/formatters';
import { getSelectableCategories } from '../../utils/categories';
import { showMessage } from '../../utils/notify';

const newKey = () => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
const newRow = () => ({ key: newKey(), subcategory: '', description: '', amount: '' });
const newGroup = () => ({ key: newKey(), categoryId: '', rows: [newRow()] });
const isBlankRow = (row) => !row.amount.trim() && !row.description.trim() && !row.subcategory;

export const BulkExpenseScreen = ({ navigation }) => {
  const queryClient = useQueryClient();

  const [date, setDate] = useState(getTodayISO());
  const [accountId, setAccountId] = useState('');
  const [groups, setGroups] = useState(() => [newGroup()]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // One id per distinct payload, so resending after a lost response cannot save the batch twice.
  const batchRef = useRef({ signature: '', id: '' });

  const accountsQuery = useQuery({
    queryKey: ['accountsList'],
    queryFn: () => accountsApi.getAccounts(),
  });

  const categoriesQuery = useQuery({
    queryKey: ['categoriesList'],
    queryFn: () => categoriesApi.getCategories(),
  });

  const accounts = accountsQuery.data?.accounts || [];
  const expenseCategories = useMemo(
    () => getSelectableCategories(categoriesQuery.data?.categories, 'EXPENSE'),
    [categoriesQuery.data]
  );
  const findCategory = (id) => expenseCategories.find((c) => c.id === id);

  React.useEffect(() => {
    if (!accountId && accounts.length > 0) {
      setAccountId(accounts[0].id);
    }
  }, [accounts, accountId]);

  const clearFieldError = (key) => {
    setError('');
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const updateGroup = (groupKey, changes) => {
    setGroups((prev) => prev.map((g) => (g.key === groupKey ? { ...g, ...changes } : g)));
  };

  const updateRow = (groupKey, rowKey, field, value) => {
    if (field === 'amount') clearFieldError(rowKey);
    setGroups((prev) =>
      prev.map((g) =>
        g.key === groupKey
          ? { ...g, rows: g.rows.map((r) => (r.key === rowKey ? { ...r, [field]: value } : r)) }
          : g
      )
    );
  };

  const selectCategory = (group, categoryId) => {
    if (categoryId === group.categoryId) return;
    clearFieldError(group.key);
    // Subcategories belong to the previous category, so they cannot carry over.
    updateGroup(group.key, {
      categoryId,
      rows: group.rows.map((r) => ({ ...r, subcategory: '' })),
    });
  };

  const addRow = (groupKey) => {
    setGroups((prev) => prev.map((g) => (g.key === groupKey ? { ...g, rows: [...g.rows, newRow()] } : g)));
  };

  const removeRow = (groupKey, rowKey) => {
    clearFieldError(rowKey);
    setGroups((prev) =>
      prev.map((g) => (g.key === groupKey ? { ...g, rows: g.rows.filter((r) => r.key !== rowKey) } : g))
    );
  };

  const addGroup = () => setGroups((prev) => [...prev, newGroup()]);
  const removeGroup = (groupKey) => {
    clearFieldError(groupKey);
    setGroups((prev) => prev.filter((g) => g.key !== groupKey));
  };

  const groupTotal = (group) => group.rows.reduce((sum, r) => sum + (parseAmount(r.amount) || 0), 0);
  const totalSum = groups.reduce((sum, g) => sum + groupTotal(g), 0);
  const filledCount = groups.reduce((sum, g) => sum + g.rows.filter((r) => !isBlankRow(r)).length, 0);
  const canAddGroup = groups.length < expenseCategories.length;

  const handleSubmit = async () => {
    if (loading) return;
    setError('');

    const errors = {};
    const validItems = [];

    if (!accountId) errors.account = 'Please select an account.';
    if (!isValidISODate(date.trim())) errors.date = 'Enter a valid date as YYYY-MM-DD.';

    groups.forEach((group) => {
      const filledRows = group.rows.filter((r) => !isBlankRow(r));
      const category = findCategory(group.categoryId);
      if (filledRows.length > 0 && !category) {
        errors[group.key] = 'Please select a category.';
      }
      filledRows.forEach((row) => {
        const amount = parseAmount(row.amount);
        if (amount === null) {
          errors[row.key] = 'Enter a valid amount.';
          return;
        }
        if (category) {
          validItems.push({
            categoryId: category.id,
            category: category.name,
            subcategory: row.subcategory || undefined,
            description: row.description.trim() || `${category.name} Expense`,
            amount,
          });
        }
      });
    });

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError('Please fix the highlighted fields. Nothing has been saved.');
      return;
    }
    if (validItems.length === 0) {
      setError('Please add at least one expense with an amount.');
      return;
    }

    const payload = { date: date.trim(), accountId, items: validItems };
    const signature = JSON.stringify(payload);
    if (batchRef.current.signature !== signature) {
      batchRef.current = { signature, id: newKey() };
    }

    setLoading(true);
    try {
      const result = await transactionsApi.createBulkExpense({ ...payload, batchId: batchRef.current.id });

      queryClient.invalidateQueries({ queryKey: ['expensesList'] });
      queryClient.invalidateQueries({ queryKey: ['transactionsList'] });
      queryClient.invalidateQueries({ queryKey: ['reportsSummary'] });
      queryClient.invalidateQueries({ queryKey: ['accountsOverview'] });
      queryClient.invalidateQueries({ queryKey: ['accountsList'] });
      queryClient.invalidateQueries({ queryKey: ['recentTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['budgetsList'] });

      showMessage(
        'Success',
        `Recorded ${result.count} expenses. Total: ${formatCurrency(validItems.reduce((sum, it) => sum + it.amount, 0))}`,
        () => navigation.goBack()
      );
    } catch (err) {
      if (err.status === 408 || err.status === 0) {
        setError('Could not confirm the save. Tap Save again; it will not create duplicates.');
      } else {
        setError(err.message || 'Failed to record expenses. Nothing has been saved.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Add Multiple Expenses" showBack onBack={() => navigation.goBack()} showDateFilter={false} />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <DateField
          label="Date *"
          value={date}
          onChange={(val) => {
            clearFieldError('date');
            setDate(val);
          }}
          error={fieldErrors.date}
        />

        {accountsQuery.isError ? (
          <QueryErrorBanner message="Could not load accounts." onRetry={() => accountsQuery.refetch()} />
        ) : null}
        <Select
          label="Payment Account *"
          placeholder="Select an account"
          value={accountId}
          options={accounts.map((acc) => ({ value: acc.id, label: acc.name }))}
          onChange={(id) => {
            clearFieldError('account');
            setAccountId(id);
          }}
          loading={accountsQuery.isLoading}
          emptyMessage="No accounts found. Create an account first."
          error={fieldErrors.account}
        />

        {categoriesQuery.isError ? (
          <TouchableOpacity style={styles.retryBox} onPress={() => categoriesQuery.refetch()}>
            <Text style={styles.errorText}>Could not load categories. Tap to retry.</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.summaryBar}>
          <View>
            <Text style={styles.summaryLabel}>RUNNING TOTAL</Text>
            <Text style={styles.summaryTotal}>{formatCurrency(totalSum)}</Text>
          </View>
          <View style={styles.itemCountBadge}>
            <Text style={styles.itemCountText}>{filledCount} {filledCount === 1 ? 'expense' : 'expenses'}</Text>
          </View>
        </View>

        {groups.map((group) => {
          const category = findCategory(group.categoryId);
          const usedElsewhere = groups.filter((g) => g.key !== group.key).map((g) => g.categoryId);
          const categoryOptions = expenseCategories
            .filter((c) => !usedElsewhere.includes(c.id))
            .map((c) => ({ value: c.id, label: c.name }));
          const subcategoryOptions = (category?.subcategories || []).map((name) => ({ value: name, label: name }));

          return (
            <View key={group.key} style={styles.groupCard}>
              <View style={styles.groupHeader}>
                <Select
                  label="Category *"
                  placeholder="Select a category"
                  value={group.categoryId}
                  options={categoryOptions}
                  onChange={(id) => selectCategory(group, id)}
                  loading={categoriesQuery.isLoading}
                  emptyMessage="No expense categories found. Add one in Settings."
                  error={fieldErrors[group.key]}
                  style={styles.groupSelect}
                />
                {groups.length > 1 ? (
                  <TouchableOpacity
                    style={styles.removeGroupBtn}
                    onPress={() => removeGroup(group.key)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel="Remove category"
                  >
                    <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {group.rows.map((row, idx) => (
                <View key={row.key} style={styles.itemRow}>
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemIndexText}>Expense {idx + 1}</Text>
                    {group.rows.length > 1 ? (
                      <TouchableOpacity
                        onPress={() => removeRow(group.key, row.key)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel="Remove expense"
                      >
                        <Ionicons name="close-circle-outline" size={18} color={COLORS.textMuted} />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <View style={styles.inputRow}>
                    <View style={styles.descriptionCol}>
                      <Input
                        label="Description"
                        autoCapitalize="sentences"
                        placeholder="e.g. Lunch"
                        value={row.description}
                        onChangeText={(val) => updateRow(group.key, row.key, 'description', val)}
                        style={styles.flushField}
                      />
                    </View>
                    <View style={styles.amountCol}>
                      <Input
                        label="Amount *"
                        placeholder="0.00"
                        value={row.amount}
                        onChangeText={(val) => updateRow(group.key, row.key, 'amount', val)}
                        keyboardType="numeric"
                        error={fieldErrors[row.key]}
                        style={styles.flushField}
                        inputStyle={styles.amountInput}
                      />
                    </View>
                  </View>

                  {subcategoryOptions.length > 0 ? (
                    <Select
                      label="Subcategory"
                      placeholder="Optional"
                      value={row.subcategory}
                      options={subcategoryOptions}
                      onChange={(val) => updateRow(group.key, row.key, 'subcategory', val)}
                      allowClear
                      style={styles.subcategorySelect}
                    />
                  ) : null}
                </View>
              ))}

              <View style={styles.groupFooter}>
                <TouchableOpacity style={styles.addRowLink} onPress={() => addRow(group.key)}>
                  <Ionicons name="add" size={16} color={COLORS.primary} />
                  <Text style={styles.addRowText}>Add expense</Text>
                </TouchableOpacity>
                <Text style={styles.subtotal}>Subtotal: {formatCurrency(groupTotal(group))}</Text>
              </View>
            </View>
          );
        })}

        <Button
          title="Add Another Category"
          variant="secondary"
          icon={<Ionicons name="add" size={16} color={COLORS.text} />}
          onPress={addGroup}
          disabled={!canAddGroup}
          style={styles.addGroupBtn}
        />

        <Button
          title={`Save All Expenses (${formatCurrency(totalSum)})`}
          variant="danger"
          onPress={handleSubmit}
          loading={loading}
          style={styles.submitBtn}
        />
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
  errorText: {
    color: COLORS.danger,
    fontSize: FONT_SIZE.xs,
    marginBottom: SPACING.md,
  },
  retryBox: {
    marginBottom: SPACING.xs,
  },
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    marginBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderHairline,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.6,
  },
  summaryTotal: {
    fontSize: FONT_SIZE.title,
    fontWeight: '800',
    color: COLORS.danger,
    letterSpacing: -0.5,
    marginTop: 2,
  },
  itemCountBadge: {
    backgroundColor: COLORS.surfaceGhost,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.borderHairline,
  },
  itemCountText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  groupCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  groupSelect: {
    flex: 1,
  },
  removeGroupBtn: {
    marginLeft: SPACING.md,
    marginTop: 34,
  },
  itemRow: {
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  itemIndexText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  inputRow: {
    flexDirection: 'row',
  },
  descriptionCol: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  amountCol: {
    width: 115,
  },
  flushField: {
    marginBottom: 0,
  },
  amountInput: {
    fontWeight: '700',
    color: COLORS.danger,
  },
  subcategorySelect: {
    marginTop: SPACING.sm,
    marginBottom: 0,
  },
  groupFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
  },
  addRowLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addRowText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.primary,
  },
  subtotal: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.text,
  },
  addGroupBtn: {
    marginBottom: SPACING.md,
  },
  submitBtn: {
    marginBottom: SPACING.xxl,
  },
});
