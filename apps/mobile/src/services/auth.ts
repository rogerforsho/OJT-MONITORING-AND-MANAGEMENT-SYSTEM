import { clearAttendanceIdentity, getCachedAttendanceIdentity, rememberAttendanceIdentity } from '../lib/attendanceCache';
import { isNetworkAvailable } from '../lib/syncEngine';
import { supabase } from '../lib/supabase';
import type { AppResult, RegisterStudentInput, SignInInput, AuthUser } from '@ojt/shared';

export async function registerStudent(input: RegisterStudentInput): Promise<AppResult<null>> {
  // Validation
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
  if (input.year_level !== 4)
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Registration is restricted to fourth-year students.' } };

  if (!/(BSIT|BSCS|BS-?CPE|INFORMATION TECHNOLOGY|COMPUTER ENGINEERING|COMPUTER SCIENCE|BSBA|BSENTREP|ENTREPRENEURSHIP|HUMAN RESOURCE|BSA|ACCOUNTANCY)/i.test(input.course))
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Registration is restricted to ICS and IBE students.' } };

  // Check if student number is already taken
  const { data: existingStudent } = await supabase
    .from('students')
    .select('student_id')
    .eq('student_number', input.student_number.trim())
    .maybeSingle();

  if (existingStudent)
    return { data: null, error: { code: 'DUPLICATE_REQUEST', message: 'Student number already registered.' } };

  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
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

  if (error) {
    if (error.message?.includes('already registered'))
      return { data: null, error: { code: 'DUPLICATE_REQUEST', message: 'Email already registered.' } };
    if (error.message?.includes('rate limit'))
      return { data: null, error: { code: 'SERVER_FAILURE', message: 'Too many registration attempts. Please wait and try again later.' } };
    if (error.message?.toLowerCase().includes('database error saving new user'))
      return { data: null, error: { code: 'SERVER_FAILURE', message: 'Account creation failed: this email or student number may already be in use. Please check your credentials or contact your OJT Coordinator.' } };
    return { data: null, error: { code: 'SERVER_FAILURE', message: error.message || 'Registration failed. Please try again.' } };
  }

  if (!data.user)
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Registration submitted. Please check if email confirmation is required.' } };

  return { data: null, error: null };
}

export async function signIn(input: SignInInput): Promise<AppResult<AuthUser>> {
  if (!input.email?.trim())
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Email is required.' } };
  if (!input.password)
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Password is required.' } };

  await clearAttendanceIdentity();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email.trim(),
    password: input.password,
  });

  if (error)
    return { data: null, error: { code: 'UNAUTHORIZED', message: 'Invalid email or password.' } };

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('user_id, full_name, email, role, account_status')
    .eq('user_id', data.user.id)
    .single();

  if (userError || !user)
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

  if (user.role !== 'Student') {
    await supabase.auth.signOut();
    return {
      data: null,
      error: {
        code: 'FORBIDDEN',
        message: `The CdM mobile app is exclusively for Student Trainees. As a ${user.role}, please access the system through the Web Portal.`,
      },
    };
  }

  await rememberAttendanceIdentity(user as AuthUser);
  return { data: user as AuthUser, error: null };
}

export async function signOut(): Promise<void> {
  await clearAttendanceIdentity();
  await supabase.auth.signOut();
}

export async function changeUserPassword(
  currentPassword: string,
  newPassword: string
): Promise<AppResult<null>> {
  if (!newPassword || newPassword.length < 8) {
    return {
      data: null,
      error: { code: 'VALIDATION_FAILURE', message: 'New password must be at least 8 characters long.' },
    };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return {
      data: null,
      error: { code: 'UNAUTHORIZED', message: 'You must be signed in to update your password.' },
    };
  }

  // Verify current password first
  if (currentPassword) {
    const { error: verifyErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (verifyErr) {
      return {
        data: null,
        error: { code: 'UNAUTHORIZED', message: 'Current password verification failed. Please enter your correct current password.' },
      };
    }
  }

  // Update password in Supabase Auth
  const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
  if (updateErr) {
    return {
      data: null,
      error: { code: 'SERVER_FAILURE', message: updateErr.message || 'Failed to update password.' },
    };
  }

  return { data: null, error: null };
}

export async function getAuthUser(): Promise<AuthUser | null> {
  if (!await isNetworkAvailable()) return (await getCachedAttendanceIdentity())?.user ?? null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    await clearAttendanceIdentity();
    return null;
  }

  const { data } = await supabase
    .from('users')
    .select('user_id, full_name, email, role, account_status')
    .eq('user_id', user.id)
    .single();

  if (data) await rememberAttendanceIdentity(data as AuthUser);
  return data as AuthUser ?? null;
}
