'use server';

import { createClient } from '@/src/lib/supabase/server';
import { canManageDepartmentStudent } from '@/src/lib/department-scope';
import { getServiceClient } from '@/src/lib/supabase/service';
import { recordAuditEvent } from '@/src/lib/audit';
import { checkStudentGatewayStatus } from './reports';
import type { AppResult, DbPracticumSchedule, WorkModality, PracticumScheduleStatus } from '@ojt/shared';

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

export interface PracticumScheduleInput {
  company_id?: string | null;
  custom_company_name?: string | null;
  work_modality: WorkModality;
  work_days: number[]; // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  time_in: string; // "HH:MM" e.g. "08:00"
  time_out: string; // "HH:MM" e.g. "17:00"
  lunch_break_minutes?: number; // default 60
  lunch_break_start: string | null;
  start_date: string;
  end_date?: string | null;
  student_notes?: string | null;
}

export type ScheduleDetail = Omit<DbPracticumSchedule, 'students' | 'companies'> & {
  students?: {
    student_id: string;
    student_number: string;
    course: string;
    year_level: number;
    users?: { full_name: string; email: string } | null;
  } | null;
  companies?: { company_id: string; company_name: string; address?: string | null } | null;
};

function parseTimeToMinutes(t: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(t);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return NaN;
  return Number(match[1]) * 60 + Number(match[2]);
}

