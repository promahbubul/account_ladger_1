import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme';
import { Header } from '../../components/common/Header';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { LoadMoreFooter } from '../../components/common/LoadMoreFooter';
import { QueryErrorState } from '../../components/common/QueryStates';
import { BarList } from '../../components/charts/BarList';
import { usePagedQuery } from '../../hooks/usePagedQuery';
import { projectsApi } from '../../services/api/projects.api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { exportProjectCsv, exportProjectPdf } from '../../utils/projectExport';
import { showMessage } from '../../utils/notify';
import { KeyboardView } from '../../components/common/KeyboardView';

const TABS = [
  { key: 'OVERVIEW', label: 'Overview' },
  { key: 'EXPENSE', label: 'Expenses' },
  { key: 'FUND', label: 'Funds' },
  { key: 'PEOPLE', label: 'People' },
  { key: 'HEADS', label: 'Heads' },
];

const EntriesTab = ({ projectId, type, navigation }) => {
  const query = usePagedQuery({
    queryKey: ['projectEntries', projectId, type],
    fetchPage: (page) => projectsApi.getEntries(projectId, { type, page, limit: 50 }),
  });

  if (query.isLoading) return <LoadingSpinner message="Loading entries..." />;
  if (query.isError && query.items.length === 0) {
    return <QueryErrorState title="Could not load entries" onRetry={() => query.refetch()} />;
  }

  return (
    <FlatList
      data={query.items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.listRow}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('ProjectEntries', { projectId, type, entry: item })}
        >
          <View style={styles.listRowInfo}>
            <Text style={styles.listRowTitle} numberOfLines={1}>{item.headName || item.description || 'Fund'}</Text>
            <Text style={styles.listRowSub} numberOfLines={1}>
              {[formatDate(item.date), item.personName, item.headName ? item.description : null].filter(Boolean).join(' • ')}
            </Text>
          </View>
          <Text style={styles.listRowValue}>{formatCurrency(item.amount)}</Text>
        </TouchableOpacity>
      )}
      ListFooterComponent={<LoadMoreFooter query={query} />}
      ListEmptyComponent={<EmptyState icon={type === 'FUND' ? 'wallet-outline' : 'receipt-outline'} title={type === 'FUND' ? 'No funds added yet' : 'No expenses added yet'} />}
    />
  );
};

