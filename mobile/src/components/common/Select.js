import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Modal, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../../constants/theme';

const SEARCH_THRESHOLD = 8;

export const Select = ({
  label,
  value,
  options = [],
  onChange,
  placeholder = 'Select an option',
  emptyMessage = 'No options available',
  loading = false,
  disabled = false,
  allowClear = false,
  error,
  style,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selected = options.find((opt) => opt.value === value);
  const showSearch = options.length > SEARCH_THRESHOLD;

  const visibleOptions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return options;
    return options.filter((opt) => opt.label.toLowerCase().includes(term));
  }, [options, search]);

  const close = () => {
    setOpen(false);
    setSearch('');
  };

  const pick = (nextValue) => {
    onChange(nextValue);
    close();
  };

  const isDisabled = disabled || loading;

  return (
    <View style={[styles.container, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TouchableOpacity
        style={[styles.trigger, Boolean(error) && styles.errorBorder, isDisabled && styles.disabled]}
        activeOpacity={0.7}
        disabled={isDisabled}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label || placeholder}
      >
        <Text style={[styles.triggerText, !selected && styles.placeholder]} numberOfLines={1}>
          {loading ? 'Loading...' : selected ? selected.label : placeholder}
        </Text>
        {loading ? (
          <ActivityIndicator size="small" color={COLORS.textMuted} />
        ) : (
          <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
        )}
      </TouchableOpacity>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={close}>
          <TouchableOpacity style={styles.sheet} activeOpacity={1}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{label || placeholder}</Text>
              <TouchableOpacity onPress={close} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {showSearch ? (
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search..."
                placeholderTextColor={COLORS.textMuted}
                style={styles.search}
              />
            ) : null}

            <FlatList
              data={visibleOptions}
              keyExtractor={(opt) => String(opt.value)}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={
                allowClear && value ? (
                  <TouchableOpacity style={styles.option} onPress={() => pick('')}>
                    <Text style={styles.clearText}>Clear selection</Text>
                  </TouchableOpacity>
                ) : null
              }
              ListEmptyComponent={<Text style={styles.empty}>{emptyMessage}</Text>}
              renderItem={({ item }) => {
                const isSelected = item.value === value;
                return (
                  <TouchableOpacity
                    style={[styles.option, isSelected && styles.optionSelected]}
                    onPress={() => pick(item.value)}
                  >
                    <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{item.label}</Text>
                    {isSelected ? <Ionicons name="checkmark" size={16} color={COLORS.primary} /> : null}
                  </TouchableOpacity>
                );
              }}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    minHeight: 48,
  },
  triggerText: {
    flex: 1,
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    marginRight: SPACING.sm,
  },
  placeholder: {
    color: COLORS.textMuted,
  },
  errorBorder: {
    borderColor: COLORS.danger,
  },
  disabled: {
    opacity: 0.5,
  },
  errorText: {
    fontSize: FONT_SIZE.xs - 1,
    color: COLORS.danger,
    marginTop: 4,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    maxHeight: '75%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  sheetTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  search: {
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: RADIUS.md,
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm,
    outlineStyle: 'none',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  optionSelected: {
    backgroundColor: COLORS.primaryLight,
  },
  optionText: {
    flex: 1,
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
  },
  optionTextSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  clearText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
  },
  empty: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.sm,
    textAlign: 'center',
    paddingVertical: SPACING.xl,
  },
});
