'use server';

import { createClient } from '@/src/lib/supabase/server';
import { getServiceClient } from '@/src/lib/supabase/service';
import { redirect } from 'next/navigation';
import crypto from 'crypto';
import { sendOtpEmail } from '@/src/lib/email/send-otp';
import { validateUploadedFile } from '@/src/lib/uploadValidation';
import type { AppError, AppResult } from '@ojt/shared';
import type { RegisterStudentInput, SignInInput } from '@ojt/shared';
import { isICSCourse, isIBECourse } from '@/src/lib/departments';
import { recordAuditEvent } from './audit';

let cachedServiceClient: any = null;

function serviceClient() {
  if (!cachedServiceClient) {
    cachedServiceClient = getServiceClient();
  }
  return cachedServiceClient;
}

type AuthAction = 'login' | 'register' | 'password_reset_request' | 'password_reset_verify' | 'id_card_upload';

async function authActionLimit(
  action: AuthAction,
  email: string,
  maxAttempts: number,
  windowSeconds: number
): Promise<AppError | null> {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return { code: 'SERVER_FAILURE', message: 'Authentication service is not configured.' };

  const subjectHash = crypto.createHmac('sha256', secret)
    .update(email.trim().toLowerCase()).digest('hex');
  const { data, error } = await serviceClient().rpc('claim_auth_rate_limit', {
    p_action: action,
    p_subject_hash: subjectHash,
    p_max_attempts: maxAttempts,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error(`[authActionLimit] ${action} unavailable`);
    return { code: 'SERVER_FAILURE', message: 'Authentication service is temporarily unavailable.' };
  }
  return data === true ? null : {
    code: 'RATE_LIMITED', message: 'Too many attempts. Please wait before trying again.',
  };
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
  return {
    supabase,
    authorized: ['Coordinator', 'Admin'].includes(data?.role ?? '') && data?.account_status === 'active',
  };
}

export async function listPendingStudents(
  page = 1,
  pageSize = 20
): Promise<AppResult<{ students: Array<{ user_id: string; full_name: string; email: string; student_number: string; course: string; year_level: number; created_at: string; id_card_path?: string | null; id_card_signed_url?: string | null }>; total: number }>> {
  const { supabase, authorized } = await assertCoordinator();
  if (!authorized) return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('users')
    .select('user_id, full_name, email, created_at, students!inner(student_number, course, year_level, id_card_path)', { count: 'exact' })
    .eq('role', 'Student')
    .eq('account_status', 'pending')
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to load pending students.' } };

  const service = serviceClient();
  const students = await Promise.all((data ?? []).map(async (row: any) => {
    let id_card_signed_url = null;
    const path = row.students?.id_card_path;
    if (path) {
      try {
        const { data: signed } = await service.storage.from('private-documents').createSignedUrl(path, 3600);
        id_card_signed_url = signed?.signedUrl ?? null;
      } catch {
        // Fallback silently if signed URL generation fails
      }
    }
    return {
      user_id: row.user_id,
      full_name: row.full_name,
      email: row.email,
      created_at: row.created_at,
      student_number: row.students?.student_number ?? '',
      course: row.students?.course ?? '',
      year_level: row.students?.year_level ?? 0,
      id_card_path: path ?? null,
      id_card_signed_url,
    };
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

import { sendAccountStatusEmail } from '@/src/lib/email/send-account-status';

export async function updateStudentAccountStatus(
  user_id: string,
  status: 'active' | 'rejected',
  reason?: string
): Promise<AppResult<null>> {
  if (!user_id) return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'User ID is required.' } };

  const { authorized } = await assertCoordinator();
  if (!authorized) return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const service = serviceClient();

  // Fetch student details for notification email
  const { data: userRec } = await service
    .from('users')
    .select('user_id, full_name, email')
    .eq('user_id', user_id)
    .maybeSingle();

  const { error } = await service
    .from('users')
    .update({ account_status: status, updated_at: new Date().toISOString() })
    .eq('user_id', user_id);

  if (error) return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to update student status.' } };

  // 1. Create in-app notification record matching schema
  try {
    await service.from('notifications').insert({
      receiver_user_id: user_id,
      message: status === 'active'
        ? 'Account Verified: Welcome to CdM OJT! Please submit your 5 pre-deployment gateway documents via the mobile app to unlock company assignment and daily attendance.'
        : `Registration Not Approved: ${reason ? `Reason: ${reason}` : 'Please consult your Institute OJT Coordinator.'}`,
      status: 'unread',
      notification_date: new Date().toISOString(),
    });
  } catch {
    // Continue even if in-app notification fails
  }

  // 2. Dispatch official notification email
  if (userRec?.email) {
    try {
      await sendAccountStatusEmail({
        to: userRec.email,
        fullName: userRec.full_name || 'Trainee',
        status,
        reason,
      });
    } catch (emailErr) {
      console.error('[updateStudentAccountStatus] Email dispatch failed:', emailErr);
    }
  }

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
  if (!isICSCourse(input.course) && !isIBECourse(input.course))
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Practicum enrollment is strictly reserved for Institute of Computing Studies (ICS) and Institute of Business and Entrepreneurship (IBE) departments.' } };
  if (input.year_level !== 4)
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'OJT registration is exclusively restricted to 4th-Year graduating students.' } };

  const limitError = await authActionLimit('register', input.email, 3, 3600);
  if (limitError) return { data: null, error: limitError };

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

  // 1. Check duplicate student number
  const { data: existing } = await service
    .from('students')
    .select('student_id')
    .eq('student_number', input.student_number.trim())
    .maybeSingle();

  if (existing)
    return { data: null, error: { code: 'DUPLICATE_REQUEST', message: 'Student number already registered.' } };

  // 2. Check and reconcile any orphaned user record in public.users (not present in auth.users)
  const { data: existingUser } = await service
    .from('users')
    .select('user_id')
    .eq('email', input.email.trim().toLowerCase())
    .maybeSingle();

  if (existingUser) {
    const { data: authUserCheck } = await service.auth.admin.getUserById(existingUser.user_id);
    if (authUserCheck?.user) {
      return { data: null, error: { code: 'DUPLICATE_REQUEST', message: 'Email already registered.' } };
    } else {
      // Orphaned record: clean up from public.students and public.users to avoid unique constraint collisions
      await service.from('students').delete().eq('user_id', existingUser.user_id);
      await service.from('users').delete().eq('user_id', existingUser.user_id);
    }
  }

  // 3. Create auth user with full metadata
  const { data: authData, error: authError } = await service.auth.admin.createUser({
    email: input.email.trim(),
    password: input.password,
    email_confirm: true,
    user_metadata: {
      full_name: input.full_name.trim(),
      role: 'Student',
      student_number: input.student_number.trim(),
      course: input.course.trim(),
      year_level: input.year_level,
      id_card_path: input.id_card_path || null,
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
    return { data: null, error: { code: 'SERVER_FAILURE', message: authError?.message || 'Registration failed. Please try again.' } };
  }

  // 4. Upsert student profile (handles both trigger-created row and ensures all fields are cleanly stored)
  // required_hours is not set at registration — coordinator configures it per assignment (FR-PROG-004)
  const { error: studentError } = await service.from('students').upsert({
    user_id: authData.user.id,
    student_number: input.student_number.trim(),
    course: input.course.trim(),
    year_level: input.year_level,
    status: 'active',
    id_card_path: input.id_card_path || null,
  }, { onConflict: 'user_id' });

  if (studentError) {
    // Rollback auth user
    await service.auth.admin.deleteUser(authData.user.id);
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Registration failed. Please try again.' } };
  }

  return { data: null, error: null };
}

export async function uploadStudentIdCard(formData: FormData): Promise<AppResult<{ file_path: string }>> {
  const email = formData.get('email');
  if (typeof email !== 'string' || !email.trim())
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Registration email is required.' } };
  const limitError = await authActionLimit('id_card_upload', email, 3, 3600);
  if (limitError) return { data: null, error: limitError };

  const file = formData.get('file') as File | null;
  const checked = await validateUploadedFile(file, ['.pdf', '.jpg', '.jpeg', '.png'], 5 * 1024 * 1024);
  if (checked.error || !checked.data) return { data: null, error: checked.error };

  const service = serviceClient();
  const filePath = `id-cards/${Date.now()}_${crypto.randomBytes(12).toString('hex')}${checked.data.extension}`;

  const { error: uploadErr } = await service.storage
    .from('private-documents')
    .upload(filePath, checked.data.bytes, {
      contentType: checked.data.mimeType,
      upsert: false,
    });

  if (uploadErr) {
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to upload student ID card: ' + uploadErr.message } };
  }

  return { data: { file_path: filePath }, error: null };
}

export async function signIn(input: SignInInput): Promise<AppResult<{ email: string; full_name: string; role: string }>> {
  if (!input.email?.trim())
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Email is required.' } };
  if (!input.password)
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Password is required.' } };

  const limitError = await authActionLimit('login', input.email, 10, 900);
  if (limitError) return { data: null, error: limitError };

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

    // Record LOGIN_FAILED audit trail for incident response & brute-force monitoring
    await recordAuditEvent({
      actor_user_id: null,
      action: 'LOGIN_FAILED',
      entity_type: 'auth',
      details: {
        email: input.email.trim(),
        reason: rawMsg || 'Invalid credentials',
      },
    });

    return { data: null, error: { code: 'UNAUTHORIZED', message: msg } };
  }

  // Check account status — backend authority
  const { data: user } = await supabase
    .from('users')
    .select('user_id, account_status, role, full_name, email')
    .eq('user_id', data.user.id)
    .single();

  if (!user) {
    await recordAuditEvent({
      actor_user_id: data.user.id,
      action: 'LOGIN_FAILED',
      entity_type: 'auth',
      details: { email: input.email.trim(), reason: 'Profile record missing' },
    });
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Account not found.' } };
  }

  if (user.account_status === 'pending') {
    await supabase.auth.signOut();
    await recordAuditEvent({
      actor_user_id: user.user_id,
      action: 'LOGIN_BLOCKED_PENDING',
      entity_type: 'auth',
      details: { email: user.email, role: user.role, reason: 'Account pending coordinator approval' },
    });
    return { data: null, error: { code: 'FORBIDDEN', message: 'Your account is pending approval.' } };
  }

  if (user.account_status === 'rejected') {
    await supabase.auth.signOut();
    await recordAuditEvent({
      actor_user_id: user.user_id,
      action: 'LOGIN_BLOCKED_REJECTED',
      entity_type: 'auth',
      details: { email: user.email, role: user.role },
    });
    return { data: null, error: { code: 'FORBIDDEN', message: 'Your account registration was rejected.' } };
  }

  if (user.account_status === 'inactive') {
    await supabase.auth.signOut();
    await recordAuditEvent({
      actor_user_id: user.user_id,
      action: 'LOGIN_BLOCKED_DEACTIVATED',
      entity_type: 'auth',
      details: { email: user.email, role: user.role },
    });
    return { data: null, error: { code: 'FORBIDDEN', message: 'Your account has been deactivated.' } };
  }

  // Enforce Mobile-Only Access for Student Trainees on Web Portal
  if (user.role === 'Student') {
    await supabase.auth.signOut();
    await recordAuditEvent({
      actor_user_id: user.user_id,
      action: 'LOGIN_BLOCKED_WEB_STUDENT',
      entity_type: 'auth',
      details: { email: user.email, reason: 'Students restricted to mobile application' },
    });
    return {
      data: null,
      error: {
        code: 'FORBIDDEN',
        message: 'Student accounts must access the system via the CdM OJT Mobile App. Web portal access is reserved for faculty, coordinators, supervisors, and administrators.',
      },
    };
  }

  // Record successful sign-in
  await recordAuditEvent({
    actor_user_id: user.user_id,
    action: 'LOGIN_SUCCESS',
    entity_type: 'auth',
    entity_id: user.user_id,
    details: {
      email: user.email,
      role: user.role,
    },
  });

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

  const limitError = await authActionLimit('password_reset_request', email, 3, 900);
  if (limitError) return { data: null, error: limitError };

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
        message: 'This account is registered as a Student Trainee. Password recovery for students is conducted exclusively through the CdM Mobile Application.',
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
  const delivery = await sendOtpEmail({
    to: normalizedEmail,
    fullName: userProfile.full_name || 'Colegio de Montalban User',
    otp,
    expiresMinutes: 10,
  });
  if (!delivery.success) {
    await service.from('password_reset_otps').update({ used: true }).eq('email', normalizedEmail).eq('used', false);
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Unable to deliver a reset code. Please try again later.' } };
  }

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

  const limitError = await authActionLimit('password_reset_verify', email, 10, 900);
  if (limitError) return { data: null, error: limitError };

  const service = serviceClient();
  const normalizedEmail = email.trim().toLowerCase();

  // A database row lock ensures only one caller can consume a valid code.
  const otpHash = crypto.createHash('sha256').update(cleanOtp).digest('hex');
  const { data: claim, error: claimError } = await service.rpc('consume_password_reset_otp', {
    p_email: normalizedEmail, p_otp_hash: otpHash,
  });
  if (claimError) {
    console.error('[verifyOtpAndResetPassword] OTP claim failed:', claimError);
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Password reset is temporarily unavailable.' } };
  }
  const result = claim?.[0];
  if (result?.result_status !== 'valid' || !result.reset_user_id) {
    const message = result?.result_status === 'expired'
      ? 'The verification code has expired. Please request a new code.'
      : 'Invalid or already used verification code. Please request a new code if needed.';
    return { data: null, error: { code: 'VALIDATION_FAILURE', message } };
  }

  const { error: adminAuthErr } = await service.auth.admin.updateUserById(result.reset_user_id, {
    password: newPassword,
  });
  if (adminAuthErr) {
    console.error('[verifyOtpAndResetPassword] Auth password update failed:', adminAuthErr);
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Password update failed. Request a new code and try again.' } };
  }

  await recordAuditEvent({
    actor_user_id: result.reset_user_id,
    action: 'PASSWORD_RESET_VIA_OTP', entity_type: 'user', entity_id: result.reset_user_id,
    details: { reset_method: '6_DIGIT_OTP' },
  });

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
