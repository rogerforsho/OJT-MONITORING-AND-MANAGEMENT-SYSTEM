import { supabase } from '../lib/supabase';
import { File, Directory, Paths } from 'expo-file-system';
import * as Network from 'expo-network';
import type { AppResult, DbAttendance, OfflineAttendanceEvent } from '@ojt/shared';

const QUEUE_FILE = new File(Paths.document, 'offline_attendance_queue.json');

// ─── Offline Queue ────────────────────────────────────────────────────────────

async function readQueue(): Promise<OfflineAttendanceEvent[]> {
  try {
    if (!QUEUE_FILE.exists) return [];
    const raw = await QUEUE_FILE.text();
    return JSON.parse(raw) as OfflineAttendanceEvent[];
  } catch {
    return [];
  }
}

async function writeQueue(queue: OfflineAttendanceEvent[]): Promise<void> {
  await QUEUE_FILE.write(JSON.stringify(queue));
}

async function addToQueue(event: OfflineAttendanceEvent): Promise<void> {
  const queue = await readQueue();
  queue.push(event);
  await writeQueue(queue);
}

export async function getPendingQueueCount(): Promise<number> {
  const queue = await readQueue();
  return queue.length;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

async function uploadSelfie(
  localUri: string,
  student_id: string,
  type: 'time_in' | 'time_out'
): Promise<AppResult<{ path: string }>> {
  const filename = `${student_id}/${type}_${Date.now()}.jpg`;

  const response = await fetch(localUri);
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();

  const { data, error } = await supabase.storage
    .from('attendance-selfies')
    .upload(filename, arrayBuffer, { contentType: 'image/jpeg', upsert: false });

  if (error)
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to upload selfie.' } };

  return { data: { path: data.path }, error: null };
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

// ─── QR Validation ────────────────────────────────────────────────────────────

async function validateQrOnline(token: string, company_id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('qr_tokens')
    .select('token_id, expires_at, used, company_id')
    .eq('token', token)
    .maybeSingle();

  if (error || !data || data.used || data.company_id !== company_id) return false;
  if (new Date(data.expires_at) < new Date()) return false;

  await supabase.from('qr_tokens').update({ used: true }).eq('token_id', data.token_id);
  return true;
}

// ─── Time In ──────────────────────────────────────────────────────────────────

export async function recordTimeIn(
  selfie_uri: string,
  qr_token: string
): Promise<AppResult<{ attendance_id: string; offline: boolean }>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user)
    return { data: null, error: { code: 'UNAUTHORIZED', message: 'Not authenticated.' } };

  const { data: student } = await supabase
    .from('students')
    .select('student_id')
    .eq('user_id', user.id)
    .single();

  if (!student)
    return { data: null, error: { code: 'NOT_FOUND', message: 'Student profile not found.' } };

  const { data: assignment } = await supabase
    .from('student_assignments')
    .select('assignment_id, company_id')
    .eq('student_id', student.student_id)
    .eq('assignment_status', 'active')
    .maybeSingle();

  if (!assignment)
    return { data: null, error: { code: 'NOT_FOUND', message: 'No active assignment found.' } };

  const today = new Date().toISOString().split('T')[0];
  const dayOfWeek = new Date().getDay();

  // Weekend check per FR-ATT-005
  if (dayOfWeek === 0 || dayOfWeek === 6)
    return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Attendance is not allowed on weekends.' } };

  // Duplicate check per FR-ATT-003
  const { data: existing } = await supabase
    .from('attendance')
    .select('attendance_id')
    .eq('student_id', student.student_id)
    .eq('attendance_date', today)
    .maybeSingle();

  if (existing)
    return { data: null, error: { code: 'DUPLICATE_REQUEST', message: 'You already have an attendance record for today.' } };

  const networkState = await Network.getNetworkStateAsync();
  const isOnline = networkState.isConnected && networkState.isInternetReachable;
  const capturedAt = new Date().toISOString();

  if (!isOnline) {
    await addToQueue({
      type: 'time_in',
      student_id: student.student_id,
      assignment_id: assignment.assignment_id,
      attendance_date: today,
      captured_at: capturedAt,
      selfie_local_path: selfie_uri,
      qr_token,
    });
    return { data: { attendance_id: '', offline: true }, error: null };
  }

  const qrValid = await validateQrOnline(qr_token, assignment.company_id);
  if (!qrValid)
    return { data: null, error: { code: 'INVALID_QR', message: 'Invalid or expired QR code.' } };

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

  if (error)
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to record Time In.' } };

  return { data: { attendance_id: record.attendance_id, offline: false }, error: null };
}

// ─── Time Out ─────────────────────────────────────────────────────────────────

