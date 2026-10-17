import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme';
import { Header } from '../../components/common/Header';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { useAuth } from '../../context/AuthContext';
import { userApi } from '../../services/api/reports.api';

export const ProfileScreen = ({ navigation }) => {
  const { user, updateUser } = useAuth();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [currency, setCurrency] = useState(user?.currency || 'BDT');
  const [timezone, setTimezone] = useState(user?.timezone || 'Asia/Dhaka');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSave = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await userApi.updateProfile({
        fullName: fullName.trim() || undefined,
        currency: currency.trim() || undefined,
        timezone: timezone.trim() || undefined,
      });

      if (res.user) {
        await updateUser(res.user);
        setSuccess('Profile updated successfully.');
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
            placeholder="e.g. Mahbubul Alam"
            value={fullName}
            onChangeText={setFullName}
            style={{ marginTop: SPACING.md }}
          />

          <Input
            label="Default Currency (BDT, USD, EUR, GBP)"
            placeholder="BDT"
            value={currency}
            onChangeText={setCurrency}
            autoCapitalize="characters"
          />

          <Input
            label="Timezone"
            placeholder="Asia/Dhaka"
            value={timezone}
            onChangeText={setTimezone}
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
