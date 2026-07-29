'use server';

import { createClient } from '@/src/lib/supabase/server';
import type { AppResult, DbEvaluation } from '@ojt/shared';

async function getAuthUserWithRole() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null };
  const { data: profile } = await supabase
    .from('users')
    .select('role, account_status')
    .eq('user_id', user.id)
    .single();
  return { supabase, user, profile };
}

export interface EvaluationWithStudent extends DbEvaluation {
  students: {
    student_number: string;
    course: string;
    users: { full_name: string };
  };
}

export interface EvaluationInput {
  student_id: string;
  performance_score: number | null;
  feedback: string;
}

export async function listEvaluationsForSupervisor(
  page = 1,
  pageSize = 20
): Promise<AppResult<{ evaluations: EvaluationWithStudent[]; total: number }>> {
  const { supabase, user, profile } = await getAuthUserWithRole();
  if (!user || profile?.role !== 'Supervisor' || profile?.account_status !== 'active')
    return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const { data: supervisor } = await supabase
    .from('supervisors')
    .select('supervisor_id')
    .eq('user_id', user.id)
    .single();

  if (!supervisor)
    return { data: null, error: { code: 'NOT_FOUND', message: 'Supervisor profile not found.' } };

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('evaluations')
    .select(`*, students ( student_number, course, users ( full_name ) )`, { count: 'exact' })
    .eq('supervisor_id', supervisor.supervisor_id)
    .order('evaluation_date', { ascending: false })
    .range(from, to);

  if (error)
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to load evaluations.' } };

  return { data: { evaluations: data as EvaluationWithStudent[], total: count ?? 0 }, error: null };
}

export async function createEvaluation(input: EvaluationInput): Promise<AppResult<null>> {
  if (!input.student_id) return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Student is required.' } };
  if (!input.feedback?.trim()) return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Feedback is required.' } };

  const { supabase, user, profile } = await getAuthUserWithRole();
  if (!user || profile?.role !== 'Supervisor' || profile?.account_status !== 'active')
    return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const { data: supervisor } = await supabase
    .from('supervisors')
    .select('supervisor_id')
    .eq('user_id', user.id)
    .single();

  if (!supervisor)
    return { data: null, error: { code: 'NOT_FOUND', message: 'Supervisor profile not found.' } };

  const { data: assignment } = await supabase
    .from('student_assignments')
    .select('assignment_id')
    .eq('student_id', input.student_id)
    .eq('supervisor_id', supervisor.supervisor_id)
    .maybeSingle();

  if (!assignment)
    return { data: null, error: { code: 'FORBIDDEN', message: 'You are not assigned to this student.' } };

  const { error } = await supabase.from('evaluations').insert({
    student_id: input.student_id,
    supervisor_id: supervisor.supervisor_id,
    performance_score: input.performance_score,
    feedback: input.feedback.trim(),
    evaluation_date: new Date().toISOString().slice(0, 10),
  });

  if (error) return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to create evaluation.' } };

  return { data: null, error: null };
}

export async function listAssignedStudentsForEvaluation(): Promise<AppResult<{ student_id: string; full_name: string; student_number: string; course: string }[]>> {
  const { supabase, user, profile } = await getAuthUserWithRole();
  if (!user || profile?.role !== 'Supervisor' || profile?.account_status !== 'active')
    return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const { data: supervisor } = await supabase
    .from('supervisors')
    .select('supervisor_id')
    .eq('user_id', user.id)
    .single();

  if (!supervisor)
    return { data: null, error: { code: 'NOT_FOUND', message: 'Supervisor profile not found.' } };

  const { data, error } = await supabase
    .from('student_assignments')
    .select(`student_id, students ( student_number, course, users ( full_name ) )`)
    .eq('supervisor_id', supervisor.supervisor_id);

  if (error) return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to load assigned students.' } };

  return {
    data: (data ?? []).map((row: any) => ({
      student_id: row.student_id,
      full_name: row.students?.users?.full_name ?? '',
      student_number: row.students?.student_number ?? '',
      course: row.students?.course ?? '',
    })),
    error: null,
  };
}
