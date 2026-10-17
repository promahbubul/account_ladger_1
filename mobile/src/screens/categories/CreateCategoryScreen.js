import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme';
import { Header } from '../../components/common/Header';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { categoriesApi } from '../../services/api/categories.api';

export const CreateCategoryScreen = ({ route, navigation }) => {
  const queryClient = useQueryClient();
  const defaultType = route.params?.defaultType || 'EXPENSE';

  const [name, setName] = useState('');
  const [type, setType] = useState(defaultType); // EXPENSE | INCOME
  const [subcategories, setSubcategories] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    setError('');
    if (!name.trim()) {
      setError('Category name is required.');
      return;
    }

    const subcats = subcategories
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    setLoading(true);
    try {
      await categoriesApi.createCategory({
        name: name.trim(),
        type,
        subcategories: subcats.length > 0 ? subcats : undefined,
      });

      queryClient.invalidateQueries({ queryKey: ['categoriesList'] });
      navigation.goBack();
    } catch (err) {
      setError(err.message || 'Failed to create category.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="New Category" showBack onBack={() => navigation.goBack()} showDateFilter={false} />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Text style={styles.fieldLabel}>Type</Text>
        <View style={styles.typeSelector}>
          <TouchableOpacity
            style={[styles.typeOption, type === 'EXPENSE' && styles.typeOptionActive]}
            onPress={() => setType('EXPENSE')}
          >
            <Text style={[styles.typeOptionText, type === 'EXPENSE' && styles.typeOptionTextActive]}>
              Expense
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeOption, type === 'INCOME' && styles.typeOptionActive]}
            onPress={() => setType('INCOME')}
          >
            <Text style={[styles.typeOptionText, type === 'INCOME' && styles.typeOptionTextActive]}>
              Income
            </Text>
          </TouchableOpacity>
        </View>

        <Input
          label="Category Name *"
          placeholder="e.g. Health & Fitness"
          value={name}
          onChangeText={setName}
        />

        <Input
          label="Subcategories (Comma-separated, optional)"
          placeholder="e.g. Gym, Medicine, Doctor"
          value={subcategories}
          onChangeText={setSubcategories}
        />

        <Button
          title="Save Category"
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
