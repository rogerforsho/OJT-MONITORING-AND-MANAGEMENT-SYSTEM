'use server';

import { createClient } from '@/src/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import type { AppResult } from '@ojt/shared';
import crypto from 'crypto';

const QR_TTL_MINUTES = 5;

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function assertCoordinator() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, authorized: false };
  const { data } = await supabase
    .from('users')
    .select('role, account_status')
    .eq('user_id', user.id)
    .single();
  return { supabase, authorized: data?.role === 'Coordinator' && data?.account_status === 'active' };
}

export async function issueQrToken(company_id: string): Promise<AppResult<{ token: string; expires_at: string }>> {
  if (!company_id)
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Company ID is required.' } };

  const { authorized } = await assertCoordinator();
  if (!authorized)
    return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const token = crypto.randomBytes(32).toString('hex');
  const expires_at = new Date(Date.now() + QR_TTL_MINUTES * 60 * 1000).toISOString();

  const service = serviceClient();
  const { error } = await service.from('qr_tokens').insert({ token, company_id, expires_at });

  if (error)
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to issue QR token.' } };

  return { data: { token, expires_at }, error: null };
}

export async function validateQrToken(
  token: string,
  company_id: string
): Promise<AppResult<{ valid: boolean }>> {
  if (!token || !company_id)
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Token and company are required.' } };

  const service = serviceClient();

  const { data, error } = await service
    .from('qr_tokens')
    .select('token_id, expires_at, used, company_id')
    .eq('token', token)
    .maybeSingle();

  if (error)
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to validate QR.' } };

  if (!data)
    return { data: null, error: { code: 'INVALID_QR', message: 'Invalid QR code.' } };

  if (data.used)
    return { data: null, error: { code: 'INVALID_QR', message: 'QR code has already been used.' } };

  if (new Date(data.expires_at) < new Date())
    return { data: null, error: { code: 'EXPIRED_QR', message: 'QR code has expired.' } };

  if (data.company_id !== company_id)
    return { data: null, error: { code: 'INVALID_QR', message: 'QR code does not match your assigned company.' } };

  // Mark as used — atomic, prevents duplicate use
  await service
    .from('qr_tokens')
    .update({ used: true })
    .eq('token_id', data.token_id);

  return { data: { valid: true }, error: null };
}
