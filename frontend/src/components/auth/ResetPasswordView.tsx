import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams, Link } from '../../lib/router';
import { API_BASE_URL, parseResponseJson } from '../../services/api';
import { Eye, EyeOff, AlertCircle, CheckCircle2, Loader2, ArrowLeft, KeyRound } from 'lucide-react';
import { getErrorMessage } from '../../lib/errors';

export const ResetPasswordView: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [isVerifying, setIsVerifying] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Validate token with backend upon loading
  useEffect(() => {
    let isMounted = true;

    const verifyToken = async () => {
      if (!token) {
        if (isMounted) {
          setTokenError('Missing password reset token. Please use the link provided in your email.');
          setIsVerifying(false);
        }
        return;
      }

      try {
        const res = await fetch(`${API_BASE_URL}/auth/verify-reset-token?token=${encodeURIComponent(token)}`);
        const data = await parseResponseJson(res);

        if (isMounted) {
          if (!res.ok || !data.valid) {
            setTokenError(
              data.error || 'This password reset link is invalid, expired, or has already been used.'
            );
          }
          setIsVerifying(false);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setTokenError('Unable to verify reset link. Please check your network connection.');
          setIsVerifying(false);
        }
      }
    };

    verifyToken();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setErrorMessage(null);

    if (!newPassword || newPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify both fields.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          newPassword,
        }),
      });

      const data = await parseResponseJson(res);

      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to reset password. The link may have expired.');
      } else {
        setIsSuccess(true);
      }
    } catch (err: unknown) {
      setErrorMessage(getErrorMessage(err) || 'Network error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center justify-center gap-2 font-semibold text-slate-900 mb-6">
          <img src="/logo.png" alt="" className="w-8 h-8 object-contain" />
          AccountLedger
        </Link>

        {/* Card */}
        <div className="bg-white border border-slate-200 rounded p-6">
          {isVerifying ? (
            <div className="py-8 flex flex-col items-center justify-center text-center">
              <Loader2 className="w-6 h-6 animate-spin text-slate-500 mb-3" />
              <p className="text-xs text-slate-500">Verifying reset token...</p>
            </div>
          ) : tokenError ? (
            <div className="py-2 text-center">
              <div className="w-10 h-10 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-3 text-red-600">
                <AlertCircle className="w-5 h-5" />
              </div>
              <h1 className="text-sm font-semibold text-slate-900 mb-2">Invalid or Expired Link</h1>
              <p className="text-xs text-red-800 leading-relaxed mb-6">
                {tokenError}
              </p>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => router.push('/forgot-password')}
                  className="w-full py-2 px-3 bg-[#0f766e] hover:bg-[#115e59] text-white text-sm font-semibold rounded transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Request New Reset Link</span>
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/login')}
                  className="w-full py-2 px-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 hover:text-slate-900 text-xs font-medium rounded transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Return to Sign In</span>
                </button>
              </div>
            </div>
          ) : isSuccess ? (
            <div className="text-center py-2">
              <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-3 text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h1 className="text-sm font-semibold text-slate-900 mb-2">Password Reset Complete</h1>
              <p className="text-sm text-slate-700 leading-relaxed mb-6">
                Your password has been successfully updated. You can now sign in with your new credentials.
              </p>
              <button
                type="button"
                onClick={() => router.push('/login')}
                className="w-full py-2.5 bg-[#0f766e] hover:bg-[#115e59] text-white text-sm font-semibold rounded transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Sign In to Account</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <div className="p-2.5 rounded bg-red-50 border border-red-200 flex items-start gap-2 text-xs text-red-800">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <span className="leading-snug">{errorMessage}</span>
                </div>
              )}

              <div>
                <label htmlFor="resetpassword-field-1" className="block text-sm font-medium text-slate-700 mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <input
                    id="resetpassword-field-1"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    disabled={isSubmitting}
                    className="w-full bg-white border border-slate-300 rounded pl-3 pr-9 py-2 text-base sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0f766e] transition-colors disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="resetpassword-field-2" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    id="resetpassword-field-2"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full bg-white border border-slate-300 rounded pl-3 pr-9 py-2 text-base sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0f766e] transition-colors disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-2.5 bg-[#0f766e] hover:bg-[#115e59] disabled:opacity-50 text-white text-sm font-semibold rounded transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-slate-900" />
                    <span>Resetting Password...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Reset Password</span>
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => router.push('/login')}
                  className="text-xs text-slate-500 hover:text-slate-800 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>Back to Sign In</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
