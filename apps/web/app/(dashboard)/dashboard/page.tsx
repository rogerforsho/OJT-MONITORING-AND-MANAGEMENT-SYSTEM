import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { getAuthUser } from '@/src/services/auth';
import { createClient } from '@/src/lib/supabase/server';

export default async function DashboardPage() {
  const user = await getAuthUser();
  if (!user) redirect('/auth/sign-in');
  //check if its working
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
    const [
      { count: pendingApprovals },
      { count: activeStudents },
      { count: totalCompanies },
      { count: atRiskCount },
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('account_status', 'pending'),
      supabase.from('students').select('*', { count: 'exact', head: true }),
      supabase.from('companies').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('internship_progress').select('*', { count: 'exact', head: true }).lt('completed_hours', 150),
    ]);

    stats = {
      pendingApprovals: pendingApprovals || 0,
      activeStudents: activeStudents || 0,
      totalCompanies: totalCompanies || 0,
      atRiskCount: atRiskCount || 0,
    };
  } else if (user.role === 'Supervisor') {
    const { data: supervisor } = await supabase
      .from('supervisors')
      .select('supervisor_id, companies(company_name)')
      .eq('user_id', user.user_id)
      .maybeSingle();

    if (supervisor) {
      const [
        { count: assignedStudents },
        { count: pendingAttendance },
        { count: completedEvaluations },
      ] = await Promise.all([
        supabase.from('student_assignments').select('*', { count: 'exact', head: true }).eq('supervisor_id', supervisor.supervisor_id).eq('assignment_status', 'active'),
        supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('verification_status', 'pending'),
        supabase.from('evaluations').select('*', { count: 'exact', head: true }).eq('supervisor_id', supervisor.supervisor_id),
      ]);

      stats = {
        supervisor,
        assignedStudents: assignedStudents || 0,
        pendingAttendance: pendingAttendance || 0,
        completedEvaluations: completedEvaluations || 0,
      };
    }
  } else if (user.role === 'ProgramHead') {
    const [
      { count: totalICS },
      { count: totalIBE },
      { count: totalCompanies },
    ] = await Promise.all([
      supabase.from('students').select('*', { count: 'exact', head: true }).in('course', ['BS Information Technology', 'BS Computer Science']),
      supabase.from('students').select('*', { count: 'exact', head: true }).in('course', ['BS Business Administration', 'BS Accountancy', 'BS Hospitality Management']),
      supabase.from('companies').select('*', { count: 'exact', head: true }).eq('is_active', true),
    ]);

    stats = {
      totalICS: totalICS || 0,
      totalIBE: totalIBE || 0,
      totalCompanies: totalCompanies || 0,
    };
  } else if (user.role === 'Admin') {
    const [
      { count: totalUsers },
      { count: pendingUsers },
      { count: activeUsers },
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('account_status', 'pending'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('account_status', 'active'),
    ]);

    stats = {
      totalUsers: totalUsers || 0,
      pendingUsers: pendingUsers || 0,
      activeUsers: activeUsers || 0,
    };
  }

  // Fetch Latest Broadcast Announcements
  const { data: latestAnnouncements } = await supabase
    .from('announcements')
    .select('announcement_id, title, content, target_department, created_at')
    .order('created_at', { ascending: false })
    .limit(2);

  return (
    <div className="p-6 sm:p-8 space-y-7 max-w-7xl page-fade-in">
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
              {user.role !== 'Admin' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase font-extrabold tracking-wider text-[#FFCC00] bg-[#062415]/80 px-2.5 py-0.5 rounded-full border border-[#FFCC00]/40">
                    {user.role} Portal
                  </span>
                  <span className="text-xs text-slate-300 font-medium">
                    Colegio de Montalban
                  </span>
                </div>
              )}
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

      {/* Campus Announcements Banner */}
      {latestAnnouncements && latestAnnouncements.length > 0 && (
        <div className="space-y-3">
          {latestAnnouncements.map((annc) => (
            <div
              key={annc.announcement_id}
              className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-4 sm:p-5 text-slate-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all hover:bg-amber-500/15"
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#0A3D24] text-[#FFCC00] border border-[#FFCC00]/40 flex items-center justify-center shrink-0 font-bold text-base shadow-sm">
                  📢
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300">
                      Official Broadcast
                    </span>
                    {annc.target_department !== 'All' && (
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {annc.target_department} Dept
                      </span>
                    )}
                    <span className="text-xs text-slate-500 font-medium">
                      {new Date(annc.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 mt-1 truncate">{annc.title}</h2>
                  <p className="text-xs text-slate-600 mt-0.5 line-clamp-2 leading-relaxed">{annc.content}</p>
                </div>
              </div>

              {user.role === 'Student' && (
                <Link
                  href="/student/notifications"
                  className="shrink-0 text-xs font-bold text-[#0A3D24] bg-white hover:bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 shadow-sm inline-flex items-center gap-1 transition-all"
                >
                  View All &rarr;
                </Link>
              )}
            </div>
          ))}
        </div>
      )}

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
                {Math.max(0, 486 - Number(stats.progress?.completed_hours || 0)).toFixed(1)} hours remaining to complete graduation requirements.
              </p>
            </div>

            {/* Today's Status */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm space-y-4">
              <span className="text-xs font-extrabold text-[#0A3D24] uppercase tracking-wider block">
                Today&apos;s Attendance
              </span>
              {stats.todayAttendance ? (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Time In:</span>
                    <span className="font-bold text-slate-900 font-mono">
                      {new Date(stats.todayAttendance.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Time Out:</span>
                    <span className="font-bold text-slate-900 font-mono">
                      {stats.todayAttendance.time_out
                        ? new Date(stats.todayAttendance.time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'Pending'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm pt-1">
                    <span className="text-slate-500">Status:</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${stats.todayAttendance.late_status === 'late' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {stats.todayAttendance.late_status?.replace('_', ' ') || 'On Time'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-3 text-center">
                  <p className="text-xs text-slate-500 font-medium">No attendance recorded today yet.</p>
                  <Link href="/student/attendance" className="inline-block mt-2 text-xs font-bold text-[#0A3D24] hover:underline">
                    Go to Camera Attendance &rarr;
                  </Link>
                </div>
              )}
            </div>

            {/* Placement Info */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm space-y-3">
              <span className="text-xs font-extrabold text-[#0A3D24] uppercase tracking-wider block">
                Company Assignment
              </span>
              {stats.assignment ? (
                <div className="space-y-2">
                  <div>
                    <span className="text-[11px] text-slate-400 uppercase font-semibold block">Host Training Establishment</span>
                    <p className="text-sm font-bold text-slate-900">{stats.assignment.companies?.company_name}</p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 uppercase font-semibold block">Supervisor</span>
                    <p className="text-xs font-semibold text-slate-700">{stats.assignment.supervisors?.full_name || 'Designated Supervisor'}</p>
                  </div>
                </div>
              ) : (
                <div className="py-3 text-center">
                  <p className="text-xs text-slate-500">No active company assignment found.</p>
                  <p className="text-[11px] text-slate-400 mt-1">Please coordinate with your OJT Coordinator.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* COORDINATOR DASHBOARD VIEW */}
      {user.role === 'Coordinator' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm space-y-2">
              <span className="text-xs font-bold text-slate-500 block uppercase">Pending Registrations</span>
              <span className="text-3xl font-black text-rose-600 font-serif">{stats.pendingApprovals}</span>
              <p className="text-xs text-slate-500">Student & supervisor accounts requiring verification.</p>
              <Link href="/coordinator/approvals" className="text-xs text-[#0A3D24] font-bold hover:underline inline-block pt-2">
                Review pending list &rarr;
              </Link>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm space-y-2">
              <span className="text-xs font-bold text-slate-500 block uppercase">Active Trainees</span>
              <span className="text-3xl font-black text-[#0A3D24] font-serif">{stats.activeStudents}</span>
              <p className="text-xs text-slate-500">4th-Year ICS & IBE graduating students enrolled in practicum.</p>
              <Link href="/coordinator/students" className="text-xs text-[#0A3D24] font-bold hover:underline inline-block pt-2">
                View student cohort &rarr;
              </Link>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm space-y-2">
              <span className="text-xs font-bold text-slate-500 block uppercase">Partner Establishments</span>
              <span className="text-3xl font-black text-[#0A3D24] font-serif">{stats.totalCompanies}</span>
              <p className="text-xs text-slate-500">Accredited host training companies with active MOA status.</p>
              <Link href="/coordinator/companies" className="text-xs text-[#0A3D24] font-bold hover:underline inline-block pt-2">
                Manage companies &rarr;
              </Link>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm space-y-2">
              <span className="text-xs font-bold text-slate-500 block uppercase">At-Risk Interns (&lt;150h)</span>
              <span className="text-3xl font-black text-amber-600 font-serif">{stats.atRiskCount}</span>
              <p className="text-xs text-slate-500">Trainees needing intervention to complete 486 required hours.</p>
              <Link href="/coordinator/progress" className="text-xs text-[#0A3D24] font-bold hover:underline inline-block pt-2">
                Monitor hour milestones &rarr;
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* SUPERVISOR DASHBOARD VIEW */}
      {user.role === 'Supervisor' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm space-y-2">
              <span className="text-xs font-bold text-slate-500 block uppercase">Assigned Trainees</span>
              <span className="text-3xl font-black text-[#0A3D24] font-serif">{stats.assignedStudents}</span>
              <p className="text-xs text-slate-500">Active student interns under your direct company mentorship.</p>
              <Link href="/supervisor/students" className="text-xs text-[#0A3D24] font-bold hover:underline inline-block pt-2">
                View assigned interns &rarr;
              </Link>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm space-y-2">
              <span className="text-xs font-bold text-slate-500 block uppercase">Pending Attendance Logs</span>
              <span className="text-3xl font-black text-amber-600 font-serif">{stats.pendingAttendance}</span>
              <p className="text-xs text-slate-500">Daily selfie logs awaiting supervisor verification.</p>
              <Link href="/supervisor/attendance" className="text-xs text-[#0A3D24] font-bold hover:underline inline-block pt-2">
                Verify daily logs &rarr;
              </Link>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm space-y-2">
              <span className="text-xs font-bold text-slate-500 block uppercase">Evaluations Completed</span>
              <span className="text-3xl font-black text-[#0A3D24] font-serif">{stats.completedEvaluations}</span>
              <p className="text-xs text-slate-500">Midterm and final performance evaluations submitted.</p>
              <Link href="/supervisor/evaluations" className="text-xs text-[#0A3D24] font-bold hover:underline inline-block pt-2">
                Conduct evaluations &rarr;
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
              <div className="flex gap-4 items-baseline pt-1">
                <div>
                  <span className="text-2xl font-black text-[#0A3D24] font-serif">{stats.totalICS}</span>
                  <span className="text-xs text-slate-400 block font-semibold">ICS Cohort</span>
                </div>
                <div className="border-l border-slate-200 pl-4">
                  <span className="text-2xl font-black text-[#0A3D24] font-serif">{stats.totalIBE}</span>
                  <span className="text-xs text-slate-400 block font-semibold">IBE Cohort</span>
                </div>
              </div>
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
              <p className="text-xs text-slate-500">Students, Coordinators, Supervisors, and Program Heads.</p>
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
