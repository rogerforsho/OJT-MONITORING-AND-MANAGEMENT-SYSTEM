import { supabase } from '../lib/supabase';
import { decodeBase64ToArrayBuffer } from '../lib/base64';
import { isNetworkAvailable } from '../lib/syncEngine';
import {
  saveImageToSandbox,
  enqueueOfflineAttendance,
  getOfflineAttendanceForToday,
} from '../lib/offlineQueue';
import type { AppResult, DbAttendance } from '@ojt/shared';

// ─── Storage ──────────────────────────────────────────────────────────────────

async function uploadSelfie(
  imagePayload: string,
  student_id: string,
  type: 'time_in' | 'time_out'
): Promise<AppResult<{ path: string }>> {
  const filename = `${student_id}/${type}_${Date.now()}.jpg`;

  try {
    let arrayBuffer: ArrayBuffer;

    if (imagePayload.startsWith('file://') || imagePayload.startsWith('http')) {
      const response = await fetch(imagePayload);
      const blob = await response.blob();
      arrayBuffer = await blob.arrayBuffer();
    } else {
      arrayBuffer = decodeBase64ToArrayBuffer(imagePayload);
    }

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

  try {
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
  } catch {
    return 'unknown';
  }
}

// ─── Time In ──────────────────────────────────────────────────────────────────

export async function recordTimeIn(
  selfie_uri: string
): Promise<AppResult<{ attendance_id: string; isOffline?: boolean }>> {
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

  const online = await isNetworkAvailable();
  const capturedAt = new Date().toISOString();

  // If OFFLINE: queue locally
  if (!online) {
    try {
      const savedPath = await saveImageToSandbox(selfie_uri, `time_in_${Date.now()}.jpg`);
      await enqueueOfflineAttendance({
        type: 'time_in',
        student_id: student.student_id,
        assignment_id: assignment.assignment_id,
        local_photo_uri: savedPath,
        captured_at: capturedAt,
        attendance_date: today,
      });
      return { data: { attendance_id: 'offline_pending', isOffline: true }, error: null };
    } catch {
      return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to save offline attendance.' } };
    }
  }

  // Duplicate check when online
  const { data: existing } = await supabase
    .from('attendance')
    .select('attendance_id')
    .eq('student_id', student.student_id)
    .eq('attendance_date', today)
    .maybeSingle();

  if (existing) {
    return { data: null, error: { code: 'DUPLICATE_REQUEST', message: 'You already have an attendance record for today.' } };
  }

  const selfieResult = await uploadSelfie(selfie_uri, student.student_id, 'time_in');
  if (selfieResult.error) {
    // Fallback to offline queue if upload fails due to network drop
    try {
      const savedPath = await saveImageToSandbox(selfie_uri, `time_in_${Date.now()}.jpg`);
      await enqueueOfflineAttendance({
        type: 'time_in',
        student_id: student.student_id,
        assignment_id: assignment.assignment_id,
        local_photo_uri: savedPath,
        captured_at: capturedAt,
        attendance_date: today,
      });
      return { data: { attendance_id: 'offline_pending', isOffline: true }, error: null };
    } catch {
      return { data: null, error: selfieResult.error };
    }
  }

  const late_status = await determineLateStatus(assignment.company_id, new Date(capturedAt));

  const { data: record, error } = await supabase
    .from('attendance')
    .insert({
      student_id: student.student_id,
      assignment_id: assignment.assignment_id,
      attendance_date: today,
      time_in: capturedAt,
      time_in_selfie_path: selfieResult.data!.path,
      verification_status: 'pending',
      late_status,
      sync_status: 'synced',
    })
    .select('attendance_id')
    .single();

  if (error) {
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to record Time In.' } };
  }

  return { data: { attendance_id: record.attendance_id, isOffline: false }, error: null };
}

// ─── Time Out ─────────────────────────────────────────────────────────────────

export async function recordTimeOut(
  attendance_id: string,
  selfie_uri: string
): Promise<AppResult<{ isOffline?: boolean }>> {
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

  const today = new Date().toISOString().split('T')[0];
  const capturedAt = new Date().toISOString();
  const online = await isNetworkAvailable();

  // If OFFLINE: queue locally
  if (!online || attendance_id === 'offline_pending') {
    try {
      const savedPath = await saveImageToSandbox(selfie_uri, `time_out_${Date.now()}.jpg`);
      await enqueueOfflineAttendance({
        type: 'time_out',
        student_id: student.student_id,
        assignment_id: '',
        attendance_id: attendance_id !== 'offline_pending' ? attendance_id : undefined,
        local_photo_uri: savedPath,
        captured_at: capturedAt,
        attendance_date: today,
      });
      return { data: { isOffline: true }, error: null };
    } catch {
      return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to save offline Time Out.' } };
    }
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

  const selfieResult = await uploadSelfie(selfie_uri, student.student_id, 'time_out');
  if (selfieResult.error) {
    try {
      const savedPath = await saveImageToSandbox(selfie_uri, `time_out_${Date.now()}.jpg`);
      await enqueueOfflineAttendance({
        type: 'time_out',
        student_id: student.student_id,
        assignment_id: '',
        attendance_id,
        local_photo_uri: savedPath,
        captured_at: capturedAt,
        attendance_date: today,
      });
      return { data: { isOffline: true }, error: null };
    } catch {
      return { data: null, error: selfieResult.error };
    }
  }

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

  return { data: { isOffline: false }, error: null };
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

  try {
    const { data, error, count } = await supabase
      .from('attendance')
      .select('attendance_id, student_id, assignment_id, attendance_date, time_in, time_out, time_in_selfie_path, time_out_selfie_path, verification_status, late_status, sync_status, created_at, updated_at', { count: 'exact' })
      .eq('student_id', student.student_id)
      .order('attendance_date', { ascending: false })
      .range(from, to);

    if (error) {
      return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to load attendance records.' } };
    }

    return { data: { records: (data as DbAttendance[]) ?? [], total: count ?? 0 }, error: null };
  } catch {
    return { data: { records: [], total: 0 }, error: null };
  }
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

  try {
    const { data } = await supabase
      .from('attendance')
      .select('attendance_id, student_id, assignment_id, attendance_date, time_in, time_out, time_in_selfie_path, time_out_selfie_path, verification_status, late_status, sync_status, created_at, updated_at')
      .eq('student_id', student.student_id)
      .eq('attendance_date', today)
      .maybeSingle();

    if (data) return data as DbAttendance;
  } catch {
    // Check offline queue
  }

  // Check offline queue fallback
  const offlineItem = await getOfflineAttendanceForToday(student.student_id);
  if (offlineItem) {
    return {
      attendance_id: offlineItem.id,
      student_id: offlineItem.student_id,
      assignment_id: offlineItem.assignment_id,
      attendance_date: offlineItem.attendance_date,
      time_in: offlineItem.captured_at,
      time_out: null,
      time_in_selfie_path: offlineItem.local_photo_uri,
      time_out_selfie_path: null,
      verification_status: 'pending',
      late_status: 'unknown',
      sync_status: 'pending_sync',
      created_at: offlineItem.created_at,
      updated_at: offlineItem.created_at,
    } as DbAttendance;
  }

  return null;
}
