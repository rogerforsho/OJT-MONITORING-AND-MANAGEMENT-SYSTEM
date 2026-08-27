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

export interface CreateSystemUserInput {
  full_name: string;
  email: string;
  password: string;
  role: 'Coordinator' | 'ProgramHead' | 'Admin';
  department_or_program?: string;
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

export async function createSystemUser(
  input: CreateSystemUserInput
): Promise<AppResult<{ user_id: string }>> {
  const { authorized, user: adminUser } = await assertAdmin();
  if (!authorized || !adminUser) {
    return { data: null, error: { code: 'FORBIDDEN', message: 'Admin access required.' } };
  }

  if (!input.full_name?.trim()) return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Full name is required.' } };
  if (!input.email?.trim()) return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Email is required.' } };
  if (!input.password || input.password.length < 8) return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Password must be at least 8 characters.' } };
  if (!['Coordinator', 'ProgramHead', 'Admin'].includes(input.role)) {
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Invalid staff role.' } };
  }

  const service = serviceClient();

  // 1. Create auth user with pre-confirmed email
  const { data: authData, error: authError } = await service.auth.admin.createUser({
    email: input.email.trim(),
    password: input.password,
    email_confirm: true,
    user_metadata: {
      full_name: input.full_name.trim(),
      role: input.role,
    },
  });

  if (authError || !authData.user) {
    if (authError?.message?.includes('already registered') || authError?.message?.includes('unique constraint')) {
      return { data: null, error: { code: 'DUPLICATE_REQUEST', message: 'Email address is already registered.' } };
    }
    return { data: null, error: { code: 'SERVER_FAILURE', message: authError?.message || 'Failed to create staff account.' } };
  }

  const newUserId = authData.user.id;
  const dept = input.department_or_program || 'ICS';

  // 2. Ensure public.users entry is active
  await service
    .from('users')
    .upsert({
      user_id: newUserId,
      full_name: input.full_name.trim(),
      email: input.email.trim(),
      role: input.role,
      account_status: 'active',
      updated_at: new Date().toISOString(),
    });

  // 3. Populate corresponding role table
  if (input.role === 'Coordinator') {
    await service.from('coordinators').upsert({
      user_id: newUserId,
      department: dept,
    });
  } else if (input.role === 'ProgramHead') {
    await service.from('program_heads').upsert({
      user_id: newUserId,
      department_or_program: dept,
    });
  } else if (input.role === 'Admin') {
    await service.from('admins').upsert({
      user_id: newUserId,
    });
  }

  // 4. Log Audit Event
  await recordAuditEvent({
    actor_user_id: adminUser.id,
    action: `STAFF_ACCOUNT_CREATED`,
    entity_type: 'user',
    entity_id: newUserId,
    details: {
      role: input.role,
      email: input.email.trim(),
      department: dept,
    },
  });

  return { data: { user_id: newUserId }, error: null };
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
export async function deleteSystemUser(
  user_id: string
): Promise<AppResult<null>> {
  const { authorized, user: adminUser } = await assertAdmin();
  if (!authorized || !adminUser) {
    return { data: null, error: { code: 'FORBIDDEN', message: 'Admin access required.' } };
  }

  if (adminUser.id === user_id) {
    return { data: null, error: { code: 'FORBIDDEN', message: 'You cannot delete your own administrator account.' } };
  }

  const service = serviceClient();

  // 1. Fetch user details for audit logging and role-specific cleanup
  const { data: targetUser } = await service
    .from('users')
    .select('full_name, email, role')
    .eq('user_id', user_id)
    .maybeSingle();

  if (!targetUser) {
    return { data: null, error: { code: 'NOT_FOUND', message: 'User not found.' } };
  }

  // 2. If user is a supervisor, check/handle assignments to avoid foreign key restrict errors
  if (targetUser.role === 'Supervisor') {
    const { data: supervisor } = await service
      .from('supervisors')
      .select('supervisor_id')
      .eq('user_id', user_id)
      .maybeSingle();

    if (supervisor) {
      await service
        .from('student_assignments')
        .delete()
        .eq('supervisor_id', supervisor.supervisor_id);
    }
  }

  // 3. Delete user record in public schema (cascades to students/coordinators/etc)
  const { error: dbError } = await service
    .from('users')
    .delete()
    .eq('user_id', user_id);

  if (dbError) {
    return { data: null, error: { code: 'SERVER_FAILURE', message: `Database deletion failed: ${dbError.message}` } };
  }

  // 4. Delete Supabase Auth user identity
  const { error: authError } = await service.auth.admin.deleteUser(user_id);
  if (authError) {
    console.error('Warning: Failed to delete auth user from Supabase Auth:', authError.message);
  }

  // 5. Audit Log Entry
  await recordAuditEvent({
    actor_user_id: adminUser.id,
    action: 'USER_DELETED',
    entity_type: 'user',
    entity_id: user_id,
    details: {
      deleted_user_name: targetUser.full_name,
      deleted_user_email: targetUser.email,
      deleted_user_role: targetUser.role,
    },
  });

  return { data: null, error: null };
}

export async function adminResetUserPassword(
  userId: string,
  newPassword?: string
): Promise<AppResult<{ temporaryPassword?: string }>> {
  const { user, authorized } = await assertAdmin();
  if (!user || !authorized)
    return { data: null, error: { code: 'FORBIDDEN', message: 'Admin access required.' } };

  if (!userId)
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'User ID is required.' } };

  const finalPassword = newPassword?.trim() || `CdM@${Math.floor(100000 + Math.random() * 900000)}!`;

  if (finalPassword.length < 8)
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Password must be at least 8 characters long.' } };

  const service = serviceClient();

  // Fetch target user metadata
  const { data: targetUser } = await service
    .from('users')
    .select('email, full_name, role')
    .eq('user_id', userId)
    .maybeSingle();

  // Update password in Supabase Auth Admin API
  const { error: authErr } = await service.auth.admin.updateUserById(userId, {
    password: finalPassword,
  });

  if (authErr) {
    return {
      data: null,
      error: { code: 'SERVER_FAILURE', message: authErr.message || 'Failed to update user password in Auth server.' },
    };
  }

  // Record immutable security audit log
  await recordAuditEvent({
    actor_user_id: user.id,
    action: 'ADMIN_RESET_PASSWORD',
    entity_type: 'user',
    entity_id: userId,
    details: {
      target_email: targetUser?.email,
      target_role: targetUser?.role,
      reset_by_admin: user.id,
    },
  });

  return { data: { temporaryPassword: finalPassword }, error: null };
}
