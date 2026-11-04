import React, { useState } from 'react';
import { showMessage } from '../../utils/notify';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { COLORS, SPACING, FONT_SIZE } from '../../constants/theme';
import { Header } from '../../components/common/Header';
import { DateField } from '../../components/common/DateField';
import { Select } from '../../components/common/Select';
import { QueryErrorBanner } from '../../components/common/QueryStates';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { loansApi } from '../../services/api/loans.api';
import { accountsApi } from '../../services/api/accounts.api';
import { getTodayISO, formatCurrency, parseAmount } from '../../utils/formatters';

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
    const numAmount = parseAmount(amount);
    if (numAmount === null) {
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

      showMessage('Success', 'Repayment recorded successfully.', () => navigation.goBack());
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
          label="Repayment Amount *"
          placeholder="0.00"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          inputStyle={{ fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.success }}
        />

        <DateField
          label="Date *"
          value={date}
          onChange={setDate}
        />

        {accountsQuery.isError ? (
          <QueryErrorBanner message="Could not load accounts." onRetry={() => accountsQuery.refetch()} />
        ) : null}
        <Select
          label="Account *"
          placeholder="Select an account"
          value={accountId}
          options={accounts.map((acc) => ({ value: acc.id, label: acc.name }))}
          onChange={setAccountId}
          loading={accountsQuery.isLoading}
          emptyMessage="No accounts found."
        />

        <Input
          label="Notes (Optional)"
          autoCapitalize="sentences"
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
  submitBtn: {
    marginTop: SPACING.md,
  },
});
