import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme';
import { Header } from '../../components/common/Header';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { accountsApi } from '../../services/api/accounts.api';

export const CreateAccountScreen = ({ navigation }) => {
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [type, setType] = useState('BANK'); // BANK | CASH | MOBILE_BANKING
  const [providerName, setProviderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const accountTypes = [
    { id: 'BANK', label: 'Bank' },
    { id: 'CASH', label: 'Cash' },
    { id: 'MOBILE_BANKING', label: 'Mobile Banking' },
  ];

  const handleCreate = async () => {
    setError('');
    if (!name.trim()) {
      setError('Account name is required.');
      return;
    }

    setLoading(true);
    try {
      await accountsApi.createAccount({
        name: name.trim(),
        type,
        providerName: providerName.trim() || undefined,
        accountNumber: accountNumber.trim() || undefined,
        openingBalance: parseFloat(openingBalance) || 0,
      });

      queryClient.invalidateQueries({ queryKey: ['accountsList'] });
      queryClient.invalidateQueries({ queryKey: ['accountsOverview'] });
      queryClient.invalidateQueries({ queryKey: ['reportsSummary'] });

      navigation.goBack();
    } catch (err) {
      setError(err.message || 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="New Account" showBack onBack={() => navigation.goBack()} showDateFilter={false} />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Text style={styles.typeLabel}>Account Type</Text>
        <View style={styles.typeSelector}>
          {accountTypes.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={[styles.typeOption, type === t.id && styles.typeOptionActive]}
              onPress={() => setType(t.id)}
            >
              <Text style={[styles.typeOptionText, type === t.id && styles.typeOptionTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Input
          label="Account Name *"
          placeholder="e.g. Brac Bank Salary A/C"
          value={name}
          onChangeText={setName}
        />

        {type !== 'CASH' ? (
          <>
            <Input
              label="Provider / Bank Name"
              placeholder={type === 'BANK' ? 'e.g. Brac Bank' : 'e.g. bKash / Nagad'}
              value={providerName}
              onChangeText={setProviderName}
            />

            <Input
              label="Account / Phone Number (Optional)"
              placeholder="e.g. 150120..."
              value={accountNumber}
              onChangeText={setAccountNumber}
              keyboardType="number-pad"
            />
          </>
        ) : null}

        <Input
          label="Opening Balance (BDT)"
          placeholder="0.00"
          value={openingBalance}
          onChangeText={setOpeningBalance}
          keyboardType="numeric"
        />

        <Button
          title="Create Account"
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
  typeLabel: {
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
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderRadius: RADIUS.sm,
  },
  typeOptionActive: {
    backgroundColor: COLORS.primary,
  },
  typeOptionText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  typeOptionTextActive: {
    color: '#FFF',
  },
  submitBtn: {
    marginTop: SPACING.md,
  },
});
