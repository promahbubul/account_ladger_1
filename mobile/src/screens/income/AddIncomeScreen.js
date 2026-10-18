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

export const AddIncomeScreen = ({ navigation }) => {
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
  const incomeCategories = (categoriesQuery.data?.categories || []).filter(c => c.type === 'INCOME');

  // Set default account and category when loaded
  React.useEffect(() => {
    if (!accountId && accounts.length > 0) {
      setAccountId(accounts[0].id);
    }
  }, [accounts, accountId]);

  React.useEffect(() => {
    if (!categoryName && incomeCategories.length > 0) {
      setCategoryName(incomeCategories[0].name);
      setCategoryId(incomeCategories[0].id);
    }
  }, [incomeCategories, categoryName]);

  const handleAdd = async () => {
    if (loading) return;
    setError('');
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please provide a valid amount greater than 0.');
      return;
    }
    if (!accountId) {
      setError('Please select a destination account.');
      return;
    }
    if (!date.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      setError('Please provide a valid date in YYYY-MM-DD format.');
      return;
    }

    const finalDescription = description.trim() || (categoryName ? `${categoryName} Income` : 'Income');

    setLoading(true);
    try {
      await transactionsApi.createIncome({
        date: date.trim(),
        amount: numAmount,
        accountId,
        categoryId: categoryId || undefined,
        category: categoryName || 'Other Income',
        subcategory: subcatName || undefined,
        description: finalDescription,
        reference: reference.trim() || undefined,
      });

      queryClient.invalidateQueries({ queryKey: ['incomeList'] });
      queryClient.invalidateQueries({ queryKey: ['transactionsList'] });
      queryClient.invalidateQueries({ queryKey: ['reportsSummary'] });
      queryClient.invalidateQueries({ queryKey: ['accountsOverview'] });
      queryClient.invalidateQueries({ queryKey: ['accountsList'] });
      queryClient.invalidateQueries({ queryKey: ['recentTransactions'] });

      navigation.goBack();
    } catch (err) {
      setError(err.message || 'Failed to record income.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Add Income" showBack onBack={() => navigation.goBack()} showDateFilter={false} />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Input
          label="Amount (BDT) *"
          placeholder="0.00"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          inputStyle={{ fontSize: FONT_SIZE.xl, fontWeight: '700' }}
        />

        <Input
          label="Date (YYYY-MM-DD) *"
          placeholder="YYYY-MM-DD"
          value={date}
          onChangeText={setDate}
        />

        {/* Account Selector */}
        <Text style={styles.fieldLabel}>Destination Account *</Text>
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
          {incomeCategories.map(cat => {
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
          label="Description (Optional)"
          placeholder="e.g. Monthly Salary, Freelance project"
          value={description}
          onChangeText={setDescription}
        />

        <Input
          label="Reference / Invoice # (Optional)"
          placeholder="e.g. INV-1002"
          value={reference}
          onChangeText={setReference}
        />

        <Button
          title="Save Income"
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
