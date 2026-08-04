'use server';

import { createClient } from '@/src/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import type { AppResult, DbAttendance, VerificationStatus } from '@ojt/shared';

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getAuthUserWithRole() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null };
  const { data: profile } = await supabase
    .from('users')
    .select('role, account_status')
    .eq('user_id', user.id)
    .single();
  return { supabase, user, profile };
}

export interface AttendanceWithStudent extends DbAttendance {
  students: {
    student_number: string;
    course: string;
    users: { full_name: string };
  };
}

export interface AttendanceInput {
  selfie_path?: string;
}

function getTodayDateString(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function getDayOfWeekNumber(date = new Date()) {
  const day = date.getDay();
  if (day === 0) return 7;
  return day;
}

function inferLateStatus(timeIn: string, schedule: { time_in_cutoff: string } | null) {
  if (!schedule) return 'unknown';
  const cutoff = new Date(`2000-01-01T${schedule.time_in_cutoff}`);
  const arrivedAt = new Date(timeIn);
  return arrivedAt > cutoff ? 'late' : 'on_time';
}

export async function startAttendance(input: AttendanceInput): Promise<AppResult<{ attendance_id: string }>> {
  if (!input.selfie_path?.trim()) return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'A selfie reference is required.' } };

  const { supabase, user, profile } = await getAuthUserWithRole();
  if (!user || profile?.role !== 'Student' || profile?.account_status !== 'active')
    return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('student_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (studentError) return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to load student profile.' } };
  if (!student) return { data: null, error: { code: 'NOT_FOUND', message: 'Student profile not found.' } };

  const today = getTodayDateString();
  const { data: existingToday, error: existingError } = await supabase
    .from('attendance')
    .select('attendance_id')
    .eq('student_id', student.student_id)
    .eq('attendance_date', today)
    .is('time_out', null)
    .maybeSingle();

  if (existingError) return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to check existing attendance.' } };
  if (existingToday) return { data: null, error: { code: 'DUPLICATE_REQUEST', message: 'You already have an active attendance session for today.' } };

  const { data: assignment, error: assignmentError } = await supabase
    .from('student_assignments')
    .select('assignment_id, company_id')
    .eq('student_id', student.student_id)
    .eq('assignment_status', 'active')
    .maybeSingle();

  if (assignmentError) return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to load assignment.' } };
  if (!assignment) return { data: null, error: { code: 'NOT_FOUND', message: 'No active assignment found.' } };

  const dayOfWeek = getDayOfWeekNumber();
  if (dayOfWeek > 5) return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Weekend attendance is not allowed.' } };

  const { data: schedule } = await supabase
    .from('work_schedules')
    .select('time_in_cutoff')
    .eq('company_id', assignment.company_id)
    .eq('day_of_week', dayOfWeek)
    .maybeSingle();

  const timeIn = new Date().toISOString();
  const lateStatus = inferLateStatus(timeIn, schedule);

  const { data, error } = await supabase
    .from('attendance')
    .insert({
      student_id: student.student_id,
      assignment_id: assignment.assignment_id,
      attendance_date: today,
      time_in: timeIn,
      time_in_selfie_path: input.selfie_path.trim(),
      qr_validation_status: 'valid',
      verification_status: 'pending',
      late_status: lateStatus,
      sync_status: 'synced',
    })
    .select('attendance_id')
    .single();

  if (error) return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to start attendance.' } };

  return { data: { attendance_id: data.attendance_id }, error: null };
}

export async function endAttendance(attendance_id: string, input: AttendanceInput): Promise<AppResult<null>> {
  if (!attendance_id) return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Attendance ID is required.' } };
  if (!input.selfie_path?.trim()) return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'A selfie reference is required.' } };

  const { supabase, user, profile } = await getAuthUserWithRole();
  if (!user || profile?.role !== 'Student' || profile?.account_status !== 'active')
    return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('student_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (studentError) return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to load student profile.' } };
  if (!student) return { data: null, error: { code: 'NOT_FOUND', message: 'Student profile not found.' } };

  const { data: existing, error: existingError } = await supabase
    .from('attendance')
    .select('attendance_id')
    .eq('attendance_id', attendance_id)
    .eq('student_id', student.student_id)
    .is('time_out', null)
    .maybeSingle();

  if (existingError) return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to load attendance session.' } };
  if (!existing) return { data: null, error: { code: 'NOT_FOUND', message: 'No active attendance session found.' } };

  const { error } = await supabase
    .from('attendance')
    .update({
      time_out: new Date().toISOString(),
      time_out_selfie_path: input.selfie_path.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('attendance_id', attendance_id);

  if (error) return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to end attendance.' } };

  return { data: null, error: null };
}

export async function getCurrentAttendanceSession(): Promise<AppResult<{ record: DbAttendance | null }>> {
  const { supabase, user, profile } = await getAuthUserWithRole();
  if (!user || profile?.role !== 'Student' || profile?.account_status !== 'active')
    return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('student_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (studentError) return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to load student profile.' } };
  if (!student) return { data: null, error: { code: 'NOT_FOUND', message: 'Student profile not found.' } };

  const today = getTodayDateString();
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('student_id', student.student_id)
    .eq('attendance_date', today)
    .is('time_out', null)
    .maybeSingle();

  if (error) return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to load current session.' } };

  return { data: { record: data as DbAttendance | null }, error: null };
}

