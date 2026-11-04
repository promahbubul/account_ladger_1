import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../../constants/theme';
import { getTodayISO } from '../../utils/formatters';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const toISO = (year, month, day) =>
  `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

// Leading nulls align the first day under its weekday; the week starts on Monday.
const buildMonthCells = (year, month) => {
  const leading = (new Date(year, month, 1).getDay() + 6) % 7;
  const dayCount = new Date(year, month + 1, 0).getDate();
  const cells = Array(leading).fill(null);
  for (let day = 1; day <= dayCount; day += 1) cells.push(day);
  return cells;
};

export const DateRangeCalendar = ({ startDate, endDate, onChange }) => {
  const today = getTodayISO();
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const [year, month] = (startDate || today).split('-').map(Number);
    return { year, month: month - 1 };
  });

  // Normalizing through Date rolls month -1 and 12 into the neighbouring year.
  const shiftMonth = (delta) => {
    const next = new Date(visibleMonth.year, visibleMonth.month + delta, 1);
    setVisibleMonth({ year: next.getFullYear(), month: next.getMonth() });
  };

  // First tap picks the start, second the end (swapped if earlier), third starts over.
  const selectDay = (iso) => {
    if (!startDate || endDate) {
      onChange(iso, '');
    } else if (iso < startDate) {
      onChange(iso, startDate);
    } else {
      onChange(startDate, iso);
    }
  };

  const navButton = (icon, delta, label) => (
    <TouchableOpacity
      style={styles.navBtn}
      onPress={() => shiftMonth(delta)}
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={16} color={COLORS.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <View>
      <View style={styles.monthRow}>
        {navButton('play-back-outline', -12, 'Previous year')}
        {navButton('chevron-back', -1, 'Previous month')}
        <Text style={styles.monthLabel}>{MONTHS[visibleMonth.month]} {visibleMonth.year}</Text>
        {navButton('chevron-forward', 1, 'Next month')}
        {navButton('play-forward-outline', 12, 'Next year')}
      </View>

      <View style={styles.grid}>
        {WEEKDAYS.map((name) => (
          <View key={name} style={styles.cell}>
            <Text style={styles.weekday}>{name}</Text>
          </View>
        ))}

        {buildMonthCells(visibleMonth.year, visibleMonth.month).map((day, index) => {
          if (day === null) return <View key={`blank-${index}`} style={styles.cell} />;

          const iso = toISO(visibleMonth.year, visibleMonth.month, day);
          const isEdge = iso === startDate || iso === endDate;
          const isBetween = Boolean(startDate && endDate) && iso > startDate && iso < endDate;
          const isToday = iso === today;

          return (
            <TouchableOpacity
              key={iso}
              style={[styles.cell, isBetween && styles.cellBetween]}
              activeOpacity={0.7}
              onPress={() => selectDay(iso)}
              accessibilityRole="button"
              accessibilityLabel={iso}
            >
              <View style={[styles.dayCircle, isEdge && styles.dayEdge, isToday && !isEdge && styles.dayToday]}>
                <Text style={[styles.dayText, isEdge && styles.dayTextEdge]}>{day}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  monthLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  navBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellBetween: {
    backgroundColor: COLORS.primaryLight,
  },
  weekday: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayEdge: {
    backgroundColor: COLORS.primary,
  },
  dayToday: {
    borderColor: COLORS.borderLight,
  },
  dayText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
  },
  dayTextEdge: {
    color: '#FFF',
    fontWeight: '700',
  },
});