export async function submitPracticumSchedule(
  input: PracticumScheduleInput
): Promise<AppResult<DbPracticumSchedule>> {
  const { supabase, user, profile } = await getAuthUserWithRole();
  if (!user || profile?.role !== 'Student' || profile?.account_status !== 'active') {
    return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };
  }

  const { data: student } = await supabase
    .from('students')
    .select('student_id')
    .eq('user_id', user.id)
    .single();

  if (!student) {
    return { data: null, error: { code: 'NOT_FOUND', message: 'Student record not found.' } };
  }

  // 1. Enforce Gateway Clearance (Orientation Certificate & Endorsement Letter approved)
  const gateway = await checkStudentGatewayStatus(student.student_id);
  if (!gateway.isCleared) {
    return {
      data: null,
      error: {
        code: 'VALIDATION_FAILURE',
        message: `Cannot propose practicum schedule: You must first have your 2 mandatory pre-deployment gateway documents approved by your OJT Coordinator (Missing: ${gateway.missing.join(', ')}).`,
      },
    };
  }

  // 2. Validate input fields
  if (!input.work_days || input.work_days.length === 0) {
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Please select at least one weekly work day.' } };
  }
  if (!input.time_in || !input.time_out) {
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Time In and Time Out are required.' } };
  }
  if (!input.start_date) {
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Practicum start date is required.' } };
  }

  // 3. CHED / CDM Guidelines Validation
  const lunchMinutes = input.lunch_break_minutes ?? 60;
  const startMin = parseTimeToMinutes(input.time_in);
  const endMin = parseTimeToMinutes(input.time_out);
  const lunchStartMin = input.lunch_break_start ? parseTimeToMinutes(input.lunch_break_start) : null;
  if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || !Number.isInteger(lunchMinutes) || lunchMinutes < 0 || lunchMinutes > 120 ||
      (lunchMinutes > 0 && (lunchStartMin === null || !Number.isFinite(lunchStartMin) || lunchStartMin < startMin || lunchStartMin + lunchMinutes > endMin)) ||
      (lunchMinutes === 0 && input.lunch_break_start !== null))
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Enter a valid lunch interval inside the scheduled shift.' } };

  if (startMin >= endMin) {
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Time In must be earlier than Time Out.' } };
  }

  // No graveyard / night shifts (allowed window: 06:00 to 21:00)
  if (startMin < 6 * 60 || endMin > 21 * 60) {
    return {
      data: null,
      error: {
        code: 'VALIDATION_FAILURE',
        message: 'Practicum shifts must fall between 6:00 AM and 9:00 PM (graveyard/overnight shifts are prohibited per CHED CMO 104).',
      },
    };
  }

  // No Sunday shifts
  if (input.work_days.includes(0)) {
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Sunday practicum shifts are not permitted.' } };
  }

  const shiftDurationMinutes = (endMin - startMin) - lunchMinutes;
  const dailyHours = Math.round((shiftDurationMinutes / 60) * 100) / 100;

  if (dailyHours <= 0) {
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Shift duration must be greater than lunch break duration.' } };
  }

  if (dailyHours > 8.0) {
    return {
      data: null,
      error: {
        code: 'VALIDATION_FAILURE',
        message: `Calculated daily shift is ${dailyHours} hours. Maximum allowable work duration is 8.0 hours per day per CHED CMO 104 guidelines.`,
      },
    };
  }

  const weeklyHours = Math.round((dailyHours * input.work_days.length) * 100) / 100;
  if (weeklyHours > 40.0) {
    return {
      data: null,
      error: {
        code: 'VALIDATION_FAILURE',
        message: `Calculated weekly commitment is ${weeklyHours} hours across ${input.work_days.length} days. Maximum allowable work duration is 40.0 hours per week per CHED CMO 104 guidelines.`,
      },
    };
  }

  // 4. Upsert or Insert schedule proposal
  const { data: existing } = await supabase
    .from('practicum_schedules')
    .select('schedule_id, status')
    .eq('student_id', student.student_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let result;
  if (existing && existing.status === 'pending') {
    result = await supabase
      .from('practicum_schedules')
      .update({
        company_id: input.company_id || null,
        custom_company_name: input.custom_company_name || null,
        work_modality: input.work_modality,
        work_days: input.work_days,
        time_in: input.time_in,
        time_out: input.time_out,
        lunch_break_minutes: lunchMinutes,
        lunch_break_start: input.lunch_break_start,
        daily_hours: dailyHours,
        weekly_hours: weeklyHours,
        start_date: input.start_date,
        end_date: input.end_date || null,
        student_notes: input.student_notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('schedule_id', existing.schedule_id)
      .select()
      .single();
  } else {
    result = await supabase
      .from('practicum_schedules')
      .insert({
        student_id: student.student_id,
        company_id: input.company_id || null,
        custom_company_name: input.custom_company_name || null,
        work_modality: input.work_modality,
        work_days: input.work_days,
        time_in: input.time_in,
        time_out: input.time_out,
        lunch_break_minutes: lunchMinutes,
        daily_hours: dailyHours,
        weekly_hours: weeklyHours,
        start_date: input.start_date,
        end_date: input.end_date || null,
        student_notes: input.student_notes || null,
        status: 'pending',
      })
      .select()
      .single();
  }

  if (result.error) {
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to submit practicum schedule.' } };
  }

  await recordAuditEvent({
    actor_user_id: user.id,
    action: 'PRACTICUM_SCHEDULE_SUBMITTED',
    entity_type: 'practicum_schedule',
    entity_id: result.data.schedule_id,
    details: { daily_hours: dailyHours, weekly_hours: weeklyHours, modality: input.work_modality },
  });

  return { data: result.data as DbPracticumSchedule, error: null };
}

export async function getStudentPracticumSchedule(): Promise<AppResult<ScheduleDetail | null>> {
  const { supabase, user } = await getAuthUserWithRole();
  if (!user) return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };

  const { data: student } = await supabase
    .from('students')
    .select('student_id')
    .eq('user_id', user.id)
    .single();

  if (!student) return { data: null, error: { code: 'NOT_FOUND', message: 'Student record not found.' } };

  const { data, error } = await supabase
    .from('practicum_schedules')
    .select(`
      *,
      students (
        student_id, student_number, course, year_level,
        users ( full_name, email )
      ),
      companies ( company_id, company_name, address )
    `)
    .eq('student_id', student.student_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to load schedule.' } };
  return { data: (data as ScheduleDetail) || null, error: null };
}

export async function listPracticumSchedules(
  statusFilter = 'pending',
  page = 1,
  pageSize = 20
): Promise<AppResult<{ schedules: ScheduleDetail[]; total: number }>> {
  const { supabase, user, profile } = await getAuthUserWithRole();
  if (!user || !['Coordinator', 'Admin', 'ProgramHead'].includes(profile?.role ?? '') || profile?.account_status !== 'active') {
    return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('practicum_schedules')
    .select(`
      *,
      students (
        student_id, student_number, course, year_level,
        users ( full_name, email )
      ),
      companies ( company_id, company_name, address )
    `, { count: 'exact' })
    .order('created_at', { ascending: false });

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const { data, error, count } = await query.range(from, to);

  if (error) return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to load schedules.' } };
  return { data: { schedules: (data as ScheduleDetail[]) || [], total: count ?? 0 }, error: null };
}

export async function reviewPracticumSchedule(
  schedule_id: string,
  action: 'approve' | 'reject' | 'modify',
  reviewData?: {
    company_id?: string;
    supervisor_id?: string;
    feedback?: string;
    start_date?: string;
    end_date?: string;
  }
): Promise<AppResult<null>> {
  const { supabase, user, profile } = await getAuthUserWithRole();
  if (!user || !['Coordinator', 'Admin', 'ProgramHead'].includes(profile?.role ?? '') || profile?.account_status !== 'active') {
    return { data: null, error: { code: 'FORBIDDEN', message: 'Access denied.' } };
  }

  const { data: schedule } = await supabase
    .from('practicum_schedules')
    .select('*')
    .eq('schedule_id', schedule_id)
    .single();

  if (!schedule) {
    return { data: null, error: { code: 'NOT_FOUND', message: 'Schedule proposal not found.' } };
  }
  if (!await canManageDepartmentStudent(supabase, user.id, profile.role, schedule.student_id))
    return { data: null, error: { code: 'FORBIDDEN', message: 'Schedule is outside your department.' } };
  if (!['approve', 'reject', 'modify'].includes(action))
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Invalid schedule decision.' } };

  const statusMap: Record<string, PracticumScheduleStatus> = {
    approve: 'approved',
    reject: 'rejected',
    modify: 'modified',
  };

  const newStatus = statusMap[action];
  const updatePayload: Record<string, any> = {
    status: newStatus,
    coordinator_feedback: reviewData?.feedback || null,
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (reviewData?.company_id) updatePayload.company_id = reviewData.company_id;
  if (reviewData?.start_date) updatePayload.start_date = reviewData.start_date;
  if (reviewData?.end_date) updatePayload.end_date = reviewData.end_date;

  const { error: updateErr } = await supabase
    .from('practicum_schedules')
    .update(updatePayload)
    .eq('schedule_id', schedule_id);

  if (updateErr) {
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to update schedule status.' } };
  }

  // If approved and company_id + supervisor_id are provided, deploy the trainee!
  const finalCompanyId = reviewData?.company_id || schedule.company_id;
  const supervisorId = reviewData?.supervisor_id;

  if (action === 'approve' && finalCompanyId && supervisorId) {
    const service = getServiceClient();

    // Verify supervisor belongs to company
    const { data: supervisor } = await service
      .from('supervisors')
      .select('company_id')
      .eq('supervisor_id', supervisorId)
      .single();

    if (supervisor && supervisor.company_id === finalCompanyId) {
      // Check for active assignment
      const { data: existingAssignment } = await service
        .from('student_assignments')
        .select('assignment_id')
        .eq('student_id', schedule.student_id)
        .eq('assignment_status', 'active')
        .maybeSingle();

      if (!existingAssignment) {
        await service.from('student_assignments').insert({
          student_id: schedule.student_id,
          company_id: finalCompanyId,
          supervisor_id: supervisorId,
          start_date: reviewData?.start_date || schedule.start_date,
          end_date: reviewData?.end_date || schedule.end_date || null,
          assignment_status: 'active',
        });
      }
    }
  }

  await recordAuditEvent({
    actor_user_id: user.id,
    action: `PRACTICUM_SCHEDULE_${action.toUpperCase()}`,
    entity_type: 'practicum_schedule',
    entity_id: schedule_id,
    details: { action, student_id: schedule.student_id, feedback: reviewData?.feedback },
  });

  return { data: null, error: null };
}