export async function listAttendanceForSupervisor(
  page = 1,
  pageSize = 20,
  verificationFilter?: VerificationStatus
): Promise<AppResult<{ records: AttendanceWithStudent[]; total: number }>> {
  const { supabase, user, profile } = await getAuthUserWithRole();
  if (!user || profile?.role !== 'Supervisor' || profile?.account_status !== 'active')
    return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const { data: supervisor } = await supabase
    .from('supervisors')
    .select('supervisor_id')
    .eq('user_id', user.id)
    .single();

  if (!supervisor)
    return { data: null, error: { code: 'NOT_FOUND', message: 'Supervisor profile not found.' } };

  // Get assigned student IDs first
  const { data: assignments } = await supabase
    .from('student_assignments')
    .select('student_id')
    .eq('supervisor_id', supervisor.supervisor_id);

  const studentIds = (assignments ?? []).map((a: { student_id: string }) => a.student_id);
  if (studentIds.length === 0)
    return { data: { records: [], total: 0 }, error: null };

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('attendance')
    .select(`*, students ( student_number, course, users ( full_name ) )`, { count: 'exact' })
    .in('student_id', studentIds)
    .order('attendance_date', { ascending: false })
    .range(from, to);

  if (verificationFilter) query = query.eq('verification_status', verificationFilter);

  const { data, error, count } = await query;

  if (error)
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to load attendance records.' } };

  return { data: { records: data as AttendanceWithStudent[], total: count ?? 0 }, error: null };
}

export async function verifyAttendance(
  attendance_id: string,
  verification_status: 'verified' | 'rejected'
): Promise<AppResult<null>> {
  if (!attendance_id)
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Attendance ID is required.' } };

  const { supabase, user, profile } = await getAuthUserWithRole();
  if (!user || profile?.role !== 'Supervisor' || profile?.account_status !== 'active')
    return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const { data: supervisor } = await supabase
    .from('supervisors')
    .select('supervisor_id')
    .eq('user_id', user.id)
    .single();

  if (!supervisor)
    return { data: null, error: { code: 'NOT_FOUND', message: 'Supervisor profile not found.' } };

  // IDOR check — verify this attendance belongs to an assigned student
  const { data: record } = await supabase
    .from('attendance')
    .select('student_id, verification_status')
    .eq('attendance_id', attendance_id)
    .single();

  if (!record)
    return { data: null, error: { code: 'NOT_FOUND', message: 'Attendance record not found.' } };

  const { data: assignment } = await supabase
    .from('student_assignments')
    .select('assignment_id')
    .eq('student_id', record.student_id)
    .eq('supervisor_id', supervisor.supervisor_id)
    .maybeSingle();

  if (!assignment)
    return { data: null, error: { code: 'FORBIDDEN', message: 'You are not assigned to this student.' } };

  if (record.verification_status !== 'pending')
    return { data: null, error: { code: 'DUPLICATE_REQUEST', message: 'Attendance already verified.' } };

  const service = serviceClient();
  const { error } = await service
    .from('attendance')
    .update({ verification_status, updated_at: new Date().toISOString() })
    .eq('attendance_id', attendance_id);

  if (error)
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to update verification.' } };

  return { data: null, error: null };
}

export async function getSelfieUrl(selfie_path: string): Promise<AppResult<{ url: string }>> {
  if (!selfie_path)
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Selfie path is required.' } };

  const { user, profile } = await getAuthUserWithRole();
  if (!user || !['Supervisor', 'Coordinator', 'Admin'].includes(profile?.role ?? ''))
    return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const service = serviceClient();

  // Signed URL — never expose permanent public URLs per SECURITY.md
  const { data, error } = await service.storage
    .from('attendance-selfies')
    .createSignedUrl(selfie_path, 60);

  if (error || !data)
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to retrieve selfie.' } };

  return { data: { url: data.signedUrl }, error: null };
}

export async function listAttendanceForCoordinator(
  page = 1,
  pageSize = 20
): Promise<AppResult<{ records: AttendanceWithStudent[]; total: number }>> {
  const { supabase, profile } = await getAuthUserWithRole();
  if (!profile || !['Coordinator', 'Admin'].includes(profile.role) || profile.account_status !== 'active')
    return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('attendance')
    .select(`*, students ( student_number, course, users ( full_name ) )`, { count: 'exact' })
    .order('attendance_date', { ascending: false })
    .range(from, to);

  if (error)
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to load attendance records.' } };

  return { data: { records: data as AttendanceWithStudent[], total: count ?? 0 }, error: null };
}

export async function listOwnAttendance(
  page = 1,
  pageSize = 20
): Promise<AppResult<{ records: DbAttendance[]; total: number }>> {
  const { supabase, user, profile } = await getAuthUserWithRole();
  if (!user || profile?.role !== 'Student' || profile?.account_status !== 'active')
    return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('student_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (studentError)
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to load student profile.' } };

  if (!student)
    return { data: null, error: { code: 'NOT_FOUND', message: 'Student profile not found.' } };

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('attendance')
    .select('*', { count: 'exact' })
    .eq('student_id', student.student_id)
    .order('attendance_date', { ascending: false })
    .range(from, to);

  if (error)
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to load attendance.' } };

  return { data: { records: data as DbAttendance[], total: count ?? 0 }, error: null };
}
