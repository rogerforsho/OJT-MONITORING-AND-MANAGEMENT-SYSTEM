'use server';

import crypto from 'crypto';
import { isICSCourse, isIBECourse } from '@/src/lib/departments';
import { createClient } from '@/src/lib/supabase/server';
import { getServiceClient } from '@/src/lib/supabase/service';
import { recordAuditEvent } from './audit';
import type { AppResult, UserRole, AccountStatus } from '@ojt/shared';

const serviceClient = getServiceClient;

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { authorized: false, user: null };
  const { data: profile } = await supabase
    .from('users')
    .select('role, account_status')
    .eq('user_id', user.id)
    .single();
  return {
    authorized: profile?.role === 'Admin' && profile?.account_status === 'active',
    user,
  };
}

export interface UserManagementItem {
  user_id: string;
  full_name: string;
  email: string;
  role: UserRole;
  account_status: AccountStatus;
  employee_number?: string | null;
  created_at: string;
}

export interface CreateSystemUserInput {
  full_name: string;
  email: string;
  password: string;
  role: 'Coordinator' | 'ProgramHead' | 'Admin';
  department_or_program?: string;
  employee_number?: string;
}

export async function listAllUsers(
  page = 1,
  pageSize = 20,
  roleFilter?: string,
  statusFilter?: string,
  search?: string
): Promise<AppResult<{ users: UserManagementItem[]; total: number }>> {
  const { authorized } = await assertAdmin();
  if (!authorized) return { data: null, error: { code: 'FORBIDDEN', message: 'Admin access required.' } };

  const service = serviceClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = service
    .from('users')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (roleFilter && roleFilter !== 'all') query = query.eq('role', roleFilter);
  if (statusFilter && statusFilter !== 'all') query = query.eq('account_status', statusFilter);
  if (search?.trim()) {
    query = query.or(`full_name.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%`);
  }

  const { data, error, count } = await query;
  if (error)
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to load user records.' } };

  return {
    data: {
      users: (data ?? []) as UserManagementItem[],
      total: count ?? 0,
    },
    error: null,
  };
}

