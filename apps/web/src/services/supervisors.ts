'use server';

import { createClient } from '@/src/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import type { AppResult } from '@ojt/shared';

export interface SupervisorInput {
  full_name: string;
  email: string;
  password: string;
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
  if (!input.password || input.password.length < 8) return 'Password must be at least 8 characters.';
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

  const supervisors = (data ?? []).map((row: any) => {
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

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: authData, error: authError } = await service.auth.admin.createUser({
    email: input.email.trim(),
    password: input.password,
    email_confirm: true,
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

  // Set supervisor status to active immediately (as they are created directly by the Coordinator)
  await service
    .from('users')
    .update({ account_status: 'active', updated_at: new Date().toISOString() })
    .eq('user_id', authData.user.id);

  return { data: null, error: null };
}
