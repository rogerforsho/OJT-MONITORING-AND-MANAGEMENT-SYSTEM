'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Input from '@/src/components/ui/Input';
import Button from '@/src/components/ui/Button';
import Alert from '@/src/components/ui/Alert';
import { registerStudent, uploadStudentIdCard } from '@/src/services/auth';

const COURSES = [
  // Institute of Computing Studies (ICS)
  { code: 'BSIT', name: 'BS in Information Technology (ICS)' },
  { code: 'BSCS', name: 'BS in Computer Science (ICS)' },
  { code: 'BS-CPE', name: 'BS in Computer Engineering (ICS)' },
  // Institute of Business and Entrepreneurship (IBE)
  { code: 'BSBA-HRM', name: 'BSBA - Human Resource Mgt (IBE)' },
  { code: 'BSBA-MKT', name: 'BSBA - Marketing Management (IBE)' },
  { code: 'BSBA-FM', name: 'BSBA - Financial Management (IBE)' },
  { code: 'BSENTREP', name: 'BS in Entrepreneurship (IBE)' },
  { code: 'BSA', name: 'BS in Accountancy (IBE)' },
];

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dataPrivacyConsent, setDataPrivacyConsent] = useState(false);
  const [idCardFile, setIdCardFile] = useState<File | null>(null);
  const [idCardPreview, setIdCardPreview] = useState<string | null>(null);
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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Student ID image must be under 5 MB.');
        return;
      }
      setIdCardFile(file);
      if (file.type.startsWith('image/')) {
        setIdCardPreview(URL.createObjectURL(file));
      } else {
        setIdCardPreview(null);
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!dataPrivacyConsent) {
      setError('You must agree to the Data Privacy Notice to register.');
      return;
    }

    if (!idCardFile) {
      setError('Please upload your Validated Student ID Card for enrollment verification.');
      return;
    }

    if (form.password !== form.confirm_password) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    // 1. Upload Student ID Card
    const formData = new FormData();
    formData.append('file', idCardFile);
    formData.append('email', form.email.trim());
    const uploadRes = await uploadStudentIdCard(formData);

    if (uploadRes.error) {
      setLoading(false);
      setError(uploadRes.error.message);
      return;
    }

    // 2. Register Student with id_card_path
    const result = await registerStudent({
      full_name: form.full_name,
      email: form.email,
      password: form.password,
      student_number: form.student_number,
      course: form.course,
      year_level: parseInt(form.year_level),
      id_card_path: uploadRes.data?.file_path,
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
        <h1 className="text-xl font-black text-[#0A3D24] font-serif">Student Registration</h1>
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
                  {c.code} – {c.name}
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

        {/* Validated Student ID Card Upload */}
        <div className="flex flex-col gap-1.5 p-3 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <span>📎</span> Validated Student ID Card <span className="text-rose-600 font-normal">*</span>
            </label>
            <span className="text-[10px] text-emerald-800 font-medium">Front & Back (JPG, PNG, PDF &le; 5MB)</span>
          </div>
          <p className="text-[11px] text-slate-500">
            Uploaded for OJT Coordinator enrollment verification and 4th-year standing legitimacy check.
          </p>
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={handleFileChange}
            required
            className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#0A3D24] file:text-white hover:file:bg-[#062415] file:cursor-pointer cursor-pointer"
          />
          {idCardPreview && (
            <div className="mt-2 relative w-full h-32 rounded-lg border border-slate-200 overflow-hidden bg-white flex items-center justify-center">
              <img
                src={idCardPreview}
                alt="Student ID Preview"
                className="max-h-full max-w-full object-contain"
              />
            </div>
          )}
          {idCardFile && !idCardPreview && (
            <div className="mt-1 text-xs text-emerald-800 font-medium flex items-center gap-1">
              <span>✓</span> File selected: {idCardFile.name} ({(idCardFile.size / 1024).toFixed(0)} KB)
            </div>
          )}
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

        {/* Philippine Data Privacy Act (RA 10173) Consent */}
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-[11px] text-emerald-950">
          <input
            id="data-privacy-consent"
            type="checkbox"
            checked={dataPrivacyConsent}
            onChange={(e) => setDataPrivacyConsent(e.target.checked)}
            required
            className="mt-0.5 h-4 w-4 rounded border-emerald-300 text-[#0A3D24] focus:ring-[#0A3D24] cursor-pointer"
          />
          <label htmlFor="data-privacy-consent" className="cursor-pointer leading-tight select-none">
            I consent to the collection and processing of my academic and practicum records in accordance with the{' '}
            <span className="font-bold text-[#0A3D24]">Philippine Data Privacy Act of 2012 (RA 10173)</span> for official OJT monitoring.
          </label>
        </div>

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
