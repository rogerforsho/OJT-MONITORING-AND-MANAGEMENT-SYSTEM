import { getAttendanceIdentity } from './attendanceCache';
import * as Network from 'expo-network';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';
import { decodeBase64ToArrayBuffer } from './base64';
import { getOfflineQueue, removeOfflineQueueItem } from './offlineQueue';

export interface SyncResult {
  syncedCount: number;
  errors: string[];
}

/**
 * Checks if the device has an active, reachable internet connection.
 */
export async function isNetworkAvailable(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return Boolean(state.isConnected && state.isInternetReachable !== false);
  } catch {
    return false;
  }
}

/**
 * Uploads a local sandboxed selfie file to Supabase Storage.
 */
async function uploadOfflineSelfie(
  localUri: string,
  studentId: string,
  type: 'time_in' | 'time_out'
): Promise<string | null> {
  try {
    let arrayBuffer: ArrayBuffer;
    const isBase64 =
      localUri.startsWith('data:') ||
      localUri.startsWith('/9j/') ||
      (!localUri.startsWith('file://') && !localUri.startsWith('content://') && localUri.length > 500);

    if (isBase64) {
      arrayBuffer = decodeBase64ToArrayBuffer(localUri);
    } else if (localUri.startsWith('file://') || localUri.startsWith('content://') || localUri.startsWith('/')) {
      const uriToRead = localUri.startsWith('/') ? `file://${localUri}` : localUri;
      const base64 = await FileSystem.readAsStringAsync(uriToRead, {
        encoding: 'base64',
      });
      arrayBuffer = decodeBase64ToArrayBuffer(base64);
    } else {
      // Direct base64 string or data URL
      arrayBuffer = decodeBase64ToArrayBuffer(localUri);
    }

    const filename = `${studentId}/${type}_offline_${Date.now()}.jpg`;

    const { data, error } = await supabase.storage
      .from('attendance-selfies')
      .upload(filename, arrayBuffer, { contentType: 'image/jpeg', upsert: false });

    if (error || !data) {
      console.error('[uploadOfflineSelfie] Storage upload error:', error);
      return null;
    }
    return data.path;
  } catch (err) {
    console.error('[uploadOfflineSelfie] Exception:', err);
    return null;
  }
}

/**
 * Processes all pending items in the offline queue and uploads them to Supabase.
 */
let pendingSync: Promise<SyncResult> | null = null;

export function syncPendingOfflineAttendance(): Promise<SyncResult> {
  if (!pendingSync) {
    pendingSync = syncQueue().finally(() => { pendingSync = null; });
  }
  return pendingSync;
}

