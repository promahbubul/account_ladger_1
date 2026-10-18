import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../../constants/theme';
import { useDateFilter } from '../../context/DateFilterContext';

export const Header = ({
  title,
  showBack = false,
  onBack,
  showDateFilter = true,
  rightAction,
}) => {
  const insets = useSafeAreaInsets();
  const { preset, setPreset, formattedRangeLabel } = useDateFilter();
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const presets = [
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'This Month' },
    { id: 'year', label: 'This Year' },
    { id: 'all', label: 'All Time' },
  ];

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 12) }]}>
      <View style={styles.contentRow}>
        <View style={styles.leftCol}>
          {showBack ? (
            <TouchableOpacity onPress={onBack} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color={COLORS.text} />
            </TouchableOpacity>
          ) : null}
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>

        <View style={styles.rightCol}>
          {showDateFilter ? (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setFilterModalVisible(true)}
              style={styles.filterBadge}
            >
              <Ionicons name="calendar-outline" size={13} color={COLORS.primary} />
              <Text style={styles.filterText} numberOfLines={1}>
                {formattedRangeLabel}
              </Text>
              <Ionicons name="chevron-down" size={11} color={COLORS.textSecondary} />
            </TouchableOpacity>
          ) : null}

          {rightAction ? <View style={{ marginLeft: SPACING.sm }}>{rightAction}</View> : null}
        </View>
      </View>

      {/* Date Filter Modal */}
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setFilterModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalHeading}>Select Date Range</Text>
            {presets.map((p) => {
              const isSelected = preset === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.presetRow, isSelected && styles.presetRowSelected]}
                  onPress={() => {
                    setPreset(p.id);
                    setFilterModalVisible(false);
                  }}
                >
                  <Text style={[styles.presetText, isSelected && styles.presetTextSelected]}>
                    {p.label}
                  </Text>
                  {isSelected ? (
                    <Ionicons name="checkmark" size={18} color={COLORS.primary} />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderHairline,
    paddingBottom: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  leftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backBtn: {
    marginRight: SPACING.sm,
    padding: SPACING.xs,
  },
  title: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  rightCol: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceGhost,
    borderWidth: 1,
    borderColor: COLORS.borderHairline,
    borderRadius: RADIUS.full,
    paddingVertical: 5,
    paddingHorizontal: 10,
    gap: 4,
  },
  filterText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontWeight: '500',
    maxWidth: 110,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  modalContent: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
  },
  modalHeading: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  presetRowSelected: {
    backgroundColor: COLORS.surfaceGhost,
  },
  presetText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    fontWeight: '500',
  },
  presetTextSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },
});
