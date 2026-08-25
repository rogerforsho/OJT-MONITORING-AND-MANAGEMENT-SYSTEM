import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { getAuthUser } from '@/src/services/auth';
import { createClient } from '@/src/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export default async function DashboardPage() {
  const user = await getAuthUser();
  if (!user) redirect('/auth/sign-in');

  const supabase = await createClient();
  const service = serviceClient();

  // Role-specific stats query
  let stats: any = {};
  let departmentSubtitle = 'Colegio de Montalban';

  if (user.role === 'Student') {
    const { data: student } = await supabase
      .from('students')
      .select('student_id, required_hours, student_number, course')
      .eq('user_id', user.user_id)
      .maybeSingle();

    if (student) {
      const isICS = ['BS Information Technology', 'BS Computer Science', 'BSIT', 'BSCS'].some(c =>
        (student.course || '').toLowerCase().includes(c.toLowerCase())
      );
      departmentSubtitle = isICS
        ? 'Institute of Computing Studies (ICS)'
        : 'Institute of Business and Entrepreneurship (IBE)';

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
    const { data: coord } = await service
      .from('coordinators')
      .select('department')
      .eq('user_id', user.user_id)
      .maybeSingle();

    departmentSubtitle = coord?.department === 'IBE'
      ? 'Institute of Business and Entrepreneurship (IBE)'
      : 'Institute of Computing Studies (ICS)';

    const [
      { count: pendingApprovals },
      { count: activeStudents },
      { count: totalCompanies },
      { count: atRiskCount },
    ] = await Promise.all([
      service.from('users').select('*', { count: 'exact', head: true }).eq('account_status', 'pending'),
      service.from('students').select('*', { count: 'exact', head: true }),
      service.from('companies').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      service.from('internship_progress').select('*', { count: 'exact', head: true }).lt('completed_hours', 150),
    ]);

    stats = {
      pendingApprovals: pendingApprovals || 0,
      activeStudents: activeStudents || 0,
      totalCompanies: totalCompanies || 0,
      atRiskCount: atRiskCount || 0,
    };
  } else if (user.role === 'Supervisor') {
    const { data: supervisor } = await service
      .from('supervisors')
      .select('supervisor_id, companies(company_name)')
      .eq('user_id', user.user_id)
      .maybeSingle();

    const companyName = (supervisor?.companies as any)?.company_name;
    departmentSubtitle = companyName
      ? `${companyName} • Industry Practicum Partner`
      : 'Industry Host Training Establishment (HTE)';

    if (supervisor) {
      const [
        { count: assignedStudents },
        { count: pendingAttendance },
        { count: completedEvaluations },
      ] = await Promise.all([
        service.from('student_assignments').select('*', { count: 'exact', head: true }).eq('supervisor_id', supervisor.supervisor_id).eq('assignment_status', 'active'),
        service.from('attendance').select('*', { count: 'exact', head: true }).eq('verification_status', 'pending'),
        service.from('evaluations').select('*', { count: 'exact', head: true }).eq('supervisor_id', supervisor.supervisor_id),
      ]);

      stats = {
        supervisor,
        assignedStudents: assignedStudents || 0,
        pendingAttendance: pendingAttendance || 0,
        completedEvaluations: completedEvaluations || 0,
      };
    }
  } else if (user.role === 'ProgramHead') {
    const { data: progHead } = await service
      .from('program_heads')
      .select('department_or_program')
      .eq('user_id', user.user_id)
      .maybeSingle();

    departmentSubtitle = progHead?.department_or_program === 'IBE'
      ? 'Institute of Business and Entrepreneurship (IBE)'
      : 'Institute of Computing Studies (ICS)';

    const [
      { count: totalICS },
      { count: totalIBE },
      { count: totalCompanies },
    ] = await Promise.all([
      service.from('students').select('*', { count: 'exact', head: true }).in('course', ['BS Information Technology', 'BS Computer Science', 'BSIT', 'BSCS']),
      service.from('students').select('*', { count: 'exact', head: true }).in('course', ['BS Business Administration', 'BS Accountancy', 'BS Hospitality Management', 'BSBA', 'BSA']),
      service.from('companies').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    ]);

    stats = {
      totalICS: totalICS || 0,
      totalIBE: totalIBE || 0,
      totalCompanies: totalCompanies || 0,
    };
  } else if (user.role === 'Admin') {
    departmentSubtitle = 'Institutional Administration & Systems Control';
    const [
      { count: totalUsers },
      { count: pendingUsers },
      { count: activeUsers },
    ] = await Promise.all([
      service.from('users').select('*', { count: 'exact', head: true }),
      service.from('users').select('*', { count: 'exact', head: true }).eq('account_status', 'pending'),
      service.from('users').select('*', { count: 'exact', head: true }).eq('account_status', 'active'),
    ]);

    stats = {
      totalUsers: totalUsers || 0,
      pendingUsers: pendingUsers || 0,
      activeUsers: activeUsers || 0,
    };
  }

  // Fetch Latest Broadcast Announcements
  const { data: latestAnnouncements } = await service
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
              <p className="text-xs sm:text-sm text-slate-300 mt-0.5 font-medium">
                {departmentSubtitle}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-start sm:items-end gap-1">
            <span className="text-xs text-slate-400 font-medium">Platform Status</span>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-300 bg-emerald-950/60 border border-emerald-500/40 px-3 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              System Operational
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
              className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-[#FFCC00]/30 flex items-start gap-3.5 shadow-sm"
            >
              <span className="text-2xl mt-0.5">📢</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#0A3D24] text-[#FFCC00] uppercase tracking-wider">
                    {annc.target_department === 'All' ? 'Campus-Wide Announcement' : `${annc.target_department} Department`}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    {new Date(annc.created_at).toLocaleDateString()}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 mt-1">{annc.title}</h4>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{annc.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Role-Specific Metric Cards */}
      {user.role === 'Student' && stats.student && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-xl font-bold">
              ⏱️
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Rendered Hours</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">
                {stats.progress.completed_hours} <span className="text-xs font-normal text-slate-500">/ {stats.student.required_hours || 486} hrs</span>
              </h3>
              <p className="text-xs text-emerald-600 font-medium mt-0.5">
                {Math.min(100, Math.round((stats.progress.completed_hours / (stats.student.required_hours || 486)) * 100))}% completed
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center text-xl font-bold">
              ⏳
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Remaining Hours</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">
                {stats.progress.remaining_hours} <span className="text-xs font-normal text-slate-500">hrs</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Required to graduate</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center text-xl font-bold">
              🏢
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Assigned Company</p>
              <h3 className="text-sm font-bold text-slate-900 mt-1 truncate">
                {stats.assignment?.companies?.company_name || 'Unassigned'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 truncate">
                Supervisor: {stats.assignment?.supervisors?.full_name || 'Pending assignment'}
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center text-xl font-bold">
              📅
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Today&apos;s Status</p>
              <h3 className="text-sm font-bold text-slate-900 mt-1">
                {stats.todayAttendance ? (stats.todayAttendance.time_out ? 'Shift Completed' : 'Clocked In') : 'No Attendance Today'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {stats.todayAttendance?.time_in ? `In at ${stats.todayAttendance.time_in}` : 'Use Mobile App to log'}
              </p>
            </div>
          </div>
        </div>
      )}

      {user.role === 'Coordinator' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center text-xl font-bold">
              🛡️
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending Approvals</p>
              <h3 className="text-2xl font-bold text-amber-600 mt-0.5">{stats.pendingApprovals}</h3>
              <Link href="/coordinator/approvals" className="text-xs text-[#0A3D24] font-bold hover:underline">
                Review accounts →
              </Link>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center text-xl font-bold">
              👥
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Students</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{stats.activeStudents}</h3>
              <p className="text-xs text-slate-400 mt-0.5">Enrolled trainees</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center text-xl font-bold">
              🏢
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Partner Companies</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{stats.totalCompanies}</h3>
              <p className="text-xs text-slate-400 mt-0.5">Active HTE establishments</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center text-xl font-bold">
              ⚠️
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Behind Schedule</p>
              <h3 className="text-2xl font-bold text-rose-600 mt-0.5">{stats.atRiskCount}</h3>
              <p className="text-xs text-slate-400 mt-0.5">&lt; 150 hours logged</p>
            </div>
          </div>
        </div>
      )}

      {user.role === 'Supervisor' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center text-xl font-bold">
              👥
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Assigned Interns</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{stats.assignedStudents}</h3>
              <p className="text-xs text-slate-400 mt-0.5">Active under your supervision</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center text-xl font-bold">
              ⏱️
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending Attendance</p>
              <h3 className="text-2xl font-bold text-amber-600 mt-0.5">{stats.pendingAttendance}</h3>
              <Link href="/supervisor/attendance" className="text-xs text-[#0A3D24] font-bold hover:underline">
                Verify logs →
              </Link>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center text-xl font-bold">
              ⭐
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Evaluations</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{stats.completedEvaluations}</h3>
              <Link href="/supervisor/evaluations" className="text-xs text-[#0A3D24] font-bold hover:underline">
                Rate students →
              </Link>
            </div>
          </div>
        </div>
      )}

      {user.role === 'ProgramHead' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-xl font-bold">
              💻
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">ICS Cohort (BSIT/BSCS)</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{stats.totalICS}</h3>
              <p className="text-xs text-slate-400 mt-0.5">Enrolled Computing Interns</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center text-xl font-bold">
              💼
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">IBE Cohort (BSBA/BSA)</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{stats.totalIBE}</h3>
              <p className="text-xs text-slate-400 mt-0.5">Enrolled Business Interns</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center text-xl font-bold">
              🏢
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Partner HTEs</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{stats.totalCompanies}</h3>
              <p className="text-xs text-slate-400 mt-0.5">MoA compliant companies</p>
            </div>
          </div>
        </div>
      )}

      {user.role === 'Admin' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center text-xl font-bold">
              👥
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Users</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{stats.totalUsers}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{stats.activeUsers} active accounts</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center text-xl font-bold">
              🛡️
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending Accounts</p>
              <h3 className="text-2xl font-bold text-amber-600 mt-0.5">{stats.pendingUsers}</h3>
              <p className="text-xs text-slate-400 mt-0.5">Awaiting activation</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#0A3D24]/10 text-[#0A3D24] flex items-center justify-center text-xl font-bold">
              ⚙️
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">System Administration</p>
              <Link href="/admin" className="text-sm font-bold text-[#0A3D24] hover:underline mt-1 inline-block">
                Open Admin Console →
              </Link>
              <p className="text-xs text-slate-400 mt-0.5">Manage users & staff</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}