import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { getAuthUser } from '@/src/services/auth';
import { createClient } from '@/src/lib/supabase/server';

export default async function DashboardPage() {
  const user = await getAuthUser();
  if (!user) redirect('/auth/sign-in');

  const supabase = await createClient();

  // Role-specific stats query
  let stats: any = {};

  if (user.role === 'Student') {
    const { data: student } = await supabase
      .from('students')
      .select('student_id, required_hours, student_number, course')
      .eq('user_id', user.user_id)
      .maybeSingle();

    if (student) {
      const { data: progress } = await supabase
        .from('internship_progress')
        .select('completed_hours, remaining_hours, progress_status')
        .eq('student_id', student.student_id)
        .maybeSingle();

      const today = new Date().toISOString().split('T')[0];
      const { data: todayAttendance } = await supabase
        .from('attendance')
        .select('time_in, time_out, late_status, verification_status')
        .eq('student_id', student.student_id)
        .eq('attendance_date', today)
        .maybeSingle();

      const { data: assignment } = await supabase
        .from('student_assignments')
        .select('companies(company_name), supervisors:users!supervisors_user_id_fkey(full_name)')
        .eq('student_id', student.student_id)
        .eq('assignment_status', 'active')
        .maybeSingle();

      stats = {
        student,
        progress: progress || { completed_hours: 0, remaining_hours: student.required_hours || 486, progress_status: 'not_started' },
        todayAttendance,
        assignment,
      };
    }
  } else if (user.role === 'Coordinator') {
    const [{ count: pendingCount }, { count: studentCount }, { count: companyCount }, { count: reportCount }] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'Student').eq('account_status', 'pending'),
      supabase.from('students').select('*', { count: 'exact', head: true }),
      supabase.from('companies').select('*', { count: 'exact', head: true }),
      supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'submitted'),
    ]);

    stats = {
      pendingApprovals: pendingCount || 0,
      totalStudents: studentCount || 0,
      totalCompanies: companyCount || 0,
      pendingReports: reportCount || 0,
    };
  } else if (user.role === 'Supervisor') {
    const { data: supervisor } = await supabase
      .from('supervisors')
      .select('supervisor_id, company_id, companies(company_name)')
      .eq('user_id', user.user_id)
      .maybeSingle();

    if (supervisor) {
      const [{ count: traineeCount }, { count: pendingAttendanceCount }] = await Promise.all([
        supabase.from('student_assignments').select('*', { count: 'exact', head: true }).eq('supervisor_id', supervisor.supervisor_id).eq('assignment_status', 'active'),
        supabase.from('attendance').select('*, student_assignments!inner(supervisor_id)', { count: 'exact', head: true }).eq('student_assignments.supervisor_id', supervisor.supervisor_id).eq('verification_status', 'pending'),
      ]);

      stats = {
        supervisor,
        traineeCount: traineeCount || 0,
        pendingAttendanceCount: pendingAttendanceCount || 0,
      };
    }
  } else if (user.role === 'ProgramHead') {
    const [{ count: totalStudents }, { count: totalCompanies }] = await Promise.all([
      supabase.from('students').select('*', { count: 'exact', head: true }),
      supabase.from('companies').select('*', { count: 'exact', head: true }),
    ]);

    stats = {
      totalStudents: totalStudents || 0,
      totalCompanies: totalCompanies || 0,
    };
  } else if (user.role === 'Admin') {
    const [{ count: userCount }, { count: pendingCount }] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('account_status', 'pending'),
    ]);

    stats = {
      totalUsers: userCount || 0,
      pendingUsers: pendingCount || 0,
    };
  }

  return (
    <div className="p-6 sm:p-8 space-y-8 max-w-7xl">
      {/* Welcome Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-[#062415] via-[#0A3D24] to-[#041a0f] p-6 sm:p-8 text-white shadow-xl shadow-black/15 border border-[#FFCC00]/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#FFCC00]/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-white p-1 border-2 border-[#FFCC00] shadow-md flex items-center justify-center shrink-0">
              <Image
                src="/logo.png"
                alt="Colegio de Montalban Seal"
                width={60}
                height={60}
                className="w-full h-full object-contain rounded-full"
                priority
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-extrabold tracking-wider text-[#FFCC00] bg-[#062415]/80 px-2.5 py-0.5 rounded-full border border-[#FFCC00]/40">
                  {user.role} Portal
                </span>
                <span className="text-xs text-slate-300 font-medium">
                  Colegio de Montalban
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white font-serif mt-1 tracking-tight">
                Welcome back, {user.full_name}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                Institute of Computing Studies (ICS) &bull; Institute of Business and Entrepreneurship (IBE)
              </p>
            </div>
          </div>

          <div className="flex flex-col items-start sm:items-end gap-1">
            <span className="text-xs text-slate-400 font-medium">System Standard</span>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-300 bg-emerald-950/60 border border-emerald-500/40 px-3 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              ISO/IEC 25010:2023 Evaluated
            </span>
          </div>
        </div>
      </div>

      {/* STUDENT DASHBOARD VIEW */}
      {user.role === 'Student' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Hours Progress Card */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-[#0A3D24] uppercase tracking-wider">
                  Rendered Hours (486.0 Required)
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#FFCC00]/20 text-[#062415] border border-[#FFCC00]/40">
                  {stats.progress?.progress_status?.replace('_', ' ') || 'Active'}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-[#0A3D24] font-serif">
                  {Number(stats.progress?.completed_hours || 0).toFixed(1)}
                </span>
                <span className="text-sm font-semibold text-slate-500">/ 486.0 hrs</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-[#FFCC00] rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, ((stats.progress?.completed_hours || 0) / 486) * 100)}%`,
                  }}
                />
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {Number(stats.progress?.remaining_hours || 486).toFixed(1)} hours remaining to complete graduation requirements.
              </p>
            </div>

            {/* Today's Attendance Card */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm space-y-3">
              <span className="text-xs font-extrabold text-[#0A3D24] uppercase tracking-wider block">
                Today&apos;s Attendance Status
              </span>
              {stats.todayAttendance ? (
                <div className="space-y-2 pt-1 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Time In:</span>
                    <span className="font-bold text-slate-900">
                      {new Date(stats.todayAttendance.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Time Out:</span>
                    <span className="font-bold text-slate-900">
                      {stats.todayAttendance.time_out
                        ? new Date(stats.todayAttendance.time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'Pending Time Out'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-slate-500 font-medium">Supervisor Verification:</span>
                    <span className="font-bold text-emerald-700 uppercase">
                      {stats.todayAttendance.verification_status}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-3 text-center">
                  <p className="text-xs text-slate-500">No attendance recorded yet for today.</p>
                  <Link
                    href="/student/attendance"
                    className="inline-block mt-3 px-4 py-2 bg-[#0A3D24] text-[#FFCC00] rounded-xl text-xs font-bold hover:bg-[#062415] transition-all"
                  >
                    Log Time In Now
                  </Link>
                </div>
              )}
            </div>

            {/* Host Company Card */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm space-y-3">
              <span className="text-xs font-extrabold text-[#0A3D24] uppercase tracking-wider block">
                Host Training Establishment
              </span>
              <div className="pt-1">
                <p className="text-base font-bold text-slate-900">
                  {(stats.assignment as any)?.companies?.company_name || 'Assignment Pending'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Supervisor: {(stats.assignment as any)?.supervisors?.full_name || 'Designated by Host Company'}
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Practicum Year:</span>
                <span className="text-[#0A3D24] font-bold">4th Year Graduating</span>
              </div>
            </div>
          </div>

          {/* Student Quick Links */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Link href="/student/attendance" className="bg-white p-4 rounded-xl border border-slate-200 hover:border-[#0A3D24] hover:shadow-md transition-all text-center group">
              <span className="text-2xl block mb-1 group-hover:scale-110 transition-transform">📋</span>
              <span className="text-xs font-bold text-slate-800 group-hover:text-[#0A3D24]">Attendance Logs</span>
            </Link>
            <Link href="/student/progress" className="bg-white p-4 rounded-xl border border-slate-200 hover:border-[#0A3D24] hover:shadow-md transition-all text-center group">
              <span className="text-2xl block mb-1 group-hover:scale-110 transition-transform">📈</span>
              <span className="text-xs font-bold text-slate-800 group-hover:text-[#0A3D24]">Rendered Hours</span>
            </Link>
            <Link href="/student/reports" className="bg-white p-4 rounded-xl border border-slate-200 hover:border-[#0A3D24] hover:shadow-md transition-all text-center group">
              <span className="text-2xl block mb-1 group-hover:scale-110 transition-transform">📁</span>
              <span className="text-xs font-bold text-slate-800 group-hover:text-[#0A3D24]">Digital Reports</span>
            </Link>
            <Link href="/student/notifications" className="bg-white p-4 rounded-xl border border-slate-200 hover:border-[#0A3D24] hover:shadow-md transition-all text-center group">
              <span className="text-2xl block mb-1 group-hover:scale-110 transition-transform">🔔</span>
              <span className="text-xs font-bold text-slate-800 group-hover:text-[#0A3D24]">Alerts & Notices</span>
            </Link>
          </div>
        </div>
      )}

      {/* COORDINATOR DASHBOARD VIEW */}
      {user.role === 'Coordinator' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm">
              <span className="text-xs font-bold text-slate-500 block">Pending Registrations</span>
              <span className="text-3xl font-black text-rose-600 font-serif mt-2 block">{stats.pendingApprovals}</span>
              <Link href="/coordinator/approvals" className="text-xs text-[#0A3D24] font-bold hover:underline mt-2 inline-block">
                Review pending &rarr;
              </Link>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm">
              <span className="text-xs font-bold text-slate-500 block">Total Trainees (ICS/IBE)</span>
              <span className="text-3xl font-black text-[#0A3D24] font-serif mt-2 block">{stats.totalStudents}</span>
              <Link href="/coordinator/students" className="text-xs text-[#0A3D24] font-bold hover:underline mt-2 inline-block">
                View student roster &rarr;
              </Link>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm">
              <span className="text-xs font-bold text-slate-500 block">Partner Companies</span>
              <span className="text-3xl font-black text-[#0A3D24] font-serif mt-2 block">{stats.totalCompanies}</span>
              <Link href="/coordinator/companies" className="text-xs text-[#0A3D24] font-bold hover:underline mt-2 inline-block">
                Manage companies &rarr;
              </Link>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm">
              <span className="text-xs font-bold text-slate-500 block">Reports to Grade</span>
              <span className="text-3xl font-black text-amber-600 font-serif mt-2 block">{stats.pendingReports}</span>
              <Link href="/coordinator/submissions" className="text-xs text-[#0A3D24] font-bold hover:underline mt-2 inline-block">
                Review submissions &rarr;
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* SUPERVISOR DASHBOARD VIEW */}
      {user.role === 'Supervisor' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm space-y-2">
              <span className="text-xs font-bold text-slate-500 block uppercase">Assigned Interns</span>
              <span className="text-3xl font-black text-[#0A3D24] font-serif">{stats.traineeCount}</span>
              <p className="text-xs text-slate-500">4th-Year Colegio de Montalban student interns assigned to your training station.</p>
              <Link href="/supervisor/students" className="text-xs text-[#0A3D24] font-bold hover:underline inline-block pt-2">
                Manage assigned trainees &rarr;
              </Link>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm space-y-2">
              <span className="text-xs font-bold text-slate-500 block uppercase">Pending Attendance Verifications</span>
              <span className="text-3xl font-black text-amber-600 font-serif">{stats.pendingAttendanceCount}</span>
              <p className="text-xs text-slate-500">Verify trainee selfie evidence and daily rendered timestamps.</p>
              <Link href="/supervisor/attendance" className="text-xs text-[#0A3D24] font-bold hover:underline inline-block pt-2">
                Verify daily logs &rarr;
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* PROGRAM HEAD DASHBOARD VIEW */}
      {user.role === 'ProgramHead' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm space-y-2">
              <span className="text-xs font-bold text-slate-500 block uppercase">Department Trainees</span>
              <span className="text-3xl font-black text-[#0A3D24] font-serif">{stats.totalStudents}</span>
              <p className="text-xs text-slate-500">Institute of Computing Studies & Institute of Business and Entrepreneurship.</p>
              <Link href="/program-head/reports" className="text-xs text-[#0A3D24] font-bold hover:underline inline-block pt-2">
                View department analytics &rarr;
              </Link>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm space-y-2">
              <span className="text-xs font-bold text-slate-500 block uppercase">Partner Establishments</span>
              <span className="text-3xl font-black text-[#0A3D24] font-serif">{stats.totalCompanies}</span>
              <p className="text-xs text-slate-500">Active industry partners providing practicum training for graduating seniors.</p>
              <Link href="/program-head/reports" className="text-xs text-[#0A3D24] font-bold hover:underline inline-block pt-2">
                Generate summary reports &rarr;
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN DASHBOARD VIEW */}
      {user.role === 'Admin' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm space-y-2">
              <span className="text-xs font-bold text-slate-500 block uppercase">Total System Accounts</span>
              <span className="text-3xl font-black text-[#0A3D24] font-serif">{stats.totalUsers}</span>
              <p className="text-xs text-slate-500">Students, Coordinators, Supervisors, Program Heads, and Administrators.</p>
              <Link href="/admin" className="text-xs text-[#0A3D24] font-bold hover:underline inline-block pt-2">
                Manage user accounts &rarr;
              </Link>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm space-y-2">
              <span className="text-xs font-bold text-slate-500 block uppercase">Pending Registrations</span>
              <span className="text-3xl font-black text-rose-600 font-serif">{stats.pendingUsers}</span>
              <p className="text-xs text-slate-500">Accounts awaiting administrative verification and activation.</p>
              <Link href="/admin" className="text-xs text-[#0A3D24] font-bold hover:underline inline-block pt-2">
                Go to admin console &rarr;
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
