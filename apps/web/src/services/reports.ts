'use server';

import { createClient } from '@/src/lib/supabase/server';
import { recordAuditEvent } from './audit';
import type { AppResult, DbReport } from '@ojt/shared';

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

export interface ReportWithStudent extends DbReport {
  students: {
    student_number: string;
    course: string;
    users: { full_name: string };
  };
}

export interface ReportInput {
  report_type: string;
  file_path: string;
  remarks?: string;
}

export async function listStudentReports(page = 1, pageSize = 20): Promise<AppResult<{ reports: DbReport[]; total: number }>> {
  const { supabase, user, profile } = await getAuthUserWithRole();
  if (!user || profile?.role !== 'Student' || profile?.account_status !== 'active')
    return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const { data: student } = await supabase.from('students').select('student_id').eq('user_id', user.id).single();
  if (!student) return { data: null, error: { code: 'NOT_FOUND', message: 'Student profile not found.' } };

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('reports')
    .select('*', { count: 'exact' })
    .eq('student_id', student.student_id)
    .order('submission_date', { ascending: false })
    .range(from, to);

  if (error) return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to load reports.' } };

  return { data: { reports: (data ?? []) as DbReport[], total: count ?? 0 }, error: null };
}

export async function submitReport(input: ReportInput): Promise<AppResult<null>> {
  if (!input.report_type?.trim()) return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Report type is required.' } };
  if (!input.file_path?.trim()) return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'File path is required.' } };

  const { supabase, user, profile } = await getAuthUserWithRole();
  if (!user || profile?.role !== 'Student' || profile?.account_status !== 'active')
    return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const { data: student } = await supabase.from('students').select('student_id').eq('user_id', user.id).single();
  if (!student) return { data: null, error: { code: 'NOT_FOUND', message: 'Student profile not found.' } };

  const { data: report, error } = await supabase.from('reports').insert({
    student_id: student.student_id,
    report_type: input.report_type.trim(),
    file_path: input.file_path.trim(),
    status: 'submitted',
    remarks: input.remarks?.trim() ?? null,
  }).select('report_id').single();

  if (error) return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to submit report.' } };

  await recordAuditEvent({
    actor_user_id: user.id,
    action: 'REPORT_SUBMITTED',
    entity_type: 'report',
    entity_id: report.report_id,
    details: { report_type: input.report_type, file_path: input.file_path },
  });

  return { data: null, error: null };
}

export async function listReportsForCoordinator(page = 1, pageSize = 20): Promise<AppResult<{ reports: ReportWithStudent[]; total: number }>> {
  const { supabase, profile } = await getAuthUserWithRole();
  if (!profile || !['Coordinator', 'Admin'].includes(profile.role) || profile.account_status !== 'active')
    return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('reports')
    .select(`*, students ( student_number, course, users ( full_name ) )`, { count: 'exact' })
    .order('submission_date', { ascending: false })
    .range(from, to);

  if (error) return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to load reports.' } };

  return { data: { reports: (data ?? []) as ReportWithStudent[], total: count ?? 0 }, error: null };
}

export async function reviewReport(
  report_id: string,
  status: 'reviewed' | 'approved' | 'rejected',
  remarks?: string
): Promise<AppResult<null>> {
  if (!report_id) return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Report ID is required.' } };

  const { supabase, user, profile } = await getAuthUserWithRole();
  if (!user || !profile || !['Coordinator', 'Admin'].includes(profile.role) || profile.account_status !== 'active')
    return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const { error } = await supabase.from('reports').update({
    status,
    remarks: remarks?.trim() ?? null,
    updated_at: new Date().toISOString(),
  }).eq('report_id', report_id);

  if (error) return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to review report.' } };

  await recordAuditEvent({
    actor_user_id: user.id,
    action: `REPORT_${status.toUpperCase()}`,
    entity_type: 'report',
    entity_id: report_id,
    details: { status, remarks },
  });

  return { data: null, error: null };
}