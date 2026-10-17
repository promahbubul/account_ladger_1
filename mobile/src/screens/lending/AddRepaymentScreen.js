import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme';
import { Header } from '../../components/common/Header';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { loansApi } from '../../services/api/loans.api';
import { accountsApi } from '../../services/api/accounts.api';
import { getTodayISO, formatCurrency } from '../../utils/formatters';

export const AddRepaymentScreen = ({ route, navigation }) => {
  const queryClient = useQueryClient();
  const loan = route.params?.loan;

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getTodayISO());
  const [accountId, setAccountId] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const accountsQuery = useQuery({
    queryKey: ['accountsList'],
    queryFn: () => accountsApi.getAccounts(),
  });

  const accounts = accountsQuery.data?.accounts || [];

  React.useEffect(() => {
    if (!accountId && accounts.length > 0) {
      setAccountId(accounts[0].id);
    }
  }, [accounts, accountId]);

  if (!loan) return null;

  const handleRepayment = async () => {
    setError('');
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please provide a valid repayment amount.');
      return;
    }
    if (numAmount > loan.outstandingPrincipal) {
      setError(`Repayment cannot exceed outstanding balance of ${formatCurrency(loan.outstandingPrincipal)}.`);
      return;
    }
    if (!accountId) {
      setError('Please select an account.');
      return;
    }

    setLoading(true);
    try {
      await loansApi.addRepayment(loan.id, {
        amount: numAmount,
        accountId,
        date,
        notes: notes.trim() || undefined,
      });

      queryClient.invalidateQueries({ queryKey: ['loansList'] });
      queryClient.invalidateQueries({ queryKey: ['repaymentsList'] });
      queryClient.invalidateQueries({ queryKey: ['reportsSummary'] });
      queryClient.invalidateQueries({ queryKey: ['accountsList'] });
      queryClient.invalidateQueries({ queryKey: ['accountsOverview'] });

      Alert.alert('Success', 'Repayment recorded successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      setError(err.message || 'Failed to record repayment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Record Repayment" showBack onBack={() => navigation.goBack()} showDateFilter={false} />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Card style={styles.loanOverview}>
          <Text style={styles.person}>{loan.counterpartyName}</Text>
          <Text style={styles.type}>
            {loan.type === 'LENT' ? 'Lent (Receivable)' : 'Borrowed (Payable)'}
          </Text>
          <Text style={styles.outstanding}>
            Outstanding: {formatCurrency(loan.outstandingPrincipal)}
          </Text>
        </Card>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Input
          label="Repayment Amount (BDT) *"
          placeholder="0.00"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          inputStyle={{ fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.success }}
        />

        <Input
          label="Date (YYYY-MM-DD) *"
          placeholder="YYYY-MM-DD"
          value={date}
          onChangeText={setDate}
        />

        <Text style={styles.fieldLabel}>Account *</Text>
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

        <Input
          label="Notes (Optional)"
          placeholder="e.g. Partial cash payment"
          value={notes}
          onChangeText={setNotes}
        />

        <Button
          title="Save Repayment"
          variant="primary"
          onPress={handleRepayment}
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
  loanOverview: {
    marginBottom: SPACING.lg,
  },
  person: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  type: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginVertical: 2,
  },
  outstanding: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 4,
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
