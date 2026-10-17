import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { transactionsApi } from '../../services/api/transactions.api';

export const TransactionDetailScreen = ({ route, navigation }) => {
  const queryClient = useQueryClient();
  const tx = route.params?.transaction;

  const [deleteVisible, setDeleteVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!tx) return null;

  const isIncome = tx.type === 'INCOME';
  const isExpense = tx.type === 'EXPENSE';
  const amountColor = isIncome ? COLORS.success : isExpense ? COLORS.danger : COLORS.warning;

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
      Alert.alert('Error', err.message || 'Failed to delete transaction.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Transaction Details" showBack onBack={() => navigation.goBack()} showDateFilter={false} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={styles.heroCard}>
          <Badge
            label={tx.type}
            variant={isIncome ? 'success' : isExpense ? 'danger' : 'warning'}
            style={{ marginBottom: SPACING.sm }}
          />

          <Text style={[styles.amountHero, { color: amountColor }]}>
            {isIncome ? '+' : isExpense ? '-' : ''}{formatCurrency(tx.amount)}
          </Text>

          <Text style={styles.descHero}>{tx.description || tx.category || 'Transaction'}</Text>
        </Card>

        <Card>
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
        </Card>

        <Button
          title="Delete Transaction"
          variant="danger"
          onPress={() => setDeleteVisible(true)}
          style={{ marginTop: SPACING.md }}
        />
      </ScrollView>

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
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  heroCard: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    marginBottom: SPACING.md,
  },
  amountHero: {
    fontSize: FONT_SIZE.title + 4,
    fontWeight: '800',
    marginBottom: 4,
  },
  descHero: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
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
});
