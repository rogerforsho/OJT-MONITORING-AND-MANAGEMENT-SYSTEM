import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAuthUser } from '@/src/services/auth';
import { createClient } from '@/src/lib/supabase/server';

async function getAdminOverview() {
  const supabase = await createClient();

  const [
    { data: totalUsers },
    { data: pendingStudents },
    { data: activeAssignments },
    { data: pendingAttendance },
    { data: verifiedAttendance },
  ] = await Promise.all([
    supabase.from('users').select('user_id', { count: 'exact' }),
    supabase.from('users').select('user_id', { count: 'exact' }).eq('role', 'Student').eq('account_status', 'pending'),
    supabase.from('student_assignments').select('assignment_id', { count: 'exact' }).eq('assignment_status', 'active'),
    supabase.from('attendance').select('attendance_id', { count: 'exact' }).eq('verification_status', 'pending'),
    supabase.from('attendance').select('attendance_id', { count: 'exact' }).eq('verification_status', 'verified'),
  ]);

  return {
    totalUsers: totalUsers?.length ?? 0,
    pendingStudents: pendingStudents?.length ?? 0,
    activeAssignments: activeAssignments?.length ?? 0,
    pendingAttendance: pendingAttendance?.length ?? 0,
    verifiedAttendance: verifiedAttendance?.length ?? 0,
  };
}

export default async function AdminPage() {
  const user = await getAuthUser();

  if (!user || user.role !== 'Admin') redirect('/dashboard');

  const overview = await getAdminOverview();

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Administration</h1>
        <p className="mt-1 text-sm text-slate-500">Oversee account health, assignments, and submission activity.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Registered users</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{overview.totalUsers}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Pending students</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{overview.pendingStudents}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Active assignments</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{overview.activeAssignments}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Pending attendance</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{overview.pendingAttendance}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Verified attendance</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{overview.verifiedAttendance}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Quick actions</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Link href="/coordinator/approvals" className="rounded-xl border border-slate-200 p-4 text-sm font-medium text-slate-700 transition hover:border-teal-500 hover:text-teal-700">Review pending approvals</Link>
          <Link href="/coordinator/students" className="rounded-xl border border-slate-200 p-4 text-sm font-medium text-slate-700 transition hover:border-teal-500 hover:text-teal-700">Manage student records</Link>
          <Link href="/coordinator/submissions" className="rounded-xl border border-slate-200 p-4 text-sm font-medium text-slate-700 transition hover:border-teal-500 hover:text-teal-700">Review submissions</Link>
        </div>
      </div>
    </div>
  );
}
