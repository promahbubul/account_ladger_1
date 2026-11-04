import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { COLORS, SPACING, FONT_SIZE } from '../../constants/theme';
import { Header } from '../../components/common/Header';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Select } from '../../components/common/Select';
import { DateField } from '../../components/common/DateField';
import { projectsApi } from '../../services/api/projects.api';
import { parseAmount } from '../../utils/formatters';
import { KeyboardView } from '../../components/common/KeyboardView';

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'COMPLETED', label: 'Completed' },
];

export const ProjectFormScreen = ({ route, navigation }) => {
  const queryClient = useQueryClient();
  const project = route.params?.project;

  const [name, setName] = useState(project?.name || '');
  const [clientName, setClientName] = useState(project?.clientName || '');
  const [location, setLocation] = useState(project?.location || '');
  const [startDate, setStartDate] = useState(project?.startDate || '');
  const [budget, setBudget] = useState(project?.budget != null ? String(project.budget) : '');
  const [status, setStatus] = useState(project?.status || 'ACTIVE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (loading) return;
    setError('');
    if (!name.trim()) {
      setError('Please enter a project name.');
      return;
    }
    const budgetValue = budget.trim() === '' || budget.trim() === '0' ? null : parseAmount(budget);
    if (budget.trim() !== '' && budget.trim() !== '0' && budgetValue === null) {
      setError('Please enter a valid budget.');
      return;
    }

    const data = {
      name: name.trim(),
      clientName: clientName.trim() || null,
      location: location.trim() || null,
      startDate: startDate || null,
      budget: budgetValue,
      status,
    };

    setLoading(true);
    try {
      const result = project ? await projectsApi.updateProject(project.id, data) : await projectsApi.createProject(data);
      queryClient.invalidateQueries({ queryKey: ['projectsList'] });
      queryClient.invalidateQueries({ queryKey: ['project', result.project.id] });
      if (project) {
        navigation.goBack();
      } else {
        navigation.replace('ProjectDetail', { projectId: result.project.id });
      }
    } catch (err) {
      setError(err.message || 'Could not save the project.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title={project ? 'Edit Project' : 'New Project'} showBack onBack={() => navigation.goBack()} showDateFilter={false} />
      <KeyboardView>
<ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Input label="Project Name *" placeholder="e.g. Dhaka Building" value={name} onChangeText={setName} autoCapitalize="words" />
        <Input label="Client (Optional)" value={clientName} onChangeText={setClientName} autoCapitalize="words" />
        <Input label="Location (Optional)" value={location} onChangeText={setLocation} autoCapitalize="words" />
        <DateField label="Start Date (Optional)" value={startDate} onChange={setStartDate} allowClear />
        <Input label="Budget (Optional)" placeholder="0.00" value={budget} onChangeText={setBudget} keyboardType="numeric" />
        {project ? <Select label="Status" value={status} options={STATUS_OPTIONS} onChange={setStatus} /> : null}
        <Button title={project ? 'Save Changes' : 'Create Project'} onPress={handleSave} loading={loading} style={styles.submitBtn} />
      </ScrollView>
      </KeyboardView>
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
  submitBtn: {
    marginTop: SPACING.md,
    marginBottom: SPACING.xxl,
  },
});
