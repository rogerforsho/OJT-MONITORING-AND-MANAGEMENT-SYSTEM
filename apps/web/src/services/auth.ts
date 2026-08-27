'use server';

import { createClient } from '@/src/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import type { AppResult } from '@ojt/shared';
import type { RegisterStudentInput, SignInInput } from '@ojt/shared';

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

export async function listPendingStudents(
  page = 1,
  pageSize = 20
): Promise<AppResult<{ students: Array<{ user_id: string; full_name: string; email: string; student_number: string; course: string; year_level: number; created_at: string }>; total: number }>> {
  const { supabase, authorized } = await assertCoordinator();
  if (!authorized) return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('users')
    .select('user_id, full_name, email, created_at, students!inner(student_number, course, year_level)', { count: 'exact' })
    .eq('role', 'Student')
    .eq('account_status', 'pending')
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to load pending students.' } };

  const students = (data ?? []).map((row: any) => ({
    user_id: row.user_id,
    full_name: row.full_name,
    email: row.email,
    created_at: row.created_at,
    student_number: row.students?.student_number ?? '',
    course: row.students?.course ?? '',
    year_level: row.students?.year_level ?? 0,
  }));

  return { data: { students, total: count ?? 0 }, error: null };
}

export async function listActiveStudents(
  page = 1,
  pageSize = 20
): Promise<AppResult<{ students: Array<{ user_id: string; full_name: string; email: string; student_number: string; course: string; year_level: number; account_status: string; created_at: string }>; total: number }>> {
  const { supabase, authorized } = await assertCoordinator();
  if (!authorized) return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('users')
    .select('user_id, full_name, email, account_status, created_at, students!inner(student_number, course, year_level)', { count: 'exact' })
    .eq('role', 'Student')
    .eq('account_status', 'active')
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to load active students.' } };

  const students = (data ?? []).map((row: any) => ({
    user_id: row.user_id,
    full_name: row.full_name,
    email: row.email,
    account_status: row.account_status,
    created_at: row.created_at,
    student_number: row.students?.student_number ?? '',
    course: row.students?.course ?? '',
    year_level: row.students?.year_level ?? 0,
  }));

  return { data: { students, total: count ?? 0 }, error: null };
}

export async function updateStudentAccountStatus(
  user_id: string,
  status: 'active' | 'rejected'
): Promise<AppResult<null>> {
  if (!user_id) return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'User ID is required.' } };

  const { authorized } = await assertCoordinator();
  if (!authorized) return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const service = serviceClient();
  const { error } = await service
    .from('users')
    .update({ account_status: status, updated_at: new Date().toISOString() })
    .eq('user_id', user_id);

  if (error) return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to update student status.' } };
  return { data: null, error: null };
}

export async function registerStudent(
  input: RegisterStudentInput
): Promise<AppResult<null>> {
  // Validate
  if (!input.full_name?.trim())
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Full name is required.' } };
  if (!input.email?.trim())
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Email is required.' } };
  if (!input.password || input.password.length < 8)
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Password must be at least 8 characters.' } };
  if (!input.student_number?.trim())
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Student number is required.' } };
  if (!input.course?.trim())
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Course is required.' } };
  if (!input.year_level || input.year_level < 1 || input.year_level > 5)
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Valid year level is required.' } };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl || supabaseUrl.includes('your-project-id')) {
    return {
      data: null,
      error: {
        code: 'SERVER_FAILURE',
        message: 'Supabase is not configured yet. Please open apps/web/.env.local and add your real NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
      },
    };
  }

  const service = serviceClient();

  // Check duplicate student number
  const { data: existing } = await service
    .from('students')
    .select('student_id')
    .eq('student_number', input.student_number.trim())
    .maybeSingle();

  if (existing)
    return { data: null, error: { code: 'DUPLICATE_REQUEST', message: 'Student number already registered.' } };

  // Create auth user — trigger will insert into users table
  const { data: authData, error: authError } = await service.auth.admin.createUser({
    email: input.email.trim(),
    password: input.password,
    email_confirm: true,
    user_metadata: {
      full_name: input.full_name.trim(),
      role: 'Student',
    },
  });

  if (authError || !authData.user) {
    if (authError?.message?.includes('already registered'))
      return { data: null, error: { code: 'DUPLICATE_REQUEST', message: 'Email already registered.' } };
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Registration failed. Please try again.' } };
  }

  // Insert student profile via service role
  // required_hours is not set at registration — coordinator configures it per assignment (FR-PROG-004)
  const { error: studentError } = await service.from('students').insert({
    user_id: authData.user.id,
    student_number: input.student_number.trim(),
    course: input.course.trim(),
    year_level: input.year_level,
    status: 'active',
  });

  if (studentError) {
    // Rollback auth user
    await service.auth.admin.deleteUser(authData.user.id);
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Registration failed. Please try again.' } };
  }

  return { data: null, error: null };
}

