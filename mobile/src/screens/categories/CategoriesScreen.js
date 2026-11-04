import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet, TouchableOpacity } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme';
import { Header } from '../../components/common/Header';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { QueryErrorState } from '../../components/common/QueryStates';
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
  // Archived categories sort last so they can still be found and restored.
  const filtered = allCategories
    .filter((c) => c.type === tab)
    .sort((a, b) => Number(Boolean(a.isArchived)) - Number(Boolean(b.isArchived)));

  return (
    <View style={styles.container}>
      <Header
        title="Categories"
        showBack
        onBack={() => navigation.goBack()}
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

      <View style={styles.segmentedContainer}>
        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[styles.segmentBtn, tab === 'EXPENSE' && styles.segmentBtnActive]}
            onPress={() => setTab('EXPENSE')}
          >
            <Text style={[styles.segmentText, tab === 'EXPENSE' && styles.segmentTextActive]}>Expenses</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, tab === 'INCOME' && styles.segmentBtnActive]}
            onPress={() => setTab('INCOME')}
          >
            <Text style={[styles.segmentText, tab === 'INCOME' && styles.segmentTextActive]}>Income</Text>
          </TouchableOpacity>
        </View>
      </View>

      {categoriesQuery.isLoading ? (
        <LoadingSpinner message="Loading categories..." fullScreen />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.categoryRow, item.isArchived && styles.archivedRow]}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('CreateCategory', { category: item })}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${item.name}`}
            >
              <View style={styles.rowLeft}>
                <View style={[styles.iconBox, { backgroundColor: item.type === 'INCOME' ? COLORS.successLight : COLORS.dangerLight }]}>
                  <Ionicons
                    name="pricetag-outline"
                    size={16}
                    color={item.type === 'INCOME' ? COLORS.success : COLORS.danger}
                  />
                </View>
                <View style={styles.infoCol}>
                  <Text style={styles.catName}>{item.name}</Text>
                  {item.subcategories && item.subcategories.length > 0 ? (
                    <Text style={styles.subcatsText} numberOfLines={1}>
                      {item.subcategories.join(' • ')}
                    </Text>
                  ) : null}
                </View>
              </View>

              {item.isArchived ? (
                <Badge label="Archived" variant="default" />
              ) : (
                <Badge
                  label={item.type}
                  variant={item.type === 'INCOME' ? 'success' : 'danger'}
                />
              )}
            </TouchableOpacity>
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
            categoriesQuery.isError ? (
              <QueryErrorState title="Could not load categories" onRetry={() => categoriesQuery.refetch()} />
            ) : (
              <EmptyState
                icon="pricetags-outline"
                title="No categories found"
                actionTitle="Add Category"
                onAction={() => navigation.navigate('CreateCategory', { defaultType: tab })}
              />
            )
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
  segmentedContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceGhost,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.borderHairline,
    padding: 3,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: RADIUS.full,
  },
  segmentBtnActive: {
    backgroundColor: COLORS.primary,
  },
  segmentText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  segmentTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  listContent: {
    flexGrow: 1,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderHairline,
  },
  archivedRow: {
    opacity: 0.55,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: SPACING.md,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  infoCol: {
    flex: 1,
  },
  catName: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  subcatsText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
});
