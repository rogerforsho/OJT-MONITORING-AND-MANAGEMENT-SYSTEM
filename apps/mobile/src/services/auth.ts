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
    if (error.message?.includes('rate limit'))
      return { data: null, error: { code: 'SERVER_FAILURE', message: 'Email rate limit exceeded. Please turn off "Confirm email" in Supabase Auth settings.' } };
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

export async function requestInstitutionalPasswordReset(
  email: string,
  identifier?: string,
  departmentOrRole?: string
): Promise<AppResult<null>> {
  if (!email?.trim())
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Email address is required.' } };

  const normalizedEmail = email.trim().toLowerCase();

  // 1. Verify user profile exists
  const { data: userProfile } = await supabase
    .from('users')
    .select('user_id, role, full_name')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (!userProfile) {
    return {
      data: null,
      error: { code: 'NOT_FOUND', message: 'No registered CdM account found with that email address.' },
    };
  }

  // 2. If student, verify Student Number identity proofing
  if (userProfile.role === 'Student') {
    if (!identifier?.trim()) {
      return {
        data: null,
        error: { code: 'VALIDATION_FAILURE', message: 'Student Number is required for student verification.' },
      };
    }

    const { data: studentRecord } = await supabase
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
          message: 'The provided Student ID does not match our institutional records for this account.',
        },
      };
    }
  }

  // 3. If faculty/staff (Coordinator, ProgramHead), verify Department affiliation
  if (['Coordinator', 'ProgramHead'].includes(userProfile.role)) {
    if (!departmentOrRole?.trim()) {
      return {
        data: null,
        error: { code: 'VALIDATION_FAILURE', message: 'Assigned Department/Institute is required for faculty verification.' },
      };
    }

    let userDept = '';
    if (userProfile.role === 'Coordinator') {
      const { data: coord } = await supabase.from('coordinators').select('department').eq('user_id', userProfile.user_id).maybeSingle();
      userDept = coord?.department || '';
    } else if (userProfile.role === 'ProgramHead') {
      const { data: head } = await supabase.from('program_heads').select('department_or_program').eq('user_id', userProfile.user_id).maybeSingle();
      userDept = head?.department_or_program || '';
    }

    const cleanInputDept = departmentOrRole.trim().toUpperCase();
    const cleanDbDept = userDept.trim().toUpperCase();

    if (cleanDbDept && !cleanDbDept.includes(cleanInputDept) && !cleanInputDept.includes(cleanDbDept)) {
      return {
        data: null,
        error: {
          code: 'VALIDATION_FAILURE',
          message: 'The selected Department does not match our official institutional records for this faculty account.',
        },
      };
    }
  }

  // 4. Request password reset email from Supabase Auth
  const { error: resetErr } = await supabase.auth.resetPasswordForEmail(normalizedEmail);
  if (resetErr) {
    return {
      data: null,
      error: { code: 'SERVER_FAILURE', message: resetErr.message || 'Failed to dispatch recovery link.' },
    };
  }

  return { data: null, error: null };
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('users')
    .select('user_id, full_name, email, role, account_status')
    .eq('user_id', user.id)
    .single();

  return data as AuthUser ?? null;
}
