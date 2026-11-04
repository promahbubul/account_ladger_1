import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../../constants/theme';

export const Input = ({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  editable = true,
  leftIcon,
  multiline = false,
  numberOfLines = 1,
  style,
  inputStyle,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  return (
    <View style={[styles.container, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.inputWrapper,
          isFocused && styles.focused,
          Boolean(error) && styles.errorBorder,
          !editable && styles.disabled,
          multiline && { minHeight: 88, alignItems: 'flex-start' },
        ]}
      >
        {leftIcon ? <View style={styles.leftIcon}>{leftIcon}</View> : null}
        <TextInput
          value={value}
          accessibilityLabel={label || placeholder}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textMuted}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          editable={editable}
          multiline={multiline}
          numberOfLines={numberOfLines}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={[styles.input, inputStyle]}
        />
        {secureTextEntry ? (
          <TouchableOpacity
            style={styles.eyeBtn}
            activeOpacity={0.7}
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
          >
            <Ionicons
              name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={COLORS.textSecondary}
            />
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
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
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    minHeight: 48,
  },
  focused: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surfaceSelected,
  },
  errorBorder: {
    borderColor: COLORS.danger,
  },
  disabled: {
    opacity: 0.5,
  },
  leftIcon: {
    marginRight: SPACING.sm,
  },
  input: {
    flex: 1,
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    paddingVertical: SPACING.sm,
    // The wrapper already shows focus, so drop the browser's own outline on web.
    outlineStyle: 'none',
  },
  eyeBtn: {
    padding: SPACING.xs,
    marginLeft: SPACING.xs,
  },
  errorText: {
    fontSize: FONT_SIZE.xs - 1,
    color: COLORS.danger,
    marginTop: 4,
  },
});
