'use server';

import { createClient } from '@/src/lib/supabase/server';
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
  if (!user) return { supabase, authorized: false };
  const { data } = await supabase
    .from('users')
    .select('role, account_status')
    .eq('user_id', user.id)
    .single();
  return { supabase, authorized: data?.role === 'Coordinator' && data?.account_status === 'active' };
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

  const { supabase, authorized } = await assertCoordinator();
  if (!authorized) return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const { data, error } = await supabase
    .from('companies')
    .insert({
      company_name: input.company_name.trim(),
      address: input.address.trim(),
      contact_person: input.contact_person.trim(),
      contact_email: input.contact_email.trim(),
      contact_number: input.contact_number.trim(),
      status: 'active',
    })
    .select()
    .single();

  if (error) return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to create company.' } };
  return { data: data as DbCompany, error: null };
}

export async function updateCompany(
  company_id: string,
  input: CompanyInput
): Promise<AppResult<DbCompany>> {
  if (!company_id) return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Company ID is required.' } };
  const validationError = validateCompanyInput(input);
  if (validationError) return { data: null, error: { code: 'VALIDATION_FAILURE', message: validationError } };

  const { supabase, authorized } = await assertCoordinator();
  if (!authorized) return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

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
  return { data: data as DbCompany, error: null };
}

export async function setCompanyStatus(
  company_id: string,
  status: 'active' | 'inactive'
): Promise<AppResult<null>> {
  if (!company_id) return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Company ID is required.' } };

  const { supabase, authorized } = await assertCoordinator();
  if (!authorized) return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const { error } = await supabase
    .from('companies')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('company_id', company_id);

  if (error) return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to update company status.' } };
  return { data: null, error: null };
}