export async function recordTimeOut(
  attendance_id: string,
  selfie_uri: string
): Promise<AppResult<{ offline: boolean }>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user)
    return { data: null, error: { code: 'UNAUTHORIZED', message: 'Not authenticated.' } };

  const { data: student } = await supabase
    .from('students')
    .select('student_id')
    .eq('user_id', user.id)
    .single();

  if (!student)
    return { data: null, error: { code: 'NOT_FOUND', message: 'Student profile not found.' } };

  // IDOR check
  const { data: record } = await supabase
    .from('attendance')
    .select('attendance_id, student_id, time_out, assignment_id')
    .eq('attendance_id', attendance_id)
    .eq('student_id', student.student_id)
    .single();

  if (!record)
    return { data: null, error: { code: 'NOT_FOUND', message: 'Attendance record not found.' } };

  if (record.time_out)
    return { data: null, error: { code: 'DUPLICATE_REQUEST', message: 'Time Out already recorded.' } };

  const capturedAt = new Date().toISOString();
  const networkState = await Network.getNetworkStateAsync();
  const isOnline = networkState.isConnected && networkState.isInternetReachable;

  if (!isOnline) {
    // Cannot queue Time Out if the Time In itself hasn't synced yet (no server attendance_id)
    if (!attendance_id)
      return { data: null, error: { code: 'VALIDATION_FAILURE', message: 'Time In is still pending sync. Connect to the internet to sync first.' } };
    const today = new Date().toISOString().split('T')[0];
    await addToQueue({
      type: 'time_out',
      student_id: student.student_id,
      assignment_id: record.assignment_id,
      attendance_date: today,
      captured_at: capturedAt,
      selfie_local_path: selfie_uri,
      attendance_id,
    });
    return { data: { offline: true }, error: null };
  }

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

  if (error)
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to record Time Out.' } };

  return { data: { offline: false }, error: null };
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

export async function syncOfflineQueue(): Promise<{ synced: number; failed: number; conflicts: number }> {
  const queue = await readQueue();
  if (queue.length === 0) return { synced: 0, failed: 0, conflicts: 0 };

  const networkState = await Network.getNetworkStateAsync();
  if (!networkState.isConnected || !networkState.isInternetReachable)
    return { synced: 0, failed: 0, conflicts: 0 };

  let synced = 0, failed = 0, conflicts = 0;
  const remaining: OfflineAttendanceEvent[] = [];

  for (const event of queue) {
    try {
      if (event.type === 'time_in') {
        const { data: existing } = await supabase
          .from('attendance')
          .select('attendance_id')
          .eq('student_id', event.student_id)
          .eq('attendance_date', event.attendance_date)
          .maybeSingle();

        if (existing) {
          // Conflict — do not silently overwrite per FR-ATT-010
          await supabase
            .from('attendance')
            .update({ sync_status: 'conflict' })
            .eq('attendance_id', existing.attendance_id);
          conflicts++;
          continue;
        }

        const dayOfWeek = new Date(event.attendance_date).getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) { failed++; continue; }

        const selfieResult = await uploadSelfie(event.selfie_local_path, event.student_id, 'time_in');
        if (selfieResult.error) { remaining.push(event); failed++; continue; }

        const { data: assignmentData } = await supabase
          .from('student_assignments')
          .select('company_id')
          .eq('assignment_id', event.assignment_id)
          .single();

        let qr_validation_status: 'valid' | 'invalid' | 'expired' = 'invalid';
        if (event.qr_token && assignmentData) {
          const valid = await validateQrOnline(event.qr_token, assignmentData.company_id);
          qr_validation_status = valid ? 'valid' : 'expired';
        }

        const late_status = assignmentData
          ? await determineLateStatus(assignmentData.company_id, new Date(event.captured_at))
          : 'unknown';

        const { error } = await supabase.from('attendance').insert({
          student_id: event.student_id,
          assignment_id: event.assignment_id,
          attendance_date: event.attendance_date,
          time_in: event.captured_at,
          time_in_selfie_path: selfieResult.data!.path,
          qr_validation_status,
          verification_status: 'pending',
          late_status,
          sync_status: 'synced',
        });

        if (error) { remaining.push(event); failed++; } else { synced++; }

      } else if (event.type === 'time_out' && event.attendance_id) {
        const { data: record } = await supabase
          .from('attendance')
          .select('time_out')
          .eq('attendance_id', event.attendance_id)
          .single();

        if (!record) { failed++; continue; }
        if (record.time_out) { conflicts++; continue; }

        const selfieResult = await uploadSelfie(event.selfie_local_path, event.student_id, 'time_out');
        if (selfieResult.error) { remaining.push(event); failed++; continue; }

        const { error } = await supabase
          .from('attendance')
          .update({
            time_out: event.captured_at,
            time_out_selfie_path: selfieResult.data!.path,
            sync_status: 'synced',
            updated_at: new Date().toISOString(),
          })
          .eq('attendance_id', event.attendance_id);

        if (error) { remaining.push(event); failed++; } else { synced++; }
      }
    } catch {
      remaining.push(event);
      failed++;
    }
  }

  await writeQueue(remaining);
  return { synced, failed, conflicts };
}

// ─── Fetch own attendance ─────────────────────────────────────────────────────

export async function fetchOwnAttendance(
  page = 1,
  pageSize = 20
): Promise<AppResult<{ records: DbAttendance[]; total: number }>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user)
    return { data: null, error: { code: 'UNAUTHORIZED', message: 'Not authenticated.' } };

  const { data: student } = await supabase
    .from('students')
    .select('student_id')
    .eq('user_id', user.id)
    .single();

  if (!student)
    return { data: null, error: { code: 'NOT_FOUND', message: 'Student profile not found.' } };

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('attendance')
    .select('*', { count: 'exact' })
    .eq('student_id', student.student_id)
    .order('attendance_date', { ascending: false })
    .range(from, to);

  if (error)
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to load attendance.' } };

  return { data: { records: data as DbAttendance[], total: count ?? 0 }, error: null };
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
