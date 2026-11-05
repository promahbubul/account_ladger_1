import React, { useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, RADIUS, themedStyles } from '../../constants/theme';
import { Header } from '../../components/common/Header';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Select } from '../../components/common/Select';
import { DateField } from '../../components/common/DateField';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { QueryErrorBanner } from '../../components/common/QueryStates';
import { projectsApi } from '../../services/api/projects.api';
import { formatCurrency, getTodayISO, isValidISODate, parseAmount } from '../../utils/formatters';
import { KeyboardView } from '../../components/common/KeyboardView';

const newKey = () => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
const newRow = () => ({ key: newKey(), headId: '', personId: '', amount: '', description: '' });
const isBlank = (row) => !row.amount.trim() && !row.description.trim() && !row.headId && !row.personId;

// Adds one or many project expenses or funds at once, and edits a single existing entry.
export const ProjectEntriesScreen = ({ route, navigation }) => {
  const queryClient = useQueryClient();
  const { projectId, type, entry } = route.params;
  const isExpense = type === 'EXPENSE';
  const noun = isExpense ? 'Expense' : 'Fund';

  const [date, setDate] = useState(entry?.date || getTodayISO());
  const [rows, setRows] = useState(() => [
    entry
      ? { key: entry.id, headId: entry.headId || '', personId: entry.personId || '', amount: String(entry.amount), description: entry.description || '' }
      : newRow(),
  ]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  // One id per distinct payload, so resending after a lost response cannot save twice.
  const batchRef = useRef({ signature: '', id: '' });

  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getProject(projectId),
  });
  const project = projectQuery.data?.project;
  const headOptions = useMemo(() => (project?.heads || []).map((h) => ({ value: h.id, label: h.name })), [project]);
  const personOptions = useMemo(() => (project?.people || []).map((p) => ({ value: p.id, label: p.name })), [project]);

  const updateRow = (key, field, value) => {
    setError('');
    setFieldErrors((prev) => (prev[`${key}:${field}`] ? { ...prev, [`${key}:${field}`]: undefined } : prev));
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, [field]: value } : row)));
  };

  const total = rows.reduce((sum, row) => sum + (parseAmount(row.amount) || 0), 0);

  const refreshProject = () => {
    queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    queryClient.invalidateQueries({ queryKey: ['projectEntries', projectId] });
    queryClient.invalidateQueries({ queryKey: ['projectsList'] });
  };

  const handleSave = async () => {
    if (loading) return;
    setError('');
    const errors = {};
    if (!isValidISODate(date)) errors.date = 'Please select a date.';

    const filled = rows.filter((row) => !isBlank(row));
    const entries = filled.map((row) => {
      const amount = parseAmount(row.amount);
      if (amount === null) errors[`${row.key}:amount`] = 'Enter a valid amount.';
      if (isExpense && !row.headId) errors[`${row.key}:headId`] = 'Select a head.';
      return { type, date, amount, headId: row.headId || null, personId: row.personId || null, description: row.description.trim() || null };
    });

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError('Please fix the highlighted fields. Nothing has been saved.');
      return;
    }
    if (entries.length === 0) {
      setError(`Please add at least one ${noun.toLowerCase()} with an amount.`);
      return;
    }

    setLoading(true);
    try {
      if (entry) {
        await projectsApi.updateEntry(projectId, entry.id, entries[0]);
      } else {
        const signature = JSON.stringify(entries);
        if (batchRef.current.signature !== signature) batchRef.current = { signature, id: newKey() };
        await projectsApi.createEntries(projectId, { entries, batchId: batchRef.current.id });
      }
      refreshProject();
      navigation.goBack();
    } catch (err) {
      if (!entry && (err.status === 408 || err.status === 0)) {
        setError('Could not confirm the save. Tap Save again; it will not create duplicates.');
      } else {
        setError(err.message || `Could not save the ${noun.toLowerCase()}.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await projectsApi.deleteEntry(projectId, entry.id);
      refreshProject();
      setDeleteVisible(false);
      navigation.goBack();
    } catch (err) {
      setDeleteVisible(false);
      setError(err.message || `Could not delete the ${noun.toLowerCase()}.`);
    } finally {
      setLoading(false);
    }
  };

  const title = entry ? `Edit ${noun}` : isExpense ? 'Add Expenses' : 'Add Funds';
  const personLabel = isExpense ? 'Spent by' : 'Received from';

  return (
    <View style={styles.container}>
      <Header title={title} showBack onBack={() => navigation.goBack()} showDateFilter={false} />
      <KeyboardView>
<ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {projectQuery.isError && !project ? (
          <QueryErrorBanner message="Could not load this project." onRetry={() => projectQuery.refetch()} />
        ) : null}

        <DateField label="Date *" value={date} onChange={setDate} error={fieldErrors.date} />

        {rows.map((row, index) => (
          <View key={row.key} style={styles.card}>
            {rows.length > 1 ? (
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{noun} {index + 1}</Text>
                <TouchableOpacity
                  onPress={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${noun.toLowerCase()} ${index + 1}`}
                >
                  <Ionicons name="close-circle-outline" size={18} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>
            ) : null}

            {isExpense ? (
              <Select
                label="Head *"
                placeholder="Select a head"
                value={row.headId}
                options={headOptions}
                onChange={(val) => updateRow(row.key, 'headId', val)}
                loading={projectQuery.isLoading}
                emptyMessage="No heads yet. Add one in the project's Heads tab."
                error={fieldErrors[`${row.key}:headId`]}
              />
            ) : null}
            <Input
              label="Amount *"
              placeholder="0.00"
              value={row.amount}
              onChangeText={(val) => updateRow(row.key, 'amount', val)}
              keyboardType="numeric"
              error={fieldErrors[`${row.key}:amount`]}
            />
            <Select
              label={personLabel}
              placeholder="Optional"
              value={row.personId}
              options={personOptions}
              onChange={(val) => updateRow(row.key, 'personId', val)}
              loading={projectQuery.isLoading}
              allowClear
              emptyMessage="No people yet. Add them in the project's People tab."
            />
            <Input
              label="Description"
              autoCapitalize="sentences"
              placeholder="Optional"
              value={row.description}
              onChangeText={(val) => updateRow(row.key, 'description', val)}
              style={styles.flush}
            />
          </View>
        ))}

        {entry ? (
          <Button title={`Delete ${noun}`} variant="secondary" onPress={() => setDeleteVisible(true)} style={styles.spaced} />
        ) : (
          <Button
            title={`Add Another ${noun}`}
            variant="secondary"
            icon={<Ionicons name="add" size={16} color={COLORS.text} />}
            onPress={() => setRows((prev) => [...prev, newRow()])}
            style={styles.spaced}
          />
        )}

        <Button
          title={entry ? 'Save Changes' : `Save (${formatCurrency(total)})`}
          variant={isExpense ? 'danger' : 'primary'}
          onPress={handleSave}
          loading={loading}
          style={styles.submitBtn}
        />
      </ScrollView>
      </KeyboardView>

      <ConfirmModal
        visible={deleteVisible}
        title={`Delete ${noun}`}
        message={`Delete this ${noun.toLowerCase()} of ${entry ? formatCurrency(entry.amount) : ''}?`}
        confirmText="Delete"
        loading={loading}
        onConfirm={handleDelete}
        onCancel={() => setDeleteVisible(false)}
      />
    </View>
  );
};

const styles = themedStyles(() => ({
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
  card: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  cardTitle: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  flush: {
    marginBottom: 0,
  },
  spaced: {
    marginBottom: SPACING.md,
  },
  submitBtn: {
    marginBottom: SPACING.xxl,
  },
}));
