
'use client';

import { useState } from 'react';
import Link from 'next/link';
import Input from '@/src/components/ui/Input';
import Button from '@/src/components/ui/Button';
import Alert from '@/src/components/ui/Alert';
import { requestPasswordReset } from '@/src/services/auth';

export default function ForgotPasswordPage() {
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');

  async function handleResetRequest(e: React.FormEvent) {
    e.preventDefault();
    setResetMessage('');
    setResetLoading(true);
    const result = await requestPasswordReset(resetEmail);
    setResetLoading(false);
    if (result.error) {
      setResetMessage(result.error.message);
    } else {
      setResetMessage('If that email is registered, a reset link has been sent.');
    }
  }

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
        <Link href="/auth/sign-in" className="text-sm text-teal-700 hover:underline text-center">
          Back to sign in
        </Link>
      </form>
    </>
  );
}
