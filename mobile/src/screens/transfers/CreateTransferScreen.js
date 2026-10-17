import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme';
import { Header } from '../../components/common/Header';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { transfersApi } from '../../services/api/transfers.api';
import { accountsApi } from '../../services/api/accounts.api';
import { getTodayISO } from '../../utils/formatters';

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
    if (!destId && accounts.length > 1) {
      setDestId(accounts[1].id);
    }
  }, [accounts, sourceId, destId]);

  const handleTransfer = async () => {
    setError('');
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
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

      Alert.alert('Success', 'Transfer recorded successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      setError(err.message || 'Transfer failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Transfer Funds" showBack onBack={() => navigation.goBack()} showDateFilter={false} />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Input
          label="Transfer Amount (BDT) *"
          placeholder="0.00"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          inputStyle={{ fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.warning }}
        />

        <Input
          label="Date (YYYY-MM-DD) *"
          placeholder="YYYY-MM-DD"
          value={date}
          onChangeText={setDate}
        />

        <Text style={styles.fieldLabel}>From (Source Account) *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {accounts.map(acc => {
            const isSelected = sourceId === acc.id;
            return (
              <TouchableOpacity
                key={acc.id}
                style={[styles.chip, isSelected && styles.chipActive]}
                onPress={() => setSourceId(acc.id)}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>{acc.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={styles.fieldLabel}>To (Destination Account) *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {accounts.map(acc => {
            const isSelected = destId === acc.id;
            return (
              <TouchableOpacity
                key={acc.id}
                style={[styles.chip, isSelected && styles.chipActiveDest]}
                onPress={() => setDestId(acc.id)}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>{acc.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Input
          label="Description / Note (Optional)"
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
    backgroundColor: COLORS.danger,
    borderColor: COLORS.danger,
  },
  chipActiveDest: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
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
