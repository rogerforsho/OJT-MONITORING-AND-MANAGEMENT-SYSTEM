'use server';

import { createClient } from '@/src/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { recordAuditEvent } from './audit';
import type { AppResult, UserRole, AccountStatus, DbUser } from '@ojt/shared';

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { authorized: false, user: null };
  const { data: profile } = await supabase
    .from('users')
    .select('role, account_status')
    .eq('user_id', user.id)
    .single();
  return {
    authorized: profile?.role === 'Admin' && profile?.account_status === 'active',
    user,
  };
}

export interface UserManagementItem {
  user_id: string;
  full_name: string;
  email: string;
  role: UserRole;
  account_status: AccountStatus;
  created_at: string;
}

export async function listAllUsers(
  page = 1,
  pageSize = 20,
  roleFilter?: string,
  statusFilter?: string,
  search?: string
): Promise<AppResult<{ users: UserManagementItem[]; total: number }>> {
  const { authorized } = await assertAdmin();
  if (!authorized) return { data: null, error: { code: 'FORBIDDEN', message: 'Admin access required.' } };

  const service = serviceClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = service
    .from('users')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (roleFilter && roleFilter !== 'all') query = query.eq('role', roleFilter);
  if (statusFilter && statusFilter !== 'all') query = query.eq('account_status', statusFilter);
  if (search?.trim()) {
    query = query.or(`full_name.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%`);
  }

  const { data, error, count } = await query;
  if (error)
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to load user records.' } };

  return {
    data: {
      users: (data ?? []) as UserManagementItem[],
      total: count ?? 0,
    },
    error: null,
  };
}

export async function updateUserAccountStatus(
  user_id: string,
  status: AccountStatus
): Promise<AppResult<null>> {
  const { authorized, user } = await assertAdmin();
  if (!authorized || !user) return { data: null, error: { code: 'FORBIDDEN', message: 'Admin access required.' } };

  if (!['pending', 'active', 'rejected', 'inactive'].includes(status)) {
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Invalid status.' } };
  }

  const service = serviceClient();
  const { error } = await service
    .from('users')
    .update({ account_status: status, updated_at: new Date().toISOString() })
    .eq('user_id', user_id);

  if (error)
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to update user status.' } };

  // Log Audit Event for Non-repudiation
  await recordAuditEvent({
    actor_user_id: user.id,
    action: `ACCOUNT_STATUS_${status.toUpperCase()}`,
    entity_type: 'user',
    entity_id: user_id,
    details: { new_status: status },
  });

  return { data: null, error: null };
}

export async function getSystemOverview(): Promise<AppResult<{
  totalUsers: number;
  activeUsers: number;
  pendingUsers: number;
  companiesCount: number;
  attendanceCount: number;
  roleBreakdown: Record<string, number>;
}>> {
  const { authorized } = await assertAdmin();
  if (!authorized) return { data: null, error: { code: 'FORBIDDEN', message: 'Admin access required.' } };

  const service = serviceClient();

  const [
    { count: totalUsers },
    { count: activeUsers },
    { count: pendingUsers },
    { count: companiesCount },
    { count: attendanceCount },
    { data: users },
  ] = await Promise.all([
    service.from('users').select('*', { count: 'exact', head: true }),
    service.from('users').select('*', { count: 'exact', head: true }).eq('account_status', 'active'),
    service.from('users').select('*', { count: 'exact', head: true }).eq('account_status', 'pending'),
    service.from('companies').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    service.from('attendance').select('*', { count: 'exact', head: true }),
    service.from('users').select('role'),
  ]);

  const roleBreakdown: Record<string, number> = {
    Student: 0,
    Coordinator: 0,
    Supervisor: 0,
    ProgramHead: 0,
    Admin: 0,
  };

  (users ?? []).forEach((u: { role: string }) => {
    if (roleBreakdown[u.role] !== undefined) {
      roleBreakdown[u.role]++;
    }
  });

  return {
    data: {
      totalUsers: totalUsers ?? 0,
      activeUsers: activeUsers ?? 0,
      pendingUsers: pendingUsers ?? 0,
      companiesCount: companiesCount ?? 0,
      attendanceCount: attendanceCount ?? 0,
      roleBreakdown,
    },
    error: null,
  };
}
