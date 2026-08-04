import { getAuthUser } from '@/src/services/auth';
import { createClient } from '@/src/lib/supabase/server';

async function getCoordinatorSummary() {
  const supabase = await createClient();

  const [{ data: pendingStudents }, { data: activeAssignments }, { data: pendingAttendance }, { data: verifiedAttendance }] = await Promise.all([
    supabase.from('users').select('user_id', { count: 'exact' }).eq('role', 'Student').eq('account_status', 'pending'),
    supabase.from('student_assignments').select('assignment_id', { count: 'exact' }).eq('assignment_status', 'active'),
    supabase.from('attendance').select('attendance_id', { count: 'exact' }).eq('verification_status', 'pending'),
    supabase.from('attendance').select('attendance_id', { count: 'exact' }).eq('verification_status', 'verified'),
  ]);

  return {
    pendingStudents: pendingStudents?.length ?? 0,
    activeAssignments: activeAssignments?.length ?? 0,
    pendingAttendance: pendingAttendance?.length ?? 0,
    verifiedAttendance: verifiedAttendance?.length ?? 0,
  };
}

async function getStudentSummary() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: student } = await supabase.from('students').select('student_id').eq('user_id', user.id).maybeSingle();
  if (!student) return null;

  const [{ data: attendance }, { data: progress }] = await Promise.all([
    supabase.from('attendance').select('attendance_id').eq('student_id', student.student_id),
    supabase.from('attendance').select('attendance_id').eq('student_id', student.student_id).eq('verification_status', 'verified'),
  ]);

  return {
    totalAttendance: attendance?.length ?? 0,
    verifiedAttendance: progress?.length ?? 0,
  };
}

export default async function DashboardPage() {
  const user = await getAuthUser();
  const role = user?.role;
  const coordinatorSummary = role === 'Coordinator' || role === 'Admin' ? await getCoordinatorSummary() : null;
  const studentSummary = role === 'Student' ? await getStudentSummary() : null;

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">Welcome back, {user?.full_name}.</p>
      </div>

      {role === 'Coordinator' || role === 'Admin' ? (
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Pending approvals</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{coordinatorSummary?.pendingStudents ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Active assignments</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{coordinatorSummary?.activeAssignments ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Pending attendance</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{coordinatorSummary?.pendingAttendance ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Verified attendance</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{coordinatorSummary?.verifiedAttendance ?? 0}</p>
          </div>
        </div>
      ) : null}

      {role === 'Student' ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Attendance entries</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{studentSummary?.totalAttendance ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Verified attendance</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{studentSummary?.verifiedAttendance ?? 0}</p>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">What’s next</h2>
        <p className="mt-2 text-sm text-slate-500">
          {role === 'Coordinator' || role === 'Admin'
            ? 'Review pending approvals, verify attendance, and monitor assignments from one place.'
            : role === 'Supervisor'
              ? 'Review assigned attendance and evaluate student performance.'
              : role === 'Student'
                ? 'Use attendance and reports to keep your OJT progress moving.'
                : 'Continue using the role-based modules to manage your OJT workflow.'}
        </p>
      </div>
    </div>
  );
}
