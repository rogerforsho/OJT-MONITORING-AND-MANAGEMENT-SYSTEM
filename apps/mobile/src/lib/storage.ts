/**
 * Unified Mobile Media & Document Storage Service
 * Colegio de Montalban - OJT Practicum System
 *
 * Supports:
 * 1. Google Firebase Storage (100% Free Spark Plan - No Credit Card)
 * 2. Supabase Storage (Default / Current)
 *
 * Features automatic on-device compression before upload to keep storage
 * consumption negligible (<90KB per photo) and uploads instantaneous.
 */

import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';
import { decodeBase64ToArrayBuffer } from './base64';
import { optimizeSelfie, optimizeDocumentImage } from './imageOptimizer';
import type { AppResult } from '@ojt/shared';

// Environment variable for Firebase Storage (Optional: defaults to Supabase)
const FIREBASE_BUCKET = process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET;

function resolveMimeType(fileName: string, providedMime?: string): string {
  if (providedMime && providedMime !== 'application/octet-stream' && providedMime.includes('/')) {
    return providedMime;
  }
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'doc':
      return 'application/msword';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    default:
      return providedMime || 'application/pdf';
  }
}

async function convertSourceToArrayBuffer(source: string): Promise<ArrayBuffer> {
  // Remote HTTP/HTTPS URL
  if (source.startsWith('http://') || source.startsWith('https://')) {
    const response = await fetch(source);
    return await response.arrayBuffer();
  }

  // Local file URI or Android content URI
  if (source.startsWith('file://') || source.startsWith('content://')) {
    const base64 = await FileSystem.readAsStringAsync(source, {
      encoding: 'base64',
    });
    return decodeBase64ToArrayBuffer(base64);
  }

  // Raw base64 string or data URI
  return decodeBase64ToArrayBuffer(source);
}

/**
 * Upload an Attendance Selfie with on-device compression
 */
export async function uploadSelfieToStorage(
  imagePayload: string,
  studentId: string,
  type: 'time_in' | 'time_out'
): Promise<AppResult<{ path: string; url?: string }>> {
  const filename = `${studentId}/${type}_${Date.now()}.jpg`;

  try {
    let finalPayload = imagePayload;

    // If source is a local file URI, compress it first
    if (imagePayload.startsWith('file://') || imagePayload.startsWith('content://')) {
      const optimized = await optimizeSelfie(imagePayload, { includeBase64: true });
      finalPayload = optimized.base64 || optimized.uri;
    }

    const arrayBuffer = await convertSourceToArrayBuffer(finalPayload);

    // 1. If Firebase Storage Bucket is configured, upload via Firebase REST API
    if (FIREBASE_BUCKET) {
      const firebasePath = `attendance/${filename}`;
      const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${FIREBASE_BUCKET}/o?uploadType=media&name=${encodeURIComponent(
        firebasePath
      )}`;

      const fbRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'image/jpeg' },
        body: arrayBuffer,
      });

      if (fbRes.ok) {
        const fbData = await fbRes.json();
        const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${FIREBASE_BUCKET}/o/${encodeURIComponent(
          firebasePath
        )}?alt=media&token=${fbData.downloadTokens || ''}`;
        console.log('[uploadSelfieToStorage] Uploaded to Google Firebase Storage:', downloadUrl);
        return { data: { path: firebasePath, url: downloadUrl }, error: null };
      }
      console.warn('[uploadSelfieToStorage] Firebase upload failed, falling back to Supabase');
    }

    // 2. Default: Supabase Storage
    const { data, error } = await supabase.storage
      .from('attendance-selfies')
      .upload(filename, arrayBuffer, { contentType: 'image/jpeg', upsert: false });

    if (error) {
      console.error('[uploadSelfieToStorage] Supabase storage error:', error);
      return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to upload selfie evidence.' } };
    }

    return { data: { path: data.path }, error: null };
  } catch (err) {
    console.error('[uploadSelfieToStorage] Exception:', err);
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Error processing selfie image.' } };
  }
}

/**
 * Upload a Report Document (PDF, DOCX, or Scanned Image)
 */
export async function uploadReportToStorage(
  fileUri: string,
  fileName: string,
  studentId: string,
  mimeType: string = 'application/pdf'
): Promise<AppResult<{ path: string; url?: string }>> {
  try {
    let sourceUri = fileUri;
    const resolvedMime = resolveMimeType(fileName, mimeType);

    // If document is an image (scanned report), compress it on-device first
    if (resolvedMime.startsWith('image/')) {
      const optimized = await optimizeDocumentImage(fileUri);
      sourceUri = optimized.uri;
    }

    const cleanFileName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const storagePath = `${studentId}/${cleanFileName}`;

    const arrayBuffer = await convertSourceToArrayBuffer(sourceUri);

    // 1. If Firebase Storage Bucket is configured, upload via Firebase REST API
    if (FIREBASE_BUCKET) {
      const firebasePath = `reports/${storagePath}`;
      const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${FIREBASE_BUCKET}/o?uploadType=media&name=${encodeURIComponent(
        firebasePath
      )}`;

      const fbRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': resolvedMime },
        body: arrayBuffer,
      });

      if (fbRes.ok) {
        const fbData = await fbRes.json();
        const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${FIREBASE_BUCKET}/o/${encodeURIComponent(
          firebasePath
        )}?alt=media&token=${fbData.downloadTokens || ''}`;
        return { data: { path: firebasePath, url: downloadUrl }, error: null };
      }
    }

    // 2. Default: Supabase Storage
    const { data, error } = await supabase.storage
      .from('private-documents')
      .upload(storagePath, arrayBuffer, { contentType: resolvedMime, upsert: false });

    if (error) {
      console.error('[uploadReportToStorage] Storage upload error:', error);
      return { data: null, error: { code: 'SERVER_FAILURE', message: 'Failed to upload document.' } };
    }

    return { data: { path: data.path }, error: null };
  } catch (err) {
    console.error('[uploadReportToStorage] Exception:', err);
    return { data: null, error: { code: 'SERVER_FAILURE', message: 'Error processing report file.' } };
  }
}
