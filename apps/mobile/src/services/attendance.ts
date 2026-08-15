import { supabase } from '../lib/supabase';
import type { AppResult, DbAttendance } from '@ojt/shared';

// ─── Storage ──────────────────────────────────────────────────────────────────

async function uploadSelfie(
  localUri: string,
  student_id: string,
  type: 'time_in' | 'time_out'
): Promise<AppResult<{ path: string }>> {
  const filename = `${student_id}/${type}_${Date.now()}.jpg`;

  try {
    const response = await fetch(localUri);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();

    const { data, error } = await supabase.storage
      .from('attendance-selfies')
      .upload(filename, arrayBuffer, { contentType: 'image/jpeg', upsert: false });

    if (error) {
      return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to upload selfie evidence.' } };
    }

    return { data: { path: data.path }, error: null };
  } catch {
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Error processing selfie image.' } };
  }
}

// ─── Late Status ──────────────────────────────────────────────────────────────

async function determineLateStatus(
  company_id: string,
  time_in: Date
): Promise<'on_time' | 'late' | 'unknown'> {
  const dayOfWeek = time_in.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) return 'unknown';

  const { data: schedule } = await supabase
    .from('work_schedules')
    .select('time_in_cutoff')
    .eq('company_id', company_id)
    .eq('day_of_week', dayOfWeek)
    .maybeSingle();

  if (!schedule) return 'unknown';

  const [cutoffHour, cutoffMin] = schedule.time_in_cutoff.split(':').map(Number);
  const cutoff = new Date(time_in);
  cutoff.setHours(cutoffHour, cutoffMin, 0, 0);

  return time_in > cutoff ? 'late' : 'on_time';
}

// ─── Time In ──────────────────────────────────────────────────────────────────

export async function recordTimeIn(
  selfie_uri: string
): Promise<AppResult<{ attendance_id: string }>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { data: null, error: { code: 'UNAUTHORIZED', message: 'Not authenticated.' } };
  }

  const { data: student } = await supabase
    .from('students')
    .select('student_id')
    .eq('user_id', user.id)
    .single();

  if (!student) {
    return { data: null, error: { code: 'NOT_FOUND', message: 'Student profile not found.' } };
  }

  const { data: assignment } = await supabase
    .from('student_assignments')
    .select('assignment_id, company_id')
    .eq('student_id', student.student_id)
    .eq('assignment_status', 'active')
    .maybeSingle();

  if (!assignment) {
    return { data: null, error: { code: 'NOT_FOUND', message: 'No active company assignment found. Please contact your coordinator.' } };
  }

  const today = new Date().toISOString().split('T')[0];
  const dayOfWeek = new Date().getDay();

  // Weekend check
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Attendance is only recorded on weekdays.' } };
  }

  // Duplicate check
  const { data: existing } = await supabase
    .from('attendance')
    .select('attendance_id')
    .eq('student_id', student.student_id)
    .eq('attendance_date', today)
    .maybeSingle();

  if (existing) {
    return { data: null, error: { code: 'DUPLICATE_REQUEST', message: 'You already have an attendance record for today.' } };
  }

  const capturedAt = new Date().toISOString();
  const selfieResult = await uploadSelfie(selfie_uri, student.student_id, 'time_in');
  if (selfieResult.error) return { data: null, error: selfieResult.error };

  const late_status = await determineLateStatus(assignment.company_id, new Date(capturedAt));

  const { data: record, error } = await supabase
    .from('attendance')
    .insert({
      student_id: student.student_id,
      assignment_id: assignment.assignment_id,
      attendance_date: today,
      time_in: capturedAt,
      time_in_selfie_path: selfieResult.data!.path,
      qr_validation_status: 'valid',
      verification_status: 'pending',
      late_status,
      sync_status: 'synced',
    })
    .select('attendance_id')
    .single();

  if (error) {
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to record Time In.' } };
  }

  return { data: { attendance_id: record.attendance_id }, error: null };
}

// ─── Time Out ─────────────────────────────────────────────────────────────────

export async function recordTimeOut(
  attendance_id: string,
  selfie_uri: string
): Promise<AppResult<null>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { data: null, error: { code: 'UNAUTHORIZED', message: 'Not authenticated.' } };
  }

  const { data: student } = await supabase
    .from('students')
    .select('student_id')
    .eq('user_id', user.id)
    .single();

  if (!student) {
    return { data: null, error: { code: 'NOT_FOUND', message: 'Student profile not found.' } };
  }

  const { data: record } = await supabase
    .from('attendance')
    .select('attendance_id, student_id, time_out')
    .eq('attendance_id', attendance_id)
    .eq('student_id', student.student_id)
    .single();

  if (!record) {
    return { data: null, error: { code: 'NOT_FOUND', message: 'Attendance record not found.' } };
  }

  if (record.time_out) {
    return { data: null, error: { code: 'DUPLICATE_REQUEST', message: 'Time Out has already been recorded for today.' } };
  }

  const capturedAt = new Date().toISOString();
  const selfieResult = await uploadSelfie(selfie_uri, student.student_id, 'time_out');
  if (selfieResult.error) return { data: null, error: selfieResult.error };

  const { error } = await supabase
    .from('attendance')
    .update({
      time_out: capturedAt,
      time_out_selfie_path: selfieResult.data!.path,
      updated_at: capturedAt,
    })
    .eq('attendance_id', attendance_id)
    .eq('student_id', student.student_id);

  if (error) {
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to record Time Out.' } };
  }

  return { data: null, error: null };
}

// ─── Fetch own attendance ─────────────────────────────────────────────────────

export async function fetchOwnAttendance(
  page = 1,
  pageSize = 20
): Promise<AppResult<{ records: DbAttendance[]; total: number }>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { data: null, error: { code: 'UNAUTHORIZED', message: 'Not authenticated.' } };
  }

  const { data: student } = await supabase
    .from('students')
    .select('student_id')
    .eq('user_id', user.id)
    .single();

  if (!student) {
    return { data: null, error: { code: 'NOT_FOUND', message: 'Student profile not found.' } };
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('attendance')
    .select('*', { count: 'exact' })
    .eq('student_id', student.student_id)
    .order('attendance_date', { ascending: false })
    .range(from, to);

  if (error) {
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to load attendance records.' } };
  }

  return { data: { records: (data as DbAttendance[]) ?? [], total: count ?? 0 }, error: null };
}

export async function getTodayAttendance(): Promise<DbAttendance | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: student } = await supabase
    .from('students')
    .select('student_id')
    .eq('user_id', user.id)
    .single();

  if (!student) return null;

  const today = new Date().toISOString().split('T')[0];

  const { data } = await supabase
    .from('attendance')
    .select('*')
    .eq('student_id', student.student_id)
    .eq('attendance_date', today)
    .maybeSingle();

  return data as DbAttendance | null;
}
