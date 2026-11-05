import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { signInWithGoogle } from '../../lib/firebase';
import { Link, usePathname, useRouter } from '../../lib/router';
import { Eye, EyeOff, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { getErrorMessage } from '../../lib/errors';

const FIELD =
  'w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-base sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0f766e] focus:ring-1 focus:ring-[#0f766e]';
const LABEL = 'block text-sm font-medium text-slate-700 mb-1.5';
const LINK = 'text-[#0f766e] hover:text-[#115e59] font-medium';
const SUBMIT =
  'w-full py-2.5 bg-[#0f766e] hover:bg-[#115e59] disabled:opacity-50 text-white text-sm font-medium rounded-md flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed';

const PasswordField: React.FC<{
  id: string;
  autoComplete: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
}> = ({ id, autoComplete, placeholder, value, onChange }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${FIELD} pr-10`}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-500 hover:text-slate-800"
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
};

export const LoginView: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { login, register, loginWithGoogle } = useAuth();
  // The address decides the form, so links and the Back button both work.
  const isRegister = pathname === '/register';

  // Sign in state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // Register state
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  // Status state
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

  useEffect(() => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setUnverifiedEmail(null);
    document.title = `${isRegister ? 'Create account' : 'Sign in'} | AccountLedger`;
    return () => {
      document.title = 'AccountLedger';
    };
  }, [isRegister]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    setUnverifiedEmail(null);

    const cleanIdentifier = identifier.trim();
    if (!cleanIdentifier) {
      setErrorMessage('Please enter your username or email.');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsLoading(true);
    const res = await login(cleanIdentifier, password);
    setIsLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Invalid credentials. Please verify your login details.');
      if (res.emailVerified === false) {
        setUnverifiedEmail(res.email || cleanIdentifier);
      }
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    setUnverifiedEmail(null);

    const email = regEmail.trim();

    if (!email || !regPassword) {
      setErrorMessage('Please provide both email and password.');
      return;
    }

    if (!email.includes('@') || !email.includes('.')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (regPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);
    const res = await register({
      email,
      password: regPassword,
    });
    setIsLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Registration failed.');
    } else {
      setSuccessMessage('Account created! Redirecting to email verification...');
      setTimeout(() => {
        router.push(`/verify-email?email=${encodeURIComponent(res.email || email)}`);
      }, 500);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsGoogleLoading(true);

    try {
      // 1. Authenticate with official Firebase Google popup
      const { idToken } = await signInWithGoogle();

      // 2. Send verified Firebase ID token to backend for server-side verification and passwordless auto-linking
      const res = await loginWithGoogle(idToken);

      if (!res.success) {
        setErrorMessage(res.error || 'Google authentication failed.');
      }
    } catch (err: unknown) {
      setErrorMessage(getErrorMessage(err) || 'Google authentication could not be completed.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center justify-center gap-2 font-semibold text-slate-900 mb-6">
          <img src="/logo.png" alt="" className="w-8 h-8 object-contain" />
          AccountLedger
        </Link>

        <div className="bg-white border border-slate-200 rounded-md p-6">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 mb-5">
            {isRegister ? 'Create your account' : 'Sign in'}
          </h1>

          {errorMessage && (
            <div role="alert" className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-800">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
              {unverifiedEmail && (
                <button
                  type="button"
                  onClick={() => router.push(`/verify-email?email=${encodeURIComponent(unverifiedEmail)}`)}
                  className="mt-2 ml-6 font-medium underline cursor-pointer"
                >
                  Enter verification code
                </button>
              )}
            </div>
          )}

          {successMessage && (
            <div role="status" className="mb-4 p-3 rounded-md bg-emerald-50 border border-emerald-200 flex items-start gap-2 text-sm text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {isRegister ? (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label htmlFor="register-email" className={LABEL}>Email</label>
                <input
                  id="register-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className={FIELD}
                />
              </div>

              <div>
                <label htmlFor="register-password" className={LABEL}>Password</label>
                <PasswordField
                  id="register-password"
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                  value={regPassword}
                  onChange={setRegPassword}
                />
              </div>

              <button type="submit" disabled={isLoading || isGoogleLoading} className={SUBMIT}>
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {isLoading ? 'Creating account...' : 'Create account'}
              </button>

              <p className="text-xs text-slate-500">
                By creating an account, you agree to our <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>.
              </p>
            </form>
          ) : (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label htmlFor="login-identifier" className={LABEL}>Username or email</label>
                <input
                  id="login-identifier"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className={FIELD}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="login-password" className="block text-sm font-medium text-slate-700">Password</label>
                  <Link href="/forgot-password" className={`text-sm ${LINK}`}>Forgot password?</Link>
                </div>
                <PasswordField
                  id="login-password"
                  autoComplete="current-password"
                  value={password}
                  onChange={setPassword}
                />
              </div>

              <button type="submit" disabled={isLoading || isGoogleLoading} className={SUBMIT}>
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {isLoading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
          )}

          <div className="flex items-center gap-3 my-4" aria-hidden="true">
            <div className="border-t border-slate-200 flex-1" />
            <span className="text-xs text-slate-500">or</span>
            <div className="border-t border-slate-200 flex-1" />
          </div>

          <button
            type="button"
            id="btn-google-auth"
            onClick={handleGoogleSignIn}
            disabled={isLoading || isGoogleLoading}
            className="w-full py-2.5 px-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-sm font-medium rounded-md flex items-center justify-center gap-2.5 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            {isGoogleLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                <span>Connecting with Google...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>
        </div>

        <p className="mt-5 text-center text-sm text-slate-600">
          {isRegister ? (
            <>Already have an account? <Link href="/login" className={LINK}>Sign in</Link></>
          ) : (
            <>New to AccountLedger? <Link href="/register" className={LINK}>Create an account</Link></>
          )}
        </p>
      </div>
    </div>
  );
};
