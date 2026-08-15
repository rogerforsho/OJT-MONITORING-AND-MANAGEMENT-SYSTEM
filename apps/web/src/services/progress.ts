'use server';

import { createClient } from '@/src/lib/supabase/server';
import type { AppResult, DbInternshipProgress } from '@ojt/shared';

async function getAuthUserWithRole() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null };
  const { data: profile } = await supabase
    .from('users')
    .select('user_id, full_name, email, role, account_status')
    .eq('user_id', user.id)
    .single();
  return { supabase, user, profile };
}

export interface StudentProgressDetail {
  student_id: string;
  full_name: string;
  student_number: string;
  course: string;
  year_level: number;
  company_name?: string;
  required_hours: number;
  completed_hours: number;
  remaining_hours: number;
  progress_status: string;
  percentage: number;
  verified_sessions_count: number;
}

export async function getOwnStudentProgress(): Promise<AppResult<StudentProgressDetail>> {
  const { supabase, user, profile } = await getAuthUserWithRole();
  if (!user || profile?.role !== 'Student' || profile?.account_status !== 'active')
    return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const { data: student } = await supabase
    .from('students')
    .select(`
      student_id, student_number, course, year_level, required_hours,
      student_assignments (
        companies ( company_name )
      )
    `)
    .eq('user_id', user.id)
    .single();

  if (!student)
    return { data: null, error: { code: 'NOT_FOUND', message: 'Student profile not found.' } };

  const { data: progress } = await supabase
    .from('internship_progress')
    .select('*')
    .eq('student_id', student.student_id)
    .maybeSingle();

  const { count: verifiedCount } = await supabase
    .from('attendance')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', student.student_id)
    .eq('verification_status', 'verified');

  const required = student.required_hours || 486;
  const completed = progress?.completed_hours || 0;
  const remaining = Math.max(0, required - completed);
  const percentage = Math.min(100, Math.round((completed / required) * 100));

  const assignment = Array.isArray(student.student_assignments) ? student.student_assignments[0] : student.student_assignments;
  const company = assignment ? (Array.isArray(assignment.companies) ? assignment.companies[0] : assignment.companies) : null;

  return {
    data: {
      student_id: student.student_id,
      full_name: profile.full_name,
      student_number: student.student_number,
      course: student.course,
      year_level: student.year_level,
      company_name: company?.company_name || 'Not yet assigned',
      required_hours: required,
      completed_hours: completed,
      remaining_hours: remaining,
      progress_status: progress?.progress_status || (completed > 0 ? 'in_progress' : 'not_started'),
      percentage,
      verified_sessions_count: verifiedCount || 0,
    },
    error: null,
  };
}

export async function listCohortProgress(
  page = 1,
  pageSize = 20,
  courseFilter?: string
): Promise<AppResult<{ students: StudentProgressDetail[]; total: number }>> {
  const { supabase, profile } = await getAuthUserWithRole();
  if (!profile || !['Coordinator', 'Admin', 'ProgramHead'].includes(profile.role) || profile.account_status !== 'active')
    return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('students')
    .select(`
      student_id, student_number, course, year_level, required_hours,
      users!inner ( full_name, account_status ),
      internship_progress ( completed_hours, remaining_hours, progress_status ),
      student_assignments ( companies ( company_name ) )
    `, { count: 'exact' })
    .eq('users.account_status', 'active')
    .order('student_number', { ascending: true })
    .range(from, to);

  if (courseFilter) query = query.eq('course', courseFilter);

  const { data, error, count } = await query;
  if (error)
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to load progress records.' } };

  const students = (data ?? []).map((s: any) => {
    const user = Array.isArray(s.users) ? s.users[0] : s.users;
    const progress = Array.isArray(s.internship_progress) ? s.internship_progress[0] : s.internship_progress;
    const assignment = Array.isArray(s.student_assignments) ? s.student_assignments[0] : s.student_assignments;
    const company = assignment ? (Array.isArray(assignment.companies) ? assignment.companies[0] : assignment.companies) : null;

    const required = s.required_hours || 486;
    const completed = progress?.completed_hours || 0;
    const remaining = Math.max(0, required - completed);
    const percentage = Math.min(100, Math.round((completed / required) * 100));

    return {
      student_id: s.student_id,
      full_name: user?.full_name || '',
      student_number: s.student_number,
      course: s.course,
      year_level: s.year_level,
      company_name: company?.company_name || 'Unassigned',
      required_hours: required,
      completed_hours: completed,
      remaining_hours: remaining,
      progress_status: progress?.progress_status || (completed > 0 ? 'in_progress' : 'not_started'),
      percentage,
      verified_sessions_count: 0,
    };
  });

  return { data: { students, total: count ?? 0 }, error: null };
}

export async function getDepartmentSummary(): Promise<AppResult<{
  totalStudents: number;
  activeTrainees: number;
  completedTrainees: number;
  totalRenderedHours: number;
  departmentCounts: Record<string, { total: number; completed: number; hours: number }>;
}>> {
  const { supabase, profile } = await getAuthUserWithRole();
  if (!profile || !['ProgramHead', 'Coordinator', 'Admin'].includes(profile.role) || profile.account_status !== 'active')
    return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const { data, error } = await supabase
    .from('students')
    .select(`
      student_id, course,
      users!inner ( account_status ),
      internship_progress ( completed_hours, progress_status )
    `)
    .eq('users.account_status', 'active');

  if (error)
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to load department summary.' } };

  let totalStudents = 0;
  let activeTrainees = 0;
  let completedTrainees = 0;
  let totalRenderedHours = 0;
  const departmentCounts: Record<string, { total: number; completed: number; hours: number }> = {
    ICS: { total: 0, completed: 0, hours: 0 },
    IBE: { total: 0, completed: 0, hours: 0 },
  };

  (data ?? []).forEach((row: any) => {
    totalStudents++;
    const progress = Array.isArray(row.internship_progress) ? row.internship_progress[0] : row.internship_progress;
    const completed = progress?.completed_hours || 0;
    const status = progress?.progress_status || 'not_started';

    totalRenderedHours += completed;
    if (status === 'completed') completedTrainees++;
    else if (status === 'in_progress') activeTrainees++;

    const isICS = ['BSIT', 'BSCS', 'ACT'].includes(row.course);
    const deptKey = isICS ? 'ICS' : 'IBE';

    departmentCounts[deptKey].total++;
    departmentCounts[deptKey].hours += completed;
    if (status === 'completed') departmentCounts[deptKey].completed++;
  });

  return {
    data: {
      totalStudents,
      activeTrainees,
      completedTrainees,
      totalRenderedHours: Math.round(totalRenderedHours),
      departmentCounts,
    },
    error: null,
  };
}
