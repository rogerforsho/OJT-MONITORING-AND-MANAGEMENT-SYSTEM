'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Input from '@/src/components/ui/Input';
import Button from '@/src/components/ui/Button';
import Alert from '@/src/components/ui/Alert';
import { updatePassword } from '@/src/services/auth';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
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
      setMessage('Password updated successfully.');
      setTimeout(() => router.push('/auth/sign-in'), 1500);
    }
  }

  return (
    <>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900">Set new password</h2>
        <p className="text-sm text-slate-500 mt-1">Choose a strong password for your account.</p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="New Password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 8 characters" required />
        <Input label="Confirm Password" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Re-enter password" required />
        {message && <Alert type={isError ? 'error' : 'success'} message={message} />}
        <Button type="submit" loading={loading} className="w-full mt-1">Update Password</Button>
      </form>
    </>
  );
}
