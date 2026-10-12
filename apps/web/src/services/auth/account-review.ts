import 'server-only';
import { createClient } from '@/src/lib/supabase/server';
import { departmentScope, canManageDepartmentStudent } from '@/src/lib/department-scope';
import { serviceClient } from './internal';
import { toPublicSupabaseUrl } from '@/src/lib/supabase/public-url';
import { sendAccountStatusEmail } from '@/src/lib/email/send-account-status';
import type { AppResult } from '@ojt/shared';
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
