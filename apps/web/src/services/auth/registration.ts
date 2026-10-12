import 'server-only';
import crypto from 'crypto';
import { createClient } from '@/src/lib/supabase/server';
import { serviceClient, authActionLimit } from './internal';
import { validateUploadedFile } from '@/src/lib/uploadValidation';
import type { AppResult } from '@ojt/shared';
import type { RegisterStudentInput } from '@ojt/shared';
import { isICSCourse, isIBECourse } from '@/src/lib/departments';
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
