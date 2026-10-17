import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme';
import { Header } from '../../components/common/Header';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { budgetsApi } from '../../services/api/budgets.api';
import { categoriesApi } from '../../services/api/categories.api';
import { formatCurrency } from '../../utils/formatters';

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
    const numLimit = parseFloat(limit);
    if (!selectedCategory) {
      setError('Please select an expense category.');
      return;
    }
    if (isNaN(numLimit) || numLimit < 0) {
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
      Alert.alert('Error', err.message || 'Failed to remove budget.');
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

            <Text style={styles.fieldLabel}>Select Category</Text>
            <View style={styles.chipGrid}>
              {expenseCategories.map((c) => {
                const isSelected = selectedCategory === c.name;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.catChip, isSelected && styles.catChipActive]}
                    onPress={() => setSelectedCategory(c.name)}
                  >
                    <Text style={[styles.catChipText, isSelected && styles.catChipTextActive]}>
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Input
              label="Monthly Limit (BDT) *"
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
          ) : (
            <EmptyState
              icon="pie-chart-outline"
              title="No budgets configured"
              description="Set monthly spending limits for categories above to stay in control."
            />
          )
        }
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
  fieldLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: SPACING.md,
  },
  catChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  catChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  catChipText: {
    fontSize: FONT_SIZE.xs - 1,
    color: COLORS.textSecondary,
  },
  catChipTextActive: {
    color: '#FFF',
    fontWeight: '600',
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
});
