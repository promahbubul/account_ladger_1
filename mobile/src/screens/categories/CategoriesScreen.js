import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme';
import { Header } from '../../components/common/Header';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { categoriesApi } from '../../services/api/categories.api';

export const CategoriesScreen = ({ navigation }) => {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('EXPENSE'); // EXPENSE | INCOME

  const categoriesQuery = useQuery({
    queryKey: ['categoriesList'],
    queryFn: () => categoriesApi.getCategories(),
  });

  const onRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['categoriesList'] });
  }, [queryClient]);

  const allCategories = categoriesQuery.data?.categories || [];
  const filtered = allCategories.filter((c) => c.type === tab);

  return (
    <View style={styles.container}>
      <Header
        title="Categories"
        showDateFilter={false}
        rightAction={
          <Button
            title="Add"
            size="sm"
            icon={<Ionicons name="add" size={16} color="#FFF" />}
            onPress={() => navigation.navigate('CreateCategory', { defaultType: tab })}
          />
        }
      />

      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'EXPENSE' && styles.tabBtnActive]}
          onPress={() => setTab('EXPENSE')}
        >
          <Text style={[styles.tabText, tab === 'EXPENSE' && styles.tabTextActive]}>Expenses</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'INCOME' && styles.tabBtnActive]}
          onPress={() => setTab('INCOME')}
        >
          <Text style={[styles.tabText, tab === 'INCOME' && styles.tabTextActive]}>Income</Text>
        </TouchableOpacity>
      </View>

      {categoriesQuery.isLoading ? (
        <LoadingSpinner message="Loading categories..." fullScreen />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.categoryCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.catName}>{item.name}</Text>
                <Badge
                  label={item.type}
                  variant={item.type === 'INCOME' ? 'success' : 'danger'}
                />
              </View>

              {item.subcategories && item.subcategories.length > 0 ? (
                <View style={styles.subcatsContainer}>
                  <Text style={styles.subcatLabel}>Subcategories:</Text>
                  <View style={styles.subcatsList}>
                    {item.subcategories.map((sub, sIdx) => (
                      <View key={sIdx} style={styles.subcatBadge}>
                        <Text style={styles.subcatText}>{sub}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={categoriesQuery.isRefetching}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="tags-outline"
              title="No categories found"
              actionTitle="Add Category"
              onAction={() => navigation.navigate('CreateCategory', { defaultType: tab })}
            />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  tabTextActive: {
    color: COLORS.primary,
  },
  listContent: {
    padding: SPACING.lg,
    flexGrow: 1,
  },
  categoryCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  catName: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.text,
  },
  subcatsContainer: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  subcatLabel: {
    fontSize: FONT_SIZE.xs - 1,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  subcatsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  subcatBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.xs,
  },
  subcatText: {
    fontSize: FONT_SIZE.xs - 1,
    color: COLORS.textSecondary,
  },
});
