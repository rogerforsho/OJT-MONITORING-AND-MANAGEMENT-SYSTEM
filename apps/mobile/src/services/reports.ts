import { supabase } from '../lib/supabase';
import { uploadReportToStorage } from '../lib/storage';
import type { AppResult, DbReport } from '@ojt/shared';

export interface SubmitReportInput {
  report_type: string;
  file_path?: string;
  file_attachment?: {
    uri: string;
    name: string;
    mimeType?: string;
  };
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
  if (!input.file_path?.trim() && !input.file_attachment) {
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Please attach a document file or enter a link.' } };
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

  let finalFilePath = input.file_path?.trim() || '';

  // If a document was attached from device, upload through unified storage
  if (input.file_attachment) {
    const uploadRes = await uploadReportToStorage(
      input.file_attachment.uri,
      input.file_attachment.name,
      student.student_id,
      input.file_attachment.mimeType || 'application/pdf'
    );

    if (uploadRes.error || !uploadRes.data?.path) {
      return {
        data: null,
        error: { code: 'SERVER_FAILURE', message: uploadRes.error?.message || 'Failed to upload report document.' },
      };
    }

    finalFilePath = uploadRes.data.path;
  }

  const { error } = await supabase.from('reports').insert({
    student_id: student.student_id,
    report_type: input.report_type.trim(),
    file_path: finalFilePath,
    status: 'submitted',
    remarks: input.remarks?.trim() || null,
  });

  if (error) {
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to submit report document.' } };
  }

  return { data: null, error: null };
}
