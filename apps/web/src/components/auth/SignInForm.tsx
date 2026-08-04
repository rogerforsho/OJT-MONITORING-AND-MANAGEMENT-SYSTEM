
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Input from '@/src/components/ui/Input';
import Button from '@/src/components/ui/Button';
import Alert from '@/src/components/ui/Alert';
import { signIn } from '@/src/services/auth';

export default function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

    const route = (() => {
      switch (result.data?.role) {
        case 'Student':
          return '/student/attendance';
        case 'Coordinator':
          return '/coordinator/approvals';
        case 'Supervisor':
          return '/supervisor/attendance';
        case 'ProgramHead':
          return '/program-head/reports';
        case 'Admin':
          return '/admin';
        default:
          return '/dashboard';
      }
    })();

    router.push(route);
    router.refresh();
  }

  return (
    <form onSubmit={handleSignIn} className="flex flex-col gap-4">
      <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
      <Input label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
      {error && <Alert type="error" message={error} />}
      <Button type="submit" loading={loading} className="w-full mt-1">Sign In</Button>
      <div className="flex items-center justify-between text-sm">
        <Link href="/auth/register" className="text-teal-700 hover:underline">Create an account</Link>
        <Link href="/auth/forgot-password" className="text-slate-500 hover:text-teal-700 hover:underline">
          Forgot password?
        </Link>
      </div>
    </form>
  );
}
