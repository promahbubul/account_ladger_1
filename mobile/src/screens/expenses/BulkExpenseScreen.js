import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme';
import { Header } from '../../components/common/Header';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { transactionsApi } from '../../services/api/transactions.api';
import { accountsApi } from '../../services/api/accounts.api';
import { categoriesApi } from '../../services/api/categories.api';
import { getTodayISO, formatCurrency } from '../../utils/formatters';

export const BulkExpenseScreen = ({ navigation }) => {
  const queryClient = useQueryClient();

  const [date, setDate] = useState(getTodayISO());
  const [accountId, setAccountId] = useState('');
  const [items, setItems] = useState([
    { id: '1', category: 'Food & Dining', description: 'Lunch', amount: '150' },
    { id: '2', category: 'Transportation', description: 'Commute', amount: '60' },
    { id: '3', category: 'Housing & Utilities', description: 'Mobile Recharge', amount: '100' },
  ]);
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

  const updateItem = (id, field, value) => {
    setItems(items.map(it => it.id === id ? { ...it, [field]: value } : it));
  };

  const addItem = () => {
    const defaultCat = expenseCategories[0]?.name || 'Daily Expense';
    setItems([...items, { id: String(Date.now()), category: defaultCat, description: '', amount: '' }]);
  };

  const removeItem = (id) => {
    if (items.length <= 1) return;
    setItems(items.filter(it => it.id !== id));
  };

  const totalSum = items.reduce((sum, it) => sum + (parseFloat(it.amount) || 0), 0);

  const handleSubmit = async () => {
    setError('');
    if (!accountId) {
      setError('Please select an account.');
      return;
    }

    const validItems = items
      .map(it => ({
        category: it.category,
        description: it.description.trim() || `${it.category} Expense`,
        amount: parseFloat(it.amount) || 0,
      }))
      .filter(it => it.amount > 0);

    if (validItems.length === 0) {
      setError('Please provide at least one item with a valid amount.');
      return;
    }

    setLoading(true);
    try {
      await transactionsApi.createBulkExpense({
        date,
        accountId,
        items: validItems,
      });

      queryClient.invalidateQueries({ queryKey: ['expensesList'] });
      queryClient.invalidateQueries({ queryKey: ['transactionsList'] });
      queryClient.invalidateQueries({ queryKey: ['reportsSummary'] });
      queryClient.invalidateQueries({ queryKey: ['accountsOverview'] });
      queryClient.invalidateQueries({ queryKey: ['recentTransactions'] });

      Alert.alert(
        'Success',
        `Recorded ${validItems.length} expenses successfully! Total: ${formatCurrency(totalSum)}`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      setError(err.message || 'Failed to record daily bulk expenses.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Daily Bulk Expenses" showBack onBack={() => navigation.goBack()} showDateFilter={false} />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.metaRow}>
          <View style={{ flex: 1, marginRight: SPACING.sm }}>
            <Input
              label="Date"
              value={date}
              onChangeText={setDate}
              style={{ marginBottom: 0 }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Account</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
              {accounts.map(acc => {
                const isSelected = accountId === acc.id;
                return (
                  <TouchableOpacity
                    key={acc.id}
                    style={[styles.smallChip, isSelected && styles.smallChipActive]}
                    onPress={() => setAccountId(acc.id)}
                  >
                    <Text style={[styles.smallChipText, isSelected && styles.smallChipTextActive]}>{acc.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>

        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>Total Items: {items.length}</Text>
          <Text style={styles.summaryTotal}>Total: {formatCurrency(totalSum)}</Text>
        </View>

        <Text style={styles.sectionHeading}>Items</Text>

        {items.map((it, idx) => (
          <Card key={it.id} style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemNum}>#{idx + 1}</Text>
              {items.length > 1 ? (
                <TouchableOpacity onPress={() => removeItem(it.id)}>
                  <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.inputRow}>
              <View style={{ flex: 1, marginRight: SPACING.sm }}>
                <Input
                  label="Category"
                  value={it.category}
                  onChangeText={(val) => updateItem(it.id, 'category', val)}
                  style={{ marginBottom: 0 }}
                />
              </View>
              <View style={{ width: 120 }}>
                <Input
                  label="Amount (BDT) *"
                  placeholder="0.00"
                  value={it.amount}
                  onChangeText={(val) => updateItem(it.id, 'amount', val)}
                  keyboardType="numeric"
                  style={{ marginBottom: 0 }}
                  inputStyle={{ fontWeight: '700', color: COLORS.danger }}
                />
              </View>
            </View>

            <Input
              label="Description (Optional)"
              placeholder="e.g. Lunch"
              value={it.description}
              onChangeText={(val) => updateItem(it.id, 'description', val)}
              style={{ marginTop: SPACING.sm, marginBottom: 0 }}
            />
          </Card>
        ))}

        <Button
          title="Add Row"
          variant="secondary"
          icon={<Ionicons name="add" size={16} color={COLORS.text} />}
          onPress={addItem}
          style={styles.addRowBtn}
        />

        <Button
          title={`Submit All (${formatCurrency(totalSum)})`}
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  fieldLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  smallChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  smallChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  smallChipText: {
    fontSize: FONT_SIZE.xs - 1,
    color: COLORS.text,
  },
  smallChipTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  summaryBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceElevated,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.lg,
  },
  summaryLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  summaryTotal: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.danger,
  },
  sectionHeading: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  itemCard: {
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  itemNum: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  inputRow: {
    flexDirection: 'row',
  },
  addRowBtn: {
    marginVertical: SPACING.md,
  },
  submitBtn: {
    marginBottom: SPACING.xxl,
  },
});
