import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { signInWithGoogle } from '../../lib/firebase';
import { useRouter } from '../../lib/router';
import { Eye, EyeOff, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

export const LoginView: React.FC = () => {
  const router = useRouter();
  const { login, register, loginWithGoogle } = useAuth();
  const [mode, setMode] = useState<'signin' | 'register'>('signin');


  // Sign in state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Register state
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Status state
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
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
    } catch (err: any) {
      setErrorMessage(err.message || 'Google authentication could not be completed.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0f12] text-gray-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-6">
          <img
            src="/logo.png"
            alt="Account Ladger Logo"
            className="w-12 h-12 object-contain mx-auto mb-3"
          />
          <h1 className="text-xl font-bold tracking-tight text-white">Account Ladger</h1>
        </div>

        {/* Card */}
        <div className="bg-[#14171d] border border-[#22252c] rounded p-6 shadow-sm">
          {/* Mode switch */}
          <div className="flex border-b border-[#22252c] mb-5 pb-1">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 py-1.5 text-xs font-medium text-center transition-colors border-b-2 ${
                mode === 'signin'
                  ? 'text-white border-blue-500'
                  : 'text-gray-400 border-transparent hover:text-gray-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 py-1.5 text-xs font-medium text-center transition-colors border-b-2 ${
                mode === 'register'
                  ? 'text-white border-blue-500'
                  : 'text-gray-400 border-transparent hover:text-gray-200'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="mb-4 p-2.5 rounded bg-red-950/40 border border-red-800/60 text-xs text-red-300">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <span className="leading-snug">{errorMessage}</span>
              </div>
              {unverifiedEmail && (
                <div className="mt-2 pt-2 border-t border-red-800/40 flex justify-end">
                  <button
                    type="button"
                    onClick={() => router.push(`/verify-email?email=${encodeURIComponent(unverifiedEmail)}`)}
                    className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 underline cursor-pointer"
                  >
                    Enter verification code &rarr;
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="mb-4 p-2.5 rounded bg-emerald-950/40 border border-emerald-800/60 flex items-start gap-2 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span className="leading-snug">{successMessage}</span>
            </div>
          )}

          {/* Official Google Social Sign-In Button */}
          <button
            type="button"
            id="btn-google-auth"
            aria-label="Continue with Google"
            onClick={handleGoogleSignIn}
            disabled={isLoading || isGoogleLoading}
            className="w-full mb-4 py-2 px-3 bg-[#1a1d24] hover:bg-[#222631] border border-[#2b2f3a] text-gray-200 hover:text-white text-xs font-medium rounded transition-colors flex items-center justify-center gap-2.5 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            {isGoogleLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                <span>Connecting with Google...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
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

          {/* Divider */}
          <div className="relative flex items-center justify-center mb-4">
            <div className="border-t border-[#22252c] w-full"></div>
            <span className="bg-[#14171d] px-2 text-[10px] text-gray-400 uppercase tracking-wider">
              or
            </span>
            <div className="border-t border-[#22252c] w-full"></div>
          </div>

          {mode === 'signin' ? (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  Username or Email
                </label>
                <input
                  type="text"
                  autoComplete="username"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full bg-[#1b1e25] border border-[#2b2f3a] rounded px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-gray-300">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => router.push('/forgot-password')}
                    className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#1b1e25] border border-[#2b2f3a] rounded pl-3 pr-9 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-200 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || isGoogleLoading}
                className="w-full mt-2 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {isLoading ? <span>Signing In...</span> : <span>Sign In</span>}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="w-full bg-[#1b1e25] border border-[#2b2f3a] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full bg-[#1b1e25] border border-[#2b2f3a] rounded pl-3 pr-9 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-200 transition-colors"
                  >
                    {showRegPassword ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || isGoogleLoading}
                className="w-full mt-3 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span>Creating Account...</span>
                ) : (
                  <span>Create Account</span>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

