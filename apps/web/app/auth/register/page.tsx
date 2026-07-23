'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Input from '@/src/components/ui/Input';
import Button from '@/src/components/ui/Button';
import Alert from '@/src/components/ui/Alert';
import { registerStudent } from '@/src/services/auth';

const COURSES = ['BSIT', 'BSBA', 'BSCS', 'BSECE', 'BSA', 'BSHM'];

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    confirm_password: '',
    student_number: '',
    course: '',
    year_level: '',
  });

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirm_password) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const result = await registerStudent({
      full_name: form.full_name,
      email: form.email,
      password: form.password,
      student_number: form.student_number,
      course: form.course,
      year_level: parseInt(form.year_level),
    });
    setLoading(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    router.push('/auth/pending');
  }

  return (
    <>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900">Student Registration</h2>
        <p className="text-sm text-slate-500 mt-1">Create your OJT account. Approval required before access.</p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <Input label="Full Name" value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="Juan Dela Cruz" required />
        <Input label="Email" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@example.com" required />
        <Input label="Student Number" value={form.student_number} onChange={e => set('student_number', e.target.value)} placeholder="2024-00001" required />

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Course</label>
            <select
              value={form.course}
              onChange={e => set('course', e.target.value)}
              required
              className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 hover:border-slate-300 transition-all"
            >
              <option value="">Select course</option>
              {COURSES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Year Level</label>
            <select
              value={form.year_level}
              onChange={e => set('year_level', e.target.value)}
              required
              className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 hover:border-slate-300 transition-all"
            >
              <option value="">Select year</option>
              {[1, 2, 3, 4].map(y => <option key={y} value={y}>Year {y}</option>)}
            </select>
          </div>
        </div>

        <Input label="Password" type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Min. 8 characters" required />
        <Input label="Confirm Password" type="password" value={form.confirm_password} onChange={e => set('confirm_password', e.target.value)} placeholder="Re-enter password" required />

        {error && <Alert type="error" message={error} />}

        <Button type="submit" loading={loading} className="w-full mt-1">Create Account</Button>
        <p className="text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link href="/auth/sign-in" className="text-teal-700 hover:underline font-medium">Sign in</Link>
        </p>
      </form>
    </>
  );
}
