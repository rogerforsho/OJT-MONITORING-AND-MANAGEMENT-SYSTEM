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
  if (!input.year_level || input.year_level < 1 || input.year_level > 4)
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Valid year level is required.' } };

  // Mobile registration goes through a server-side endpoint to use service role
  // Direct Supabase signUp creates auth user; student profile created server-side
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
      },
    },
  });

  if (error) {
    if (error.message?.includes('already registered'))
      return { data: null, error: { code: 'DUPLICATE_REQUEST', message: 'Email already registered.' } };
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Registration failed. Please try again.' } };
  }

  if (!data.user)
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Registration failed. Please try again.' } };

  return { data: null, error: null };
}

export async function signIn(input: SignInInput): Promise<AppResult<AuthUser>> {
  if (!input.email?.trim())
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Email is required.' } };
  if (!input.password)
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Password is required.' } };

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

  return { data: user as AuthUser, error: null };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function requestPasswordReset(email: string): Promise<AppResult<null>> {
  if (!email?.trim())
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Email is required.' } };

  const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
  if (error)
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to send reset email.' } };

  return { data: null, error: null };
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('users')
    .select('user_id, full_name, email, role, account_status')
    .eq('user_id', user.id)
    .single();

  return data as AuthUser ?? null;
}
