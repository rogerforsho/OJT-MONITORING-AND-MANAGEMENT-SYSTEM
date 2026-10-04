'use server';

import crypto from 'crypto';
import { createClient } from '@/src/lib/supabase/server';
import { getServiceClient } from '@/src/lib/supabase/service';
import type { AppResult } from '@ojt/shared';

export interface SupervisorInput {
  full_name: string;
  email: string;
  company_id: string;
  position: string;
}

export interface SupervisorWithCompany {
  supervisor_id: string;
  company_id: string;
  position: string;
  users: { full_name: string; email: string };
  companies: { company_name: string };
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

function validateSupervisorInput(input: SupervisorInput): string | null {
  if (!input.full_name?.trim()) return 'Full name is required.';
  if (!input.email?.trim()) return 'Email is required.';
  if (!input.company_id) return 'Company is required.';
  if (!input.position?.trim()) return 'Position is required.';
  return null;
}

export async function listSupervisors(
  page = 1,
  pageSize = 20
): Promise<AppResult<{ supervisors: SupervisorWithCompany[]; total: number }>> {
  const { supabase, authorized } = await assertCoordinator();
  if (!authorized) return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('supervisors')
    .select(`
      supervisor_id,
      company_id,
      position,
      users ( full_name, email ),
      companies ( company_name )
    `, { count: 'exact' })
    .order('position', { ascending: true })
    .range(from, to);

  if (error) return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to load supervisors.' } };

  interface RawSupervisorRow {
    supervisor_id: string;
    company_id: string;
    position: string;
    users: { full_name?: string | null; email?: string | null } | Array<{ full_name?: string | null; email?: string | null }>;
    companies: { company_name?: string | null } | Array<{ company_name?: string | null }>;
  }

  const supervisors = (data ?? []).map((row: RawSupervisorRow) => {
    const user = Array.isArray(row.users) ? row.users[0] : row.users;
    const company = Array.isArray(row.companies) ? row.companies[0] : row.companies;
    return {
      supervisor_id: row.supervisor_id,
      company_id: row.company_id,
      position: row.position,
      users: {
        full_name: user?.full_name ?? '',
        email: user?.email ?? '',
      },
      companies: {
        company_name: company?.company_name ?? '',
      },
    } satisfies SupervisorWithCompany;
  });

  return {
    data: { supervisors, total: count ?? 0 },
    error: null,
  };
}

export async function createSupervisor(input: SupervisorInput): Promise<AppResult<null>> {
  const validationError = validateSupervisorInput(input);
  if (validationError) return { data: null, error: { code: 'VALIDATION_FAILURE', message: validationError } };

  const { authorized } = await assertCoordinator();
  if (!authorized) return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const service = getServiceClient();
  const employeeNumber = `SUP-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
  // Nobody, including the coordinator or email provider, receives this password.
  const initialPassword = crypto.randomBytes(32).toString('base64url');

  const { data: authData, error: authError } = await service.auth.admin.createUser({
    email: input.email.trim(),
    password: initialPassword,
    email_confirm: true,
    app_metadata: { role: 'Supervisor' },
    user_metadata: {
      full_name: input.full_name.trim(),
      role: 'Supervisor',
    },
  });

  if (authError || !authData.user) {
    if (authError?.message?.includes('already registered'))
      return { data: null, error: { code: 'DUPLICATE_REQUEST', message: 'Email already registered.' } };
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to create supervisor account.' } };
  }

  const { error: supervisorError } = await service.from('supervisors').insert({
    user_id: authData.user.id,
    company_id: input.company_id,
    position: input.position.trim(),
  });

  if (supervisorError) {
    await service.auth.admin.deleteUser(authData.user.id);
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to create supervisor profile.' } };
  }

  // The ID supports the existing staff OTP password-setup screen.
  const { error: profileError } = await service
    .from('users')
    .update({ employee_number: employeeNumber, account_status: 'active', updated_at: new Date().toISOString() })
    .eq('user_id', authData.user.id);
  if (profileError) {
    await service.auth.admin.deleteUser(authData.user.id);
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to activate supervisor account.' } };
  }

  // Deliver the account ID and password-setup instructions, never a password.
  try {
    const { data: comp } = await service
      .from('companies')
      .select('company_name')
      .eq('company_id', input.company_id)
      .single();

    const companyName = comp?.company_name || 'Host Training Establishment';

    const { sendSupervisorWelcomeEmail } = await import('@/src/lib/email/send-account-status');
    const delivery = await sendSupervisorWelcomeEmail({
      to: input.email.trim(),
      fullName: input.full_name.trim(),
      companyName,
      position: input.position.trim(),
      employeeNumber,
    });
    if (!delivery.success) throw new Error('Welcome email delivery failed');
  } catch {
    const { error: rollbackError } = await service.auth.admin.deleteUser(authData.user.id);
    if (rollbackError) console.error('[createSupervisor] Failed to roll back an undelivered account');
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Supervisor email could not be delivered. Please try again later.' } };
  }

  return { data: null, error: null };
}
