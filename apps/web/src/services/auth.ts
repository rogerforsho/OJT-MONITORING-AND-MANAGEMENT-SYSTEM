'use server';

import { createClient } from '@/src/lib/supabase/server';
import { departmentScope, canManageDepartmentStudent } from '@/src/lib/department-scope';
import { getServiceClient } from '@/src/lib/supabase/service';
import { toPublicSupabaseUrl } from '@/src/lib/supabase/public-url';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { isIP } from 'node:net';
import crypto from 'crypto';
import { sendOtpEmail } from '@/src/lib/email/send-otp';
import { validateUploadedFile } from '@/src/lib/uploadValidation';
import type { AppError, AppResult } from '@ojt/shared';
import type { RegisterStudentInput, SignInInput } from '@ojt/shared';
import { isICSCourse, isIBECourse } from '@/src/lib/departments';
import { recordAuditEvent } from '@/src/lib/audit';

let cachedServiceClient: any = null;

function serviceClient() {
  if (!cachedServiceClient) {
    cachedServiceClient = getServiceClient();
  }
  return cachedServiceClient;
}

type AuthAction = 'login' | 'register' | 'password_reset_request' | 'password_reset_verify' | 'id_card_upload';

function auditSubjectHash(value: string): string | undefined {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return undefined;
  return crypto.createHmac('sha256', secret).update(value.trim().toLowerCase()).digest('hex');
}

async function claimActionLimit(action: AuthAction, secret: string, subject: string, maxAttempts: number, windowSeconds: number): Promise<boolean | null> {
  const subjectHash = crypto.createHmac('sha256', secret).update(subject).digest('hex');
  const { data, error } = await serviceClient().rpc('claim_auth_rate_limit', {
    p_action: action, p_subject_hash: subjectHash, p_max_attempts: maxAttempts, p_window_seconds: windowSeconds,
  });
  if (error) return null;
  return data === true;
}

async function authActionLimit(
  action: AuthAction,
  email: string,
  maxAttempts: number,
  windowSeconds: number
): Promise<AppError | null> {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return { code: 'SERVER_FAILURE', message: 'Authentication service is not configured.' };

  const emailAllowed = await claimActionLimit(action, secret, 'email:' + email.trim().toLowerCase(), maxAttempts, windowSeconds);
  if (emailAllowed === null) {
    console.error('[authActionLimit] email limit unavailable');
    return { code: 'SERVER_FAILURE', message: 'Authentication service is temporarily unavailable.' };
  }
  if (!emailAllowed) return { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait before trying again.' };

  let clientIp: string | null = null;
  try {
    const forwardedFor = (await headers()).get('x-forwarded-for');
    const candidate = forwardedFor?.split(',')[0]?.trim();
    if (candidate && isIP(candidate)) clientIp = candidate;
  } catch { /* Unit tests and local non-request callers have no request headers. */ }
  if (!clientIp && process.env.NODE_ENV === 'production') {
    console.error('[authActionLimit] trusted client IP unavailable');
    return { code: 'SERVER_FAILURE', message: 'Authentication service is temporarily unavailable.' };
  }
  const ipBudgets: Record<AuthAction, { max: number; seconds: number }> = {
    login: { max: 100, seconds: 900 },
    register: { max: 100, seconds: 3600 },
    password_reset_request: { max: 40, seconds: 900 },
    password_reset_verify: { max: 100, seconds: 900 },
    id_card_upload: { max: 100, seconds: 3600 },
  };
  const budget = ipBudgets[action];
  const ipAllowed = await claimActionLimit(action, secret, 'ip:' + (clientIp || 'local-development'), budget.max, budget.seconds);
  if (ipAllowed === null) {
    console.error('[authActionLimit] network limit unavailable');
    return { code: 'SERVER_FAILURE', message: 'Authentication service is temporarily unavailable.' };
  }
  return ipAllowed ? null : { code: 'RATE_LIMITED', message: 'Too many attempts from this network. Please wait before trying again.' };
}

async function assertCoordinator() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, role: '', authorized: false };
  const { data } = await supabase
    .from('users')
    .select('role, account_status')
    .eq('user_id', user.id)
    .single();
  const scope = await departmentScope(supabase, user.id, data?.role ?? '');
  return {
    supabase,
    user,
    role: data?.role ?? '',
    authorized: !scope.error && ['Coordinator', 'Admin', 'ProgramHead'].includes(data?.role ?? '') && data?.account_status === 'active',
  };
}

