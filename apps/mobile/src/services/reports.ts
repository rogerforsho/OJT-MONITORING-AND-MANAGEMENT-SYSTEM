import { supabase } from '../lib/supabase';
import type { AppResult, DbReport } from '@ojt/shared';

export interface SubmitReportInput {
  report_type: string;
  file_path: string;
  remarks?: string;
}

export async function listStudentReports(
  page = 1,
  pageSize = 20
): Promise<AppResult<{ reports: DbReport[]; total: number }>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { data: null, error: { code: 'UNAUTHORIZED', message: 'Not authenticated.' } };
  }

  const { data: student } = await supabase
    .from('students')
    .select('student_id')
    .eq('user_id', user.id)
    .single();

  if (!student) {
    return { data: null, error: { code: 'NOT_FOUND', message: 'Student profile not found.' } };
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('reports')
    .select('*', { count: 'exact' })
    .eq('student_id', student.student_id)
    .order('submission_date', { ascending: false })
    .range(from, to);

  if (error) {
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to load submitted reports.' } };
  }

  return { data: { reports: (data as DbReport[]) ?? [], total: count ?? 0 }, error: null };
}

export async function submitStudentReport(
  input: SubmitReportInput
): Promise<AppResult<null>> {
  if (!input.report_type?.trim()) {
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Report type is required.' } };
  }
  if (!input.file_path?.trim()) {
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'File link or document path is required.' } };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { data: null, error: { code: 'UNAUTHORIZED', message: 'Not authenticated.' } };
  }

  const { data: student } = await supabase
    .from('students')
    .select('student_id')
    .eq('user_id', user.id)
    .single();

  if (!student) {
    return { data: null, error: { code: 'NOT_FOUND', message: 'Student profile not found.' } };
  }

  const { error } = await supabase.from('reports').insert({
    student_id: student.student_id,
    report_type: input.report_type.trim(),
    file_path: input.file_path.trim(),
    status: 'submitted',
    remarks: input.remarks?.trim() || null,
  });

  if (error) {
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to submit report document.' } };
  }

  return { data: null, error: null };
}
