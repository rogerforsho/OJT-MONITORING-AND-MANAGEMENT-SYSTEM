import { supabase } from '../lib/supabase';
import { isNetworkAvailable } from '../lib/syncEngine';
import { uploadSelfieToStorage } from '../lib/storage';
import {
  saveImageToSandbox,
  enqueueOfflineAttendance,
  getOfflineAttendanceForToday,
} from '../lib/offlineQueue';
import type { AppResult, DbAttendance } from '@ojt/shared';

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

import * as SecureStore from 'expo-secure-store';

const CACHED_ASSIGNMENT_KEY = 'cdm_ojt_cached_assignment';

export interface CachedCompanyAssignment {
  assignment_id: string;
  company_id: string;
  company_name: string;
  latitude: number | null;
  longitude: number | null;
  geofence_radius_meters: number;
  geofence_enabled: boolean;
}

export interface LocationPayload {
  latitude?: number | null;
  longitude?: number | null;
  distanceMeters?: number | null;
  locationStatus?: 'verified' | 'flagged_out_of_bounds' | 'location_unavailable' | 'not_applicable';
  flagReason?: string | null;
  satelliteTimestamp?: string | null;
}

export async function getActiveAssignment(): Promise<CachedCompanyAssignment | null> {
  try {
    const online = await isNetworkAvailable();
    if (online) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: student } = await supabase
          .from('students')
          .select('student_id')
          .eq('user_id', user.id)
          .single();

        if (student) {
          const { data: assignment } = await supabase
            .from('student_assignments')
            .select(`
              assignment_id,
              company_id,
              companies (
                company_name,
                latitude,
                longitude,
                geofence_radius_meters,
                geofence_enabled
              )
            `)
            .eq('student_id', student.student_id)
            .eq('assignment_status', 'active')
            .maybeSingle();

          if (assignment && assignment.companies) {
            const comp = assignment.companies as any;
            const result: CachedCompanyAssignment = {
              assignment_id: assignment.assignment_id,
              company_id: assignment.company_id,
              company_name: comp.company_name,
              latitude: comp.latitude ?? null,
              longitude: comp.longitude ?? null,
              geofence_radius_meters: comp.geofence_radius_meters ?? 150,
              geofence_enabled: comp.geofence_enabled ?? false,
            };
            await SecureStore.setItemAsync(CACHED_ASSIGNMENT_KEY, JSON.stringify(result));
            return result;
          }
        }
      }
    }
  } catch {
    // Ignore network errors and try cache
  }

  // Fallback to locally cached assignment
  try {
    const cached = await SecureStore.getItemAsync(CACHED_ASSIGNMENT_KEY);
    if (cached) {
      return JSON.parse(cached) as CachedCompanyAssignment;
    }
  } catch {
    // Ignore cache errors
  }
  return null;
}

// ─── Time In ──────────────────────────────────────────────────────────────────

export async function recordTimeIn(
  selfie_uri: string,
  locationData?: LocationPayload
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

  const assignment = await getActiveAssignment();
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
  const capturedAt = locationData?.satelliteTimestamp || new Date().toISOString();

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
        latitude: locationData?.latitude ?? null,
        longitude: locationData?.longitude ?? null,
        distance_meters: locationData?.distanceMeters ?? null,
        location_status: locationData?.locationStatus ?? 'verified',
        flag_reason: locationData?.flagReason ?? null,
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

  const selfieResult = await uploadSelfieToStorage(selfie_uri, student.student_id, 'time_in');
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
        latitude: locationData?.latitude ?? null,
        longitude: locationData?.longitude ?? null,
        distance_meters: locationData?.distanceMeters ?? null,
        location_status: locationData?.locationStatus ?? 'verified',
        flag_reason: locationData?.flagReason ?? null,
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
      time_in_lat: locationData?.latitude ?? null,
      time_in_lng: locationData?.longitude ?? null,
      time_in_distance_meters: locationData?.distanceMeters ?? null,
      time_in_location_status: locationData?.locationStatus ?? 'verified',
      time_in_flag_reason: locationData?.flagReason ?? null,
      synced_at: new Date().toISOString(),
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
  selfie_uri: string,
  locationData?: LocationPayload
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
  const capturedAt = locationData?.satelliteTimestamp || new Date().toISOString();
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
        latitude: locationData?.latitude ?? null,
        longitude: locationData?.longitude ?? null,
        distance_meters: locationData?.distanceMeters ?? null,
        location_status: locationData?.locationStatus ?? 'verified',
        flag_reason: locationData?.flagReason ?? null,
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

  const selfieResult = await uploadSelfieToStorage(selfie_uri, student.student_id, 'time_out');
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
        latitude: locationData?.latitude ?? null,
        longitude: locationData?.longitude ?? null,
        distance_meters: locationData?.distanceMeters ?? null,
        location_status: locationData?.locationStatus ?? 'verified',
        flag_reason: locationData?.flagReason ?? null,
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
      time_out_lat: locationData?.latitude ?? null,
      time_out_lng: locationData?.longitude ?? null,
      time_out_distance_meters: locationData?.distanceMeters ?? null,
      time_out_location_status: locationData?.locationStatus ?? 'verified',
      time_out_flag_reason: locationData?.flagReason ?? null,
      synced_at: new Date().toISOString(),
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
