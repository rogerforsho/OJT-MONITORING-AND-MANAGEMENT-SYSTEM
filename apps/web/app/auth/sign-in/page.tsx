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
      setResetMessage('If that email is registered, a reset link has been sent.');
    }
  }

  if (showForgot) {
    return (
      <>
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-900">Reset your password</h2>
          <p className="text-sm text-slate-500 mt-1">Enter your email and we'll send a reset link.</p>
        </div>
        <form onSubmit={handleResetRequest} className="flex flex-col gap-4">
          <Input label="Email" type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} placeholder="you@example.com" required />
          {resetMessage && (
            <Alert type={resetMessage.includes('sent') ? 'success' : 'error'} message={resetMessage} />
          )}
          <Button type="submit" loading={resetLoading} className="w-full mt-1">Send Reset Link</Button>
          <button type="button" onClick={() => setShowForgot(false)} className="text-sm text-teal-700 hover:underline text-center">
            Back to sign in
          </button>
        </form>
      </>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900">Welcome back</h2>
        <p className="text-sm text-slate-500 mt-1">Sign in to your OJT account</p>
      </div>
      <form onSubmit={handleSignIn} className="flex flex-col gap-4">
        <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
        <Input label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
        {error && <Alert type="error" message={error} />}
        <Button type="submit" loading={loading} className="w-full mt-1">Sign In</Button>
        <div className="flex items-center justify-between text-sm">
          <Link href="/auth/register" className="text-teal-700 hover:underline">Create an account</Link>
          <button type="button" onClick={() => setShowForgot(true)} className="text-slate-500 hover:text-teal-700 hover:underline">
            Forgot password?
          </button>
        </div>
      </form>
    </>
  );
}
