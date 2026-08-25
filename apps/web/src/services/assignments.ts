'use server';

import { createClient } from '@/src/lib/supabase/server';
import { recordAuditEvent } from './audit';
import type { AppResult, DbStudentAssignment, AssignmentStatus, StudentStatus } from '@ojt/shared';

export interface AssignmentInput {
  student_id: string;
  company_id: string;
  supervisor_id: string;
  start_date: string;
  end_date?: string;
}

export interface AssignmentDetail extends DbStudentAssignment {
  students: { student_number: string; course: string; year_level: number; status: StudentStatus; users: { full_name: string; email: string } };
  companies: { company_name: string };
  supervisors: { position: string; users: { full_name: string; email: string } };
}

async function assertCoordinator() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, authorized: false };
  const { data } = await supabase
    .from('users')
    .select('role, account_status')
    .eq('user_id', user.id)
    .single();
  return {
    supabase,
    user,
    authorized: ['Coordinator', 'Admin'].includes(data?.role ?? '') && data?.account_status === 'active',
  };
}

export async function listAssignments(
  page = 1,
  pageSize = 20
): Promise<AppResult<{ assignments: AssignmentDetail[]; total: number }>> {
  const { supabase, authorized } = await assertCoordinator();
  if (!authorized) return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('student_assignments')
    .select(`
      *,
      students (
        student_number, course, year_level, status,
        users ( full_name, email )
      ),
      companies ( company_name ),
      supervisors (
        position,
        users ( full_name, email )
      )
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to load assignments.' } };
  return { data: { assignments: data as AssignmentDetail[], total: count ?? 0 }, error: null };
}

export async function createAssignment(input: AssignmentInput): Promise<AppResult<DbStudentAssignment>> {
  if (!input.student_id) return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Student is required.' } };
  if (!input.company_id) return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Company is required.' } };
  if (!input.supervisor_id) return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Supervisor is required.' } };
  if (!input.start_date) return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Start date is required.' } };

  const { supabase, user, authorized } = await assertCoordinator();
  if (!authorized || !user) return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  // Check for existing active assignment for this student
  const { data: existing } = await supabase
    .from('student_assignments')
    .select('assignment_id')
    .eq('student_id', input.student_id)
    .eq('assignment_status', 'active')
    .maybeSingle();

  if (existing) return { data: null, error: { code: 'DUPLICATE_REQUEST', message: 'Student already has an active assignment.' } };

  // Verify supervisor belongs to the selected company
  const { data: supervisor } = await supabase
    .from('supervisors')
    .select('company_id')
    .eq('supervisor_id', input.supervisor_id)
    .single();

  if (!supervisor) return { data: null, error: { code: 'NOT_FOUND', message: 'Supervisor not found.' } };
  if (supervisor.company_id !== input.company_id)
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Supervisor does not belong to the selected company.' } };

  const { data, error } = await supabase
    .from('student_assignments')
    .insert({
      student_id: input.student_id,
      company_id: input.company_id,
      supervisor_id: input.supervisor_id,
      start_date: input.start_date,
      end_date: input.end_date ?? null,
      assignment_status: 'active',
    })
    .select()
    .single();

  if (error) return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to create assignment.' } };

  // Log Audit Trail
  await recordAuditEvent({
    actor_user_id: user.id,
    action: 'STUDENT_ASSIGNED',
    entity_type: 'student_assignment',
    entity_id: data.assignment_id,
    details: { student_id: input.student_id, company_id: input.company_id, supervisor_id: input.supervisor_id },
  });

  return { data: data as DbStudentAssignment, error: null };
}

export async function updateAssignmentStatus(
  assignment_id: string,
  assignment_status: AssignmentStatus
): Promise<AppResult<null>> {
  if (!assignment_id) return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Assignment ID is required.' } };

  const { supabase, user, authorized } = await assertCoordinator();
  if (!authorized || !user) return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const { error } = await supabase
    .from('student_assignments')
    .update({ assignment_status })
    .eq('assignment_id', assignment_id);

  if (error) return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to update assignment.' } };

  await recordAuditEvent({
    actor_user_id: user.id,
    action: `ASSIGNMENT_${assignment_status.toUpperCase()}`,
    entity_type: 'student_assignment',
    entity_id: assignment_id,
    details: { status: assignment_status },
  });

  return { data: null, error: null };
}

export async function updateStudentStatus(
  student_id: string,
  status: StudentStatus
): Promise<AppResult<null>> {
  if (!student_id) return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Student ID is required.' } };

  const { supabase, user, authorized } = await assertCoordinator();
  if (!authorized || !user) return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const { error } = await supabase
    .from('students')
    .update({ status })
    .eq('student_id', student_id);

  if (error) return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to update student status.' } };

  await recordAuditEvent({
    actor_user_id: user.id,
    action: `STUDENT_STATUS_${status.toUpperCase()}`,
    entity_type: 'student',
    entity_id: student_id,
    details: { status },
  });

  return { data: null, error: null };
}

export async function reassignStudent(
  student_id: string,
  new_company_id: string,
  new_supervisor_id: string,
  start_date: string
): Promise<AppResult<DbStudentAssignment>> {
  const { supabase, user, authorized } = await assertCoordinator();
  if (!authorized || !user) return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  // 1. Mark current active assignment as 'reassigned'
  await supabase
    .from('student_assignments')
    .update({
      assignment_status: 'reassigned',
      end_date: new Date().toISOString().split('T')[0],
    })
    .eq('student_id', student_id)
    .eq('assignment_status', 'active');

  // 2. Create new active assignment
  const { data: newAssignment, error } = await supabase
    .from('student_assignments')
    .insert({
      student_id,
      company_id: new_company_id,
      supervisor_id: new_supervisor_id,
      start_date,
      assignment_status: 'active',
    })
    .select()
    .single();

  if (error || !newAssignment) {
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to reassign student.' } };
  }

  await recordAuditEvent({
    actor_user_id: user.id,
    action: 'STUDENT_REASSIGNED',
    entity_type: 'student_assignment',
    entity_id: newAssignment.assignment_id,
    details: { student_id, new_company_id, new_supervisor_id },
  });

  return { data: newAssignment as DbStudentAssignment, error: null };
}

export async function listStudentsForAssignment(): Promise<AppResult<{ student_id: string; student_number: string; full_name: string; course: string; status: string }[]>> {
  const { supabase, authorized } = await assertCoordinator();
  if (!authorized) return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const { data, error } = await supabase
    .from('students')
    .select(`
      student_id, student_number, course, status,
      users!inner ( full_name, account_status )
    `)
    .eq('users.account_status', 'active');

  if (error) return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to load students.' } };

  interface AssignmentStudentRow {
    student_id: string;
    student_number: string;
    course: string;
    status: string;
    users: { full_name: string; account_status: string } | { full_name: string; account_status: string }[];
  }

  return {
    data: (data ?? []).map((s: AssignmentStudentRow) => {
      const user = Array.isArray(s.users) ? s.users[0] : s.users;
      return {
        student_id: s.student_id,
        student_number: s.student_number,
        full_name: user?.full_name ?? '',
        course: s.course,
        status: s.status,
      };
    }),
    error: null,
  };
}

export async function listSupervisorsForCompany(
  company_id: string
): Promise<AppResult<{ supervisor_id: string; full_name: string; position: string }[]>> {
  if (!company_id) return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Company ID is required.' } };

  const { supabase, authorized } = await assertCoordinator();
  if (!authorized) return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const { data, error } = await supabase
    .from('supervisors')
    .select('supervisor_id, position, users ( full_name )')
    .eq('company_id', company_id);

  if (error) return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to load supervisors.' } };

  interface SupervisorRow {
    supervisor_id: string;
    position: string;
    users: { full_name: string } | { full_name: string }[];
  }

  return {
    data: (data ?? []).map((s: SupervisorRow) => {
      const user = Array.isArray(s.users) ? s.users[0] : s.users;
      return {
        supervisor_id: s.supervisor_id,
        full_name: user?.full_name ?? '',
        position: s.position,
      };
    }),
    error: null,
  };
}
