import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme';
import { Header } from '../../components/common/Header';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { loansApi } from '../../services/api/loans.api';
import { accountsApi } from '../../services/api/accounts.api';
import { getTodayISO } from '../../utils/formatters';

export const CreateLoanScreen = ({ navigation }) => {
  const queryClient = useQueryClient();

  const [type, setType] = useState('LENT'); // LENT | BORROWED
  const [counterparty, setCounterparty] = useState('');
  const [contact, setContact] = useState('');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [startDate, setStartDate] = useState(getTodayISO());
  const [dueDate, setDueDate] = useState('');
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

  const handleCreate = async () => {
    setError('');
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please provide a valid principal amount.');
      return;
    }
    if (!counterparty.trim()) {
      setError('Person / Party name is required.');
      return;
    }
    if (!accountId) {
      setError('Please select an account for disbursement/receipt.');
      return;
    }

    setLoading(true);
    try {
      await loansApi.createLoan({
        type,
        counterpartyName: counterparty.trim(),
        counterpartyContact: contact.trim() || undefined,
        principalAmount: numAmount,
        accountId,
        startDate,
        dueDate: dueDate.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      queryClient.invalidateQueries({ queryKey: ['loansList'] });
      queryClient.invalidateQueries({ queryKey: ['reportsSummary'] });
      queryClient.invalidateQueries({ queryKey: ['accountsList'] });
      queryClient.invalidateQueries({ queryKey: ['accountsOverview'] });

      Alert.alert('Success', 'Loan record created successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      setError(err.message || 'Failed to create loan.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="New Loan Record" showBack onBack={() => navigation.goBack()} showDateFilter={false} />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Text style={styles.fieldLabel}>Loan Type</Text>
        <View style={styles.typeSelector}>
          <TouchableOpacity
            style={[styles.typeOption, type === 'LENT' && styles.typeOptionLent]}
            onPress={() => setType('LENT')}
          >
            <Text style={[styles.typeOptionText, type === 'LENT' && styles.typeOptionTextActive]}>
              I Lent Money (Receivable)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeOption, type === 'BORROWED' && styles.typeOptionBorrowed]}
            onPress={() => setType('BORROWED')}
          >
            <Text style={[styles.typeOptionText, type === 'BORROWED' && styles.typeOptionTextActive]}>
              I Borrowed (Payable)
            </Text>
          </TouchableOpacity>
        </View>

        <Input
          label="Principal Amount (BDT) *"
          placeholder="0.00"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          inputStyle={{ fontSize: FONT_SIZE.xl, fontWeight: '700' }}
        />

        <Input
          label="Person / Party Name *"
          placeholder="e.g. Rafiq Ahmed"
          value={counterparty}
          onChangeText={setCounterparty}
        />

        <Input
          label="Phone or Email (Optional)"
          placeholder="e.g. 01700..."
          value={contact}
          onChangeText={setContact}
        />

        <Text style={styles.fieldLabel}>
          {type === 'LENT' ? 'Disbursing Account (Money out from)' : 'Receiving Account (Money into)'} *
        </Text>
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
          label="Start Date (YYYY-MM-DD) *"
          placeholder="YYYY-MM-DD"
          value={startDate}
          onChangeText={setStartDate}
        />

        <Input
          label="Due Date (Optional)"
          placeholder="YYYY-MM-DD"
          value={dueDate}
          onChangeText={setDueDate}
        />

        <Input
          label="Notes (Optional)"
          placeholder="e.g. Emergency loan, promised return by next month"
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        <Button
          title="Create Loan"
          onPress={handleCreate}
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
  typeSelector: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 3,
    marginBottom: SPACING.lg,
  },
  typeOption: {
    flex: 1,
    paddingVertical: SPACING.sm + 2,
    alignItems: 'center',
    borderRadius: RADIUS.sm,
  },
  typeOptionLent: {
    backgroundColor: COLORS.primary,
  },
  typeOptionBorrowed: {
    backgroundColor: COLORS.warning,
  },
  typeOptionText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  typeOptionTextActive: {
    color: '#FFF',
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
