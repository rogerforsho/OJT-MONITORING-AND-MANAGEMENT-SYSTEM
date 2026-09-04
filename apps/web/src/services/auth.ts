'use server';

import { createClient } from '@/src/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import crypto from 'crypto';
import { sendOtpEmail } from '@/src/lib/email/send-otp';
import type { AppResult } from '@ojt/shared';
import type { RegisterStudentInput, SignInInput } from '@ojt/shared';

let cachedServiceClient: any = null;

function serviceClient() {
  if (!cachedServiceClient) {
    cachedServiceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      }
    );
  }
  return cachedServiceClient;
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
    if (
      authError?.message?.toLowerCase().includes('fetch failed') ||
      authError?.message?.toLowerCase().includes('failed to fetch')
    ) {
      return {
        data: null,
        error: {
          code: 'SERVER_FAILURE',
          message:
            'Database connection failed (fetch failed). Your Supabase project appears to be paused due to inactivity. Please restore it in the Supabase Dashboard (https://supabase.com/dashboard).',
        },
      };
    }
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
    const rawMsg = error.message || '';
    let msg = rawMsg;
    if (!rawMsg || rawMsg.trim() === '{}') {
      msg = 'Invalid email or password. Please make sure the demo accounts were initialized in your Supabase SQL Editor.';
    } else if (
      rawMsg.toLowerCase().includes('fetch failed') ||
      rawMsg.toLowerCase().includes('failed to fetch') ||
      rawMsg.toLowerCase().includes('networkerror') ||
      rawMsg.toLowerCase().includes('enotfound')
    ) {
      msg =
        'Database connection failed (fetch failed). Your Supabase project appears to be paused due to inactivity or the URL is unreachable. Please visit https://supabase.com/dashboard to click "Restore project", or verify the NEXT_PUBLIC_SUPABASE_URL in apps/web/.env.local.';
    }
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

function maskEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const name = parts[0];
  const domain = parts[1];
  if (name.length <= 2) return `${name[0]}*@${domain}`;
  return `${name[0]}${'*'.repeat(Math.min(name.length - 2, 5))}${name[name.length - 1]}@${domain}`;
}

