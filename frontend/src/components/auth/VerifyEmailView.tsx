import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter, useSearchParams, Link } from '../../lib/router';
import { ShieldCheck, AlertCircle, CheckCircle2, Loader2, ArrowLeft, RotateCw } from 'lucide-react';

export const VerifyEmailView: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { verifyEmail, resendVerification } = useAuth();

  const initialEmail = searchParams.get('email') || '';
  const [email, setEmail] = useState(initialEmail);
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Resend cooldown timer (60 seconds)
  const [cooldown, setCooldown] = useState<number>(60);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Auto-focus first digit input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleDigitChange = (index: number, value: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    // Allow only numeric digits
    const cleaned = value.replace(/\D/g, '');

    if (!cleaned) {
      const nextDigits = [...digits];
      nextDigits[index] = '';
      setDigits(nextDigits);
      return;
    }

    // Handle single character typed
    if (cleaned.length === 1) {
      const nextDigits = [...digits];
      nextDigits[index] = cleaned;
      setDigits(nextDigits);

      // Advance focus to next input
      if (index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
      return;
    }

    // Handle multiple digits (e.g. pasted into a single box)
    const chars = cleaned.slice(0, 6).split('');
    const nextDigits = [...digits];
    for (let i = 0; i < chars.length; i++) {
      if (index + i < 6) {
        nextDigits[index + i] = chars[i];
      }
    }
    setDigits(nextDigits);

    const nextIndex = Math.min(5, index + chars.length);
    inputRefs.current[nextIndex]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        // Move back and clear previous
        const nextDigits = [...digits];
        nextDigits[index - 1] = '';
        setDigits(nextDigits);
        inputRefs.current[index - 1]?.focus();
      } else {
        const nextDigits = [...digits];
        nextDigits[index] = '';
        setDigits(nextDigits);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const pastedData = e.clipboardData.getData('text').trim().replace(/\D/g, '');
    if (!pastedData) return;

    const chars = pastedData.slice(0, 6).split('');
    const nextDigits = ['', '', '', '', '', ''];
    for (let i = 0; i < chars.length; i++) {
      nextDigits[i] = chars[i];
    }
    setDigits(nextDigits);

    const focusIdx = Math.min(5, chars.length);
    inputRefs.current[focusIdx]?.focus();
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage('Please provide the account email address.');
      return;
    }

    const fullCode = digits.join('');
    if (fullCode.length !== 6 || !/^\d{6}$/.test(fullCode)) {
      setErrorMessage('Please enter all 6 digits of the verification code.');
      return;
    }

    setIsLoading(true);
    const res = await verifyEmail(cleanEmail, fullCode);
    setIsLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Verification failed. Please check the code and try again.');
    } else {
      setSuccessMessage('Email verified successfully! Accessing your dashboard...');
      setTimeout(() => {
        router.replace('/dashboard');
      }, 800);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || isResending) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage('Please provide an email address to resend the code.');
      return;
    }

    setIsResending(true);
    const res = await resendVerification(cleanEmail);
    setIsResending(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Failed to resend verification code.');
      if (res.retryAfter) {
        setCooldown(res.retryAfter);
      }
    } else {
      setSuccessMessage(res.message || 'A fresh 6-digit code has been dispatched to your email.');
      setCooldown(60);
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
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
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center text-[#0f766e]">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-slate-900">Verify Your Email</h1>
            </div>
          </div>

          <p className="text-xs text-slate-700 mt-2 mb-4 leading-relaxed">
            We have sent a 6-digit verification code to{' '}
            <strong className="text-slate-900 font-medium">{email || 'your email'}</strong>.
            Please enter it below to activate your account.
          </p>

          {/* Error Alert */}
          {errorMessage && (
            <div className="mb-4 p-2.5 rounded bg-red-50 border border-red-200 flex items-start gap-2 text-xs text-red-800">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <span className="leading-snug">{errorMessage}</span>
            </div>
          )}

          {/* Success Alert */}
          {successMessage && (
            <div className="mb-4 p-2.5 rounded bg-emerald-50 border border-emerald-200 flex items-start gap-2 text-xs text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <span className="leading-snug">{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-4">
            {!initialEmail && (
              <div>
                <label htmlFor="verifyemail-field-1" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Account Email
                </label>
                <input
                    id="verifyemail-field-1"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-base sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0f766e] transition-colors"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-2 text-center">
                6-Digit Verification Code
              </label>

              {/* 6 Digit Input Boxes */}
              <div
                className="flex items-center justify-between gap-2"
                onPaste={handlePaste}
              >
                {digits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      inputRefs.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    className="w-11 h-12 text-center text-lg font-bold text-slate-900 bg-white border border-slate-300 rounded focus:outline-none focus:border-[#0f766e] focus:ring-1 focus:ring-[#0f766e] transition-colors"
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || digits.join('').length !== 6}
              className="w-full mt-2 py-2.5 bg-[#0f766e] hover:bg-[#115e59] disabled:opacity-50 text-white text-sm font-semibold rounded transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-900" />
                  <span>Verifying Code...</span>
                </>
              ) : (
                <span>Verify & Continue</span>
              )}
            </button>
          </form>

          {/* Resend Code Section */}
          <div className="mt-5 pt-4 border-t border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-500">Didn't receive code?</span>
            <button
              type="button"
              onClick={handleResend}
              disabled={cooldown > 0 || isResending}
              className="text-[#0f766e] hover:text-[#115e59] font-medium disabled:text-slate-500 disabled:cursor-not-allowed transition-colors flex items-center gap-1 cursor-pointer"
            >
              {isResending ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Resending...</span>
                </>
              ) : cooldown > 0 ? (
                <span>Resend in {cooldown}s</span>
              ) : (
                <>
                  <RotateCw className="w-3 h-3" />
                  <span>Resend code</span>
                </>
              )}
            </button>
          </div>

          {/* Back to Sign In */}
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Back to Sign In</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
