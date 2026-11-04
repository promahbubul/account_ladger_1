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
import { transfersApi } from '../../services/api/transfers.api';
import { accountsApi } from '../../services/api/accounts.api';
import { getTodayISO, parseAmount } from '../../utils/formatters';
import { KeyboardView } from '../../components/common/KeyboardView';

export const CreateTransferScreen = ({ route, navigation }) => {
  const queryClient = useQueryClient();

  const [date, setDate] = useState(getTodayISO());
  const [sourceId, setSourceId] = useState(route.params?.sourceAccountId || '');
  const [destId, setDestId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const accountsQuery = useQuery({
    queryKey: ['accountsList'],
    queryFn: () => accountsApi.getAccounts(),
  });

  const accounts = accountsQuery.data?.accounts || [];

  React.useEffect(() => {
    if (!sourceId && accounts.length > 0) {
      setSourceId(accounts[0].id);
    }
    const firstSource = sourceId || accounts[0]?.id;
    if (!destId) {
      const other = accounts.find((acc) => acc.id !== firstSource);
      if (other) setDestId(other.id);
    }
  }, [accounts, sourceId, destId]);

  const handleTransfer = async () => {
    setError('');
    const numAmount = parseAmount(amount);
    if (numAmount === null) {
      setError('Please provide a valid amount.');
      return;
    }
    if (!sourceId || !destId) {
      setError('Please select both source and destination accounts.');
      return;
    }
    if (sourceId === destId) {
      setError('Source and destination accounts must be different.');
      return;
    }

    setLoading(true);
    try {
      await transfersApi.createTransfer({
        date,
        sourceAccountId: sourceId,
        destinationAccountId: destId,
        amount: numAmount,
        description: description.trim() || undefined,
      });

      queryClient.invalidateQueries({ queryKey: ['transfersList'] });
      queryClient.invalidateQueries({ queryKey: ['accountsList'] });
      queryClient.invalidateQueries({ queryKey: ['accountsOverview'] });
      queryClient.invalidateQueries({ queryKey: ['reportsSummary'] });

      showMessage('Success', 'Transfer recorded successfully.', () => navigation.goBack());
    } catch (err) {
      setError(err.message || 'Transfer failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Transfer Funds" showBack onBack={() => navigation.goBack()} showDateFilter={false} />

      <KeyboardView>
<ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Input
          label="Transfer Amount *"
          placeholder="0.00"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          inputStyle={{ fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.warning }}
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
          label="From (Source Account) *"
          placeholder="Select an account"
          value={sourceId}
          options={accounts.map((acc) => ({ value: acc.id, label: acc.name }))}
          onChange={(id) => {
            setSourceId(id);
            if (id === destId) setDestId('');
          }}
          loading={accountsQuery.isLoading}
          emptyMessage="No accounts found."
        />

        {accountsQuery.isError ? (
          <QueryErrorBanner message="Could not load accounts." onRetry={() => accountsQuery.refetch()} />
        ) : null}
        <Select
          label="To (Destination Account) *"
          placeholder="Select an account"
          value={destId}
          options={accounts.filter((acc) => acc.id !== sourceId).map((acc) => ({ value: acc.id, label: acc.name }))}
          onChange={setDestId}
          loading={accountsQuery.isLoading}
          emptyMessage="No accounts found."
        />

        <Input
          label="Description / Note (Optional)"
          autoCapitalize="sentences"
          placeholder="e.g. ATM cash withdrawal, Bank to bKash"
          value={description}
          onChangeText={setDescription}
        />

        <Button
          title="Complete Transfer"
          variant="primary"
          onPress={handleTransfer}
          loading={loading}
          style={styles.submitBtn}
        />
      </ScrollView>
      </KeyboardView>
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
  submitBtn: {
    marginTop: SPACING.md,
  },
});
