import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  ScrollView, StyleSheet, FlatList, RefreshControl,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { recordTimeIn, recordTimeOut, getTodayAttendance, fetchOwnAttendance } from '../../services/attendance';
import { syncPendingOfflineAttendance, isNetworkAvailable } from '../../lib/syncEngine';
import { getOfflineQueue } from '../../lib/offlineQueue';
import NetworkToast from '../../components/NetworkToast';
import type { DbAttendance } from '@ojt/shared';

type Step = 'idle' | 'selfie' | 'submitting';
type SubTab = 'check_in' | 'history';

export default function AttendanceScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<SubTab>('check_in');
  const [permission, requestPermission] = useCameraPermissions();
  const [step, setStep] = useState<Step>('idle');
  const [todayRecord, setTodayRecord] = useState<DbAttendance | null>(null);
  const [historyRecords, setHistoryRecords] = useState<DbAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
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

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    const result = await fetchOwnAttendance(1, 50);
    if (result.data?.records) {
      setHistoryRecords(result.data.records);
    }
    setHistoryLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab, loadHistory]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (activeTab === 'check_in') {
      await loadState();
      setRefreshing(false);
    } else {
      await loadHistory();
    }
  };

  async function handleSync() {
    setSyncing(true);
    setError('');
    const res = await syncPendingOfflineAttendance();
    setSyncing(false);
    if (res.syncedCount > 0) {
      setSuccess(`Successfully synchronized ${res.syncedCount} offline attendance record(s) with CdM servers.`);
      await loadState();
      if (activeTab === 'history') await loadHistory();
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
          ? 'Time In recorded offline. Photo and timestamp saved locally and will auto-sync when online.'
          : 'Time Out recorded offline. Photo and timestamp saved locally and will auto-sync when online.'
      );
    } else {
      setSuccess(
        mode === 'time_in'
          ? 'Time In recorded successfully with selfie evidence.'
          : 'Time Out recorded successfully with selfie evidence.'
      );
    }

    setStep('idle');
    await loadState();
    if (activeTab === 'history') await loadHistory();
  }

  // Camera Permission View
  if (step === 'selfie' && !permission?.granted) {
    return (
      <View style={[s.permissionContainer, { paddingTop: insets.top }]}>
        <Ionicons name="camera" size={48} color="#0A3D24" style={{ marginBottom: 14 }} />
        <Text style={s.permissionTitle}>Camera Access Required</Text>
        <Text style={s.permissionText}>
          Colegio de Montalban OJT policies require real front-camera selfie evidence for daily attendance verification.
        </Text>
        <TouchableOpacity onPress={requestPermission} style={s.btnPrimary} activeOpacity={0.85}>
          <Text style={s.btnPrimaryText}>Grant Camera Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setStep('idle')} style={s.btnCancel}>
          <Text style={s.btnCancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Live Camera View with Face Oval Guide
  if (step === 'selfie') {
    return (
      <View style={s.cameraContainer}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />

        {/* Top Cancel Header */}
        <View style={[s.cameraTopBar, { top: insets.top + 16 }]}>
          <TouchableOpacity onPress={() => setStep('idle')} style={s.backBtn}>
            <Ionicons name="close" size={20} color="#ffffff" />
            <Text style={s.backBtnText}>Cancel</Text>
          </TouchableOpacity>
          <View style={s.cameraTag}>
            <Text style={s.cameraTagText}>{mode === 'time_in' ? 'TIME IN SELFIE' : 'TIME OUT SELFIE'}</Text>
          </View>
        </View>

        {/* Face Oval Alignment Guide */}
        <View style={s.faceGuideWrapper}>
          <View style={s.faceOval} />
          <Text style={s.faceGuideText}>Align your face within the frame</Text>
        </View>

        {/* Shutter Button */}
        <View style={s.cameraOverlay}>
          <TouchableOpacity onPress={captureSelfie} style={s.shutterOuter} activeOpacity={0.85}>
            <View style={s.shutterInner} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (step === 'submitting') {
    return (
      <View style={[s.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#0A3D24" />
        <Text style={s.submittingText}>
          {mode === 'time_in' ? 'Recording Time In...' : 'Recording Time Out...'}
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[s.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#0A3D24" />
      </View>
    );
  }

  const todayFormatted = new Date().toLocaleDateString('en-PH', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerKicker}>Colegio de Montalban OJT</Text>
        <Text style={s.headerTitle}>Attendance Portal</Text>
        <Text style={s.headerDate}>{todayFormatted}</Text>

        {/* Segmented Top Tab Switcher */}
        <View style={s.segmentedContainer}>
          <TouchableOpacity
            style={[s.segmentBtn, activeTab === 'check_in' && s.segmentBtnActive]}
            onPress={() => setActiveTab('check_in')}
            activeOpacity={0.8}
          >
            <Ionicons
              name={activeTab === 'check_in' ? 'camera' : 'camera-outline'}
              size={15}
              color={activeTab === 'check_in' ? '#0A3D24' : '#64748b'}
            />
            <Text style={[s.segmentText, activeTab === 'check_in' && s.segmentTextActive]}>
              Live Check-In
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.segmentBtn, activeTab === 'history' && s.segmentBtnActive]}
            onPress={() => setActiveTab('history')}
            activeOpacity={0.8}
          >
            <Ionicons
              name={activeTab === 'history' ? 'time' : 'time-outline'}
              size={15}
              color={activeTab === 'history' ? '#0A3D24' : '#64748b'}
            />
            <Text style={[s.segmentText, activeTab === 'history' && s.segmentTextActive]}>
              History Logs
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* VIEW A: Check-In Tab */}
      {activeTab === 'check_in' && (
        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0A3D24']} />}
        >
          {/* Offline Sync Banner */}
          {offlineCount > 0 && (
            <View style={s.offlineBanner}>
              <View style={s.offlineBannerTextCol}>
                <Text style={s.offlineBannerTitle}>
                  {offlineCount} Record{offlineCount > 1 ? 's' : ''} Queued Offline
                </Text>
                <Text style={s.offlineBannerSub}>
                  {isOffline ? 'Will auto-sync when connected' : 'Ready to synchronize with CdM servers'}
                </Text>
              </View>
              {!isOffline && (
                <TouchableOpacity onPress={handleSync} disabled={syncing} style={s.syncBtn} activeOpacity={0.85}>
                  {syncing ? (
                    <ActivityIndicator size="small" color="#062415" />
                  ) : (
                    <Text style={s.syncBtnText}>Sync Now</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Success / Error Alerts */}
          {!!success && (
            <View style={s.alertSuccess}>
              <Ionicons name="checkmark-circle" size={18} color="#0A3D24" />
              <Text style={s.alertSuccessText}>{success}</Text>
            </View>
          )}
          {!!error && (
            <View style={s.alertError}>
              <Ionicons name="alert-circle" size={18} color="#dc2626" />
              <Text style={s.alertErrorText}>{error}</Text>
            </View>
          )}

          {/* Today's Status Card */}
          <View style={s.card}>
            <View style={s.cardHeaderRow}>
              <Text style={s.cardHeading}>TODAY&apos;S ATTENDANCE STATUS</Text>
              {(todayRecord as any)?.offline_created && (
                <View style={s.offlineTag}>
                  <Text style={s.offlineTagText}>Offline Log</Text>
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
                      : 'Pending (On Duty)'}
                  </Text>
                </View>
                <View style={s.statusRow}>
                  <Text style={s.statusLabel}>Punctuality</Text>
                  <Text style={[
                    s.statusValue,
                    todayRecord.late_status === 'late' ? { color: '#dc2626' } : { color: '#0A3D24' }
                  ]}>
                    {todayRecord.late_status.replace('_', ' ').toUpperCase()}
                  </Text>
                </View>
                <View style={s.statusRow}>
                  <Text style={s.statusLabel}>Verification Status</Text>
                  <View style={[
                    s.badge,
                    todayRecord.verification_status === 'verified' ? s.badgeGreen :
                    todayRecord.verification_status === 'rejected' ? s.badgeRed : s.badgeAmber,
                  ]}>
                    <Text style={[
                      s.badgeText,
                      todayRecord.verification_status === 'verified' ? s.badgeTextGreen :
                      todayRecord.verification_status === 'rejected' ? s.badgeTextRed : s.badgeTextAmber,
                    ]}>
                      {todayRecord.verification_status}
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={s.emptyBox}>
                <Ionicons name="time-outline" size={36} color="#94a3b8" style={{ marginBottom: 6 }} />
                <Text style={s.emptyText}>No attendance recorded yet today.</Text>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View style={s.actionSection}>
            {!todayRecord && (
              <TouchableOpacity onPress={startTimeIn} style={s.btnTimeIn} activeOpacity={0.85}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="camera" size={22} color="#FFCC00" />
                  <Text style={s.btnTimeInText}>Time In</Text>
                </View>
                <Text style={s.btnSubtext}>
                  {isOffline ? 'Will record offline selfie evidence' : 'Front-camera selfie verification required'}
                </Text>
              </TouchableOpacity>
            )}

            {todayRecord && !todayRecord.time_out && (
              <TouchableOpacity onPress={startTimeOut} style={s.btnTimeOut} activeOpacity={0.85}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="log-out-outline" size={22} color="#0A3D24" />
                  <Text style={s.btnTimeOutText}>Time Out</Text>
                </View>
                <Text style={s.btnSubtextMuted}>
                  {isOffline ? 'Will record offline selfie evidence' : 'Front-camera selfie verification required'}
                </Text>
              </TouchableOpacity>
            )}

            {todayRecord?.time_out && (
              <View style={s.completeCard}>
                <Ionicons name="checkmark-done-circle" size={28} color="#0A3D24" style={{ marginBottom: 4 }} />
                <Text style={s.completeTitle}>Attendance Complete for Today</Text>
                <Text style={s.completeSub}>Both Time In and Time Out have been securely recorded.</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* VIEW B: History Logs Tab */}
      {activeTab === 'history' && (
        <FlatList
          data={historyRecords}
          keyExtractor={(item) => item.attendance_id}
          contentContainerStyle={s.historyListContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0A3D24']} />}
          ListEmptyComponent={
            historyLoading ? (
              <View style={s.center}>
                <ActivityIndicator size="large" color="#0A3D24" />
              </View>
            ) : (
              <View style={s.emptyContainer}>
                <Ionicons name="calendar-outline" size={40} color="#94a3b8" style={{ marginBottom: 8 }} />
                <Text style={s.emptyTitle}>No attendance records found</Text>
                <Text style={s.emptySub}>Your verified time in and out records will appear here.</Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <View style={s.historyCard}>
              <View style={s.cardTop}>
                <Text style={s.dateText}>
                  {new Date(item.attendance_date).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
                <View style={[
                  s.badge,
                  item.verification_status === 'verified' ? s.badgeGreen :
                  item.verification_status === 'rejected' ? s.badgeRed : s.badgeAmber
                ]}>
                  <Text style={[
                    s.badgeText,
                    item.verification_status === 'verified' ? s.badgeTextGreen :
                    item.verification_status === 'rejected' ? s.badgeTextRed : s.badgeTextAmber
                  ]}>
                    {item.verification_status}
                  </Text>
                </View>
              </View>

              <View style={s.timeGrid}>
                <View style={s.timeCol}>
                  <Text style={s.timeLabel}>Time In</Text>
                  <Text style={s.timeValue}>
                    {new Date(item.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <View style={s.timeCol}>
                  <Text style={s.timeLabel}>Time Out</Text>
                  <Text style={[s.timeValue, !item.time_out && s.textMuted]}>
                    {item.time_out
                      ? new Date(item.time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : 'Pending'}
                  </Text>
                </View>
                <View style={s.timeCol}>
                  <Text style={s.timeLabel}>Punctuality</Text>
                  <Text style={[s.timeValue, item.late_status === 'late' ? { color: '#dc2626' } : { color: '#0A3D24' }]}>
                    {item.late_status.replace('_', ' ')}
                  </Text>
                </View>
              </View>
            </View>
          )}
        />
      )}

      <NetworkToast isOffline={isOffline} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f4f6f9' },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: '#f4f6f9', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 40 },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10 },
  headerKicker: { fontSize: 11, fontWeight: '800', color: '#0A3D24', textTransform: 'uppercase', letterSpacing: 0.5 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#062415' },
  headerDate: { fontSize: 12, color: '#64748b', marginTop: 2, marginBottom: 12 },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    padding: 3,
    borderRadius: 14,
    marginTop: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 11,
    gap: 6,
  },
  segmentBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  segmentTextActive: {
    color: '#0A3D24',
    fontWeight: '800',
  },
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
  alertSuccess: {
    backgroundColor: 'rgba(10,61,36,0.08)',
    borderWidth: 1,
    borderColor: '#0A3D24',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  alertSuccessText: { color: '#0A3D24', fontSize: 13, fontWeight: '700', flex: 1 },
  alertError: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  alertErrorText: { color: '#dc2626', fontSize: 13, fontWeight: '600', flex: 1 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
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
  completeCard: {
    backgroundColor: 'rgba(10,61,36,0.06)',
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#0A3D24',
  },
  completeTitle: { fontSize: 15, fontWeight: '800', color: '#0A3D24' },
  completeSub: { fontSize: 12, color: '#475569', marginTop: 3 },
  submittingText: { fontSize: 13, fontWeight: '700', color: '#0A3D24', marginTop: 8 },
  permissionContainer: { flex: 1, backgroundColor: '#f4f6f9', alignItems: 'center', justifyContent: 'center', padding: 28 },
  permissionTitle: { fontSize: 20, fontWeight: '900', color: '#062415', marginBottom: 8, textAlign: 'center' },
  permissionText: { fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  btnPrimary: { backgroundColor: '#0A3D24', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24, width: '100%', alignItems: 'center', marginBottom: 10 },
  btnPrimaryText: { color: '#FFCC00', fontSize: 14, fontWeight: '800' },
  btnCancel: { paddingVertical: 10, alignItems: 'center' },
  btnCancelText: { color: '#64748b', fontSize: 13, fontWeight: '600' },
  cameraContainer: { flex: 1, backgroundColor: '#000000' },
  cameraTopBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  backBtn: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  cameraTag: {
    backgroundColor: 'rgba(10,61,36,0.8)',
    borderWidth: 1,
    borderColor: '#FFCC00',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  cameraTagText: { color: '#FFCC00', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  faceGuideWrapper: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  faceOval: {
    width: 220,
    height: 300,
    borderRadius: 110,
    borderWidth: 2,
    borderColor: '#FFCC00',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  faceGuideText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  cameraOverlay: { position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center', gap: 20 },
  shutterOuter: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFCC00' },
  historyListContent: { paddingHorizontal: 20, paddingBottom: 24, gap: 12 },
  historyCard: { backgroundColor: '#ffffff', borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0', padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  dateText: { fontSize: 14, fontWeight: '800', color: '#062415' },
  timeGrid: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#f1f5f9' },
  timeCol: { alignItems: 'flex-start' },
  timeLabel: { fontSize: 11, color: '#64748b', marginBottom: 2, fontWeight: '500' },
  timeValue: { fontSize: 13, fontWeight: '800', color: '#0f172a', textTransform: 'capitalize' },
  emptyContainer: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#334155' },
  emptySub: { fontSize: 13, color: '#94a3b8', textAlign: 'center', marginTop: 4, paddingHorizontal: 20 },
});
