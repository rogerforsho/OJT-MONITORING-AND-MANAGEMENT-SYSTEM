'use client';

import SignInForm from '@/src/components/auth/SignInForm';

export default function SignInPage() {
  return (
    <>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900">Welcome back</h2>
        <p className="text-sm text-slate-500 mt-1">Sign in to your OJT account</p>
      </div>
      <SignInForm />
    </>
  );
}