const NamedListTab = ({ title, editTitle, items, placeholder, withPhone, onAdd, onUpdate, onDelete, emptyTitle, emptyIcon }) => {
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const startEdit = (item) => {
    setEditing(item);
    setName(item.name);
    setPhone(item.phone || '');
    setError('');
  };

  const resetForm = () => {
    setEditing(null);
    setName('');
    setPhone('');
    setError('');
  };

  const handleSave = async () => {
    if (!name.trim() || loading) return;
    setLoading(true);
    setError('');
    try {
      const data = { name: name.trim(), ...(withPhone ? { phone: phone.trim() || null } : {}) };
      if (editing) await onUpdate(editing, data);
      else await onAdd(data);
      resetForm();
    } catch (err) {
      setError(err.message || 'Could not save this.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <View style={styles.addCard}>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Input label={editing ? editTitle : title} placeholder={placeholder} value={name} onChangeText={setName} autoCapitalize="words" />
        {withPhone ? <Input label="Phone (Optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" /> : null}
        <Button title={editing ? 'Save' : 'Add'} variant="secondary" onPress={handleSave} loading={loading} disabled={!name.trim()} />
        {editing ? <Button title="Cancel" variant="ghost" onPress={resetForm} style={styles.cancelEdit} /> : null}
      </View>
      {items.length === 0 ? (
        <EmptyState icon={emptyIcon} title={emptyTitle} />
      ) : (
        items.map((item) => (
          <View key={item.id} style={styles.listRow}>
            <TouchableOpacity
              style={styles.listRowInfo}
              activeOpacity={0.7}
              onPress={() => startEdit(item)}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${item.name}`}
            >
              <Text style={styles.listRowTitle} numberOfLines={1}>{item.name}</Text>
              {item.phone ? <Text style={styles.listRowSub}>{item.phone}</Text> : null}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onDelete(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${item.name}`}
            >
              <Ionicons name="trash-outline" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
        ))
      )}
    </View>
  );
};

export const ProjectDetailScreen = ({ route, navigation }) => {
  const queryClient = useQueryClient();
  const { projectId } = route.params;
  const [tab, setTab] = useState('OVERVIEW');
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState('');

  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getProject(projectId),
  });
  const project = projectQuery.data?.project;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    queryClient.invalidateQueries({ queryKey: ['projectEntries', projectId] });
    queryClient.invalidateQueries({ queryKey: ['projectsList'] });
  };

  const removeNamed = async (remove) => {
    try {
      await remove();
      refresh();
    } catch (err) {
      showMessage('Could not remove', err.message || 'Please try again.');
    }
  };

  const handleExport = async (format) => {
    setExporting(format);
    try {
      const { items } = await projectsApi.getEntries(projectId, { all: true });
      await (format === 'pdf' ? exportProjectPdf : exportProjectCsv)(project, items);
    } catch (err) {
      showMessage('Export Failed', err.message || 'Could not export this report.');
    } finally {
      setExporting('');
    }
  };

  const handleDeleteProject = async () => {
    setDeleting(true);
    try {
      await projectsApi.deleteProject(projectId);
      queryClient.invalidateQueries({ queryKey: ['projectsList'] });
      queryClient.removeQueries({ queryKey: ['project', projectId] });
      setDeleteVisible(false);
      navigation.goBack();
    } catch (err) {
      setDeleteVisible(false);
      showMessage('Could not delete', err.message || 'Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const header = (
    <Header
      title={project?.name || 'Project'}
      showBack
      onBack={() => navigation.goBack()}
      showDateFilter={false}
      rightAction={
        project ? (
          <TouchableOpacity
            onPress={() => navigation.navigate('ProjectForm', { project })}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Edit project"
          >
            <Ionicons name="create-outline" size={22} color={COLORS.textSecondary} />
          </TouchableOpacity>
        ) : null
      }
    />
  );

  if (projectQuery.isLoading) {
    return (
      <View style={styles.container}>
        {header}
        <LoadingSpinner message="Loading project..." fullScreen />
      </View>
    );
  }
  if (!project) {
    return (
      <View style={styles.container}>
        {header}
        <QueryErrorState title="Could not load this project" onRetry={() => projectQuery.refetch()} />
      </View>
    );
  }

  const budgetUsed = project.budget > 0 ? project.totalExpense / project.budget : null;
  const isListTab = tab === 'EXPENSE' || tab === 'FUND';

  const summary = (
    <View>
      <View style={styles.figures}>
        <View style={styles.figure}>
          <Text style={styles.figureLabel}>Funds</Text>
          <Text style={styles.figureValue} numberOfLines={1} adjustsFontSizeToFit>{formatCurrency(project.totalFunds)}</Text>
        </View>
        <View style={[styles.figure, styles.figureDivider]}>
          <Text style={styles.figureLabel}>Expense</Text>
          <Text style={styles.figureValue} numberOfLines={1} adjustsFontSizeToFit>{formatCurrency(project.totalExpense)}</Text>
        </View>
        <View style={[styles.figure, styles.figureDivider]}>
          <Text style={styles.figureLabel}>Balance</Text>
          <Text style={[styles.figureValue, project.balance < 0 && styles.negative]} numberOfLines={1} adjustsFontSizeToFit>
            {formatCurrency(project.balance)}
          </Text>
        </View>
      </View>

      {budgetUsed !== null ? (
        <View style={styles.budget}>
          <View style={styles.budgetText}>
            <Text style={styles.budgetLabel}>Budget {formatCurrency(project.budget)}</Text>
            <Text style={[styles.budgetLabel, budgetUsed > 1 && styles.negative]}>{Math.round(budgetUsed * 100)}% used</Text>
          </View>
          <View style={styles.budgetTrack}>
            <View style={[styles.budgetBar, budgetUsed > 1 && styles.budgetOver, { width: `${Math.min(budgetUsed * 100, 100)}%` }]} />
          </View>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button
          title="Add Expenses"
          variant="secondary"
          onPress={() => navigation.navigate('ProjectEntries', { projectId, type: 'EXPENSE' })}
          style={styles.action}
        />
        <Button
          title="Add Funds"
          variant="secondary"
          onPress={() => navigation.navigate('ProjectEntries', { projectId, type: 'FUND' })}
          style={styles.action}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {TABS.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[styles.tab, tab === item.key && styles.tabActive]}
            onPress={() => setTab(item.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === item.key }}
          >
            <Text style={[styles.tabText, tab === item.key && styles.tabTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.container}>
      {header}

      {isListTab ? (
        <View style={styles.listTab}>
          <View style={styles.listTabHeader}>{summary}</View>
          <EntriesTab key={tab} projectId={projectId} type={tab} navigation={navigation} />
        </View>
      ) : (
        <KeyboardView>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={projectQuery.isRefetching} onRefresh={refresh} tintColor={COLORS.primary} />}
        >
          {summary}

          {tab === 'OVERVIEW' ? (
            <View>
              <Text style={styles.sectionHeading}>Expense by head</Text>
              <BarList
                rows={project.byHead.map((row) => ({ key: row.id, label: row.name, value: row.amount }))}
                emptyMessage="No expenses added yet."
              />
              <Text style={styles.sectionHeading}>Expense by person</Text>
              <BarList
                rows={project.byPerson.map((row) => ({ key: row.id || 'none', label: row.name, value: row.expense }))}
                emptyMessage="No expenses added yet."
              />
              <Text style={styles.sectionHeading}>Funds by person</Text>
              <BarList
                rows={project.byPerson.map((row) => ({ key: row.id || 'none', label: row.name, value: row.funds }))}
                emptyMessage="No funds added yet."
              />

              <View style={styles.actions}>
                <Button
                  title="Export PDF"
                  variant="secondary"
                  onPress={() => handleExport('pdf')}
                  loading={exporting === 'pdf'}
                  style={styles.action}
                />
                <Button
                  title="Export CSV"
                  variant="secondary"
                  onPress={() => handleExport('csv')}
                  loading={exporting === 'csv'}
                  style={styles.action}
                />
              </View>
              <TouchableOpacity style={styles.deleteLink} onPress={() => setDeleteVisible(true)} accessibilityRole="button">
                <Text style={styles.deleteText}>Delete Project</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {tab === 'PEOPLE' ? (
            <NamedListTab
              title="Add Person"
              editTitle="Edit Person"
              placeholder="e.g. Karim"
              withPhone
              items={project.people}
              emptyIcon="people-outline"
              emptyTitle="No people added yet"
              onAdd={async (data) => {
                await projectsApi.addPerson(projectId, data);
                refresh();
              }}
              onUpdate={async (item, data) => {
                await projectsApi.updatePerson(projectId, item.id, data);
                refresh();
              }}
              onDelete={(item) => removeNamed(() => projectsApi.deletePerson(projectId, item.id))}
            />
          ) : null}

          {tab === 'HEADS' ? (
            <NamedListTab
              title="Add Head"
              editTitle="Edit Head"
              placeholder="e.g. Tiles"
              items={project.heads}
              emptyIcon="pricetags-outline"
              emptyTitle="No heads added yet"
              onAdd={async (data) => {
                await projectsApi.addHead(projectId, data);
                refresh();
              }}
              onUpdate={async (item, data) => {
                await projectsApi.updateHead(projectId, item.id, data);
                refresh();
              }}
              onDelete={(item) => removeNamed(() => projectsApi.deleteHead(projectId, item.id))}
            />
          ) : null}
        </ScrollView>
        </KeyboardView>
      )}

      <ConfirmModal
        visible={deleteVisible}
        title="Delete Project"
        message={`Delete "${project.name}" with all of its expenses, funds, people, and heads? This cannot be undone.`}
        confirmText="Delete"
        loading={deleting}
        onConfirm={handleDeleteProject}
        onCancel={() => setDeleteVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  cancelEdit: {
    marginTop: SPACING.xs,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  listTab: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  listTabHeader: {
    paddingTop: SPACING.lg,
  },
  figures: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
  },
  figure: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: SPACING.xs,
  },
  figureDivider: {
    borderLeftWidth: 1,
    borderLeftColor: COLORS.border,
  },
  figureLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  figureValue: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
    fontVariant: ['tabular-nums'],
  },
  negative: {
    color: COLORS.danger,
  },
  budget: {
    marginBottom: SPACING.md,
  },
  budgetText: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  budgetLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  budgetTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.surfaceElevated,
    overflow: 'hidden',
  },
  budgetBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.chartPrimary,
  },
  budgetOver: {
    backgroundColor: COLORS.danger,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    marginTop: SPACING.xs,
  },
  action: {
    flex: 1,
  },
  tabs: {
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  tab: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabActive: {
    backgroundColor: COLORS.surfaceElevated,
    borderColor: COLORS.borderLight,
  },
  tabText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: COLORS.text,
  },
  sectionHeading: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  listRowInfo: {
    flex: 1,
    marginRight: SPACING.md,
  },
  listRowTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  listRowSub: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  listRowValue: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
    fontVariant: ['tabular-nums'],
  },
  addCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: FONT_SIZE.xs,
    marginBottom: SPACING.sm,
  },
  deleteLink: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
    marginBottom: SPACING.lg,
  },
  deleteText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.danger,
  },
});
