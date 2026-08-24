'use server';

import { createClient } from '@/src/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import type { AppResult } from '@ojt/shared';

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB limit

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.jpg', '.jpeg', '.png'];

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'image/jpeg',
  'image/png',
];

/**
 * Validates file size and format, then uploads to private-documents bucket.
 * Returns the secure sanitized storage key.
 */
export async function uploadPrivateDocument(
  formData: FormData
): Promise<AppResult<{ filePath: string; fileName: string; fileSize: number }>> {
  const file = formData.get('file') as File | null;
  const reportType = (formData.get('report_type') as string) || 'document';

  if (!file || !(file instanceof File) || file.size === 0) {
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Please select a valid file to upload.' } };
  }

  // 1. File Size Checker (Max 10 MB)
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      data: null,
      error: {
        code: 'VALIDATION_FAILURE',
        message: `File size (${sizeInMB} MB) exceeds the maximum limit of 10 MB. Please compress or optimize your document.`,
      },
    };
  }

  // 2. File Extension & MIME Type Whitelist Checker
  const originalName = file.name.toLowerCase();
  const hasValidExt = ALLOWED_EXTENSIONS.some((ext) => originalName.endsWith(ext));
  const hasValidMime = ALLOWED_MIME_TYPES.includes(file.type);

  if (!hasValidExt && !hasValidMime) {
    return {
      data: null,
      error: {
        code: 'VALIDATION_FAILURE',
        message: `Unusual or unsupported file format detected ("${file.name}"). Only official document formats (PDF, Word DOCX, JPG, PNG) are accepted.`,
      },
    };
  }

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
  const ext = originalName.substring(originalName.lastIndexOf('.')) || '.pdf';
  const cleanCategory = reportType.replace(/[^a-zA-Z0-9_]/g, '_');
  const sanitizedPath = `${user.id}/${cleanCategory}_${Date.now()}${ext}`;

  // 5. Upload Buffer to Supabase Storage
  const buffer = Buffer.from(await file.arrayBuffer());
  const service = serviceClient();

  const { error: uploadErr } = await service.storage
    .from('private-documents')
    .upload(sanitizedPath, buffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: true,
    });

  if (uploadErr) {
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to upload document to secure storage.' } };
  }

  return {
    data: {
      filePath: sanitizedPath,
      fileName: file.name,
      fileSize: file.size,
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

  const service = serviceClient();
  const { data, error } = await service.storage
    .from('private-documents')
    .createSignedUrl(filePath, expiresInSeconds);

  if (error || !data) {
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to generate secure document URL.' } };
  }

  return { data: { signedUrl: data.signedUrl }, error: null };
}