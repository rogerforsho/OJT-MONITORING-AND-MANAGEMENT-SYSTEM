'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Input from '@/src/components/ui/Input';
import Button from '@/src/components/ui/Button';
import Alert from '@/src/components/ui/Alert';
import { updatePassword } from '@/src/services/auth';
import { Eye, EyeOff, Key, ShieldCheck } from '@/src/components/ui/Icons';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    if (password.length < 8) {
      setIsError(true);
      setMessage('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirm) {
      setIsError(true);
      setMessage('Passwords do not match.');
      return;
    }
    setLoading(true);
    const result = await updatePassword(password);
    setLoading(false);
    if (result.error) {
      setIsError(true);
      setMessage(result.error.message);
    } else {
      setIsError(false);
      setMessage('Your password has been successfully updated! Redirecting to sign in...');
      setTimeout(() => router.push('/auth/sign-in'), 1500);
    }
  }

  return (
    <div className="page-fade-in space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-xl font-black text-[#0A3D24] font-serif">Set New Password</h2>
        </div>
        <p className="text-xs text-slate-500">
          Create a secure, private password for your Colegio de Montalban account.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* New Password Field */}
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

        {/* Confirm Password Field */}
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
          Save New Password
        </Button>

        <div className="text-center pt-1">
          <Link
            href="/auth/sign-in"
            className="text-xs font-bold text-[#0A3D24] hover:text-[#062415] hover:underline"
          >
            ← Back to Sign In
          </Link>
        </div>
      </form>
    </div>
  );
}
