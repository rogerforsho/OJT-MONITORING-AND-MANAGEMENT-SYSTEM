import { supabase } from '../lib/supabase';
import type { AppResult, DbPracticumSchedule, WorkModality } from '@ojt/shared';

export interface MobileScheduleInput {
  company_id?: string | null;
  custom_company_name?: string | null;
  work_modality: WorkModality;
  work_days: number[]; // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  time_in: string; // "HH:MM" e.g. "08:00"
  time_out: string; // "HH:MM" e.g. "17:00"
  lunch_break_minutes: number;
  lunch_break_start: string | null;
  start_date: string;
  end_date?: string | null;
  student_notes?: string | null;
}

export async function fetchCompaniesList(): Promise<AppResult<Array<{ company_id: string; company_name: string; address: string }>>> {
  try {
    const { data, error } = await supabase
      .from('companies')
      .select('company_id, company_name, address')
      .eq('status', 'active')
      .order('company_name');

    if (error) {
      return { data: null, error: { code: 'SERVER_FAILURE', message: error.message } };
    }
    return { data: data || [], error: null };
  } catch (err: any) {
    return { data: null, error: { code: 'SERVER_FAILURE', message: err?.message || 'Failed to fetch companies' } };
  }
}

export async function fetchStudentScheduleProposal(): Promise<AppResult<DbPracticumSchedule | null>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: { code: 'UNAUTHORIZED', message: 'Not logged in.' } };

    const { data: student } = await supabase
      .from('students')
      .select('student_id')
      .eq('user_id', user.id)
      .single();

    if (!student) return { data: null, error: { code: 'NOT_FOUND', message: 'Student not found.' } };

    const { data, error } = await supabase
      .from('practicum_schedules')
      .select(`
        *,
        companies ( company_id, company_name, address )
      `)
      .eq('student_id', student.student_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return { data: null, error: { code: 'SERVER_FAILURE', message: error.message } };
    }
    return { data: (data as DbPracticumSchedule) || null, error: null };
  } catch (err: any) {
    return { data: null, error: { code: 'SERVER_FAILURE', message: err?.message || 'Failed to fetch schedule' } };
  }
}

export async function submitScheduleProposal(
  input: MobileScheduleInput
): Promise<AppResult<DbPracticumSchedule>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: { code: 'UNAUTHORIZED', message: 'Not logged in.' } };

    const { data: student } = await supabase
      .from('students')
      .select('student_id')
      .eq('user_id', user.id)
      .single();

    if (!student) return { data: null, error: { code: 'NOT_FOUND', message: 'Student not found.' } };

    if (!input.work_days || input.work_days.length === 0) {
      return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Select at least one work day.' } };
    }

    // Time calculations
    const toMinutes = (value: string) => {
      const match = /^(\d{2}):(\d{2})$/.exec(value);
      if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return NaN;
      return Number(match[1]) * 60 + Number(match[2]);
    };
    const startMin = toMinutes(input.time_in);
    const endMin = toMinutes(input.time_out);
    const lunchStartMin = input.lunch_break_start ? toMinutes(input.lunch_break_start) : null;
    if (!Number.isFinite(startMin) || !Number.isFinite(endMin) ||
        !Number.isInteger(input.lunch_break_minutes) || input.lunch_break_minutes < 0 || input.lunch_break_minutes > 120 ||
        (input.lunch_break_minutes > 0 && (lunchStartMin === null || !Number.isFinite(lunchStartMin) || lunchStartMin < startMin || lunchStartMin + input.lunch_break_minutes > endMin)) ||
        (input.lunch_break_minutes === 0 && input.lunch_break_start !== null)) {
      return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Enter a valid lunch interval inside the scheduled shift.' } };
    }

    if (startMin >= endMin) {
      return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Time In must be earlier than Time Out.' } };
    }

    // Graveyard shift check (06:00 to 21:00)
    if (startMin < 6 * 60 || endMin > 21 * 60) {
      return {
        data: null,
        error: { code: 'VALIDATION_FAILURE', message: 'Practicum shifts must be between 6:00 AM and 9:00 PM (no graveyard shifts).' },
      };
    }

    const shiftMin = (endMin - startMin) - input.lunch_break_minutes;
    const dailyHours = Math.round((shiftMin / 60) * 100) / 100;

    if (dailyHours > 8.0) {
      return {
        data: null,
        error: { code: 'VALIDATION_FAILURE', message: `Daily hours (${dailyHours}h) exceed the 8.0 hours/day CHED limit.` },
      };
    }

    const weeklyHours = Math.round((dailyHours * input.work_days.length) * 100) / 100;
    if (weeklyHours > 40.0) {
      return {
        data: null,
        error: { code: 'VALIDATION_FAILURE', message: `Weekly hours (${weeklyHours}h) exceed the 40.0 hours/week CHED limit.` },
      };
    }

    // Check existing pending
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
          lunch_break_minutes: input.lunch_break_minutes,
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
          lunch_break_minutes: input.lunch_break_minutes,
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
      return { data: null, error: { code: 'SERVER_FAILURE', message: result.error.message } };
    }

    return { data: result.data as DbPracticumSchedule, error: null };
  } catch (err: any) {
    return { data: null, error: { code: 'SERVER_FAILURE', message: err?.message || 'Failed to submit schedule' } };
  }
}
