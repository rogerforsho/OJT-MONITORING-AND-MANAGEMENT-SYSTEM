'use server';

import { createClient } from '@/src/lib/supabase/server';
import { canManageDepartmentRecord, canManageDepartmentStudent } from '@/src/lib/department-scope';
import { getServiceClient } from '@/src/lib/supabase/service';
import { recordAuditEvent } from '@/src/lib/audit';
import type { AppResult, DbEvaluation } from '@ojt/shared';

const serviceClient = getServiceClient;

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

export interface EvaluationRubricCriteria {
  technical_competence: number; // 0-25
  productivity_dependability: number; // 0-20
  attendance_punctuality: number; // 0-20
  communication_skills: number; // 0-15
  work_ethics_professionalism: number; // 0-20
}

export interface EvaluationInput {
  student_id: string;
  evaluation_type?: 'midterm' | 'final';
  performance_score: number | null;
  feedback: string;
  criteria?: EvaluationRubricCriteria;
}

export async function listEvaluationsForSupervisor(
  page = 1,
  pageSize = 20
): Promise<AppResult<{ evaluations: EvaluationWithStudent[]; total: number }>> {
  const { user, profile } = await getAuthUserWithRole();
  if (!user || profile?.role !== 'Supervisor' || profile?.account_status !== 'active')
    return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const service = serviceClient();
  const { data: supervisor } = await service
    .from('supervisors')
    .select('supervisor_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!supervisor)
    return { data: null, error: { code: 'NOT_FOUND', message: 'Supervisor profile not found.' } };

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await service
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
  if (input.evaluation_type && !['midterm', 'final'].includes(input.evaluation_type))
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Invalid evaluation type.' } };
  if (input.performance_score !== null && (typeof input.performance_score !== 'number' || !Number.isFinite(input.performance_score) || input.performance_score < 0 || input.performance_score > 100))
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Score must be between 0 and 100.' } };
  if (input.criteria) {
    const maxima: Record<keyof EvaluationRubricCriteria, number> = {
      technical_competence: 25, productivity_dependability: 20, attendance_punctuality: 20,
      communication_skills: 15, work_ethics_professionalism: 20,
    };
    if (Object.entries(maxima).some(([key, maximum]) => {
      const value = input.criteria![key as keyof EvaluationRubricCriteria];
      return typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > maximum;
    })) return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Each rubric score must be within its displayed range.' } };
  }

  const { user, profile } = await getAuthUserWithRole();
  if (!user || profile?.role !== 'Supervisor' || profile?.account_status !== 'active')
    return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const service = serviceClient();
  const { data: supervisor } = await service
    .from('supervisors')
    .select('supervisor_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!supervisor)
    return { data: null, error: { code: 'NOT_FOUND', message: 'Supervisor profile not found.' } };

  const { data: assignment } = await service
    .from('student_assignments')
    .select('assignment_id')
    .eq('student_id', input.student_id)
    .eq('supervisor_id', supervisor.supervisor_id)
    .eq('assignment_status', 'active')
    .maybeSingle();

  if (!assignment)
    return { data: null, error: { code: 'FORBIDDEN', message: 'You are not assigned to this student.' } };

  const evalType = input.evaluation_type || 'final';

  // Calculate composite score from rubric if provided
  let computedScore = input.performance_score;
  if (input.criteria) {
    computedScore = Math.min(100, Math.max(0,
      input.criteria.technical_competence +
      input.criteria.productivity_dependability +
      input.criteria.attendance_punctuality +
      input.criteria.communication_skills +
      input.criteria.work_ethics_professionalism
    ));
  }

  const { data: evalRecord, error } = await service.from('evaluations').upsert({
    student_id: input.student_id,
    supervisor_id: supervisor.supervisor_id,
    evaluation_type: evalType,
    performance_score: computedScore,
    rubric_scores: input.criteria || null,
    feedback: input.feedback.trim(),
    evaluation_date: new Date().toISOString().slice(0, 10),
  }, {
    onConflict: 'student_id,evaluation_type'
  }).select('evaluation_id').single();

  if (error) return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to create evaluation.' } };

  await recordAuditEvent({
    actor_user_id: user.id,
    action: 'EVALUATION_SUBMITTED',
    entity_type: 'evaluation',
    entity_id: evalRecord.evaluation_id,
    details: { student_id: input.student_id, evaluation_type: evalType, score: computedScore, criteria: input.criteria },
  });

  return { data: null, error: null };
}

export interface StudentEvaluationSummary {
  student_id: string;
  student_name: string;
  student_number: string;
  course: string;
  company_name: string;
  supervisor_name: string;
  midterm: DbEvaluation | null;
  final: DbEvaluation | null;
  overall_rating: number | null;
  has_passed: boolean;
}

export async function getStudentEvaluationSummary(student_id?: string): Promise<AppResult<StudentEvaluationSummary>> {
  const { supabase, user, profile } = await getAuthUserWithRole();
  if (!user || !profile || profile.account_status !== 'active')
    return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  let targetStudentId = student_id;

  if (profile.role === 'Student') {
    const { data: s } = await supabase.from('students').select('student_id').eq('user_id', user.id).single();
    if (!s) return { data: null, error: { code: 'NOT_FOUND', message: 'Student profile not found.' } };
    targetStudentId = s.student_id;
  }

  if (!targetStudentId) {
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Student ID is required.' } };
  }

  if (profile.role === 'Supervisor') {
    const { data: supervisor } = await supabase.from('supervisors').select('supervisor_id').eq('user_id', user.id).maybeSingle();
    if (!supervisor) return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };
    const { data: assignment, error } = await supabase.from('student_assignments').select('student_id')
      .eq('student_id', targetStudentId).eq('supervisor_id', supervisor.supervisor_id).eq('assignment_status', 'active').maybeSingle();
    if (error || !assignment) return { data: null, error: { code: 'FORBIDDEN', message: 'Student is not assigned to you.' } };
  } else if (profile.role !== 'Student' && !await canManageDepartmentStudent(supabase, user.id, profile.role, targetStudentId)) {
    return { data: null, error: { code: 'FORBIDDEN', message: 'Student is outside your department.' } };
  }
  const service = serviceClient();

  // Fetch student info
  const { data: student } = await service
    .from('students')
    .select('student_id, student_number, course, users ( full_name )')
    .eq('student_id', targetStudentId)
    .single();

  if (!student) return { data: null, error: { code: 'NOT_FOUND', message: 'Student not found.' } };

  // Fetch assignment & supervisor
  const { data: assignment } = await service
    .from('student_assignments')
    .select('companies ( company_name ), supervisors ( users ( full_name ) )')
    .eq('student_id', targetStudentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const compObj = Array.isArray(assignment?.companies) ? assignment?.companies[0] : assignment?.companies;
  const supObj = Array.isArray(assignment?.supervisors) ? assignment?.supervisors[0] : assignment?.supervisors;
  const supUser = Array.isArray(supObj?.users) ? supObj?.users[0] : supObj?.users;

  // Fetch evaluations
  const { data: evaluations } = await service
    .from('evaluations')
    .select('*')
    .eq('student_id', targetStudentId)
    .order('evaluation_date', { ascending: false });

  const evals = (evaluations ?? []) as DbEvaluation[];
  const midterm = evals.find(e => e.evaluation_type === 'midterm') || null;
  const final = evals.find(e => e.evaluation_type === 'final') || (evals.length > 0 && !midterm ? evals[0] : null);

  let overallRating: number | null = null;
  if (midterm?.performance_score && final?.performance_score) {
    overallRating = Math.round((Number(midterm.performance_score) * 0.4 + Number(final.performance_score) * 0.6) * 10) / 10;
  } else if (final?.performance_score) {
    overallRating = Number(final.performance_score);
  } else if (midterm?.performance_score) {
    overallRating = Number(midterm.performance_score);
  }

  const hasPassed = (overallRating !== null && overallRating >= 75) || (final?.performance_score !== null && Number(final?.performance_score) >= 75);

  const studentUser = Array.isArray(student.users) ? student.users[0] : student.users;

  return {
    data: {
      student_id: targetStudentId,
      student_name: studentUser?.full_name || '',
      student_number: student.student_number,
      course: student.course,
      company_name: compObj?.company_name || 'Partner Host Training Establishment',
      supervisor_name: supUser?.full_name || 'Industry Supervisor',
      midterm,
      final,
      overall_rating: overallRating,
      has_passed: hasPassed,
    },
    error: null,
  };
}

export async function overrideEvaluation(
  evaluation_id: string,
  new_score: number,
  reason: string
): Promise<AppResult<null>> {
  if (!evaluation_id) return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Evaluation ID is required.' } };
  if (typeof new_score !== 'number' || !Number.isFinite(new_score) || new_score < 0 || new_score > 100) return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Score must be between 0 and 100.' } };
  if (!reason?.trim()) return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Override justification is required.' } };

  const { supabase, user, profile } = await getAuthUserWithRole();
  if (!user || !profile || !['Coordinator', 'Admin', 'ProgramHead'].includes(profile.role) || profile.account_status !== 'active') {
    return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied. Requires Coordinator or Admin privileges.' } };
  }

  if (!await canManageDepartmentRecord(supabase, user.id, profile.role, 'evaluations', 'evaluation_id', evaluation_id))
    return { data: null, error: { code: 'FORBIDDEN', message: 'Evaluation is outside your department.' } };
  const { data: updated, error } = await supabase
    .from('evaluations')
    .update({
      performance_score: new_score,
      feedback: `${reason.trim()} (Adjudicated by ${profile.role})`,
    })
    .eq('evaluation_id', evaluation_id).select('evaluation_id').maybeSingle();

  if (error) return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to override evaluation.' } };
  if (!updated) return { data: null, error: { code: 'NOT_FOUND', message: 'Evaluation not found or access denied.' } };

  await recordAuditEvent({
    actor_user_id: user.id,
    action: 'EVALUATION_OVERRIDDEN',
    entity_type: 'evaluation',
    entity_id: evaluation_id,
    details: { new_score, reason },
  });

  return { data: null, error: null };
}

export async function listAssignedStudents(): Promise<AppResult<{ student_id: string; full_name: string; student_number: string; course: string }[]>> {
  const { user, profile } = await getAuthUserWithRole();
  if (!user || profile?.role !== 'Supervisor' || profile?.account_status !== 'active')
    return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const service = serviceClient();
  const { data: supervisor } = await service
    .from('supervisors')
    .select('supervisor_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!supervisor)
    return { data: null, error: { code: 'NOT_FOUND', message: 'Supervisor profile not found.' } };

  const { data, error } = await service
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

export async function listAssignedStudentsForEvaluation() {
  return listAssignedStudents();
}