export async function listPendingStudents(
  page = 1,
  pageSize = 20,
  courseFilter?: string
): Promise<AppResult<{ students: Array<{ user_id: string; full_name: string; email: string; student_number: string; course: string; year_level: number; created_at: string; id_card_path?: string | null; id_card_signed_url?: string | null }>; total: number }>> {
  const { supabase, authorized } = await assertCoordinator();
  if (!authorized) return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('users')
    .select('user_id, full_name, email, created_at, students!inner(student_number, course, year_level, id_card_path)', { count: 'exact' })
    .eq('role', 'Student')
    .eq('account_status', 'pending')
    .order('created_at', { ascending: false })
    .range(from, to);
  if (courseFilter && courseFilter !== 'All') query = query.eq('students.course', courseFilter);
  const { data, error, count } = await query;

  if (error) return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to load pending students.' } };

  const service = serviceClient();
  const students = await Promise.all((data ?? []).map(async (row: any) => {
    let id_card_signed_url = null;
    const path = row.students?.id_card_path;
    if (path) {
      try {
        const { data: signed } = await service.storage.from('private-documents').createSignedUrl(path, 3600);
        id_card_signed_url = signed?.signedUrl ? toPublicSupabaseUrl(signed.signedUrl) : null;
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
  pageSize = 20,
  searchQuery = ''
): Promise<AppResult<{ students: Array<{ user_id: string; full_name: string; email: string; student_number: string; course: string; year_level: number; account_status: string; created_at: string }>; total: number }>> {
  const { supabase, authorized } = await assertCoordinator();
  if (!authorized) return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100)
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Invalid page or page size.' } };

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const term = searchQuery.trim().replace(/[%,_*()\\]/g, ' ').replace(/\s+/g, ' ').slice(0, 100);

  let query = supabase
    .from('users')
    .select('user_id, full_name, email, account_status, created_at, students!inner(student_number, course, year_level), student_search:students()', { count: 'exact' })
    .eq('role', 'Student')
    .eq('account_status', 'active');
  if (term) {
    const pattern = '*' + term + '*';
    query = query.or('full_name.ilike.' + pattern + ',email.ilike.' + pattern + ',student_search.not.is.null')
      .or('student_number.ilike.' + pattern + ',course.ilike.' + pattern, { referencedTable: 'student_search' });
  }
  const { data, error, count } = await query
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
): Promise<AppResult<{ notificationCreated: boolean; emailSent: boolean }>> {
  if (!user_id) return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'User ID is required.' } };
  if (!['active', 'rejected'].includes(status))
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Invalid approval status.' } };

  const { supabase, user, role, authorized } = await assertCoordinator();
  if (!authorized) return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };
  if (!user || !await canManageDepartmentStudent(supabase, user.id, role, user_id, 'user_id'))
    return { data: null, error: { code: 'FORBIDDEN', message: 'Student is outside your department.' } };

  const service = serviceClient();
  if (status === 'active') {
    const { data: authResult, error: authLookupError } = await service.auth.admin.getUserById(user_id);
    if (authLookupError || !authResult?.user)
      return { data: null, error: { code: 'SERVER_FAILURE', message: 'Could not verify the registration email status.' } };
    if (!authResult.user.email_confirmed_at)
      return { data: null, error: { code: 'FORBIDDEN', message: 'The student must confirm their email before coordinator approval.' } };
  }

  // Only a pending Student can be approved/rejected through this action.
  // Keep the guard in the update so concurrent decisions cannot overwrite one another.
  const { data: userRec, error } = await service
    .from('users')
    .update({ account_status: status, updated_at: new Date().toISOString() })
    .eq('user_id', user_id)
    .eq('role', 'Student')
    .eq('account_status', 'pending')
    .select('user_id, full_name, email').maybeSingle();

  if (error) return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to update student status.' } };
  if (!userRec) return { data: null, error: { code: 'NOT_FOUND', message: 'Pending student registration not found. It may already have been processed.' } };

  let notificationCreated = false;
  try {
    const { error: notificationError } = await service.from('notifications').insert({
      receiver_user_id: user_id,
      message: status === 'active'
        ? 'Account Verified: Welcome to CdM OJT! Please submit your pre-deployment requirements via the mobile app to unlock company assignment and daily attendance.'
        : 'Registration Not Approved: ' + (reason ? 'Please review the coordinator feedback in your account.' : 'Please consult your Institute OJT Coordinator.'),
      status: 'unread',
      notification_date: new Date().toISOString(),
    });
    notificationCreated = !notificationError;
  } catch { /* Approval remains recorded; the result reports notification failure. */ }

  let emailSent = false;
  if (userRec.email) {
    try {
      emailSent = (await sendAccountStatusEmail({
        to: userRec.email,
        fullName: userRec.full_name || 'Trainee',
        status,
        reason,
      })).success;
    } catch {
      console.error('[updateStudentAccountStatus] email delivery failed');
    }
  }

  return { data: { notificationCreated, emailSent }, error: null };
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

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl || supabaseUrl.includes('your-project-id')) {
    return {
      data: null,
      error: {
        code: 'SERVER_FAILURE',
        message: 'The service is temporarily unavailable. Please try again later.',
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
    return { data: null, error: { code: 'DUPLICATE_REQUEST', message: 'If you can register with this information, you will receive a confirmation email. Otherwise, sign in or contact the coordinator.' } };

  // 2. Check and reconcile any orphaned user record in public.users (not present in auth.users)
  const { data: existingUser } = await service
    .from('users')
    .select('user_id')
    .eq('email', input.email.trim().toLowerCase())
    .maybeSingle();

  if (existingUser) {
    const { data: authUserCheck } = await service.auth.admin.getUserById(existingUser.user_id);
    if (authUserCheck?.user) {
      return { data: null, error: { code: 'DUPLICATE_REQUEST', message: 'If you can register with this information, you will receive a confirmation email. Otherwise, sign in or contact the coordinator.' } };
    } else {
      // Orphaned record: clean up from public.students and public.users to avoid unique constraint collisions
      await service.from('students').delete().eq('user_id', existingUser.user_id);
      await service.from('users').delete().eq('user_id', existingUser.user_id);
    }
  }

  // Use the public signup flow so Supabase sends its email confirmation link.
  // Admin createUser(email_confirm: true) silently bypasses email ownership checks.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.NODE_ENV !== 'production' ? 'http://localhost:3000' : '');
  if (!appUrl || (process.env.NODE_ENV === 'production' && !appUrl.startsWith('https://'))) {
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Registration email confirmation is not configured.' } };
  }
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      emailRedirectTo: new URL('/auth/callback', appUrl).toString(),
      data: {
        full_name: input.full_name.trim(),
        role: 'Student',
        student_number: input.student_number.trim(),
        course: input.course.trim(),
        year_level: input.year_level,
        id_card_path: input.id_card_path || null,
      },
    },
  });

  if (authError || !authData.user || authData.user.identities?.length === 0) {
    const duplicate = authError?.message?.toLowerCase().includes('already registered') || authData?.user?.identities?.length === 0;
    return { data: null, error: {
      code: duplicate ? 'DUPLICATE_REQUEST' : 'SERVER_FAILURE',
      message: duplicate || authData?.user?.identities?.length === 0
        ? 'If you can register with this information, you will receive a confirmation email. Otherwise, sign in or contact the coordinator.'
        : 'Registration could not be completed. Check the email address or try again later.',
    } };
  }

  // If Supabase is configured without email confirmations, do not silently create
  // an unverified account; remove it and tell the operator to enable confirmations.
  if (authData.session) {
    await supabase.auth.signOut();
    await service.auth.admin.deleteUser(authData.user.id);
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Email confirmation is disabled. Enable email confirmations in Supabase Auth before accepting registrations.' } };
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
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Unable to upload your ID right now. Please try again later.' } };
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

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
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
      msg = 'Sign-in failed. Please check your credentials and try again.';
    } else if (
      rawMsg.toLowerCase().includes('fetch failed') ||
      rawMsg.toLowerCase().includes('failed to fetch') ||
      rawMsg.toLowerCase().includes('networkerror') ||
      rawMsg.toLowerCase().includes('enotfound')
    ) {
      msg =
        'The sign-in service is temporarily unavailable. Please try again later.';
    }

    // Record LOGIN_FAILED audit trail for incident response & brute-force monitoring
    await recordAuditEvent({
      actor_user_id: null,
      action: 'LOGIN_FAILED',
      entity_type: 'auth',
      details: { subject_hash: auditSubjectHash(input.email), reason: 'authentication_failed' },
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
      details: { subject_hash: auditSubjectHash(input.email), reason: 'profile_record_missing' },
    });
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Account not found.' } };
  }

  if (user.account_status === 'pending') {
    await supabase.auth.signOut();
    await recordAuditEvent({
      actor_user_id: user.user_id,
      action: 'LOGIN_BLOCKED_PENDING',
      entity_type: 'auth',
      details: { role: user.role, reason: 'account_pending' },
    });
    return { data: null, error: { code: 'FORBIDDEN', message: 'Your account is pending approval.' } };
  }

  if (user.account_status === 'rejected') {
    await supabase.auth.signOut();
    await recordAuditEvent({
      actor_user_id: user.user_id,
      action: 'LOGIN_BLOCKED_REJECTED',
      entity_type: 'auth',
      details: { role: user.role },
    });
    return { data: null, error: { code: 'FORBIDDEN', message: 'Your account registration was rejected.' } };
  }

  if (user.account_status === 'inactive') {
    await supabase.auth.signOut();
    await recordAuditEvent({
      actor_user_id: user.user_id,
      action: 'LOGIN_BLOCKED_DEACTIVATED',
      entity_type: 'auth',
      details: { subject_hash: auditSubjectHash(user.email), role: user.role },
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
      details: { role: user.role, reason: 'web_access_restricted' },
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
    details: { subject_hash: auditSubjectHash(user.email), role: user.role },
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

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const accepted = { data: { email: normalizedEmail, maskedEmail: maskEmail(normalizedEmail), expiresAt }, error: null };
  const { data: userProfile, error: queryError } = await service.from('users')
    .select('user_id, role, full_name, employee_number').eq('email', normalizedEmail).maybeSingle();
  if (queryError) return { data: null, error: { code: 'SERVER_FAILURE', message: 'Account recovery is temporarily unavailable. Please try again later.' } };
  // Same public response for missing accounts, role mismatch and ID mismatch.
  if (!userProfile || (expectedRole === 'Student' && userProfile.role !== 'Student') ||
      (expectedRole === 'Staff' && userProfile.role === 'Student')) return accepted;
  const inputId = typeof identifier === 'string' ? identifier.trim().toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  let storedId = userProfile.employee_number || '';
  if (userProfile.role === 'Student') {
    const { data: student, error } = await service.from('students').select('student_number').eq('user_id', userProfile.user_id).maybeSingle();
    if (error) return { data: null, error: { code: 'SERVER_FAILURE', message: 'Account recovery is temporarily unavailable. Please try again later.' } };
    storedId = student?.student_number || '';
  }
  if (!inputId || inputId !== storedId.toLowerCase().replace(/[^a-z0-9]/g, '')) return accepted;

  // 4. Generate cryptographically secure 6-digit numeric OTP
  const otp = crypto.randomInt(100000, 1000000).toString();
  const otpHash = crypto.createHash('sha256').update(otp).digest('hex');


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
    console.error('[requestPasswordReset] OTP persistence failed');
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
    console.error('[verifyOtpAndResetPassword] OTP claim failed');
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
    console.error('[verifyOtpAndResetPassword] Auth password update failed');
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
