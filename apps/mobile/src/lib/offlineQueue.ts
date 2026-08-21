import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';

const QUEUE_KEY = 'cdm_ojt_offline_attendance_queue';

export interface OfflineQueueItem {
  id: string;
  type: 'time_in' | 'time_out';
  student_id: string;
  assignment_id: string;
  attendance_id?: string;
  local_photo_uri: string;
  captured_at: string;
  attendance_date: string;
  created_at: string;
}

/**
 * Saves photo to app private document sandbox directory to avoid OS temp cache deletion.
 */
export async function saveImageToSandbox(sourceUri: string, filename: string): Promise<string> {
  const dir = `${FileSystem.documentDirectory}offline_selfies/`;
  const dirInfo = await FileSystem.getInfoAsync(dir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }

  const destination = `${dir}${filename}`;
  await FileSystem.copyAsync({ from: sourceUri, to: destination });
  return destination;
}

/**
 * Retrieves the entire offline queue from SecureStore.
 */
export async function getOfflineQueue(): Promise<OfflineQueueItem[]> {
  try {
    const raw = await SecureStore.getItemAsync(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as OfflineQueueItem[];
  } catch {
    return [];
  }
}

/**
 * Appends a new attendance action to the offline queue.
 */
export async function enqueueOfflineAttendance(
  item: Omit<OfflineQueueItem, 'id' | 'created_at'>
): Promise<OfflineQueueItem> {
  const queue = await getOfflineQueue();
  const newItem: OfflineQueueItem = {
    ...item,
    id: `offline_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    created_at: new Date().toISOString(),
  };

  queue.push(newItem);
  await SecureStore.setItemAsync(QUEUE_KEY, JSON.stringify(queue));
  return newItem;
}

/**
 * Removes a synced item from the offline queue and cleans up the sandboxed file.
 */
export async function removeOfflineQueueItem(id: string): Promise<void> {
  const queue = await getOfflineQueue();
  const item = queue.find(q => q.id === id);
  if (item && item.local_photo_uri) {
    try {
      const fileInfo = await FileSystem.getInfoAsync(item.local_photo_uri);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(item.local_photo_uri, { idempotent: true });
      }
    } catch {
      // Ignore file deletion errors
    }
  }

  const updated = queue.filter(q => q.id !== id);
  await SecureStore.setItemAsync(QUEUE_KEY, JSON.stringify(updated));
}

/**
 * Checks if there is a pending offline record for today for the given student.
 */
export async function getOfflineAttendanceForToday(student_id: string): Promise<OfflineQueueItem | null> {
  const queue = await getOfflineQueue();
  const today = new Date().toISOString().split('T')[0];
  const found = queue.find(q => q.student_id === student_id && q.attendance_date === today);
  return found || null;
}
