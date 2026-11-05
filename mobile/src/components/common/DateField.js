import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE, themedStyles } from '../../constants/theme';
import { formatDate } from '../../utils/formatters';
import { DateRangeCalendar } from './DateRangeCalendar';

// Value and onChange use YYYY-MM-DD; the user only ever sees and picks a calendar date.
export const DateField = ({ label, value, onChange, error, allowClear = false, placeholder = 'Select a date', style }) => {
  const [open, setOpen] = useState(false);

  return (
    <View style={[styles.container, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TouchableOpacity
        style={[styles.trigger, Boolean(error) && styles.errorBorder]}
        activeOpacity={0.7}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label || placeholder}
      >
        <Text style={[styles.value, !value && styles.placeholder]}>{value ? formatDate(value) : placeholder}</Text>
        <Ionicons name="calendar-outline" size={16} color={COLORS.textSecondary} />
      </TouchableOpacity>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <TouchableOpacity style={styles.sheet} activeOpacity={1}>
            <DateRangeCalendar
              startDate={value}
              endDate={value}
              onChange={(picked) => {
                onChange(picked);
                setOpen(false);
              }}
            />
            {allowClear && value ? (
              <TouchableOpacity
                style={styles.clear}
                onPress={() => {
                  onChange('');
                  setOpen(false);
                }}
              >
                <Text style={styles.clearText}>Clear date</Text>
              </TouchableOpacity>
            ) : null}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = themedStyles(() => ({
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
  value: {
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
  },
  placeholder: {
    color: COLORS.textMuted,
  },
  errorBorder: {
    borderColor: COLORS.danger,
  },
  errorText: {
    fontSize: FONT_SIZE.xs - 1,
    color: COLORS.danger,
    marginTop: 4,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  sheet: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
  },
  clear: {
    alignItems: 'center',
    paddingTop: SPACING.md,
  },
  clearText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
}));
