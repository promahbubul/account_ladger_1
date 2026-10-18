import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { useAuth } from '../../context/AuthContext';
import { signInWithGoogleFirebase, checkRedirectAuthResult } from '../../services/auth/firebase';

export const LoginScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { login, googleLogin, setPendingVerificationEmail } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  // Handle returning from a redirect authentication flow on Web
  useEffect(() => {
    let isMounted = true;
    checkRedirectAuthResult()
      .then((resAuth) => {
        if (isMounted && resAuth?.idToken) {
          setGoogleLoading(true);
          googleLogin(resAuth.idToken)
            .then((res) => {
              if (isMounted && !res?.success) {
                setError(res?.error || 'Google login failed.');
              }
            })
            .catch((err) => {
              if (isMounted) setError(err.message || 'Google authentication failed.');
            })
            .finally(() => {
              if (isMounted) setGoogleLoading(false);
            });
        }
      })
      .catch((err) => {
        if (isMounted) setError(err.message || 'Redirect authentication failed.');
      });

    return () => {
      isMounted = false;
    };
  }, [googleLogin]);

  const handleLogin = async () => {
    if (loading || googleLoading) return;
    setError('');
    if (!identifier.trim() || !password) {
      setError('Please provide username/email and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await login(identifier.trim(), password);
      if (!res.success) {
        setError(res.error || 'Failed to login.');
      }
    } catch (err) {
      if (err.data && err.data.emailVerified === false) {
        setPendingVerificationEmail(err.data.email || identifier.trim());
        navigation.navigate('VerifyEmail', { email: err.data.email || identifier.trim() });
        return;
      }
      setError(err.message || 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (loading || googleLoading) return;
    setError('');
    setGoogleLoading(true);
    try {
      const resAuth = await signInWithGoogleFirebase();
      if (resAuth?.redirecting) {
        // Redirection in progress (Web), keep loading state active
        return;
      }
      if (!resAuth?.idToken) {
        throw new Error('Google authentication was cancelled or returned no credentials.');
      }
      const res = await googleLogin(resAuth.idToken);
      if (!res.success) {
        setError(res.error || 'Google login failed.');
      }
    } catch (err) {
      setError(err.message || 'Google authentication could not be completed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const isBusy = loading || googleLoading;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Ionicons name="wallet" size={32} color={COLORS.primary} />
          </View>
          <Text style={styles.appName}>AccountLedger</Text>
          <Text style={styles.tagline}>Personal Accounting & Money Manager</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.welcomeText}>Welcome back</Text>
          <Text style={styles.instructionText}>Sign in to access your ledger</Text>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={COLORS.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Input
            label="Email or Username"
            placeholder="e.g. user@example.com"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            editable={!isBusy}
            leftIcon={<Ionicons name="person-outline" size={18} color={COLORS.textSecondary} />}
          />

          <Input
            label="Password"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!isBusy}
            leftIcon={<Ionicons name="lock-closed-outline" size={18} color={COLORS.textSecondary} />}
          />

          <TouchableOpacity
            style={styles.forgotBtn}
            disabled={isBusy}
            onPress={() => navigation.navigate('ForgotPassword')}
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          <Button
            title="Sign In"
            onPress={handleLogin}
            loading={loading}
            disabled={isBusy}
            style={styles.loginBtn}
          />

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <Button
            title="Continue with Google"
            variant="outline"
            icon={<Ionicons name="logo-google" size={18} color={COLORS.text} />}
            onPress={handleGoogleLogin}
            loading={googleLoading}
            disabled={isBusy}
            style={styles.googleBtn}
          />

          <View style={styles.signupRow}>
            <Text style={styles.noAccountText}>Don't have an account? </Text>
            <TouchableOpacity disabled={isBusy} onPress={() => navigation.navigate('Register')}>
              <Text style={styles.signupLink}>Create account</Text>
            </TouchableOpacity>
          </View>
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
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },
  logoCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.surfaceGhost,
    borderWidth: 1,
    borderColor: COLORS.borderHairline,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  appName: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  tagline: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  formCard: {
    backgroundColor: 'transparent',
  },
  welcomeText: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  instructionText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
    marginTop: 2,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.dangerLight,
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    gap: 6,
  },
  errorText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.danger,
    flex: 1,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: SPACING.lg,
  },
  forgotText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
    fontWeight: '600',
  },
  loginBtn: {
    marginBottom: SPACING.md,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.borderHairline,
  },
  dividerText: {
    marginHorizontal: SPACING.md,
    fontSize: FONT_SIZE.xs - 2,
    color: COLORS.textMuted,
    fontWeight: '700',
  },
  googleBtn: {
    marginBottom: SPACING.lg,
  },
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noAccountText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  signupLink: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
    fontWeight: '700',
  },
});
