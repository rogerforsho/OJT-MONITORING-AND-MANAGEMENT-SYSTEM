'use server';

import { createClient } from '@/src/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { recordAuditEvent } from './audit';
import type { AppResult, DbAttendance, VerificationStatus } from '@ojt/shared';

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export interface AttendanceWithStudent extends DbAttendance {
  students: {
    student_number: string;
    course: string;
    users: { full_name: string };
  };
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

export async function listAttendanceForSupervisor(
  page = 1,
  pageSize = 20,
  verificationFilter?: VerificationStatus
): Promise<AppResult<{ records: AttendanceWithStudent[]; total: number }>> {
  const { supabase, user, profile } = await getAuthUserWithRole();
  if (!user || profile?.role !== 'Supervisor' || profile?.account_status !== 'active')
    return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const service = serviceClient();
  let { data: supervisor } = await supabase
    .from('supervisors')
    .select('supervisor_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!supervisor) {
    const { data: svcSupervisor } = await service
      .from('supervisors')
      .select('supervisor_id')
      .eq('user_id', user.id)
      .maybeSingle();
    supervisor = svcSupervisor;
  }

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

  const service = serviceClient();
  let { data: supervisor } = await supabase
    .from('supervisors')
    .select('supervisor_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!supervisor) {
    const { data: svcSupervisor } = await service
      .from('supervisors')
      .select('supervisor_id')
      .eq('user_id', user.id)
      .maybeSingle();
    supervisor = svcSupervisor;
  }

  if (!supervisor)
    return { data: null, error: { code: 'NOT_FOUND', message: 'Supervisor profile not found.' } };

  // IDOR check - verify this attendance belongs to an assigned student
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

  const { error } = await service
    .from('attendance')
    .update({ verification_status, updated_at: new Date().toISOString() })
    .eq('attendance_id', attendance_id);

  if (error)
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to update verification.' } };

  return { data: null, error: null };
}

export async function batchVerifyAttendance(): Promise<AppResult<{ verifiedCount: number }>> {
  const { supabase, user, profile } = await getAuthUserWithRole();
  if (!user || profile?.role !== 'Supervisor' || profile?.account_status !== 'active')
    return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const service = serviceClient();
  let { data: supervisor } = await supabase
    .from('supervisors')
    .select('supervisor_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!supervisor) {
    const { data: svcSupervisor } = await service
      .from('supervisors')
      .select('supervisor_id')
      .eq('user_id', user.id)
      .maybeSingle();
    supervisor = svcSupervisor;
  }

  if (!supervisor)
    return { data: null, error: { code: 'NOT_FOUND', message: 'Supervisor profile not found.' } };

  const { data: assignments } = await supabase
    .from('student_assignments')
    .select('student_id')
    .eq('supervisor_id', supervisor.supervisor_id)
    .eq('assignment_status', 'active');

  const studentIds = (assignments ?? []).map((a: { student_id: string }) => a.student_id);
  if (studentIds.length === 0)
    return { data: { verifiedCount: 0 }, error: null };

  const { data: updated, error } = await service
    .from('attendance')
    .update({ verification_status: 'verified', updated_at: new Date().toISOString() })
    .in('student_id', studentIds)
    .eq('verification_status', 'pending')
    .select('attendance_id');

  if (error)
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to batch verify attendance.' } };

  return { data: { verifiedCount: updated?.length ?? 0 }, error: null };
}

/**
 * Coordinator Institutional Override:
 * Allows OJT Coordinator / Admin to administratively verify pending attendance
 * if a company supervisor is unresponsive or unavailable before graduation clearance.
 */
export async function coordinatorOverrideVerifyAttendance(
  attendance_id: string,
  verification_status: 'verified' | 'rejected',
  override_reason?: string
): Promise<AppResult<null>> {
  if (!attendance_id)
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Attendance ID is required.' } };

  const { user, profile } = await getAuthUserWithRole();
  if (!user || !['Coordinator', 'Admin'].includes(profile?.role ?? '') || profile?.account_status !== 'active')
    return { data: null, error: { code: 'FORBIDDEN', message: 'Institutional Coordinator privileges required.' } };

  const service = serviceClient();

  const { data: record, error: fetchErr } = await service
    .from('attendance')
    .select('attendance_id, student_id, verification_status')
    .eq('attendance_id', attendance_id)
    .single();

  if (fetchErr || !record)
    return { data: null, error: { code: 'NOT_FOUND', message: 'Attendance record not found.' } };

  const { error } = await service
    .from('attendance')
    .update({ verification_status, updated_at: new Date().toISOString() })
    .eq('attendance_id', attendance_id);

  if (error)
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to apply institutional override.' } };

  // Non-repudiation Audit Trail Entry
  await recordAuditEvent({
    actor_user_id: user.id,
    action: `ATTENDANCE_OVERRIDE_${verification_status.toUpperCase()}`,
    entity_type: 'attendance',
    entity_id: attendance_id,
    details: {
      student_id: record.student_id,
      previous_status: record.verification_status,
      new_status: verification_status,
      override_reason: override_reason?.trim() || 'Institutional graduation clearance override by Coordinator.',
    },
  });

  return { data: null, error: null };
}

/**
 * Coordinator Batch Override:
 * Administratively verifies all pending attendances for a student.
 */
export async function coordinatorBatchOverrideForStudent(
  student_id: string,
  override_reason?: string
): Promise<AppResult<{ verifiedCount: number }>> {
  if (!student_id)
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Student ID is required.' } };

  const { user, profile } = await getAuthUserWithRole();
  if (!user || !['Coordinator', 'Admin'].includes(profile?.role ?? '') || profile?.account_status !== 'active')
    return { data: null, error: { code: 'FORBIDDEN', message: 'Institutional Coordinator privileges required.' } };

  const service = serviceClient();

  const { data: updated, error } = await service
    .from('attendance')
    .update({ verification_status: 'verified', updated_at: new Date().toISOString() })
    .eq('student_id', student_id)
    .eq('verification_status', 'pending')
    .select('attendance_id');

  if (error)
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to batch override student attendance.' } };

  const count = updated?.length ?? 0;

  if (count > 0) {
    await recordAuditEvent({
      actor_user_id: user.id,
      action: 'ATTENDANCE_BATCH_OVERRIDE',
      entity_type: 'student',
      entity_id: student_id,
      details: {
        verified_count: count,
        override_reason: override_reason?.trim() || 'Faculty institutional override for graduation batch processing.',
      },
    });
  }

  return { data: { verifiedCount: count }, error: null };
}
export async function getSelfieUrl(selfie_path: string): Promise<AppResult<{ url: string }>> {
  if (!selfie_path)
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Selfie path is required.' } };

  const { user, profile } = await getAuthUserWithRole();
  if (!user || !['Supervisor', 'Coordinator', 'Admin'].includes(profile?.role ?? ''))
    return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const service = serviceClient();

  const { data, error } = await service.storage
    .from('attendance-selfies')
    .createSignedUrl(selfie_path, 300);

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

  const { data: student } = await supabase
    .from('students')
    .select('student_id')
    .eq('user_id', user.id)
    .single();

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