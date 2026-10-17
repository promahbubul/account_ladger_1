import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme';
import { Header } from '../../components/common/Header';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { transactionsApi } from '../../services/api/transactions.api';
import { accountsApi } from '../../services/api/accounts.api';
import { categoriesApi } from '../../services/api/categories.api';
import { getTodayISO } from '../../utils/formatters';

export const AddExpenseScreen = ({ navigation }) => {
  const queryClient = useQueryClient();

  const [date, setDate] = useState(getTodayISO());
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categoryName, setCategoryName] = useState('');
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
  const expenseCategories = (categoriesQuery.data?.categories || []).filter(c => c.type === 'EXPENSE');

  React.useEffect(() => {
    if (!accountId && accounts.length > 0) {
      setAccountId(accounts[0].id);
    }
  }, [accounts, accountId]);

  React.useEffect(() => {
    if (!categoryName && expenseCategories.length > 0) {
      setCategoryName(expenseCategories[0].name);
      setCategoryId(expenseCategories[0].id);
    }
  }, [expenseCategories, categoryName]);

  const handleAdd = async () => {
    setError('');
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please provide a valid amount greater than 0.');
      return;
    }
    if (!accountId) {
      setError('Please select a payment account.');
      return;
    }
    if (!description.trim()) {
      setError('Description is required.');
      return;
    }

    setLoading(true);
    try {
      await transactionsApi.createExpense({
        date,
        amount: numAmount,
        accountId,
        categoryId: categoryId || undefined,
        category: categoryName || 'Other Expense',
        subcategory: subcatName || undefined,
        description: description.trim(),
        reference: reference.trim() || undefined,
      });

      queryClient.invalidateQueries({ queryKey: ['expensesList'] });
      queryClient.invalidateQueries({ queryKey: ['transactionsList'] });
      queryClient.invalidateQueries({ queryKey: ['reportsSummary'] });
      queryClient.invalidateQueries({ queryKey: ['accountsOverview'] });
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
        <Text style={styles.fieldLabel}>Category *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {expenseCategories.map(cat => {
            const isSelected = categoryName === cat.name;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.chip, isSelected && styles.chipActive]}
                onPress={() => {
                  setCategoryName(cat.name);
                  setCategoryId(cat.id);
                }}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>{cat.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Input
          label="Description *"
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
    paddingHorizontal: 12,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.text,
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  submitBtn: {
    marginTop: SPACING.md,
  },
});