async function syncQueue(): Promise<SyncResult> {
  const online = await isNetworkAvailable();
  if (!online) {
    return { syncedCount: 0, errors: ['Network is currently offline.'] };
  }

  const identity = await getAttendanceIdentity(true);
  if (!identity) return { syncedCount: 0, errors: ['Sign in with an active student account before syncing.'] };
  const queue = (await getOfflineQueue()).filter(item => item.student_id === identity.student_id);
  if (queue.length === 0) {
    return { syncedCount: 0, errors: [] };
  }

  let syncedCount = 0;
  const errors: string[] = [];

  for (const item of queue) {
    try {
      if (item.type === 'time_in') {
        const { data: existing, error: lookupError } = await supabase.from('attendance')
          .select('attendance_id, time_in').eq('student_id', identity.student_id)
          .eq('attendance_date', item.attendance_date).maybeSingle();
        if (lookupError) { errors.push('Could not check existing attendance.'); continue; }
        if (existing) {
          if (new Date(existing.time_in).getTime() === new Date(item.captured_at).getTime()) {
            await removeOfflineQueueItem(item.id);
            syncedCount++;
          } else errors.push(`An attendance record already exists for ${item.attendance_date}.`);
          continue;
        }
        const { data: assignment, error: assignmentError } = await supabase.from('student_assignments')
          .select('assignment_id').eq('assignment_id', item.assignment_id)
          .eq('student_id', identity.student_id).eq('assignment_status', 'active').maybeSingle();
        if (assignmentError || !assignment) { errors.push('The queued assignment is no longer active.'); continue; }
        const storagePath = await uploadOfflineSelfie(item.local_photo_uri, item.student_id, 'time_in');
        if (!storagePath) {
          errors.push(`Failed to upload photo evidence for record on ${item.attendance_date}`);
          continue;
        }

        const { error: insertError } = await supabase
          .from('attendance')
          .insert({
            student_id: item.student_id,
            assignment_id: item.assignment_id,
            attendance_date: item.attendance_date,
            time_in: item.captured_at,
            time_in_selfie_path: storagePath,
            verification_status: 'pending',
            late_status: 'unknown',
            sync_status: 'synced',
            time_in_lat: item.latitude ?? null,
            time_in_lng: item.longitude ?? null,
            time_in_distance_meters: item.distance_meters ?? null,
            time_in_location_status: item.location_status ?? 'verified',
            time_in_flag_reason: item.flag_reason ?? null,
            synced_at: new Date().toISOString(),
          })
          .select('attendance_id')
          .single();

        if (insertError) {
          errors.push(`Failed to sync database record for ${item.attendance_date}: ${insertError.message}`);
          continue;
        }

        await removeOfflineQueueItem(item.id);
        syncedCount++;
      } else if (item.type === 'time_out') {
        let existingQuery = supabase.from('attendance')
          .select('attendance_id, time_out').eq('student_id', identity.student_id);
        existingQuery = item.attendance_id && !item.attendance_id.startsWith('offline_')
          ? existingQuery.eq('attendance_id', item.attendance_id)
          : existingQuery.eq('attendance_date', item.attendance_date);
        const { data: existing, error: lookupError } = await existingQuery.maybeSingle();
        if (lookupError || !existing) {
          errors.push(`No attendance record found for ${item.attendance_date}; Time Out remains queued.`);
          continue;
        }
        if (existing.time_out) {
          if (new Date(existing.time_out).getTime() === new Date(item.captured_at).getTime()) {
            await removeOfflineQueueItem(item.id);
            syncedCount++;
          } else errors.push(`A different Time Out already exists for ${item.attendance_date}.`);
          continue;
        }
        const storagePath = await uploadOfflineSelfie(item.local_photo_uri, item.student_id, 'time_out');
        if (!storagePath) {
          errors.push(`Failed to upload time out photo for record on ${item.attendance_date}`);
          continue;
        }

        let updateQuery = supabase
          .from('attendance')
          .update({
            time_out: item.captured_at,
            time_out_selfie_path: storagePath,
            sync_status: 'synced',
            time_out_lat: item.latitude ?? null,
            time_out_lng: item.longitude ?? null,
            time_out_distance_meters: item.distance_meters ?? null,
            time_out_location_status: item.location_status ?? 'verified',
            time_out_flag_reason: item.flag_reason ?? null,
            synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        updateQuery = updateQuery.eq('student_id', identity.student_id).is('time_out', null);
        if (item.attendance_id && !item.attendance_id.startsWith('offline_')) {
          updateQuery = updateQuery.eq('attendance_id', item.attendance_id);
        } else {
          updateQuery = updateQuery
            .eq('student_id', item.student_id)
            .eq('attendance_date', item.attendance_date);
        }

        const { data: updated, error: updateError } = await updateQuery.select('attendance_id').maybeSingle();
        if (updateError) {
          errors.push(`Failed to update time out for ${item.attendance_date}: ${updateError.message}`);
          continue;
        }

        if (!updated) {
          errors.push(`No open attendance record found for ${item.attendance_date}; Time Out remains queued.`);
          continue;
        }
        await removeOfflineQueueItem(item.id);
        syncedCount++;
      }
    } catch (err: any) {
      errors.push(err?.message || 'Unknown sync error');
    }
  }

  return { syncedCount, errors };
}
