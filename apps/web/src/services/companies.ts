'use server';

import { createClient } from '@/src/lib/supabase/server';
import { recordAuditEvent } from './audit';
import type { AppResult, DbCompany } from '@ojt/shared';

export interface CompanyInput {
  company_name: string;
  address: string;
  contact_person: string;
  contact_email: string;
  contact_number: string;
}

export interface CompanyWithSupervisors extends DbCompany {
  supervisors: { supervisor_id: string; user_id: string; position: string; users: { full_name: string; email: string } }[];
  active_interns_count?: number;
}

function validateCompanyInput(input: CompanyInput): string | null {
  if (!input.company_name?.trim()) return 'Company name is required.';
  if (!input.address?.trim()) return 'Address is required.';
  if (!input.contact_person?.trim()) return 'Contact person is required.';
  if (!input.contact_email?.trim()) return 'Contact email is required.';
  if (!input.contact_number?.trim()) return 'Contact number is required.';
  return null;
}

async function assertCoordinator() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, authorized: false };
  const { data } = await supabase
    .from('users')
    .select('role, account_status')
    .eq('user_id', user.id)
    .single();
  return {
    supabase,
    user,
    authorized: ['Coordinator', 'Admin', 'ProgramHead'].includes(data?.role ?? '') && data?.account_status === 'active',
  };
}

export async function listCompanies(
  page = 1,
  pageSize = 20
): Promise<AppResult<{ companies: CompanyWithSupervisors[]; total: number }>> {
  const { supabase, authorized } = await assertCoordinator();
  if (!authorized) return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('companies')
    .select(`
      *,
      supervisors (
        supervisor_id, user_id, position,
        users ( full_name, email )
      )
    `, { count: 'exact' })
    .order('company_name', { ascending: true })
    .range(from, to);

  if (error) return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to load companies.' } };
  return { data: { companies: data as CompanyWithSupervisors[], total: count ?? 0 }, error: null };
}

export async function createCompany(input: CompanyInput): Promise<AppResult<DbCompany>> {
  const validationError = validateCompanyInput(input);
  if (validationError) return { data: null, error: { code: 'VALIDATION_FAILURE', message: validationError } };

  const { supabase, user, authorized } = await assertCoordinator();
  if (!authorized || !user) return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const normalizedName = input.company_name.trim();

  // Duplicate Company Detection
  const { data: existing } = await supabase
    .from('companies')
    .select('company_id, company_name')
    .ilike('company_name', normalizedName)
    .maybeSingle();

  if (existing) {
    return { data: null, error: { code: 'DUPLICATE_REQUEST', message: `A company named "${existing.company_name}" is already registered.` } };
  }

  const { data, error } = await supabase
    .from('companies')
    .insert({
      company_name: normalizedName,
      address: input.address.trim(),
      contact_person: input.contact_person.trim(),
      contact_email: input.contact_email.trim(),
      contact_number: input.contact_number.trim(),
      status: 'active',
    })
    .select()
    .single();

  if (error) return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to create company.' } };

  await recordAuditEvent({
    actor_user_id: user.id,
    action: 'COMPANY_CREATED',
    entity_type: 'company',
    entity_id: data.company_id,
    details: { company_name: data.company_name },
  });

  return { data: data as DbCompany, error: null };
}

export async function updateCompany(
  company_id: string,
  input: CompanyInput
): Promise<AppResult<DbCompany>> {
  if (!company_id) return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Company ID is required.' } };
  const validationError = validateCompanyInput(input);
  if (validationError) return { data: null, error: { code: 'VALIDATION_FAILURE', message: validationError } };

  const { supabase, user, authorized } = await assertCoordinator();
  if (!authorized || !user) return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const { data, error } = await supabase
    .from('companies')
    .update({
      company_name: input.company_name.trim(),
      address: input.address.trim(),
      contact_person: input.contact_person.trim(),
      contact_email: input.contact_email.trim(),
      contact_number: input.contact_number.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('company_id', company_id)
    .select()
    .single();

  if (error) return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to update company.' } };

  await recordAuditEvent({
    actor_user_id: user.id,
    action: 'COMPANY_UPDATED',
    entity_type: 'company',
    entity_id: company_id,
    details: { company_name: data.company_name },
  });

  return { data: data as DbCompany, error: null };
}

export async function setCompanyStatus(
  company_id: string,
  status: 'active' | 'inactive'
): Promise<AppResult<{ activeInternsAffected: number }>> {
  if (!company_id) return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Company ID is required.' } };

  const { supabase, user, authorized } = await assertCoordinator();
  if (!authorized || !user) return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  // Check active student assignments at this establishment
  const { count: activeInterns } = await supabase
    .from('student_assignments')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', company_id)
    .eq('assignment_status', 'active');

  const { error } = await supabase
    .from('companies')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('company_id', company_id);

  if (error) return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to update company status.' } };

  await recordAuditEvent({
    actor_user_id: user.id,
    action: `COMPANY_STATUS_${status.toUpperCase()}`,
    entity_type: 'company',
    entity_id: company_id,
    details: { status, active_interns_affected: activeInterns || 0 },
  });

  return { data: { activeInternsAffected: activeInterns || 0 }, error: null };
}

export async function getCompanyCapacity(
  company_id: string
): Promise<AppResult<{ company_id: string; active_interns: number; recommended_capacity: number; is_at_capacity: boolean }>> {
  if (!company_id) return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Company ID is required.' } };

  const { supabase, authorized } = await assertCoordinator();
  if (!authorized) return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const { count, error } = await supabase
    .from('student_assignments')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', company_id)
    .eq('assignment_status', 'active');

  if (error) return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to fetch capacity.' } };

  const active = count || 0;
  const recommendedCapacity = 5; // Institutional benchmark per partner establishment

  return {
    data: {
      company_id,
      active_interns: active,
      recommended_capacity: recommendedCapacity,
      is_at_capacity: active >= recommendedCapacity,
    },
    error: null,
  };
}
