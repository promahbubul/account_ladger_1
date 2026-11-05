import React, { useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, themedStyles } from '../../constants/theme';
import { Header } from '../../components/common/Header';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { QueryErrorState } from '../../components/common/QueryStates';
import { projectsApi } from '../../services/api/projects.api';
import { formatCurrency } from '../../utils/formatters';

export const ProjectsScreen = ({ navigation }) => {
  const queryClient = useQueryClient();
  const projectsQuery = useQuery({
    queryKey: ['projectsList'],
    queryFn: () => projectsApi.getProjects(),
  });

  const onRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['projectsList'] });
  }, [queryClient]);

  const projects = projectsQuery.data?.projects || [];

  return (
    <View style={styles.container}>
      <Header
        title="Projects"
        showBack
        onBack={() => navigation.goBack()}
        showDateFilter={false}
        rightAction={
          <Button
            title="Add"
            size="sm"
            icon={<Ionicons name="add" size={16} color="#FFF" />}
            onPress={() => navigation.navigate('ProjectForm')}
          />
        }
      />

      {projectsQuery.isLoading ? (
        <LoadingSpinner message="Loading projects..." fullScreen />
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={projectsQuery.isRefetching} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('ProjectDetail', { projectId: item.id })}
            >
              <View style={styles.rowHeader}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                {item.status === 'COMPLETED' ? <Text style={styles.status}>Completed</Text> : null}
              </View>
              {item.clientName ? <Text style={styles.client} numberOfLines={1}>{item.clientName}</Text> : null}
              <View style={styles.figures}>
                <View style={styles.figure}>
                  <Text style={styles.figureLabel}>Funds</Text>
                  <Text style={styles.figureValue} numberOfLines={1}>{formatCurrency(item.totalFunds)}</Text>
                </View>
                <View style={styles.figure}>
                  <Text style={styles.figureLabel}>Expense</Text>
                  <Text style={styles.figureValue} numberOfLines={1}>{formatCurrency(item.totalExpense)}</Text>
                </View>
                <View style={styles.figure}>
                  <Text style={styles.figureLabel}>Balance</Text>
                  <Text style={[styles.figureValue, item.balance < 0 && styles.negative]} numberOfLines={1}>
                    {formatCurrency(item.balance)}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            projectsQuery.isError ? (
              <QueryErrorState title="Could not load projects" onRetry={() => projectsQuery.refetch()} />
            ) : (
              <EmptyState
                icon="briefcase-outline"
                title="No projects yet"
                actionTitle="Create Project"
                onAction={() => navigation.navigate('ProjectForm')}
              />
            )
          }
        />
      )}
    </View>
  );
};

const styles = themedStyles(() => ({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listContent: {
    padding: SPACING.lg,
    flexGrow: 1,
  },
  row: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  status: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginLeft: SPACING.sm,
  },
  client: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  figures: {
    flexDirection: 'row',
    marginTop: SPACING.md,
  },
  figure: {
    flex: 1,
  },
  figureLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  figureValue: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  negative: {
    color: COLORS.danger,
  },
}));
