'use server';

import { createClient } from '@/src/lib/supabase/server';
import { getServiceClient } from '@/src/lib/supabase/service';
import { validateUploadedFile } from '@/src/lib/uploadValidation';
import type { AppResult } from '@ojt/shared';

const serviceClient = getServiceClient;

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Validates file size and format, then uploads to private-documents bucket.
 * Returns the secure sanitized storage key.
 */
export async function uploadPrivateDocument(
  formData: FormData
): Promise<AppResult<{ filePath: string; fileName: string; fileSize: number }>> {
  const file = formData.get('file') as File | null;
  const reportType = (formData.get('report_type') as string) || 'document';

  const checked = await validateUploadedFile(file, ['.pdf', '.docx', '.doc', '.jpg', '.jpeg', '.png'], MAX_FILE_SIZE_BYTES);
  if (checked.error || !checked.data) return { data: null, error: checked.error };

  // 3. User Authentication & Authorization Check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { data: null, error: { code: 'UNAUTHORIZED', message: 'Not authenticated.' } };
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role, account_status')
    .eq('user_id', user.id)
    .single();

  if (!profile || profile.account_status !== 'active') {
    return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };
  }

  // 4. Sanitize File Name & Construct Secure Storage Path
  const cleanCategory = reportType.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 40);
  const sanitizedPath = `${user.id}/${cleanCategory}_${Date.now()}${checked.data.extension}`;

  const service = serviceClient();

  const { error: uploadErr } = await service.storage
    .from('private-documents')
    .upload(sanitizedPath, checked.data.bytes, {
      contentType: checked.data.mimeType,
      upsert: false,
    });

  if (uploadErr) {
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to upload document to secure storage.' } };
  }

  return {
    data: {
      filePath: sanitizedPath,
      fileName: file?.name ?? sanitizedPath,
      fileSize: checked.data.bytes.length,
    },
    error: null,
  };
}

/**
 * Generates a short-lived cryptographically signed URL for private student documents.
 * Adheres to Philippine Data Privacy Act (RA 10173) and ISO/IEC 25010:2023 Confidentiality standards.
 * Expiration defaults to 60 seconds.
 */
export async function getSignedDocumentUrl(
  filePath: string,
  expiresInSeconds = 60
): Promise<AppResult<{ signedUrl: string }>> {
  if (!filePath?.trim()) {
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'File path is required.' } };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { data: null, error: { code: 'UNAUTHORIZED', message: 'Not authenticated.' } };
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role, account_status')
    .eq('user_id', user.id)
    .single();

  if (!profile || profile.account_status !== 'active') {
    return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };
  }

  if (!Number.isInteger(expiresInSeconds) || expiresInSeconds < 1 || expiresInSeconds > 300 ||
      filePath.startsWith('http://'))
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Invalid document path or expiry.' } };

  // Query with the caller's JWT; report RLS limits rows to permitted records.
  const { data: report, error: reportError } = await supabase
    .from('reports').select('student_id').eq('file_path', filePath).limit(1).maybeSingle();
  if (reportError || !report)
    return { data: null, error: { code: 'FORBIDDEN', message: 'Document is not available to this account.' } };

  if (filePath.startsWith('https://')) return { data: { signedUrl: filePath }, error: null };

  const { data: student } = await supabase
    .from('students').select('user_id, student_id').eq('student_id', report.student_id).single();
  if (!student || !(filePath.startsWith(`${student.user_id}/`) || filePath.startsWith(`${student.student_id}/`)))
    return { data: null, error: { code: 'FORBIDDEN', message: 'Document path does not belong to this student.' } };

  const service = serviceClient();
  const { data, error } = await service.storage
    .from('private-documents')
    .createSignedUrl(filePath, expiresInSeconds);

  if (error || !data) {
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to generate secure document URL.' } };
  }

  return { data: { signedUrl: data.signedUrl }, error: null };
}
