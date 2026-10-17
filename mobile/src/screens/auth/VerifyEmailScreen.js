import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../services/api/auth.api';

export const VerifyEmailScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { verifyEmail, pendingVerificationEmail } = useAuth();
  const emailParam = route.params?.email || pendingVerificationEmail || '';

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleVerify = async () => {
    setError('');
    setMessage('');
    if (!code || code.length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      await verifyEmail(emailParam, code.trim());
      // On success, AuthContext sets token & user, RootNavigator navigates automatically
    } catch (err) {
      setError(err.message || 'Verification failed. Please check the code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setResending(true);
    setError('');
    setMessage('');
    try {
      await authApi.resendVerification(emailParam);
      setMessage('A new 6-digit verification code has been dispatched to your email.');
      setCooldown(60);
    } catch (err) {
      setError(err.message || 'Failed to resend code.');
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="mail-unread-outline" size={32} color={COLORS.primary} />
          </View>

          <Text style={styles.heading}>Verify Your Email</Text>
          <Text style={styles.subheading}>
            We've sent a 6-digit verification code to:
          </Text>
          <Text style={styles.emailText}>{emailParam}</Text>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={COLORS.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {message ? (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
              <Text style={styles.successText}>{message}</Text>
            </View>
          ) : null}

          <Input
            label="6-Digit Verification Code"
            placeholder="e.g. 123456"
            value={code}
            onChangeText={(text) => setCode(text.replace(/[^0-9]/g, '').slice(0, 6))}
            keyboardType="number-pad"
            style={{ marginTop: SPACING.md }}
            inputStyle={{ fontSize: 20, letterSpacing: 8, textAlign: 'center', fontWeight: '700' }}
          />

          <Button
            title="Verify & Continue"
            onPress={handleVerify}
            loading={loading}
            style={styles.verifyBtn}
          />

          <View style={styles.resendRow}>
            {cooldown > 0 ? (
              <Text style={styles.cooldownText}>Resend code in {cooldown}s</Text>
            ) : (
              <TouchableOpacity onPress={handleResend} disabled={resending}>
                <Text style={styles.resendLink}>
                  {resending ? 'Sending...' : 'Resend verification code'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.cancelText}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  heading: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '800',
    color: COLORS.text,
  },
  subheading: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  emailText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 2,
    marginBottom: SPACING.md,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.dangerLight,
    borderWidth: 1,
    borderColor: COLORS.danger,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    width: '100%',
    gap: 6,
  },
  errorText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.danger,
    flex: 1,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.successLight,
    borderWidth: 1,
    borderColor: COLORS.success,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    width: '100%',
    gap: 6,
  },
  successText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.success,
    flex: 1,
  },
  verifyBtn: {
    width: '100%',
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  resendRow: {
    marginBottom: SPACING.lg,
  },
  cooldownText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
  resendLink: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
    fontWeight: '700',
  },
  cancelBtn: {
    padding: SPACING.xs,
  },
  cancelText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
});
