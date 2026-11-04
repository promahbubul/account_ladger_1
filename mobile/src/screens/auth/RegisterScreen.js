import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { useAuth } from '../../context/AuthContext';
import { signInWithGoogleFirebase, checkRedirectAuthResult } from '../../services/auth/firebase';

export const RegisterScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { register, googleLogin } = useAuth();

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
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
                setError(res?.error || 'Google registration failed.');
              }
            })
            .catch((err) => {
              if (isMounted) setError(err.message || 'Google registration failed.');
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

  const handleRegister = async () => {
    if (loading || googleLoading) return;
    setError('');
    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      const res = await register({
        fullName: fullName.trim() || undefined,
        username: username.trim() || undefined,
        email: email.trim().toLowerCase(),
        password,
      });

      if (res.email) {
        navigation.navigate('VerifyEmail', { email: res.email });
      }
    } catch (err) {
      setError(err.message || 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
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
        setError(res.error || 'Google registration failed.');
      }
    } catch (err) {
      setError(err.message || 'Google registration could not be completed.');
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
        <View style={styles.formCard}>
          <TouchableOpacity style={styles.backLink} disabled={isBusy} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={COLORS.textSecondary} />
            <Text style={styles.backLinkText}>Back to Sign In</Text>
          </TouchableOpacity>

          <Text style={styles.heading}>Create Account</Text>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={COLORS.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Input
            label="Full Name (Optional)"
            autoCapitalize="words"
            placeholder="e.g. Mahbubul Alam"
            value={fullName}
            onChangeText={setFullName}
            editable={!isBusy}
            leftIcon={<Ionicons name="person-outline" size={18} color={COLORS.textSecondary} />}
          />

          <Input
            label="Username (Optional)"
            placeholder="e.g. mahbub"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            editable={!isBusy}
            leftIcon={<Ionicons name="at-outline" size={18} color={COLORS.textSecondary} />}
          />

          <Input
            label="Email Address *"
            placeholder="e.g. user@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!isBusy}
            leftIcon={<Ionicons name="mail-outline" size={18} color={COLORS.textSecondary} />}
          />

          <Input
            label="Password (min 6 chars) *"
            placeholder="Create a password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!isBusy}
            leftIcon={<Ionicons name="lock-closed-outline" size={18} color={COLORS.textSecondary} />}
          />

          <Button
            title="Create Account"
            onPress={handleRegister}
            loading={loading}
            disabled={isBusy}
            style={styles.submitBtn}
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
            onPress={handleGoogleRegister}
            loading={googleLoading}
            disabled={isBusy}
            style={styles.googleBtn}
          />

          <View style={styles.loginRow}>
            <Text style={styles.haveAccountText}>Already have an account? </Text>
            <TouchableOpacity disabled={isBusy} onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginLink}>Sign in</Text>
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
  formCard: {
    backgroundColor: 'transparent',
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    gap: 6,
  },
  backLinkText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  heading: {
    marginBottom: SPACING.lg,
    fontSize: FONT_SIZE.xl,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.3,
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
  submitBtn: {
    marginTop: SPACING.sm,
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
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  haveAccountText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  loginLink: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
    fontWeight: '700',
  },
});
