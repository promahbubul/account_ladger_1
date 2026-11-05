import React, { useState } from 'react';
import { useRouter, Link } from '../../lib/router';
import { API_BASE_URL, parseResponseJson } from '../../services/api';
import { Mail, ArrowLeft, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { getErrorMessage } from '../../lib/errors';

export const ForgotPasswordView: React.FC = () => {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = await parseResponseJson(res);

      if (!res.ok) {
        if (res.status === 429) {
          setErrorMessage(data.error || 'Too many reset requests. Please wait before trying again.');
        } else {
          setErrorMessage(data.error || 'Unable to process your request. Please try again.');
        }
      } else {
        setSuccessMessage(
          data.message ||
            'If an account exists for this email address, you will receive a password reset link shortly.'
        );
      }
    } catch (err: unknown) {
      setErrorMessage(getErrorMessage(err) || 'Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
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
          {errorMessage && (
            <div className="mb-4 p-2.5 rounded bg-red-50 border border-red-200 flex items-start gap-2 text-xs text-red-800">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <span className="leading-snug">{errorMessage}</span>
            </div>
          )}

          {successMessage ? (
            <div className="text-center py-2">
              <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-3 text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h1 className="text-sm font-semibold text-slate-900 mb-2">Check Your Email</h1>
              <p className="text-sm text-slate-700 leading-relaxed mb-6">
                {successMessage}
              </p>
              <button
                type="button"
                onClick={() => router.push('/login')}
                className="w-full py-2 px-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 hover:text-slate-900 text-xs font-medium rounded transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Sign In</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-slate-900 mb-2">Forgot your password?</h1>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Enter your email address, and we'll send you a link to reset it.
                </p>
              </div>

              <div>
                <label htmlFor="forgotpassword-field-1" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <input
                    id="forgotpassword-field-1"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    autoFocus
                    className="w-full bg-white border border-slate-300 rounded pl-8 pr-3 py-2 text-base sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0f766e] transition-colors disabled:opacity-50"
                  />
                  <Mail className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-2.5 bg-[#0f766e] hover:bg-[#115e59] disabled:opacity-50 text-white text-sm font-semibold rounded transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-slate-900" />
                    <span>Sending Reset Link...</span>
                  </>
                ) : (
                  <span>Send Reset Link</span>
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
