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
