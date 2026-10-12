import { getAttendanceIdentity } from './attendanceCache';
import * as Network from 'expo-network';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';
import { decodeBase64ToArrayBuffer } from './base64';
import { getOfflineQueue, removeOfflineQueueItem } from './offlineQueue';
import { syncAttendanceWorkflow, type QueuedAttendanceEvent } from './attendanceSyncWorkflow';

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
  item: QueuedAttendanceEvent
): Promise<string | null> {
  try {
    const { local_photo_uri: localUri, student_id: studentId, type } = item;
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

    // One stable object path per queued event lets retries reuse the same upload.
    const safeEventId = item.id.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${studentId}/${type}_offline_${safeEventId}.jpg`;

    const { data, error } = await supabase.storage
      .from('attendance-selfies')
      .upload(filename, arrayBuffer, { contentType: 'image/jpeg', upsert: true });

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

  return syncAttendanceWorkflow(queue, identity.student_id, {
    async findTimeIn(studentId, attendanceDate) {
      const { data, error } = await supabase.from('attendance')
        .select('attendance_id, time_in').eq('student_id', studentId)
        .eq('attendance_date', attendanceDate).maybeSingle();
      return { data, error };
    },
    async hasActiveAssignment(studentId, assignmentId) {
      const { data, error } = await supabase.from('student_assignments')
        .select('assignment_id').eq('assignment_id', assignmentId)
        .eq('student_id', studentId).eq('assignment_status', 'active').maybeSingle();
      return !error && Boolean(data);
    },
    uploadSelfie: item => uploadOfflineSelfie(item),
    async insertTimeIn(payload) {
      const { error } = await supabase.from('attendance').insert(payload).select('attendance_id').single();
      return { error };
    },
    async findTimeOut(item, studentId) {
      let query = supabase.from('attendance').select('attendance_id, time_out').eq('student_id', studentId);
      query = item.attendance_id && !item.attendance_id.startsWith('offline_')
        ? query.eq('attendance_id', item.attendance_id)
        : query.eq('attendance_date', item.attendance_date);
      const { data, error } = await query.maybeSingle();
      return { data, error };
    },
    async updateTimeOut(item, studentId, storagePath) {
      const updatedAt = new Date().toISOString();
      let query = supabase.from('attendance').update({
        time_out: item.captured_at,
        time_out_selfie_path: storagePath,
        sync_status: 'synced',
        time_out_lat: item.latitude ?? null,
        time_out_lng: item.longitude ?? null,
        time_out_distance_meters: item.distance_meters ?? null,
        time_out_location_status: item.location_status ?? 'verified',
        time_out_flag_reason: item.flag_reason ?? null,
        synced_at: updatedAt,
        updated_at: updatedAt,
      }).eq('student_id', studentId).is('time_out', null);
      if (item.attendance_id && !item.attendance_id.startsWith('offline_')) {
        query = query.eq('attendance_id', item.attendance_id);
      } else {
        query = query.eq('student_id', item.student_id).eq('attendance_date', item.attendance_date);
      }
      const { data, error } = await query.select('attendance_id').maybeSingle();
      return { updated: Boolean(data), error };
    },
    removeQueueItem: removeOfflineQueueItem,
    now: () => new Date().toISOString(),
  });
}
