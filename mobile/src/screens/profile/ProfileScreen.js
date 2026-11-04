import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme';
import { Header } from '../../components/common/Header';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Select } from '../../components/common/Select';
import { CURRENCIES, TIMEZONES } from '../../constants/preferences';
import { showMessage } from '../../utils/notify';
import { Card } from '../../components/common/Card';
import { useAuth } from '../../context/AuthContext';
import { userApi } from '../../services/api/user.api';

const CURRENCY_OPTIONS = CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} (${c.symbol}) - ${c.name}` }));

export const ProfileScreen = ({ navigation }) => {
  const { user, updateUser } = useAuth();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [currency, setCurrency] = useState(user?.currency || 'BDT');
  const [timezone, setTimezone] = useState(user?.timezone || 'Asia/Dhaka');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Keeps a timezone saved before this list existed selectable.
  const timezoneOptions = TIMEZONES.some((t) => t.value === timezone)
    ? TIMEZONES
    : [{ value: timezone, label: timezone }, ...TIMEZONES];

  const handleSave = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await userApi.updateProfile({
        fullName: fullName.trim(),
        currency,
        timezone,
      });

      if (res.user) {
        const currencyChanged = res.user.currency !== user?.currency;
        await updateUser(res.user);
        setSuccess('Profile updated successfully.');
        // A new currency redraws every screen, which also clears the message above.
        if (currencyChanged) showMessage('Profile Updated', `Amounts now show in ${res.user.currency}.`);
      }
    } catch (err) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Profile & Preferences" showBack onBack={() => navigation.goBack()} showDateFilter={false} />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {success ? <Text style={styles.successText}>{success}</Text> : null}

        <Card>
          <Text style={styles.label}>Email Address (Read-only)</Text>
          <Text style={styles.readonlyValue}>{user?.email}</Text>

          <Text style={styles.label}>Username (Read-only)</Text>
          <Text style={styles.readonlyValue}>@{user?.username}</Text>

          <Input
            label="Full Name"
            autoCapitalize="words"
            placeholder="e.g. Mahbubul Alam"
            value={fullName}
            onChangeText={setFullName}
            style={{ marginTop: SPACING.md }}
          />

          <Select
            label="Currency"
            value={currency}
            options={CURRENCY_OPTIONS}
            onChange={setCurrency}
          />
          <Text style={styles.hint}>Changes the symbol shown. Amounts are not converted.</Text>

          <Select
            label="Timezone"
            value={timezone}
            options={timezoneOptions}
            onChange={setTimezone}
          />

          <Button
            title="Save Changes"
            onPress={handleSave}
            loading={loading}
            style={{ marginTop: SPACING.md }}
          />
        </Card>
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
  hint: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: -SPACING.sm,
    marginBottom: SPACING.md,
  },
  successText: {
    color: COLORS.success,
    fontSize: FONT_SIZE.xs,
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginBottom: 2,
    marginTop: SPACING.sm,
  },
  readonlyValue: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
    backgroundColor: COLORS.surfaceElevated,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
});
