import React, { useState, useCallback } from 'react';
import { showMessage } from '../../utils/notify';
import { View, Text, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, RADIUS, themedStyles } from '../../constants/theme';
import { Header } from '../../components/common/Header';
import { Select } from '../../components/common/Select';
import { QueryErrorState } from '../../components/common/QueryStates';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { budgetsApi } from '../../services/api/budgets.api';
import { categoriesApi } from '../../services/api/categories.api';
import { formatCurrency, parseAmount } from '../../utils/formatters';

export const BudgetsScreen = ({ navigation }) => {
  const queryClient = useQueryClient();

  const [selectedCategory, setSelectedCategory] = useState('');
  const [limit, setLimit] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const budgetsQuery = useQuery({
    queryKey: ['budgetsList'],
    queryFn: () => budgetsApi.getBudgets(),
  });

  const categoriesQuery = useQuery({
    queryKey: ['categoriesList'],
    queryFn: () => categoriesApi.getCategories(),
  });

  const onRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['budgetsList'] });
  }, [queryClient]);

  const budgets = budgetsQuery.data?.budgets || [];
  const expenseCategories = (categoriesQuery.data?.categories || []).filter(c => c.type === 'EXPENSE');

  const handleSetBudget = async () => {
    setError('');
    const numLimit = parseAmount(limit);
    if (!selectedCategory) {
      setError('Please select an expense category.');
      return;
    }
    if (numLimit === null) {
      setError('Please provide a valid monthly budget limit.');
      return;
    }

    setLoading(true);
    try {
      await budgetsApi.setBudget(selectedCategory, numLimit);
      queryClient.invalidateQueries({ queryKey: ['budgetsList'] });
      setLimit('');
      setSelectedCategory('');
    } catch (err) {
      setError(err.message || 'Failed to save budget.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBudget = async (categoryName) => {
    try {
      await budgetsApi.deleteBudget(categoryName);
      queryClient.invalidateQueries({ queryKey: ['budgetsList'] });
    } catch (err) {
      showMessage('Error', err.message || 'Failed to remove budget.');
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Category Budgets" showBack onBack={() => navigation.goBack()} showDateFilter={false} />

      <FlatList
        data={budgets}
        keyExtractor={(item) => item.categoryName}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={budgetsQuery.isRefetching}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
        ListHeaderComponent={
          <Card style={styles.addCard}>
            <Text style={styles.addTitle}>Set Monthly Budget</Text>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Select
              label="Category *"
              placeholder="Select a category"
              value={selectedCategory}
              options={expenseCategories.map((c) => ({ value: c.name, label: c.name }))}
              onChange={setSelectedCategory}
              loading={categoriesQuery.isLoading}
              emptyMessage="No expense categories found."
            />

            <Input
              label="Monthly Limit *"
              placeholder="e.g. 5000"
              value={limit}
              onChangeText={setLimit}
              keyboardType="numeric"
            />

            <Button
              title="Save Monthly Budget"
              onPress={handleSetBudget}
              loading={loading}
            />
          </Card>
        }
        renderItem={({ item }) => (
          <View style={styles.budgetRow}>
            <View>
              <Text style={styles.budgetName}>{item.categoryName}</Text>
              <Text style={styles.budgetLimit}>Limit: {formatCurrency(item.monthlyLimit)} / month</Text>
            </View>
            <TouchableOpacity onPress={() => handleDeleteBudget(item.categoryName)}>
              <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          budgetsQuery.isLoading ? (
            <LoadingSpinner message="Loading budgets..." />
          ) : budgetsQuery.isError ? (
            <QueryErrorState title="Could not load budgets" onRetry={() => budgetsQuery.refetch()} />
          ) : (
            <EmptyState
              icon="pie-chart-outline"
              title="No budgets configured"
            />
          )
        }
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
  },
  addCard: {
    marginBottom: SPACING.lg,
  },
  addTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: FONT_SIZE.xs,
    marginBottom: SPACING.sm,
  },
  budgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  budgetName: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.text,
  },
  budgetLimit: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
}));