export async function createSystemUser(
  input: CreateSystemUserInput
): Promise<AppResult<{ user_id: string }>> {
  const { authorized, user: adminUser } = await assertAdmin();
  if (!authorized || !adminUser) {
    return { data: null, error: { code: 'FORBIDDEN', message: 'Admin access required.' } };
  }

  if (!input.full_name?.trim()) return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Full name is required.' } };
  if (!input.email?.trim()) return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Email is required.' } };
  if (!input.password || input.password.length < 8) return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Password must be at least 8 characters.' } };
  if (!['Coordinator', 'ProgramHead', 'Admin'].includes(input.role)) {
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Invalid staff role.' } };
  }

  const service = serviceClient();

  // 1. Create auth user with pre-confirmed email
  const { data: authData, error: authError } = await service.auth.admin.createUser({
    email: input.email.trim(),
    password: input.password,
    email_confirm: true,
    user_metadata: {
      full_name: input.full_name.trim(),
      role: input.role,
    },
  });

  if (authError || !authData.user) {
    if (authError?.message?.includes('already registered') || authError?.message?.includes('unique constraint')) {
      return { data: null, error: { code: 'DUPLICATE_REQUEST', message: 'Email address is already registered.' } };
    }
    return { data: null, error: { code: 'SERVER_FAILURE', message: authError?.message || 'Failed to create staff account.' } };
  }

  const newUserId = authData.user.id;
  const dept = input.department_or_program || 'ICS';

  const empNumber = input.employee_number?.trim() || `${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

  // 2. Ensure public.users entry is active
  await service
    .from('users')
    .upsert({
      user_id: newUserId,
      full_name: input.full_name.trim(),
      email: input.email.trim(),
      role: input.role,
      employee_number: empNumber,
      account_status: 'active',
      updated_at: new Date().toISOString(),
    });

  // 3. Populate corresponding role table
  if (input.role === 'Coordinator') {
    await service.from('coordinators').upsert({
      user_id: newUserId,
      department: dept,
    });
  } else if (input.role === 'ProgramHead') {
    await service.from('program_heads').upsert({
      user_id: newUserId,
      department_or_program: dept,
    });
  } else if (input.role === 'Admin') {
    await service.from('admins').upsert({
      user_id: newUserId,
    });
  }

  // 4. Log Audit Event
  await recordAuditEvent({
    actor_user_id: adminUser.id,
    action: `STAFF_ACCOUNT_CREATED`,
    entity_type: 'user',
    entity_id: newUserId,
    details: {
      role: input.role,
      email: input.email.trim(),
      department: dept,
    },
  });

  return { data: { user_id: newUserId }, error: null };
}

export async function updateUserAccountStatus(
  user_id: string,
  status: AccountStatus
): Promise<AppResult<null>> {
  const { authorized, user } = await assertAdmin();
  if (!authorized || !user) return { data: null, error: { code: 'FORBIDDEN', message: 'Admin access required.' } };

  if (!['pending', 'active', 'rejected', 'inactive'].includes(status)) {
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Invalid status.' } };
  }

  const service = serviceClient();
  const { error } = await service
    .from('users')
    .update({ account_status: status, updated_at: new Date().toISOString() })
    .eq('user_id', user_id);

  if (error)
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to update user status.' } };

  // Log Audit Event for Non-repudiation
  await recordAuditEvent({
    actor_user_id: user.id,
    action: `ACCOUNT_STATUS_${status.toUpperCase()}`,
    entity_type: 'user',
    entity_id: user_id,
    details: { new_status: status },
  });

  return { data: null, error: null };
}

export async function getSystemOverview(): Promise<AppResult<{
  totalUsers: number;
  activeUsers: number;
  pendingUsers: number;
  companiesCount: number;
  attendanceCount: number;
  roleBreakdown: Record<string, number>;
}>> {
  const { authorized } = await assertAdmin();
  if (!authorized) return { data: null, error: { code: 'FORBIDDEN', message: 'Admin access required.' } };

  const service = serviceClient();

  const [
    { count: totalUsers },
    { count: activeUsers },
    { count: pendingUsers },
    { count: companiesCount },
    { count: attendanceCount },
    { data: users },
  ] = await Promise.all([
    service.from('users').select('*', { count: 'exact', head: true }),
    service.from('users').select('*', { count: 'exact', head: true }).eq('account_status', 'active'),
    service.from('users').select('*', { count: 'exact', head: true }).eq('account_status', 'pending'),
    service.from('companies').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    service.from('attendance').select('*', { count: 'exact', head: true }),
    service.from('users').select('role'),
  ]);

  const roleBreakdown: Record<string, number> = {
    Student: 0,
    Coordinator: 0,
    Supervisor: 0,
    ProgramHead: 0,
    Admin: 0,
  };

  (users ?? []).forEach((u: { role: string }) => {
    if (roleBreakdown[u.role] !== undefined) {
      roleBreakdown[u.role]++;
    }
  });

  return {
    data: {
      totalUsers: totalUsers ?? 0,
      activeUsers: activeUsers ?? 0,
      pendingUsers: pendingUsers ?? 0,
      companiesCount: companiesCount ?? 0,
      attendanceCount: attendanceCount ?? 0,
      roleBreakdown,
    },
    error: null,
  };
}
export async function deleteSystemUser(
  user_id: string
): Promise<AppResult<null>> {
  const { authorized, user: adminUser } = await assertAdmin();
  if (!authorized || !adminUser) {
    return { data: null, error: { code: 'FORBIDDEN', message: 'Admin access required.' } };
  }

  if (adminUser.id === user_id) {
    return { data: null, error: { code: 'FORBIDDEN', message: 'You cannot delete your own administrator account.' } };
  }

  const service = serviceClient();

  // 1. Fetch user details for audit logging and role-specific cleanup
  const { data: targetUser } = await service
    .from('users')
    .select('full_name, email, role')
    .eq('user_id', user_id)
    .maybeSingle();

  if (!targetUser) {
    return { data: null, error: { code: 'NOT_FOUND', message: 'User not found.' } };
  }

  // 2. If user is a supervisor, check/handle assignments to avoid foreign key restrict errors
  if (targetUser.role === 'Supervisor') {
    const { data: supervisor } = await service
      .from('supervisors')
      .select('supervisor_id')
      .eq('user_id', user_id)
      .maybeSingle();

    if (supervisor) {
      await service
        .from('student_assignments')
        .delete()
        .eq('supervisor_id', supervisor.supervisor_id);
    }
  }

  // 3. Delete user record in public schema (cascades to students/coordinators/etc)
  const { error: dbError } = await service
    .from('users')
    .delete()
    .eq('user_id', user_id);

  if (dbError) {
    return { data: null, error: { code: 'SERVER_FAILURE', message: `Database deletion failed: ${dbError.message}` } };
  }

  // 4. Delete Supabase Auth user identity
  const { error: authError } = await service.auth.admin.deleteUser(user_id);
  if (authError) {
    console.error('Warning: Failed to delete auth user from Supabase Auth:', authError.message);
  }

  // 5. Audit Log Entry
  await recordAuditEvent({
    actor_user_id: adminUser.id,
    action: 'USER_DELETED',
    entity_type: 'user',
    entity_id: user_id,
    details: {
      deleted_user_name: targetUser.full_name,
      deleted_user_email: targetUser.email,
      deleted_user_role: targetUser.role,
    },
  });

  return { data: null, error: null };
}

export async function adminResetUserPassword(
  userId: string,
  newPassword?: string
): Promise<AppResult<{ temporaryPassword?: string }>> {
  const { user, authorized } = await assertAdmin();
  if (!user || !authorized)
    return { data: null, error: { code: 'FORBIDDEN', message: 'Admin access required.' } };

  if (!userId)
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'User ID is required.' } };

  const finalPassword = newPassword?.trim() || `CdM@${Math.floor(100000 + Math.random() * 900000)}!`;

  if (finalPassword.length < 8)
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Password must be at least 8 characters long.' } };

  const service = serviceClient();

  // Fetch target user metadata
  const { data: targetUser } = await service
    .from('users')
    .select('email, full_name, role')
    .eq('user_id', userId)
    .maybeSingle();

  // Update password in Supabase Auth Admin API
  const { error: authErr } = await service.auth.admin.updateUserById(userId, {
    password: finalPassword,
  });

  if (authErr) {
    return {
      data: null,
      error: { code: 'SERVER_FAILURE', message: authErr.message || 'Failed to update user password in Auth server.' },
    };
  }

  // Record immutable security audit log
  await recordAuditEvent({
    actor_user_id: user.id,
    action: 'ADMIN_RESET_PASSWORD',
    entity_type: 'user',
    entity_id: userId,
    details: {
      target_email: targetUser?.email,
      target_role: targetUser?.role,
      reset_by_admin: user.id,
    },
  });

  return { data: { temporaryPassword: finalPassword }, error: null };
}

// ─── Database Archival & Backup (ISO/IEC 25010 / RA 10173) ───────────────────

export interface DatabaseSnapshotResult {
  timestamp: string;
  sha256_checksum: string;
  table_counts: Record<string, number>;
  snapshot_json: string;
  file_size_bytes: number;
}

export async function generateDatabaseSnapshot(): Promise<AppResult<DatabaseSnapshotResult>> {
  const { user, authorized } = await assertAdmin();
  if (!user || !authorized)
    return { data: null, error: { code: 'FORBIDDEN', message: 'Admin access required.' } };

  const service = serviceClient();

  // Concurrently fetch normalized tables (sanitized of sensitive secrets/passwords)
  const [
    { data: users },
    { data: students },
    { data: coordinators },
    { data: supervisors },
    { data: programHeads },
    { data: companies },
    { data: assignments },
    { data: attendance },
    { data: reports },
    { data: evaluations },
    { data: certificates },
    { data: announcements },
    { data: auditLogs },
  ] = await Promise.all([
    service.from('users').select('user_id, full_name, email, role, account_status, employee_number, created_at, updated_at'),
    service.from('students').select('student_id, user_id, student_number, course, year_level, required_hours, status'),
    service.from('coordinators').select('coordinator_id, user_id, department'),
    service.from('supervisors').select('supervisor_id, user_id, company_id, position'),
    service.from('program_heads').select('program_head_id, user_id, department_or_program'),
    service.from('companies').select('company_id, company_name, address, contact_person, contact_email, contact_number, status, latitude, longitude, geofence_radius_meters, geofence_enabled, created_at'),
    service.from('student_assignments').select('assignment_id, student_id, company_id, supervisor_id, start_date, end_date, assignment_status, created_at'),
    service.from('attendance').select('attendance_id, student_id, assignment_id, attendance_date, time_in, time_out, verification_status, late_status, sync_status, time_in_distance_meters, time_in_location_status, time_out_distance_meters, time_out_location_status, synced_at, created_at'),
    service.from('reports').select('report_id, student_id, report_type, file_path, submission_date, status, remarks, supervisor_feedback, supervisor_endorsed_at, created_at'),
    service.from('evaluations').select('evaluation_id, student_id, supervisor_id, performance_score, feedback, evaluation_date, evaluation_type, rubric_scores, created_at'),
    service.from('certificates').select('certificate_id, student_id, verification_code, hours_rendered, host_company_name, academic_year, status, issued_at'),
    service.from('announcements').select('announcement_id, author_user_id, title, content, target_role, target_department, created_at'),
    service.from('audit_logs').select('log_id, actor_user_id, action, entity_type, entity_id, details, created_at').order('created_at', { ascending: false }).limit(500),
  ]);

  const timestamp = new Date().toISOString();
  const tableCounts: Record<string, number> = {
    users: users?.length ?? 0,
    students: students?.length ?? 0,
    coordinators: coordinators?.length ?? 0,
    supervisors: supervisors?.length ?? 0,
    program_heads: programHeads?.length ?? 0,
    companies: companies?.length ?? 0,
    student_assignments: assignments?.length ?? 0,
    attendance: attendance?.length ?? 0,
    reports: reports?.length ?? 0,
    evaluations: evaluations?.length ?? 0,
    certificates: certificates?.length ?? 0,
    announcements: announcements?.length ?? 0,
    audit_logs: auditLogs?.length ?? 0,
  };

  const payload = {
    metadata: {
      institution: 'Colegio de Montalban',
      system: 'Cross-Platform OJT Monitoring and Management System',
      departments: ['Institute of Computing Studies (ICS)', 'Institute of Business and Entrepreneurship (IBE)'],
      schema_version: '1.0',
      exported_at: timestamp,
      exported_by_user_id: user.id,
      compliance: 'ISO/IEC 25010:2023 & RA 10173 (Philippine Data Privacy Act)',
      table_counts: tableCounts,
    },
    tables: {
      users: users ?? [],
      students: students ?? [],
      coordinators: coordinators ?? [],
      supervisors: supervisors ?? [],
      program_heads: programHeads ?? [],
      companies: companies ?? [],
      student_assignments: assignments ?? [],
      attendance: attendance ?? [],
      reports: reports ?? [],
      evaluations: evaluations ?? [],
      certificates: certificates ?? [],
      announcements: announcements ?? [],
      audit_logs: auditLogs ?? [],
    },
  };

  const jsonString = JSON.stringify(payload, null, 2);
  const sha256Checksum = crypto.createHash('sha256').update(jsonString).digest('hex');
  const fileSizeBytes = Buffer.byteLength(jsonString, 'utf8');

  // Record audit log event for institutional accountability
  await recordAuditEvent({
    actor_user_id: user.id,
    action: 'DATABASE_BACKUP_EXPORTED',
    entity_type: 'system',
    entity_id: 'database',
    details: {
      timestamp,
      sha256_checksum: sha256Checksum,
      total_tables: Object.keys(tableCounts).length,
      total_records: Object.values(tableCounts).reduce((a, b) => a + b, 0),
      file_size_bytes: fileSizeBytes,
    },
  });

  return {
    data: {
      timestamp,
      sha256_checksum: sha256Checksum,
      table_counts: tableCounts,
      snapshot_json: jsonString,
      file_size_bytes: fileSizeBytes,
    },
    error: null,
  };
}

// ─── Institutional Practicum Reports & Analytics ─────────────────────────────

export interface PracticumRosterItem {
  student_id: string;
  student_number: string;
  full_name: string;
  email: string;
  department: 'ICS' | 'IBE';
  course: string;
  year_level: number;
  company_name: string;
  supervisor_name: string;
  required_hours: number;
  completed_hours: number;
  remaining_hours: number;
  progress_percentage: number;
  midterm_score: number | null;
  final_score: number | null;
  evaluation_status: string;
  clearance_status: 'Cleared' | 'In Progress' | 'At Risk';
  certificate_issued: boolean;
  certificate_code?: string | null;
}

export interface PracticumReportSummary {
  roster: PracticumRosterItem[];
  kpis: {
    totalTrainees: number;
    placedTrainees: number;
    placementRate: number;
    completedTrainees: number;
    completionRate: number;
    averageRenderedHours: number;
    deficientCount: number;
    icsCount: number;
    ibeCount: number;
  };
}

export async function getPracticumRosterReport(
  programFilter?: string
): Promise<AppResult<PracticumReportSummary>> {
  const { user, authorized } = await assertAdmin();
  if (!user || !authorized)
    return { data: null, error: { code: 'FORBIDDEN', message: 'Admin access required.' } };

  const service = serviceClient();

  const { data: students, error: studentErr } = await service
    .from('students')
    .select(`
      student_id,
      student_number,
      course,
      year_level,
      required_hours,
      status,
      users!inner ( full_name, email, account_status ),
      internship_progress ( completed_hours, remaining_hours, progress_status ),
      student_assignments (
        assignment_status,
        companies ( company_name ),
        supervisors ( position, users ( full_name ) )
      ),
      evaluations ( performance_score, evaluation_type ),
      certificates ( verification_code, status )
    `)
    .eq('users.account_status', 'active')
    .order('student_number', { ascending: true });

  if (studentErr) {
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to generate practicum report.' } };
  }

  let totalTrainees = 0;
  let placedTrainees = 0;
  let completedTrainees = 0;
  let totalHoursSum = 0;
  let deficientCount = 0;
  let icsCount = 0;
  let ibeCount = 0;

  const rawRoster: PracticumRosterItem[] = (students ?? []).map((s: any) => {
    const userObj = Array.isArray(s.users) ? s.users[0] : s.users;
    const progress = Array.isArray(s.internship_progress) ? s.internship_progress[0] : s.internship_progress;
    
    // Find active assignment or latest
    const assignments = Array.isArray(s.student_assignments) ? s.student_assignments : (s.student_assignments ? [s.student_assignments] : []);
    const activeAssignment = assignments.find((a: any) => a.assignment_status === 'active') || assignments[0];
    const company = activeAssignment ? (Array.isArray(activeAssignment.companies) ? activeAssignment.companies[0] : activeAssignment.companies) : null;
    const supervisor = activeAssignment ? (Array.isArray(activeAssignment.supervisors) ? activeAssignment.supervisors[0] : activeAssignment.supervisors) : null;
    const supervisorUser = supervisor ? (Array.isArray(supervisor.users) ? supervisor.users[0] : supervisor.users) : null;

    // Evaluations
    const evals = Array.isArray(s.evaluations) ? s.evaluations : (s.evaluations ? [s.evaluations] : []);
    const midtermEval = evals.find((e: any) => e.evaluation_type === 'midterm');
    const finalEval = evals.find((e: any) => e.evaluation_type === 'final') || (!midtermEval && evals.length > 0 ? evals[0] : null);

    const midtermScore = midtermEval?.performance_score != null ? Number(midtermEval.performance_score) : null;
    const finalScore = finalEval?.performance_score != null ? Number(finalEval.performance_score) : null;

    // Certificate
    const certs = Array.isArray(s.certificates) ? s.certificates : (s.certificates ? [s.certificates] : []);
    const activeCert = certs.find((c: any) => c.status === 'active') || certs[0];

    const courseStr = (s.course || '').toUpperCase();
    const isICS = isICSCourse(courseStr);
    const department: 'ICS' | 'IBE' = isICS ? 'ICS' : 'IBE';

    const reqHours = s.required_hours || 486;
    const compHours = progress?.completed_hours || 0;
    const remHours = Math.max(0, reqHours - compHours);
    const pct = Math.min(100, Math.round((compHours / reqHours) * 100));

    const isPlaced = !!company?.company_name;
    const isCompleted = compHours >= reqHours && (finalScore == null || finalScore >= 75);
    const isDeficient = !isPlaced || (compHours < reqHours * 0.4);

    totalTrainees++;
    if (isPlaced) placedTrainees++;
    if (isCompleted) completedTrainees++;
    totalHoursSum += compHours;
    if (isDeficient) deficientCount++;
    if (isICS) icsCount++;
    else ibeCount++;

    let evalStatus = 'No Evaluations';
    if (midtermScore !== null && finalScore !== null) evalStatus = `Midterm: ${midtermScore}% | Final: ${finalScore}%`;
    else if (finalScore !== null) evalStatus = `Final: ${finalScore}%`;
    else if (midtermScore !== null) evalStatus = `Midterm: ${midtermScore}%`;

    const clearanceStatus: 'Cleared' | 'In Progress' | 'At Risk' =
      activeCert ? 'Cleared' : isDeficient ? 'At Risk' : 'In Progress';

    return {
      student_id: s.student_id,
      student_number: s.student_number,
      full_name: userObj?.full_name || '',
      email: userObj?.email || '',
      department,
      course: s.course,
      year_level: s.year_level,
      company_name: company?.company_name || 'Unassigned',
      supervisor_name: supervisorUser?.full_name || 'Unassigned',
      required_hours: reqHours,
      completed_hours: compHours,
      remaining_hours: remHours,
      progress_percentage: pct,
      midterm_score: midtermScore,
      final_score: finalScore,
      evaluation_status: evalStatus,
      clearance_status: clearanceStatus,
      certificate_issued: !!activeCert,
      certificate_code: activeCert?.verification_code || null,
    };
  });

  const filteredRoster = programFilter && programFilter !== 'all'
    ? rawRoster.filter((r) => programFilter === 'ICS' ? r.department === 'ICS' : programFilter === 'IBE' ? r.department === 'IBE' : r.course === programFilter)
    : rawRoster;

  const placementRate = totalTrainees > 0 ? Math.round((placedTrainees / totalTrainees) * 100) : 0;
  const completionRate = totalTrainees > 0 ? Math.round((completedTrainees / totalTrainees) * 100) : 0;
  const averageRenderedHours = totalTrainees > 0 ? Math.round((totalHoursSum / totalTrainees) * 10) / 10 : 0;

  return {
    data: {
      roster: filteredRoster,
      kpis: {
        totalTrainees,
        placedTrainees,
        placementRate,
        completedTrainees,
        completionRate,
        averageRenderedHours,
        deficientCount,
        icsCount,
        ibeCount,
      },
    },
    error: null,
  };
}
