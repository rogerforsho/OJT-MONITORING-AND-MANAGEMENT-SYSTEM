import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { getAuthUser } from '@/src/services/auth';
import { createClient } from '@/src/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import {
  Timer,
  Hourglass,
  Building2,
  CalendarCheck,
  UserCheck,
  Users,
  AlertTriangle,
  Star,
  Laptop,
  Cpu,
  Briefcase,
  TrendingUp,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Megaphone,
  CheckCircle2,
  ArrowRight,
} from '@/src/components/ui/Icons';

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
      const isICS = ['BS Information Technology', 'BS Computer Science', 'BS Computer Engineering', 'BSIT', 'BS-CPE', 'BSCPE'].some(c =>
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

      const { data: assignment } = await service
        .from('student_assignments')
        .select(`
          assignment_id,
          assignment_status,
          companies ( company_name ),
          supervisors ( users ( full_name ) )
        `)
        .eq('student_id', student.student_id)
        .eq('assignment_status', 'active')
        .maybeSingle();

      const companyName = (assignment?.companies as any)?.company_name;
      const supervisorUser = (assignment?.supervisors as any)?.users;
      const supervisorName = Array.isArray(supervisorUser)
        ? supervisorUser[0]?.full_name
        : supervisorUser?.full_name;

      stats = {
        student,
        progress: progress || { completed_hours: 0, remaining_hours: student.required_hours || 486, progress_status: 'not_started' },
        todayAttendance,
        assignment: {
          company_name: companyName,
          supervisor_name: supervisorName,
        },
      };
    }
  } else if (user.role === 'Coordinator') {
    departmentSubtitle = 'Practicum Management & Coordinator Office';
    const [
      { count: pendingApprovals },
      { count: activeStudents },
      { count: totalCompanies },
      { count: atRiskCount },
    ] = await Promise.all([
      service.from('users').select('*', { count: 'exact', head: true }).eq('role', 'Student').eq('account_status', 'pending'),
      service.from('students').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      service.from('companies').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      service.from('internship_progress').select('*', { count: 'exact', head: true }).lt('completed_hours', 100),
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

    const dept = (progHead?.department_or_program || 'ICS').toUpperCase();
    departmentSubtitle = dept === 'IBE'
      ? 'Institute of Business and Entrepreneurship (IBE)'
      : 'Institute of Computing Studies (ICS)';

    const [
      { data: allStudents },
      { count: totalCompanies },
    ] = await Promise.all([
      service.from('students').select('course, users!inner(account_status)').eq('users.account_status', 'active'),
      service.from('companies').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    ]);

    let courseCount1 = 0; // BSIT or BSBA-HRM
    let courseCount2 = 0; // BS-CPE or BSEntrep
    let totalDepartmentStudents = 0;

    (allStudents ?? []).forEach((s: any) => {
      const c = (s.course || '').toUpperCase();
      if (dept === 'ICS') {
        if (c.includes('BSIT') || c.includes('INFORMATION TECHNOLOGY')) {
          courseCount1++;
          totalDepartmentStudents++;
        } else if (c.includes('BS-CPE') || c.includes('BSCPE') || c.includes('COMPUTER ENGINEERING')) {
          courseCount2++;
          totalDepartmentStudents++;
        }
      } else {
        if (c.includes('BSBA-HRM') || c.includes('BSBA-HR') || c.includes('HUMAN RESOURCE') || c.includes('BSBA')) {
          courseCount1++;
          totalDepartmentStudents++;
        } else if (c.includes('BSENTREP') || c.includes('ENTREPRENEURSHIP')) {
          courseCount2++;
          totalDepartmentStudents++;
        }
      }
    });

    stats = {
      dept,
      courseCount1,
      courseCount2,
      totalDepartmentStudents,
      totalCompanies: totalCompanies || 0,
    };
  } else if (user.role === 'Admin') {
    departmentSubtitle = 'Institutional Administration & Systems Control';
    const [
      { count: totalUsers },
      { count: pendingUsers },
      { count: activeUsers },
      { count: totalCompanies },
    ] = await Promise.all([
      service.from('users').select('*', { count: 'exact', head: true }),
      service.from('users').select('*', { count: 'exact', head: true }).eq('account_status', 'pending'),
      service.from('users').select('*', { count: 'exact', head: true }).eq('account_status', 'active'),
      service.from('companies').select('*', { count: 'exact', head: true }),
    ]);

    stats = {
      totalUsers: totalUsers || 0,
      pendingUsers: pendingUsers || 0,
      activeUsers: activeUsers || 0,
      totalCompanies: totalCompanies || 0,
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
      {/* Streamlined Welcome Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-[#062415] via-[#0A3D24] to-[#041a0f] p-6 sm:p-7 text-white shadow-xl shadow-black/15 border border-[#FFCC00]/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#FFCC00]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 rounded-2xl bg-white/10 p-2 border border-[#FFCC00]/40 shadow-md flex items-center justify-center shrink-0">
              <Image
                src="/logo.png"
                alt="Colegio de Montalban Seal"
                width={48}
                height={48}
                className="w-full h-full object-contain"
                priority
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#FFCC00]">
                  Colegio de Montalban
                </span>
                <span className="text-[10px] text-slate-400 font-medium">•</span>
                <span className="text-[10px] text-slate-300 font-medium">
                  {new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white font-serif mt-0.5 tracking-tight">
                Welcome back, {user.full_name}
              </h1>
              <p className="text-xs text-slate-300 mt-0.5 font-medium">
                {departmentSubtitle}
              </p>
            </div>
          </div>

          <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-300 bg-emerald-950/60 border border-emerald-500/40 px-3 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              System Active
            </span>
            {user.role === 'Admin' && (
              <Link
                href="/admin"
                className="text-xs font-bold text-[#FFCC00] hover:underline flex items-center gap-1"
              >
                Admin Console <ArrowRight className="w-3 h-3" />
              </Link>
            )}
            {user.role === 'Student' && (
              <Link
                href="/student/attendance"
                className="text-xs font-bold text-[#FFCC00] hover:underline flex items-center gap-1"
              >
                Log Attendance <ArrowRight className="w-3 h-3" />
              </Link>
            )}
            {user.role === 'Coordinator' && (
              <Link
                href="/coordinator/approvals"
                className="text-xs font-bold text-[#FFCC00] hover:underline flex items-center gap-1"
              >
                Review Approvals <ArrowRight className="w-3 h-3" />
              </Link>
            )}
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
              <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200/90 text-[#0A3D24] flex items-center justify-center shrink-0 mt-0.5">
                <Megaphone className="w-4 h-4 text-[#0A3D24]" />
              </div>
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
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200/90 text-[#0A3D24] flex items-center justify-center shrink-0">
              <Timer className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Rendered Hours</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">
                {stats.progress.completed_hours} <span className="text-xs font-normal text-slate-500">/ {stats.student.required_hours || 486} hrs</span>
              </h3>
              <p className="text-xs text-emerald-700 font-semibold mt-0.5">
                {Math.min(100, Math.round((stats.progress.completed_hours / (stats.student.required_hours || 486)) * 100))}% completed
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200/90 text-[#0A3D24] flex items-center justify-center shrink-0">
              <Hourglass className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Remaining Hours</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">
                {stats.progress.remaining_hours} <span className="text-xs font-normal text-slate-500">hrs</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Target: {stats.student.required_hours || 486} hrs</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200/90 text-[#0A3D24] flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Assigned Company</p>
              <h3 className="text-sm font-bold text-slate-900 mt-0.5 truncate max-w-[150px]">
                {stats.assignment.company_name || 'Not yet assigned'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[150px]">
                {stats.assignment.supervisor_name ? `Sup: ${stats.assignment.supervisor_name}` : 'Awaiting Supervisor'}
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200/90 text-[#0A3D24] flex items-center justify-center shrink-0">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Today&apos;s Status</p>
              <h3 className="text-sm font-bold text-slate-900 mt-0.5">
                {stats.todayAttendance?.time_in ? 'Time In Recorded' : 'Not Clocked In'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {stats.todayAttendance?.time_out
                  ? 'Shift Completed'
                  : stats.todayAttendance?.time_in
                  ? 'Currently on Shift'
                  : 'Pending Attendance'}
              </p>
            </div>
          </div>
        </div>
      )}

      {user.role === 'Coordinator' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200/90 text-amber-600 flex items-center justify-center shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending Registrations</p>
              <h3 className="text-2xl font-bold text-amber-600 mt-0.5">{stats.pendingApprovals}</h3>
              <Link href="/coordinator/approvals" className="text-xs text-[#0A3D24] font-bold hover:underline">
                Review queue →
              </Link>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200/90 text-[#0A3D24] flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Trainees</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{stats.activeStudents}</h3>
              <p className="text-xs text-slate-400 mt-0.5">Deployed across HTEs</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200/90 text-[#0A3D24] flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Partner Companies</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{stats.totalCompanies}</h3>
              <p className="text-xs text-slate-400 mt-0.5">MoA Active Establishments</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200/90 text-red-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Low Progress Alert</p>
              <h3 className="text-2xl font-bold text-red-600 mt-0.5">{stats.atRiskCount}</h3>
              <p className="text-xs text-slate-400 mt-0.5">&lt; 100 hrs rendered</p>
            </div>
          </div>
        </div>
      )}

      {user.role === 'Supervisor' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200/90 text-[#0A3D24] flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Assigned Interns</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{stats.assignedStudents}</h3>
              <p className="text-xs text-slate-400 mt-0.5">Active under your supervision</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200/90 text-[#0A3D24] flex items-center justify-center shrink-0">
              <Timer className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending Attendance</p>
              <h3 className="text-2xl font-bold text-amber-600 mt-0.5">{stats.pendingAttendance}</h3>
              <Link href="/supervisor/attendance" className="text-xs text-[#0A3D24] font-bold hover:underline">
                Verify logs →
              </Link>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200/90 text-[#0A3D24] flex items-center justify-center shrink-0">
              <Star className="w-5 h-5" />
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200/90 text-[#0A3D24] flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Interns</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{stats.totalDepartmentStudents}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{stats.dept} Department Trainees</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200/90 text-[#0A3D24] flex items-center justify-center shrink-0">
              {stats.dept === 'ICS' ? <Laptop className="w-5 h-5" /> : <Briefcase className="w-5 h-5" />}
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {stats.dept === 'ICS' ? 'BSIT Trainees' : 'BSBA-HRM Trainees'}
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{stats.courseCount1}</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {stats.dept === 'ICS' ? 'Information Technology' : 'Human Resource Management'}
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200/90 text-[#0A3D24] flex items-center justify-center shrink-0">
              {stats.dept === 'ICS' ? <Cpu className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {stats.dept === 'ICS' ? 'BS-CPE Trainees' : 'BSEntrep Trainees'}
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{stats.courseCount2}</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {stats.dept === 'ICS' ? 'Computer Engineering' : 'Entrepreneurship'}
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200/90 text-[#0A3D24] flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Partner HTEs</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{stats.totalCompanies}</h3>
              <Link href="/program-head/reports" className="text-xs text-[#0A3D24] font-bold hover:underline inline-block mt-0.5">
                View Reports →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Admin Balanced Full-Width 4-Card Grid & Quick Operations Hub */}
      {user.role === 'Admin' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200/90 text-[#0A3D24] flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Accounts</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{stats.totalUsers}</h3>
                <p className="text-xs text-slate-400 mt-0.5">Registered system users</p>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200/90 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Users</p>
                <h3 className="text-2xl font-bold text-emerald-700 mt-0.5">{stats.activeUsers}</h3>
                <p className="text-xs text-slate-400 mt-0.5">Verified active accounts</p>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200/90 text-amber-600 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending Approvals</p>
                <h3 className="text-2xl font-bold text-amber-600 mt-0.5">{stats.pendingUsers}</h3>
                <Link href="/admin" className="text-xs text-amber-700 font-bold hover:underline inline-block mt-0.5">
                  Review pending →
                </Link>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200/90 text-[#0A3D24] flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Partner Companies</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{stats.totalCompanies}</h3>
                <p className="text-xs text-slate-400 mt-0.5">Host Training Establishments</p>
              </div>
            </div>
          </div>

          {/* Full-Width Quick Management Panel for Admin */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Administrative System Console</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Access advanced user controls, staff provisioning, campus broadcasts, and immutable security audit logs.
              </p>
            </div>
            <Link
              href="/admin"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#0A3D24] hover:bg-[#062415] text-[#FFCC00] font-bold text-xs shadow-sm transition-all duration-150 shrink-0"
            >
              <Settings className="w-4 h-4" />
              Open System Administration
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