export async function signIn(input: SignInInput): Promise<AppResult<{ email: string; full_name: string; role: string }>> {
  if (!input.email?.trim())
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Email is required.' } };
  if (!input.password)
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Password is required.' } };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl || supabaseUrl.includes('your-project-id')) {
    return {
      data: null,
      error: {
        code: 'SERVER_FAILURE',
        message: 'Supabase is not configured yet. Please open apps/web/.env.local and add your real NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
      },
    };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email.trim(),
    password: input.password,
  });

  if (error) {
    const rawMsg = error.message;
    const msg = (!rawMsg || rawMsg.trim() === '{}')
      ? 'Invalid email or password. Please make sure the demo accounts were initialized in your Supabase SQL Editor.'
      : rawMsg;
    return { data: null, error: { code: 'UNAUTHORIZED', message: msg } };
  }

  // Check account status — backend authority
  const { data: user } = await supabase
    .from('users')
    .select('account_status, role, full_name, email')
    .eq('user_id', data.user.id)
    .single();

  if (!user)
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Account not found.' } };

  if (user.account_status === 'pending') {
    await supabase.auth.signOut();
    return { data: null, error: { code: 'FORBIDDEN', message: 'Your account is pending approval.' } };
  }

  if (user.account_status === 'rejected') {
    await supabase.auth.signOut();
    return { data: null, error: { code: 'FORBIDDEN', message: 'Your account registration was rejected.' } };
  }

  if (user.account_status === 'inactive') {
    await supabase.auth.signOut();
    return { data: null, error: { code: 'FORBIDDEN', message: 'Your account has been deactivated.' } };
  }

  return {
    data: {
      email: user.email || input.email.trim(),
      full_name: user.full_name || '',
      role: user.role || 'Student',
    },
    error: null,
  };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/auth/sign-in');
}

export async function requestPasswordReset(email: string): Promise<AppResult<null>> {
  if (!email?.trim())
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Email is required.' } };

  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
  });

  if (error)
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to send reset email.' } };

  return { data: null, error: null };
}


export async function changeUserPassword(currentPassword: string, newPassword: string): Promise<AppResult<null>> {
  if (!newPassword || newPassword.length < 8)
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'New password must be at least 8 characters long.' } };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email)
    return { data: null, error: { code: 'UNAUTHORIZED', message: 'You must be signed in to change your password.' } };

  // Verify current password if supplied
  if (currentPassword) {
    const { error: verifyErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (verifyErr) {
      return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'The current password you entered is incorrect.' } };
    }
  }

  // Update password in Supabase Auth
  const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
  if (updateErr)
    return { data: null, error: { code: 'SERVER_FAILURE', message: updateErr.message || 'Failed to update password.' } };

  // Log Security Audit Event
  try {
    const service = serviceClient();
    await service.from('audit_logs').insert({
      user_id: user.id,
      action: 'PASSWORD_CHANGED',
      table_affected: 'users',
      record_id: user.id,
      details: { changed_at: new Date().toISOString() },
      timestamp: new Date().toISOString(),
    });
  } catch {}

  return { data: null, error: null };
}

export async function updatePassword(newPassword: string): Promise<AppResult<null>> {
  if (!newPassword || newPassword.length < 8)
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Password must be at least 8 characters.' } };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error)
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to update password.' } };

  return { data: null, error: null };
}

export async function getAuthUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('users')
    .select('user_id, full_name, email, role, account_status')
    .eq('user_id', user.id)
    .single();

  return data ?? null;
}
