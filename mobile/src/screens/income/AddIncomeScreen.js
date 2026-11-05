import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { COLORS, SPACING, FONT_SIZE, themedStyles } from '../../constants/theme';
import { Header } from '../../components/common/Header';
import { DateField } from '../../components/common/DateField';
import { Select } from '../../components/common/Select';
import { getSelectableCategories } from '../../utils/categories';
import { QueryErrorBanner } from '../../components/common/QueryStates';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { transactionsApi } from '../../services/api/transactions.api';
import { accountsApi } from '../../services/api/accounts.api';
import { categoriesApi } from '../../services/api/categories.api';
import { getTodayISO, isValidISODate, parseAmount } from '../../utils/formatters';
import { KeyboardView } from '../../components/common/KeyboardView';

export const AddIncomeScreen = ({ navigation }) => {
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
  const incomeCategories = useMemo(
    () => getSelectableCategories(categoriesQuery.data?.categories, 'INCOME'),
    [categoriesQuery.data]
  );
  const selectedCategory = incomeCategories.find(c => c.id === categoryId);

  // Set default account and category when loaded
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
      setError('Please select a destination account.');
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

    const finalDescription = description.trim() || `${selectedCategory.name} Income`;

    setLoading(true);
    try {
      await transactionsApi.createIncome({
        date: date.trim(),
        amount: numAmount,
        accountId,
        categoryId: selectedCategory.id,
        category: selectedCategory.name,
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

      <KeyboardView>
<ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Input
          label="Amount *"
          placeholder="0.00"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          inputStyle={{ fontSize: FONT_SIZE.xl, fontWeight: '700' }}
        />

        <DateField
          label="Date *"
          value={date}
          onChange={setDate}
        />

        {/* Account Selector */}
        {accountsQuery.isError ? (
          <QueryErrorBanner message="Could not load accounts." onRetry={() => accountsQuery.refetch()} />
        ) : null}
        <Select
          label="Destination Account *"
          placeholder="Select an account"
          value={accountId}
          options={accounts.map((acc) => ({ value: acc.id, label: acc.name }))}
          onChange={setAccountId}
          loading={accountsQuery.isLoading}
          emptyMessage="No accounts found."
        />

        {/* Category Selector */}
        {categoriesQuery.isError ? (
          <QueryErrorBanner message="Could not load categories." onRetry={() => categoriesQuery.refetch()} />
        ) : null}
        <Select
          label="Category *"
          placeholder="Select a category"
          value={categoryId}
          options={incomeCategories.map((cat) => ({ value: cat.id, label: cat.name }))}
          onChange={(id) => {
            setCategoryId(id);
            setSubcatName('');
          }}
          loading={categoriesQuery.isLoading}
          emptyMessage="No income categories found. Add one in Settings."
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
          autoCapitalize="sentences"
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
      </KeyboardView>
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
  submitBtn: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.xxl,
  },
}));
