'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Input from '@/src/components/ui/Input';
import Button from '@/src/components/ui/Button';
import Alert from '@/src/components/ui/Alert';
import { signIn } from '@/src/services/auth';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await signIn({ email, password });
    setLoading(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  async function handleResetRequest(e: React.FormEvent) {
    e.preventDefault();
    setResetMessage('');
    setResetLoading(true);
    const { requestPasswordReset } = await import('@/src/services/auth');
    const result = await requestPasswordReset(resetEmail);
    setResetLoading(false);
    if (result.error) {
      setResetMessage(result.error.message);
    } else {
      setResetMessage('If that email is registered, a secure recovery link has been dispatched to your inbox.');
    }
  }

  if (showForgot) {
    return (
      <>
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">🔐</span>
            <h2 className="text-xl font-black text-[#0A3D24] font-serif">Reset Password</h2>
          </div>
          <p className="text-xs text-slate-500">
            Enter your institutional email to receive a recovery link.
          </p>
        </div>
        <form onSubmit={handleResetRequest} className="flex flex-col gap-4">
          <Input
            label="Institutional Email"
            type="email"
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            placeholder="username@cdm.edu.ph"
            required
          />
          {resetMessage && (
            <Alert
              type={resetMessage.includes('dispatched') ? 'success' : 'error'}
              message={resetMessage}
            />
          )}
          <Button type="submit" loading={resetLoading} className="w-full mt-1 shadow-md shadow-[#0A3D24]/20">
            Send Reset Link
          </Button>
          <button
            type="button"
            onClick={() => setShowForgot(false)}
            className="text-xs font-bold text-[#0A3D24] hover:text-[#062415] hover:underline text-center mt-1 cursor-pointer"
          >
            ← Back to Sign In
          </button>
        </form>
      </>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-black text-[#0A3D24] font-serif tracking-tight">Sign In</h2>
        <p className="text-xs text-slate-500 mt-1">
          Enter your institutional credentials to continue.
        </p>
      </div>

      <form onSubmit={handleSignIn} className="flex flex-col gap-4">
        {/* Dynamic Placeholder */}
        <Input
          label="Institutional Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="username@cdm.edu.ph"
          required
        />

        {/* Password field with Visibility Toggle */}
        <div className="flex flex-col gap-1 w-full">
          <label className="text-xs font-bold text-slate-700">Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 pr-11 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:ring-2 focus:ring-[#0A3D24] focus:border-[#0A3D24] hover:border-slate-300"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0A3D24] text-sm p-1 transition-colors cursor-pointer"
              title={showPassword ? 'Hide Password' : 'Show Password'}
              aria-label={showPassword ? 'Hide Password' : 'Show Password'}
            >
              {showPassword ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {error && <Alert type="error" message={error} />}

        {/* Enhanced Visual Hierarchy Button */}
        <Button
          type="submit"
          loading={loading}
          className="w-full mt-1.5 py-3 shadow-md shadow-[#0A3D24]/30 hover:shadow-lg transition-all text-sm font-extrabold"
        >
          Sign In
        </Button>

        {/* Action Links with Clear Hover Underlines */}
        <div className="flex items-center justify-between text-xs pt-2">
          <Link
            href="/auth/register"
            className="text-[#0A3D24] hover:text-[#062415] font-bold hover:underline transition-colors"
          >
            Student Registration
          </Link>
          <button
            type="button"
            onClick={() => setShowForgot(true)}
            className="text-slate-500 hover:text-[#0A3D24] font-medium hover:underline transition-colors cursor-pointer"
          >
            Forgot password?
          </button>
        </div>
      </form>
    </>
  );
}
