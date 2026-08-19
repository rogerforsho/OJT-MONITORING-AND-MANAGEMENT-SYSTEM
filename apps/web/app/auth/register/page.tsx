'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Input from '@/src/components/ui/Input';
import Button from '@/src/components/ui/Button';
import Alert from '@/src/components/ui/Alert';
import { registerStudent } from '@/src/services/auth';

const COURSES = [
  { code: 'BSIT', name: 'BS in Information Technology (ICS)' },
  { code: 'BSCS', name: 'BS in Computer Science (ICS)' },
  { code: 'BSBA-MKT', name: 'BSBA - Marketing Management (IBE)' },
  { code: 'BSBA-HRM', name: 'BSBA - Human Resource Mgt (IBE)' },
  { code: 'BSBA-FM', name: 'BSBA - Financial Management (IBE)' },
  { code: 'BSA', name: 'BS in Accountancy (IBE)' },
];

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
    course: 'BSIT',
    year_level: '4',
  });

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
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
      <div className="mb-5">
        <h2 className="text-xl font-black text-[#0A3D24] font-serif">Student Registration</h2>
        <p className="text-xs text-slate-500 mt-1">
          Enroll your 4th-Year OJT trainee profile (ICS / IBE).
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <Input
          label="Full Name"
          value={form.full_name}
          onChange={(e) => set('full_name', e.target.value)}
          placeholder="Juan Dela Cruz"
          required
        />
        <Input
          label="Institutional Email"
          type="email"
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
          placeholder="juan.delacruz@cdm.edu.ph"
          required
        />
        <Input
          label="Student ID Number"
          value={form.student_number}
          onChange={(e) => set('student_number', e.target.value)}
          placeholder="2024-00001"
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-700">Academic Course</label>
            <select
              value={form.course}
              onChange={(e) => set('course', e.target.value)}
              required
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-[#0A3D24] focus:border-[#0A3D24] hover:border-slate-300 transition-all font-medium"
            >
              {COURSES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-700">Year Level</label>
            <select
              value={form.year_level}
              onChange={(e) => set('year_level', e.target.value)}
              required
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-[#0A3D24] focus:border-[#0A3D24] hover:border-slate-300 transition-all font-medium"
            >
              <option value="4">4th Year (Graduating / Practicum)</option>
            </select>
          </div>
        </div>

        <Input
          label="Create Password"
          type="password"
          value={form.password}
          onChange={(e) => set('password', e.target.value)}
          placeholder="Min. 8 characters"
          required
        />
        <Input
          label="Confirm Password"
          type="password"
          value={form.confirm_password}
          onChange={(e) => set('confirm_password', e.target.value)}
          placeholder="Re-enter password"
          required
        />

        {error && <Alert type="error" message={error} />}

        <Button type="submit" loading={loading} className="w-full mt-1">
          Submit Registration
        </Button>

        <p className="text-center text-xs text-slate-500 pt-1">
          Already have an active account?{' '}
          <Link href="/auth/sign-in" className="text-[#0A3D24] hover:underline font-bold">
            Sign in
          </Link>
        </p>
      </form>
    </>
  );
}
