import * as Network from 'expo-network';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';
import { decodeBase64ToArrayBuffer } from './base64';
import { getOfflineQueue, removeOfflineQueueItem, type OfflineQueueItem } from './offlineQueue';

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
    if (localUri.startsWith('file://') || localUri.startsWith('content://') || localUri.startsWith('/')) {
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
export async function syncPendingOfflineAttendance(): Promise<SyncResult> {
  const online = await isNetworkAvailable();
  if (!online) {
    return { syncedCount: 0, errors: ['Network is currently offline.'] };
  }

  const queue = await getOfflineQueue();
  if (queue.length === 0) {
    return { syncedCount: 0, errors: [] };
  }

  let syncedCount = 0;
  const errors: string[] = [];

  for (const item of queue) {
    try {
      if (item.type === 'time_in') {
        const storagePath = await uploadOfflineSelfie(item.local_photo_uri, item.student_id, 'time_in');
        if (!storagePath) {
          errors.push(`Failed to upload photo evidence for record on ${item.attendance_date}`);
          continue;
        }

        const { data: inserted, error: insertError } = await supabase
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

        if (item.attendance_id && item.attendance_id !== 'offline_pending') {
          updateQuery = updateQuery.eq('attendance_id', item.attendance_id);
        } else {
          updateQuery = updateQuery
            .eq('student_id', item.student_id)
            .eq('attendance_date', item.attendance_date);
        }

        const { error: updateError } = await updateQuery;
        if (updateError) {
          errors.push(`Failed to update time out for ${item.attendance_date}: ${updateError.message}`);
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
