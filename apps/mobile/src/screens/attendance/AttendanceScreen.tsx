import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  ScrollView, StyleSheet,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { recordTimeIn, recordTimeOut, getTodayAttendance } from '../../services/attendance';
import { syncPendingOfflineAttendance, isNetworkAvailable } from '../../lib/syncEngine';
import { getOfflineQueue, type OfflineQueueItem } from '../../lib/offlineQueue';
import NetworkToast from '../../components/NetworkToast';
import type { DbAttendance } from '@ojt/shared';

type Step = 'idle' | 'selfie' | 'submitting';

export default function AttendanceScreen() {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [step, setStep] = useState<Step>('idle');
  const [todayRecord, setTodayRecord] = useState<DbAttendance | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [offlineCount, setOfflineCount] = useState(0);
  const [isOffline, setIsOffline] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mode, setMode] = useState<'time_in' | 'time_out'>('time_in');
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    loadState();
    checkOfflineStatus();
  }, []);

  async function checkOfflineStatus() {
    const online = await isNetworkAvailable();
    setIsOffline(!online);
    const queue = await getOfflineQueue();
    setOfflineCount(queue.length);

    // Auto-sync if online and queue has items
    if (online && queue.length > 0) {
      await handleSync();
    }
  }

  async function loadState() {
    setLoading(true);
    const record = await getTodayAttendance();
    setTodayRecord(record);
    const queue = await getOfflineQueue();
    setOfflineCount(queue.length);
    setLoading(false);
  }

  async function handleSync() {
    setSyncing(true);
    setError('');
    const res = await syncPendingOfflineAttendance();
    setSyncing(false);
    if (res.syncedCount > 0) {
      setSuccess(`✅ Successfully synchronized ${res.syncedCount} offline attendance record(s) with CdM servers.`);
      await loadState();
    } else if (res.errors.length > 0 && isOffline) {
      setError(res.errors[0]);
    }
  }

  function startTimeIn() {
    setError('');
    setSuccess('');
    setMode('time_in');
    setStep('selfie');
  }

  function startTimeOut() {
    setError('');
    setSuccess('');
    setMode('time_out');
    setStep('selfie');
  }

  async function captureSelfie() {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.6, base64: true });
      if (!photo) return;
      await submitAttendance(photo.base64 || photo.uri);
    } catch {
      setError('Failed to capture selfie. Please try again.');
      setStep('idle');
    }
  }

  async function submitAttendance(imagePayload: string) {
    setStep('submitting');
    setError('');

    let result;
    if (mode === 'time_in') {
      result = await recordTimeIn(imagePayload);
    } else {
      if (!todayRecord?.attendance_id) {
        setError('No Time In record found for today.');
        setStep('idle');
        return;
      }
      result = await recordTimeOut(todayRecord.attendance_id, imagePayload);
    }

    if (result.error) {
      setError(result.error.message);
      setStep('idle');
      return;
    }

    if (result.data?.isOffline) {
      setSuccess(
        mode === 'time_in'
          ? '📁 Time In recorded offline. Photo and timestamp saved locally and will auto-sync when online.'
          : '📁 Time Out recorded offline. Photo and timestamp saved locally and will auto-sync when online.'
      );
    } else {
      setSuccess(
        mode === 'time_in'
          ? '✅ Time In recorded successfully with selfie evidence.'
          : '✅ Time Out recorded successfully with selfie evidence.'
      );
    }

    setStep('idle');
    await loadState();
  }

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#0A3D24" />
      </View>
    );
  }

  // Selfie capture step
  if (step === 'selfie') {
    if (!permission?.granted) {
      return (
        <View style={[s.permissionContainer, { paddingTop: insets.top }]}>
          <Text style={s.permissionIcon}>📷</Text>
          <Text style={s.permissionTitle}>Camera Access Required</Text>
          <Text style={s.permissionText}>
            Camera permission is required to capture your front-camera attendance selfie evidence.
          </Text>
          <TouchableOpacity onPress={requestPermission} style={s.btnPrimary}>
            <Text style={s.btnPrimaryText}>Grant Camera Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setStep('idle')} style={s.btnCancel}>
            <Text style={s.btnCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={s.cameraContainer}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />
        <View style={s.cameraOverlay}>
          <Text style={s.cameraTag}>
            Capture Selfie for {mode === 'time_in' ? 'Time In' : 'Time Out'}
          </Text>
          <TouchableOpacity onPress={captureSelfie} style={s.shutterOuter} activeOpacity={0.8}>
            <View style={s.shutterInner} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => setStep('idle')} style={[s.backBtn, { top: Math.max(insets.top + 10, 40) }]}>
          <Text style={s.backBtnText}>← Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Submitting step
  if (step === 'submitting') {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#0A3D24" />
        <Text style={s.submittingText}>
          {isOffline ? 'Saving selfie & recording offline timestamp...' : 'Uploading selfie & recording attendance...'}
        </Text>
      </View>
    );
  }

  // Main screen view
  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <Text style={s.headerKicker}>Colegio de Montalban OJT</Text>
          <Text style={s.headerTitle}>Daily Attendance</Text>
          <Text style={s.headerDate}>
            {new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </Text>
        </View>

        {/* Offline Queue Banner */}
        {offlineCount > 0 && (
          <View style={s.offlineBanner}>
            <View style={s.offlineBannerTextCol}>
              <Text style={s.offlineBannerTitle}>📁 {offlineCount} Pending Offline Record(s)</Text>
              <Text style={s.offlineBannerSub}>Saved locally. Will synchronize automatically once connected.</Text>
            </View>
            <TouchableOpacity
              onPress={handleSync}
              disabled={syncing}
              style={s.syncBtn}
              activeOpacity={0.8}
            >
              {syncing ? (
                <ActivityIndicator size="small" color="#0A3D24" />
              ) : (
                <Text style={s.syncBtnText}>Sync Now</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Success / Error Messages */}
        {!!success && (
          <View style={s.alertSuccess}>
            <Text style={s.alertSuccessText}>{success}</Text>
          </View>
        )}
        {!!error && (
          <View style={s.alertError}>
            <Text style={s.alertErrorText}>{error}</Text>
          </View>
        )}

        {/* Today's status card */}
        <View style={s.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <Text style={s.cardHeading}>Today&apos;s Status</Text>
            {todayRecord?.sync_status === 'pending_sync' && (
              <View style={s.offlineTag}>
                <Text style={s.offlineTagText}>Offline Stored</Text>
              </View>
            )}
          </View>
          
          {todayRecord ? (
            <View style={s.statusList}>
              <View style={s.statusRow}>
                <Text style={s.statusLabel}>Time In</Text>
                <Text style={s.statusValue}>
                  {new Date(todayRecord.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              <View style={s.statusRow}>
                <Text style={s.statusLabel}>Time Out</Text>
                <Text style={[s.statusValue, !todayRecord.time_out && s.textMuted]}>
                  {todayRecord.time_out
                    ? new Date(todayRecord.time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : 'Pending'}
                </Text>
              </View>
              <View style={s.statusRow}>
                <Text style={s.statusLabel}>Punctuality</Text>
                <View style={[s.badge, todayRecord.late_status === 'late' ? s.badgeRed : s.badgeGreen]}>
                  <Text style={[s.badgeText, todayRecord.late_status === 'late' ? s.badgeTextRed : s.badgeTextGreen]}>
                    {todayRecord.late_status.replace('_', ' ')}
                  </Text>
                </View>
              </View>
              <View style={s.statusRow}>
                <Text style={s.statusLabel}>Supervisor Verification</Text>
                <View style={[
                  s.badge,
                  todayRecord.verification_status === 'verified' ? s.badgeGreen :
                  todayRecord.verification_status === 'rejected' ? s.badgeRed : s.badgeAmber
                ]}>
                  <Text style={[
                    s.badgeText,
                    todayRecord.verification_status === 'verified' ? s.badgeTextGreen :
                    todayRecord.verification_status === 'rejected' ? s.badgeTextRed : s.badgeTextAmber
                  ]}>
                    {todayRecord.verification_status}
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={s.emptyBox}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>🕒</Text>
              <Text style={s.emptyText}>No attendance recorded yet today.</Text>
            </View>
          )}
        </View>

        {/* Action buttons */}
        <View style={s.actionSection}>
          {!todayRecord && (
            <TouchableOpacity onPress={startTimeIn} style={s.btnTimeIn} activeOpacity={0.85}>
              <Text style={s.btnTimeInText}>📷 Time In</Text>
              <Text style={s.btnSubtext}>
                {isOffline ? 'Will record offline selfie evidence' : 'Front-camera selfie evidence required'}
              </Text>
            </TouchableOpacity>
          )}

          {todayRecord && !todayRecord.time_out && (
            <TouchableOpacity onPress={startTimeOut} style={s.btnTimeOut} activeOpacity={0.85}>
              <Text style={s.btnTimeOutText}>📷 Time Out</Text>
              <Text style={s.btnSubtextMuted}>
                {isOffline ? 'Will record offline selfie evidence' : 'Front-camera selfie evidence required'}
              </Text>
            </TouchableOpacity>
          )}

          {todayRecord?.time_out && (
            <View style={s.completeCard}>
              <Text style={s.completeTitle}>✅ Attendance Complete</Text>
              <Text style={s.completeSub}>Both Time In and Time Out recorded for today</Text>
            </View>
          )}
        </View>
      </ScrollView>
      <NetworkToast isOffline={isOffline} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f4f6f9' },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: '#f4f6f9', alignItems: 'center', justifyContent: 'center', gap: 12 },
  header: { marginBottom: 20 },
  headerKicker: { fontSize: 11, fontWeight: '800', color: '#0A3D24', textTransform: 'uppercase', letterSpacing: 0.5 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#062415' },
  headerDate: { fontSize: 12, color: '#64748b', marginTop: 2 },
  offlineBanner: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fef3c7',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  offlineBannerTextCol: { flex: 1 },
  offlineBannerTitle: { fontSize: 13, fontWeight: '800', color: '#92400e' },
  offlineBannerSub: { fontSize: 11, color: '#b45309', marginTop: 2 },
  syncBtn: {
    backgroundColor: '#FFCC00',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncBtnText: { color: '#062415', fontSize: 12, fontWeight: '800' },
  offlineTag: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  offlineTagText: { fontSize: 10, fontWeight: '800', color: '#b45309' },
  alertSuccess: { backgroundColor: 'rgba(10,61,36,0.08)', borderWidth: 1, borderColor: '#0A3D24', borderRadius: 14, padding: 14, marginBottom: 16 },
  alertSuccessText: { color: '#0A3D24', fontSize: 13, fontWeight: '700' },
  alertError: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 14, padding: 14, marginBottom: 16 },
  alertErrorText: { color: '#dc2626', fontSize: 13, fontWeight: '600' },
  card: { backgroundColor: '#ffffff', borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardHeading: { fontSize: 11, fontWeight: '800', color: '#0A3D24', textTransform: 'uppercase', letterSpacing: 0.5 },
  statusList: { gap: 12 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusLabel: { fontSize: 13, color: '#475569', fontWeight: '500' },
  statusValue: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  textMuted: { color: '#f59e0b', fontWeight: '600' },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  badgeGreen: { backgroundColor: 'rgba(10,61,36,0.1)' },
  badgeTextGreen: { color: '#0A3D24', fontSize: 12, fontWeight: '800', textTransform: 'capitalize' },
  badgeRed: { backgroundColor: '#fee2e2' },
  badgeTextRed: { color: '#dc2626', fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  badgeAmber: { backgroundColor: '#fef3c7' },
  badgeTextAmber: { color: '#d97706', fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  badgeText: { fontSize: 12, fontWeight: '600' },
  emptyBox: { alignItems: 'center', paddingVertical: 16 },
  emptyText: { fontSize: 13, color: '#94a3b8', fontWeight: '500' },
  actionSection: { gap: 12 },
  btnTimeIn: {
    backgroundColor: '#0A3D24',
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFCC00',
    shadowColor: '#0A3D24',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  btnTimeInText: { color: '#FFCC00', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  btnSubtext: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600', marginTop: 4 },
  btnTimeOut: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0A3D24',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  btnTimeOutText: { color: '#0A3D24', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  btnSubtextMuted: { color: '#64748b', fontSize: 11, fontWeight: '600', marginTop: 4 },
  completeCard: { backgroundColor: 'rgba(10,61,36,0.06)', borderRadius: 18, padding: 18, alignItems: 'center', borderWidth: 1, borderColor: '#0A3D24' },
  completeTitle: { fontSize: 15, fontWeight: '800', color: '#0A3D24' },
  completeSub: { fontSize: 12, color: '#475569', marginTop: 3 },
  submittingText: { fontSize: 13, fontWeight: '700', color: '#0A3D24', marginTop: 8 },
  permissionContainer: { flex: 1, backgroundColor: '#f4f6f9', alignItems: 'center', justifyContent: 'center', padding: 28 },
  permissionIcon: { fontSize: 44, marginBottom: 14 },
  permissionTitle: { fontSize: 20, fontWeight: '900', color: '#062415', marginBottom: 8, textAlign: 'center' },
  permissionText: { fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  btnPrimary: { backgroundColor: '#0A3D24', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24, width: '100%', alignItems: 'center', marginBottom: 10 },
  btnPrimaryText: { color: '#FFCC00', fontSize: 14, fontWeight: '800' },
  btnCancel: { paddingVertical: 10, alignItems: 'center' },
  btnCancelText: { color: '#64748b', fontSize: 13, fontWeight: '600' },
  cameraContainer: { flex: 1, backgroundColor: '#000000' },
  cameraOverlay: { position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center', gap: 20 },
  cameraTag: { backgroundColor: 'rgba(0,0,0,0.6)', color: '#ffffff', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, fontSize: 12, fontWeight: '700' },
  shutterOuter: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFCC00' },
  backBtn: { position: 'absolute', left: 20, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  backBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
});
