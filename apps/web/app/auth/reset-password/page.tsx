'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Input from '@/src/components/ui/Input';
import Button from '@/src/components/ui/Button';
import Alert from '@/src/components/ui/Alert';
import { requestPasswordReset, verifyOtpAndResetPassword } from '@/src/services/auth';
import { Eye, EyeOff, Key, ShieldCheck, Mail, ArrowLeft } from '@/src/components/ui/Icons';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Query params prefill
  const initialEmail = searchParams.get('email') || '';
  const initialRole = (searchParams.get('role') as 'Student' | 'Staff') || 'Student';
  const initialStep = searchParams.get('step') === 'verify' && initialEmail ? 2 : 1;

  // Wizard state
  const [step, setStep] = useState<1 | 2>(initialStep);
  const [role, setRole] = useState<'Student' | 'Staff'>(initialRole);

  // Step 1 fields
  const [email, setEmail] = useState(initialEmail);
  const [identifier, setIdentifier] = useState(''); // Student ID or Employee ID
  const [maskedEmail, setMaskedEmail] = useState('');

  // Step 2 fields
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Timer & cooldowns
  const [secondsLeft, setSecondsLeft] = useState(600); // 10 minutes
  const [canResend, setCanResend] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);

  // Status state
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  // Countdown timer for OTP expiry and resend cooldown
  useEffect(() => {
    if (step !== 2) return;

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });

      setResendCooldown((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [step]);

  // Compute password strength
  const getStrength = (pwd: string) => {
    if (!pwd) return 0;
    let score = 0;
    if (pwd.length >= 8) score += 25;
    if (pwd.length >= 12) score += 25;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 25;
    if (/[0-9]/.test(pwd) || /[^A-Za-z0-9]/.test(pwd)) score += 25;
    return score;
  };

  const strength = getStrength(password);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // STEP 1: Request 6-Digit OTP
  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    setIsError(false);

    if (!email.trim()) {
      setIsError(true);
      setMessage('Please enter your registered email address.');
      return;
    }

    if (!identifier.trim()) {
      setIsError(true);
      setMessage(
        role === 'Student'
          ? 'Please enter your official Student Number for identity verification.'
          : 'Please enter your official Employee ID for identity verification.'
      );
      return;
    }

    setLoading(true);
    const result = await requestPasswordReset(email.trim(), identifier.trim(), role);
    setLoading(false);

    if (result.error) {
      setIsError(true);
      setMessage(result.error.message);
    } else {
      setIsError(false);
      setMaskedEmail(result.data?.maskedEmail || email.trim());
      setStep(2);
      setSecondsLeft(600);
      setResendCooldown(60);
      setCanResend(false);
      setMessage(`Verification code dispatched! Check your institutional inbox for the 6-digit code.`);
    }
  }

  // Resend OTP
  async function handleResendCode() {
    if (!canResend || resendLoading) return;
    setMessage('');
    setIsError(false);
    setResendLoading(true);

    const result = await requestPasswordReset(email.trim(), identifier.trim(), role);
    setResendLoading(false);

    if (result.error) {
      setIsError(true);
      setMessage(result.error.message);
    } else {
      setSecondsLeft(600);
      setResendCooldown(60);
      setCanResend(false);
      setOtp('');
      setMessage('A brand new 6-digit verification code has been sent to your email.');
    }
  }

  // STEP 2: Verify Code and Reset Password
  async function handleVerifyAndReset(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    setIsError(false);

    const cleanOtp = otp.trim().replace(/\D/g, '');
    if (cleanOtp.length !== 6) {
      setIsError(true);
      setMessage('Please enter the full 6-digit numeric verification code.');
      return;
    }

    if (password.length < 8) {
      setIsError(true);
      setMessage('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirm) {
      setIsError(true);
      setMessage('Passwords do not match. Please re-enter your password.');
      return;
    }

    if (secondsLeft === 0) {
      setIsError(true);
      setMessage('Your verification code has expired. Please click "Resend Code" to receive a new one.');
      return;
    }

    setLoading(true);
    const result = await verifyOtpAndResetPassword(email.trim(), cleanOtp, password);
    setLoading(false);

    if (result.error) {
      setIsError(true);
      setMessage(result.error.message);
    } else {
      setIsError(false);
      setMessage('Password successfully updated! Redirecting you to the sign-in screen...');
      setTimeout(() => router.push('/auth/sign-in'), 1800);
    }
  }

  return (
    <div className="page-fade-in space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-xl font-black text-[#0A3D24] font-serif">
            {step === 1 ? 'Reset Account Password' : 'Enter Verification Code'}
          </h2>
        </div>
        <p className="text-xs text-slate-500">
          {step === 1
            ? 'Verify your institutional identity to receive a secure 6-digit verification code.'
            : `Enter the 6-digit code sent to ${maskedEmail || email} and set your new password.`}
        </p>
      </div>

      {/* Progress Pills */}
      <div className="flex items-center gap-2 py-1">
        <div
          className={`flex-1 h-1.5 rounded-full transition-colors ${
            step >= 1 ? 'bg-[#0A3D24]' : 'bg-slate-200'
          }`}
        />
        <div
          className={`flex-1 h-1.5 rounded-full transition-colors ${
            step >= 2 ? 'bg-[#0A3D24]' : 'bg-slate-200'
          }`}
        />
      </div>

      {/* STEP 1: Identity Proofing Form */}
      {step === 1 && (
        <form onSubmit={handleRequestOtp} className="flex flex-col gap-4">
          {/* Role Selector Tabs */}
          <div className="flex rounded-lg bg-slate-100 p-1 border border-slate-200">
            <button
              type="button"
              onClick={() => {
                setRole('Student');
                setMessage('');
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                role === 'Student'
                  ? 'bg-white text-[#0A3D24] shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Student / Trainee
            </button>
            <button
              type="button"
              onClick={() => {
                setRole('Staff');
                setMessage('');
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                role === 'Staff'
                  ? 'bg-white text-[#0A3D24] shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Coordinator / Faculty
            </button>
          </div>

          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 text-xs flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed text-emerald-800">
              <strong>Two-Point Verification:</strong> To protect institutional accounts, please provide both your registered email and official {role === 'Student' ? 'Student Number' : 'Employee ID'}.
            </p>
          </div>

          <Input
            label="Registered Institutional Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={role === 'Student' ? 'student@cdm.edu.ph' : 'faculty@cdm.edu.ph'}
            required
          />

          <Input
            label={role === 'Student' ? 'CdM Student Number' : 'CdM Employee ID'}
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder={role === 'Student' ? 'e.g. 2021-00123' : 'e.g. 2024-001'}
            required
          />

          {message && <Alert type={isError ? 'error' : 'success'} message={message} />}

          <Button
            type="submit"
            loading={loading}
            className="w-full mt-1 bg-[#0A3D24] hover:bg-[#062415] text-[#FFCC00] font-bold shadow-md shadow-[#0A3D24]/20 cursor-pointer"
          >
            <Mail className="w-4 h-4 mr-1.5" />
            Send 6-Digit Code
          </Button>

          <div className="text-center pt-1">
            <Link
              href="/auth/sign-in"
              className="text-xs font-bold text-[#0A3D24] hover:text-[#062415] hover:underline inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Sign In
            </Link>
          </div>
        </form>
      )}

      {/* STEP 2: Enter 6-Digit OTP & Set New Password */}
      {step === 2 && (
        <form onSubmit={handleVerifyAndReset} className="flex flex-col gap-4">
          {/* OTP Code Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">
                6-Digit Verification Code
              </label>
              <span
                className={`text-[11px] font-bold font-mono ${
                  secondsLeft < 60 ? 'text-rose-600 animate-pulse' : 'text-slate-500'
                }`}
              >
                Expires in: {formatTimer(secondsLeft)}
              </span>
            </div>

            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                required
                className="w-full text-center text-2xl font-extrabold tracking-[0.5em] font-mono py-2.5 px-4 bg-slate-50 border-2 border-[#0A3D24]/40 focus:border-[#0A3D24] focus:bg-white rounded-xl text-[#0A3D24] outline-none transition-all"
              />
            </div>

            <div className="flex items-center justify-between pt-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setMessage('');
                  setIsError(false);
                }}
                className="text-slate-500 hover:text-slate-800 underline cursor-pointer"
              >
                Change Email / ID
              </button>

              <button
                type="button"
                onClick={handleResendCode}
                disabled={!canResend || resendLoading}
                className={`font-bold transition-colors cursor-pointer ${
                  canResend
                    ? 'text-[#0A3D24] hover:underline'
                    : 'text-slate-400 cursor-not-allowed'
                }`}
              >
                {resendLoading
                  ? 'Sending...'
                  : canResend
                  ? 'Resend Code'
                  : `Resend in ${resendCooldown}s`}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">New Password</label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Strength Meter */}
            {password.length > 0 && (
              <div className="pt-1 space-y-1">
                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className="text-slate-400">Password Strength:</span>
                  <span
                    className={
                      strength <= 25
                        ? 'text-rose-600'
                        : strength <= 50
                        ? 'text-amber-600'
                        : strength <= 75
                        ? 'text-blue-600'
                        : 'text-emerald-600'
                    }
                  >
                    {strength <= 25
                      ? 'Weak (Min 8 chars)'
                      : strength <= 50
                      ? 'Fair'
                      : strength <= 75
                      ? 'Good'
                      : 'Strong & Secure'}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      strength <= 25
                        ? 'bg-rose-500 w-1/4'
                        : strength <= 50
                        ? 'bg-amber-500 w-2/4'
                        : strength <= 75
                        ? 'bg-blue-500 w-3/4'
                        : 'bg-emerald-500 w-full'
                    }`}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Confirm New Password</label>
            <div className="relative">
              <Input
                type={showConfirm ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter password"
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirm.length > 0 && password !== confirm && (
              <p className="text-[11px] font-bold text-rose-600 pt-0.5">
                Passwords do not match.
              </p>
            )}
          </div>

          {message && <Alert type={isError ? 'error' : 'success'} message={message} />}

          <Button
            type="submit"
            loading={loading}
            className="w-full mt-1 bg-[#0A3D24] hover:bg-[#062415] text-[#FFCC00] font-bold shadow-md shadow-[#0A3D24]/20 cursor-pointer"
          >
            <Key className="w-4 h-4 mr-1.5" />
            Verify Code &amp; Save Password
          </Button>

          <div className="text-center pt-1">
            <Link
              href="/auth/sign-in"
              className="text-xs font-bold text-[#0A3D24] hover:text-[#062415] hover:underline inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Cancel and Return to Sign In
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-xs text-slate-400">Loading password reset...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