export async function requestPasswordReset(
  email: string,
  identifier?: string,
  expectedRole?: 'Student' | 'Staff'
): Promise<AppResult<{ email: string; maskedEmail: string; expiresAt: string }>> {
  if (!email?.trim())
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Email address is required.' } };

  const service = serviceClient();
  const normalizedEmail = email.trim().toLowerCase();

  // 1. Verify user exists in the system
  const { data: userProfile, error: queryError } = await service
    .from('users')
    .select('user_id, role, full_name, employee_number')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (queryError) {
    if (
      queryError.message?.toLowerCase().includes('fetch failed') ||
      queryError.message?.toLowerCase().includes('failed to fetch')
    ) {
      return {
        data: null,
        error: {
          code: 'SERVER_FAILURE',
          message:
            'Database connection failed (fetch failed). Your Supabase project appears to be paused due to inactivity. Please restore it in the Supabase Dashboard (https://supabase.com/dashboard).',
        },
      };
    }
  }

  if (!userProfile) {
    return {
      data: null,
      error: { code: 'NOT_FOUND', message: 'No registered CdM account was found with that email address.' },
    };
  }

  // 2. Strict Role Tab Enforcement: Block cross-role recovery in the wrong tab
  if (expectedRole === 'Student' && userProfile.role !== 'Student') {
    return {
      data: null,
      error: {
        code: 'VALIDATION_FAILURE',
        message: `This account is registered as a ${userProfile.role} (Faculty/Staff). Please switch to the "Coordinator / Faculty" tab to reset your password.`,
      },
    };
  }

  if (expectedRole === 'Staff' && userProfile.role === 'Student') {
    return {
      data: null,
      error: {
        code: 'VALIDATION_FAILURE',
        message: 'This account is registered as a Student. Please switch to the "Student" tab to reset your password.',
      },
    };
  }

  // 3. Two-Point Identity Proofing against institutional ID records
  if (userProfile.role === 'Student') {
    if (!identifier?.trim()) {
      return {
        data: null,
        error: { code: 'VALIDATION_FAILURE', message: 'Student Number is required for student verification.' },
      };
    }

    const { data: studentRecord } = await service
      .from('students')
      .select('student_number')
      .eq('user_id', userProfile.user_id)
      .maybeSingle();

    const cleanInputId = identifier.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanDbId = (studentRecord?.student_number || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

    if (!cleanDbId || cleanInputId !== cleanDbId) {
      return {
        data: null,
        error: {
          code: 'VALIDATION_FAILURE',
          message: 'The provided Student ID does not match our institutional enrollment records for this account.',
        },
      };
    }
  } else {
    if (!identifier?.trim()) {
      return {
        data: null,
        error: { code: 'VALIDATION_FAILURE', message: 'Employee ID Number is required for faculty verification.' },
      };
    }

    const cleanInputId = identifier.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanDbId = (userProfile.employee_number || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

    if (!cleanDbId || cleanInputId !== cleanDbId) {
      return {
        data: null,
        error: {
          code: 'VALIDATION_FAILURE',
          message: 'The provided Employee ID does not match our institutional records for this faculty account.',
        },
      };
    }
  }

  // 4. Generate cryptographically secure 6-digit numeric OTP
  const otp = crypto.randomInt(100000, 1000000).toString();
  const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

  // Invalidate any existing unused OTPs for this email address
  await service
    .from('password_reset_otps')
    .update({ used: true })
    .eq('email', normalizedEmail)
    .eq('used', false);

  // Insert new hashed OTP record
  const { error: insertErr } = await service.from('password_reset_otps').insert({
    user_id: userProfile.user_id,
    email: normalizedEmail,
    otp_hash: otpHash,
    expires_at: expiresAt,
    attempts: 0,
    used: false,
  });

  if (insertErr) {
    console.error('[requestPasswordReset] Failed to store OTP in database:', insertErr);
    return {
      data: null,
      error: { code: 'SERVER_FAILURE', message: 'Failed to issue verification code. Please try again.' },
    };
  }

  // 5. Dispatch branded email with 6-digit verification code
  await sendOtpEmail({
    to: normalizedEmail,
    fullName: userProfile.full_name || 'Colegio de Montalban User',
    otp,
    expiresMinutes: 10,
  });

  return {
    data: {
      email: normalizedEmail,
      maskedEmail: maskEmail(normalizedEmail),
      expiresAt,
    },
    error: null,
  };
}

export async function verifyOtpAndResetPassword(
  email: string,
  otp: string,
  newPassword: string
): Promise<AppResult<{ success: boolean }>> {
  if (!email?.trim() || !otp?.trim() || !newPassword) {
    return {
      data: null,
      error: { code: 'VALIDATION_FAILURE', message: 'Email, verification code, and new password are required.' },
    };
  }

  if (newPassword.length < 8) {
    return {
      data: null,
      error: { code: 'VALIDATION_FAILURE', message: 'Password must be at least 8 characters long.' },
    };
  }

  const cleanOtp = otp.trim().replace(/\D/g, '');
  if (cleanOtp.length !== 6) {
    return {
      data: null,
      error: { code: 'VALIDATION_FAILURE', message: 'Verification code must be exactly 6 digits.' },
    };
  }

  const service = serviceClient();
  const normalizedEmail = email.trim().toLowerCase();

  // 1. Fetch active OTP record for this email
  const { data: otpRecord, error: fetchErr } = await service
    .from('password_reset_otps')
    .select('id, user_id, otp_hash, expires_at, attempts, used')
    .eq('email', normalizedEmail)
    .eq('used', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchErr || !otpRecord) {
    return {
      data: null,
      error: {
        code: 'NOT_FOUND',
        message: 'No active verification code found for this account. Please request a new code.',
      },
    };
  }

  // 2. Check if expired
  const isExpired = new Date(otpRecord.expires_at).getTime() < Date.now();
  if (isExpired) {
    await service.from('password_reset_otps').update({ used: true }).eq('id', otpRecord.id);
    return {
      data: null,
      error: {
        code: 'VALIDATION_FAILURE',
        message: 'The verification code has expired (valid for 10 minutes). Please request a new code.',
      },
    };
  }

  // 3. Check brute-force attempts
  if (otpRecord.attempts >= 5) {
    await service.from('password_reset_otps').update({ used: true }).eq('id', otpRecord.id);
    return {
      data: null,
      error: {
        code: 'VALIDATION_FAILURE',
        message: 'Too many incorrect attempts. For security, this code has been revoked. Please request a new code.',
      },
    };
  }

  // 4. Verify OTP Hash
  const inputHash = crypto.createHash('sha256').update(cleanOtp).digest('hex');
  if (inputHash !== otpRecord.otp_hash) {
    const nextAttempts = otpRecord.attempts + 1;
    await service
      .from('password_reset_otps')
      .update({ attempts: nextAttempts, used: nextAttempts >= 5 })
      .eq('id', otpRecord.id);

    const remaining = 5 - nextAttempts;
    return {
      data: null,
      error: {
        code: 'VALIDATION_FAILURE',
        message: remaining > 0
          ? `Incorrect verification code. ${remaining} attempt(s) remaining.`
          : 'Incorrect verification code. Attempt limit reached; please request a new code.',
      },
    };
  }

  // 5. Code verified! Update the user password in Supabase Auth via Admin client
  const { error: adminAuthErr } = await service.auth.admin.updateUserById(otpRecord.user_id, {
    password: newPassword,
  });

  if (adminAuthErr) {
    console.error('[verifyOtpAndResetPassword] Supabase admin error:', adminAuthErr);
    return {
      data: null,
      error: {
        code: 'SERVER_FAILURE',
        message: adminAuthErr.message || 'Failed to update account password.',
      },
    };
  }

  // 6. Concurrently mark OTP as used and write security audit log in parallel
  await Promise.allSettled([
    service.from('password_reset_otps').update({ used: true }).eq('id', otpRecord.id),
    service.from('audit_logs').insert({
      user_id: otpRecord.user_id,
      action: 'PASSWORD_RESET_VIA_OTP',
      table_affected: 'users',
      record_id: otpRecord.user_id,
      details: { reset_method: '6_DIGIT_OTP', reset_at: new Date().toISOString() },
      timestamp: new Date().toISOString(),
    }),
  ]);

  return { data: { success: true }, error: null };
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
    .select('user_id, full_name, email, role, account_status, employee_number')
    .eq('user_id', user.id)
    .single();

  return data ?? null;
}
