import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme';
import { Header } from '../../components/common/Header';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Select } from '../../components/common/Select';
import { transactionsApi } from '../../services/api/transactions.api';
import { accountsApi } from '../../services/api/accounts.api';
import { categoriesApi } from '../../services/api/categories.api';
import { getTodayISO, parseAmount, isValidISODate } from '../../utils/formatters';
import { getSelectableCategories } from '../../utils/categories';

export const AddExpenseScreen = ({ navigation }) => {
  const queryClient = useQueryClient();

  const [date, setDate] = useState(getTodayISO());
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subcatName, setSubcatName] = useState('');
  const [accountId, setAccountId] = useState('');
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
  const selectedCategory = expenseCategories.find(c => c.id === categoryId);

  React.useEffect(() => {
    if (!accountId && accounts.length > 0) {
      setAccountId(accounts[0].id);
    }
  }, [accounts, accountId]);

  const handleAdd = async () => {
    if (loading) return;
    setError('');
    const numAmount = parseAmount(amount);
    if (numAmount === null) {
      setError('Please provide a valid amount greater than 0.');
      return;
    }
    if (!accountId) {
      setError('Please select a payment account.');
      return;
    }
    if (!selectedCategory) {
      setError('Please select a category.');
      return;
    }
    if (!isValidISODate(date.trim())) {
      setError('Please provide a valid date in YYYY-MM-DD format.');
      return;
    }

    const finalDescription = description.trim() || `${selectedCategory.name} Expense`;

    setLoading(true);
    try {
      await transactionsApi.createExpense({
        date: date.trim(),
        amount: numAmount,
        accountId,
        categoryId: selectedCategory.id,
        category: selectedCategory.name,
        subcategory: subcatName || undefined,
        description: finalDescription,
        reference: reference.trim() || undefined,
      });

      queryClient.invalidateQueries({ queryKey: ['expensesList'] });
      queryClient.invalidateQueries({ queryKey: ['transactionsList'] });
      queryClient.invalidateQueries({ queryKey: ['reportsSummary'] });
      queryClient.invalidateQueries({ queryKey: ['accountsOverview'] });
      queryClient.invalidateQueries({ queryKey: ['accountsList'] });
      queryClient.invalidateQueries({ queryKey: ['recentTransactions'] });

      navigation.goBack();
    } catch (err) {
      setError(err.message || 'Failed to record expense.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Add Expense" showBack onBack={() => navigation.goBack()} showDateFilter={false} />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity style={styles.multipleLink} onPress={() => navigation.replace('BulkExpense')}>
          <Ionicons name="layers-outline" size={16} color={COLORS.primary} />
          <Text style={styles.multipleLinkText}>Add multiple expenses by category</Text>
        </TouchableOpacity>

        <Input
          label="Amount (BDT) *"
          placeholder="0.00"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          inputStyle={{ fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.danger }}
        />

        <Input
          label="Date (YYYY-MM-DD) *"
          placeholder="YYYY-MM-DD"
          value={date}
          onChangeText={setDate}
        />

        {/* Account Selector */}
        <Text style={styles.fieldLabel}>Payment Account *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {accounts.map(acc => {
            const isSelected = accountId === acc.id;
            return (
              <TouchableOpacity
                key={acc.id}
                style={[styles.chip, isSelected && styles.chipActive]}
                onPress={() => setAccountId(acc.id)}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>{acc.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Category Selector */}
        {categoriesQuery.isError ? (
          <TouchableOpacity onPress={() => categoriesQuery.refetch()}>
            <Text style={styles.errorText}>Could not load categories. Tap to retry.</Text>
          </TouchableOpacity>
        ) : null}
        <Select
          label="Category *"
          placeholder="Select a category"
          value={categoryId}
          options={expenseCategories.map(cat => ({ value: cat.id, label: cat.name }))}
          onChange={(id) => {
            setCategoryId(id);
            setSubcatName('');
          }}
          loading={categoriesQuery.isLoading}
          emptyMessage="No expense categories found. Add one in Settings."
        />

        {selectedCategory?.subcategories?.length > 0 ? (
          <Select
            label="Subcategory"
            placeholder="Optional"
            value={subcatName}
            options={selectedCategory.subcategories.map(name => ({ value: name, label: name }))}
            onChange={setSubcatName}
            allowClear
          />
        ) : null}

        <Input
          label="Description (Optional)"
          placeholder="e.g. Lunch, Groceries, Electricity bill"
          value={description}
          onChangeText={setDescription}
        />

        <Input
          label="Reference (Optional)"
          placeholder="e.g. Receipt #123"
          value={reference}
          onChangeText={setReference}
        />

        <Button
          title="Save Expense"
          variant="danger"
          onPress={handleAdd}
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
  multipleLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.lg,
  },
  multipleLinkText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.primary,
  },
  fieldLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  chipsRow: {
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    backgroundColor: COLORS.surfaceGhost,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.borderHairline,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  submitBtn: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.xxl,
  },
});
