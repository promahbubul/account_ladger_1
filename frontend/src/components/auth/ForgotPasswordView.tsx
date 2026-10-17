import React, { useState } from 'react';
import { useRouter } from '../../lib/router';
import { API_BASE_URL, parseResponseJson } from '../../services/api';
import { Mail, ArrowLeft, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

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
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
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
          {errorMessage && (
            <div className="mb-4 p-2.5 rounded bg-red-950/40 border border-red-800/60 flex items-start gap-2 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span className="leading-snug">{errorMessage}</span>
            </div>
          )}

          {successMessage ? (
            <div className="text-center py-2">
              <div className="w-10 h-10 rounded-full bg-emerald-950/50 border border-emerald-800/60 flex items-center justify-center mx-auto mb-3 text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h2 className="text-sm font-semibold text-white mb-2">Check Your Email</h2>
              <p className="text-xs text-gray-300 leading-relaxed mb-6">
                {successMessage}
              </p>
              <button
                type="button"
                onClick={() => router.push('/')}
                className="w-full py-2 px-3 bg-[#1a1d24] hover:bg-[#222631] border border-[#2b2f3a] text-gray-200 hover:text-white text-xs font-medium rounded transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Sign In</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-xs text-gray-300 leading-relaxed mb-4">
                Enter your email address to receive a secure password reset link.
              </p>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    autoFocus
                    className="w-full bg-[#1b1e25] border border-[#2b2f3a] rounded pl-8 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
                  />
                  <Mail className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Sending Reset Link...</span>
                  </>
                ) : (
                  <span>Send Reset Link</span>
                )}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => router.push('/')}
                  className="text-xs text-gray-400 hover:text-gray-200 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
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
