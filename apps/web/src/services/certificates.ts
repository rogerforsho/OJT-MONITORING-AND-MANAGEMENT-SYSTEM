'use server';

import { createClient } from '@/src/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { recordAuditEvent } from './audit';
import type { AppResult } from '@ojt/shared';

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

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

export interface ClearanceCheckResult {
  student_id: string;
  student_name: string;
  student_number: string;
  course: string;
  completed_hours: number;
  required_hours: number;
  hours_met: boolean;
  final_report_approved: boolean;
  evaluation_passed: boolean;
  evaluation_score: number | null;
  can_issue: boolean;
  certificate?: {
    certificate_id: string;
    verification_code: string;
    status: string;
    issued_at: string;
  } | null;
}

export async function checkClearanceStatus(student_id: string): Promise<AppResult<ClearanceCheckResult>> {
  if (!student_id) return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Student ID is required.' } };

  const service = serviceClient();

  // 1. Fetch student info
  const { data: student, error: studentErr } = await service
    .from('students')
    .select('student_id, student_number, course, required_hours, users ( full_name )')
    .eq('student_id', student_id)
    .single();

  if (studentErr || !student) {
    return { data: null, error: { code: 'NOT_FOUND', message: 'Student profile not found.' } };
  }

  // 2. Fetch progress hours
  const { data: progress } = await service
    .from('internship_progress')
    .select('completed_hours')
    .eq('student_id', student_id)
    .maybeSingle();

  const completedHours = Number(progress?.completed_hours || 0);
  const requiredHours = Number(student.required_hours || 486);
  const hoursMet = completedHours >= requiredHours;

  // 3. Fetch final report status
  const { data: finalReport } = await service
    .from('reports')
    .select('status')
    .eq('student_id', student_id)
    .eq('report_type', 'final_report')
    .eq('status', 'approved')
    .maybeSingle();

  const finalReportApproved = !!finalReport;

  // 4. Fetch supervisor evaluation
  const { data: evaluation } = await service
    .from('evaluations')
    .select('performance_score')
    .eq('student_id', student_id)
    .order('evaluation_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  const evalScore = evaluation?.performance_score !== null && evaluation?.performance_score !== undefined
    ? Number(evaluation.performance_score)
    : null;
  const evaluationPassed = evalScore !== null && evalScore >= 75;

  // 5. Check if already issued
  const { data: cert } = await service
    .from('certificates')
    .select('certificate_id, verification_code, status, issued_at')
    .eq('student_id', student_id)
    .maybeSingle();

  const userObj = Array.isArray(student.users) ? student.users[0] : student.users;

  return {
    data: {
      student_id,
      student_name: userObj?.full_name || '',
      student_number: student.student_number,
      course: student.course,
      completed_hours: completedHours,
      required_hours: requiredHours,
      hours_met: hoursMet,
      final_report_approved: finalReportApproved,
      evaluation_passed: evaluationPassed,
      evaluation_score: evalScore,
      can_issue: hoursMet && finalReportApproved && evaluationPassed && !cert,
      certificate: cert || null,
    },
    error: null,
  };
}

export async function issueCertificate(student_id: string): Promise<AppResult<{ verification_code: string }>> {
  if (!student_id) return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Student ID is required.' } };

  const { user, profile } = await getAuthUserWithRole();
  if (!user || !profile || !['Coordinator', 'Admin', 'ProgramHead'].includes(profile.role) || profile.account_status !== 'active') {
    return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied. Requires Coordinator or Admin privileges.' } };
  }

  const clearance = await checkClearanceStatus(student_id);
  if (clearance.error || !clearance.data) {
    return { data: null, error: { code: 'SERVER_FAILURE', message: clearance.error?.message || 'Failed to check clearance.' } };
  }

  if (clearance.data.certificate) {
    return { data: { verification_code: clearance.data.certificate.verification_code }, error: null };
  }

  const service = serviceClient();

  // Fetch student active/last company
  const { data: assignment } = await service
    .from('student_assignments')
    .select('companies ( company_name )')
    .eq('student_id', student_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const compObj = Array.isArray(assignment?.companies) ? assignment?.companies[0] : assignment?.companies;
  const companyName = compObj?.company_name || 'Partner Host Training Establishment';

  // Generate unique verification code: CDM-OJT-2026-XXXXXX
  const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  const verificationCode = `CDM-OJT-2026-${randomSuffix}`;

  const { data: cert, error: insertErr } = await service
    .from('certificates')
    .insert({
      student_id,
      verification_code: verificationCode,
      hours_rendered: clearance.data.completed_hours,
      host_company_name: companyName,
      academic_year: '2025-2026',
      status: 'active',
      issued_by_user_id: user.id,
    })
    .select('certificate_id, verification_code')
    .single();

  if (insertErr || !cert) {
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to generate certificate.' } };
  }

  await recordAuditEvent({
    actor_user_id: user.id,
    action: 'CERTIFICATE_ISSUED',
    entity_type: 'certificate',
    entity_id: cert.certificate_id,
    details: { student_id, verification_code: cert.verification_code },
  });

  return { data: { verification_code: cert.verification_code }, error: null };
}

export async function revokeCertificate(certificate_id: string, reason: string): Promise<AppResult<null>> {
  if (!certificate_id) return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Certificate ID is required.' } };
  if (!reason?.trim()) return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Revocation reason is required.' } };

  const { user, profile } = await getAuthUserWithRole();
  if (!user || !profile || !['Coordinator', 'Admin', 'ProgramHead'].includes(profile.role) || profile.account_status !== 'active') {
    return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied. Requires Coordinator or Admin privileges.' } };
  }

  const service = serviceClient();
  const { error } = await service
    .from('certificates')
    .update({
      status: 'revoked',
      revocation_reason: reason.trim(),
    })
    .eq('certificate_id', certificate_id);

  if (error) return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to revoke certificate.' } };

  await recordAuditEvent({
    actor_user_id: user.id,
    action: 'CERTIFICATE_REVOKED',
    entity_type: 'certificate',
    entity_id: certificate_id,
    details: { reason },
  });

  return { data: null, error: null };
}

export async function verifyCertificatePublic(code: string): Promise<AppResult<{
  valid: boolean;
  status: 'active' | 'revoked' | 'not_found';
  verification_code: string;
  student_name?: string;
  student_number?: string;
  course?: string;
  hours_rendered?: number;
  host_company_name?: string;
  academic_year?: string;
  issued_at?: string;
  revocation_reason?: string;
}>> {
  if (!code?.trim()) {
    return { data: { valid: false, status: 'not_found', verification_code: code }, error: null };
  }

  const service = serviceClient();
  const { data, error } = await service
    .from('certificates')
    .select(`
      verification_code, hours_rendered, host_company_name, academic_year, status, revocation_reason, issued_at,
      students (
        student_number, course,
        users ( full_name )
      )
    `)
    .eq('verification_code', code.trim().toUpperCase())
    .maybeSingle();

  if (error || !data) {
    return { data: { valid: false, status: 'not_found', verification_code: code }, error: null };
  }

  const studentObj = Array.isArray(data.students) ? data.students[0] : data.students;
  const userObj = Array.isArray(studentObj?.users) ? studentObj?.users[0] : studentObj?.users;

  return {
    data: {
      valid: data.status === 'active',
      status: data.status as 'active' | 'revoked',
      verification_code: data.verification_code,
      student_name: userObj?.full_name || 'Trainee',
      student_number: studentObj?.student_number || '',
      course: studentObj?.course || '',
      hours_rendered: Number(data.hours_rendered),
      host_company_name: data.host_company_name,
      academic_year: data.academic_year,
      issued_at: data.issued_at,
      revocation_reason: data.revocation_reason || undefined,
    },
    error: null,
  };
}
