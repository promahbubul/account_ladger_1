import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
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
  const [subcategories, setSubcategories] = useState([]);
  const [subcategoryText, setSubcategoryText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Commas still split, so a pasted list works too. Duplicates are dropped ignoring case.
  const withPendingSubcategory = () => {
    const merged = [...subcategories];
    for (const name of subcategoryText.split(',').map((s) => s.trim()).filter(Boolean)) {
      if (!merged.some((existing) => existing.toLowerCase() === name.toLowerCase())) merged.push(name);
    }
    return merged;
  };

  const addSubcategory = () => {
    setSubcategories(withPendingSubcategory());
    setSubcategoryText('');
  };

  const handleCreate = async () => {
    setError('');
    if (!name.trim()) {
      setError('Category name is required.');
      return;
    }

    const subcats = withPendingSubcategory();

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
          autoCapitalize="words"
          placeholder="e.g. Health & Fitness"
          value={name}
          onChangeText={setName}
        />

        <View style={styles.subcategoryRow}>
          <Input
            label="Subcategories (Optional)"
            placeholder="e.g. Groceries"
            value={subcategoryText}
            onChangeText={setSubcategoryText}
            autoCapitalize="words"
            style={styles.subcategoryInput}
          />
          <Button
            title="Add"
            variant="secondary"
            onPress={addSubcategory}
            disabled={!subcategoryText.trim()}
            style={styles.subcategoryAdd}
          />
        </View>
        {subcategories.length > 0 ? (
          <View style={styles.tags}>
            {subcategories.map((name) => (
              <TouchableOpacity
                key={name}
                style={styles.tag}
                onPress={() => setSubcategories((prev) => prev.filter((item) => item !== name))}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${name}`}
              >
                <Text style={styles.tagText}>{name}</Text>
                <Ionicons name="close" size={13} color={COLORS.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

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
  subcategoryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  subcategoryInput: {
    flex: 1,
  },
  subcategoryAdd: {
    marginTop: 22,
    minHeight: 48,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  tagText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.text,
  },
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
