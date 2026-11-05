import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE, themedStyles } from '../../constants/theme';
import { useDateFilter } from '../../context/DateFilterContext';
import { formatDate } from '../../utils/formatters';
import { Button } from './Button';
import { DateRangeCalendar } from './DateRangeCalendar';

export const Header = ({
  title,
  showBack = false,
  onBack,
  showDateFilter = true,
  rightAction,
}) => {
  const insets = useSafeAreaInsets();
  const { preset, startDate, endDate, setPreset, setCustomRange, formattedRangeLabel } = useDateFilter();
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [draftRange, setDraftRange] = useState({ start: '', end: '' });

  const openFilter = () => {
    setShowCustomRange(false);
    setFilterModalVisible(true);
  };

  const openCustomRange = () => {
    setDraftRange(preset === 'custom' ? { start: startDate, end: endDate } : { start: '', end: '' });
    setShowCustomRange(true);
  };

  const applyCustomRange = () => {
    setCustomRange(draftRange.start, draftRange.end || draftRange.start);
    setFilterModalVisible(false);
  };

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
              onPress={openFilter}
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
          <TouchableOpacity style={styles.modalContent} activeOpacity={1}>
            {showCustomRange ? (
              <>
                <View style={styles.customHeader}>
                  <TouchableOpacity
                    onPress={() => setShowCustomRange(false)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel="Back to date ranges"
                  >
                    <Ionicons name="arrow-back" size={18} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                  <Text style={styles.customHeading}>Custom Range</Text>
                </View>

                <View style={styles.rangeSummary}>
                  <View style={styles.rangeSummaryItem}>
                    <Text style={styles.rangeSummaryLabel}>From</Text>
                    <Text style={styles.rangeSummaryValue}>{draftRange.start ? formatDate(draftRange.start) : 'Select'}</Text>
                  </View>
                  <View style={styles.rangeSummaryItem}>
                    <Text style={styles.rangeSummaryLabel}>To</Text>
                    <Text style={styles.rangeSummaryValue}>
                      {draftRange.end ? formatDate(draftRange.end) : draftRange.start ? 'Same day' : 'Select'}
                    </Text>
                  </View>
                </View>

                <DateRangeCalendar
                  startDate={draftRange.start}
                  endDate={draftRange.end}
                  onChange={(start, end) => setDraftRange({ start, end })}
                />

                <Button
                  title="Apply"
                  onPress={applyCustomRange}
                  disabled={!draftRange.start}
                  style={styles.applyBtn}
                />
              </>
            ) : (
              <>
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
                <TouchableOpacity
                  style={[styles.presetRow, preset === 'custom' && styles.presetRowSelected]}
                  onPress={openCustomRange}
                >
                  <View>
                    <Text style={[styles.presetText, preset === 'custom' && styles.presetTextSelected]}>
                      Custom Range
                    </Text>
                    {preset === 'custom' ? (
                      <Text style={styles.presetHint}>{formattedRangeLabel}</Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = themedStyles(() => ({
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
    maxWidth: 150,
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
  presetHint: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    marginBottom: SPACING.md,
  },
  customHeading: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  rangeSummary: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  rangeSummaryItem: {
    flex: 1,
    paddingHorizontal: SPACING.xs,
  },
  rangeSummaryLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  rangeSummaryValue: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  applyBtn: {
    marginTop: SPACING.md,
  },
}));
