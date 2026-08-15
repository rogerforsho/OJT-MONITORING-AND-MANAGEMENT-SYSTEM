import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  ScrollView, StyleSheet, Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { recordTimeIn, recordTimeOut, getTodayAttendance } from '../../services/attendance';
import type { DbAttendance } from '@ojt/shared';

type Step = 'idle' | 'selfie' | 'submitting';

export default function AttendanceScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [step, setStep] = useState<Step>('idle');
  const [todayRecord, setTodayRecord] = useState<DbAttendance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mode, setMode] = useState<'time_in' | 'time_out'>('time_in');
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    loadState();
  }, []);

  async function loadState() {
    setLoading(true);
    const record = await getTodayAttendance();
    setTodayRecord(record);
    setLoading(false);
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
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.6 });
      if (!photo) return;
      await submitAttendance(photo.uri);
    } catch {
      setError('Failed to capture selfie. Please try again.');
      setStep('idle');
    }
  }

  async function submitAttendance(uri: string) {
    setStep('submitting');
    setError('');

    let result;
    if (mode === 'time_in') {
      result = await recordTimeIn(uri);
    } else {
      if (!todayRecord?.attendance_id) {
        setError('No Time In record found for today.');
        setStep('idle');
        return;
      }
      result = await recordTimeOut(todayRecord.attendance_id, uri);
    }

    if (result.error) {
      setError(result.error.message);
      setStep('idle');
      return;
    }

    setSuccess(
      mode === 'time_in'
        ? 'Time In recorded successfully with selfie evidence.'
        : 'Time Out recorded successfully with selfie evidence.'
    );
    setStep('idle');
    await loadState();
  }

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  // Selfie capture step
  if (step === 'selfie') {
    if (!permission?.granted) {
      return (
        <View style={s.permissionContainer}>
          <Text style={s.permissionIcon}>📷</Text>
          <Text style={s.permissionTitle}>Camera Access Required</Text>
          <Text style={s.permissionText}>
            Camera permission is required to capture your attendance selfie evidence.
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
        <TouchableOpacity onPress={() => setStep('idle')} style={s.backBtn}>
          <Text style={s.backBtnText}>✕ Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Submitting step
  if (step === 'submitting') {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#0f766e" />
        <Text style={s.submittingText}>
          Uploading selfie & recording attendance...
        </Text>
      </View>
    );
  }

  // Main screen view
  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Attendance</Text>
        <Text style={s.headerDate}>
          {new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </Text>
      </View>

      {/* Success / Error Messages */}
      {!!success && (
        <View style={s.alertSuccess}>
          <Text style={s.alertSuccessText}>✓ {success}</Text>
        </View>
      )}
      {!!error && (
        <View style={s.alertError}>
          <Text style={s.alertErrorText}>⚠ {error}</Text>
        </View>
      )}

      {/* Today's status card */}
      <View style={s.card}>
        <Text style={s.cardHeading}>Today's Status</Text>
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
              <View style={[s.badge, todayRecord.late_status === 'late' ? s.badgeRed : s.badgeTeal]}>
                <Text style={[s.badgeText, todayRecord.late_status === 'late' ? s.badgeTextRed : s.badgeTextTeal]}>
                  {todayRecord.late_status.replace('_', ' ')}
                </Text>
              </View>
            </View>
            <View style={s.statusRow}>
              <Text style={s.statusLabel}>Verification</Text>
              <View style={[
                s.badge,
                todayRecord.verification_status === 'verified' ? s.badgeTeal :
                todayRecord.verification_status === 'rejected' ? s.badgeRed : s.badgeAmber
              ]}>
                <Text style={[
                  s.badgeText,
                  todayRecord.verification_status === 'verified' ? s.badgeTextTeal :
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
            <Text style={s.btnSubtext}>Selfie evidence required</Text>
          </TouchableOpacity>
        )}

        {todayRecord && !todayRecord.time_out && (
          <TouchableOpacity onPress={startTimeOut} style={s.btnTimeOut} activeOpacity={0.85}>
            <Text style={s.btnTimeOutText}>📷 Time Out</Text>
            <Text style={s.btnSubtextMuted}>Selfie evidence required</Text>
          </TouchableOpacity>
        )}

        {todayRecord?.time_out && (
          <View style={s.completeCard}>
            <Text style={s.completeTitle}>✓ Attendance Complete</Text>
            <Text style={s.completeSub}>Both Time In and Time Out recorded for today</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 24, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', gap: 12 },
  header: { marginBottom: 20 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#0f172a' },
  headerDate: { fontSize: 13, color: '#64748b', marginTop: 2 },
  alertSuccess: { backgroundColor: '#f0fdfa', borderWidth: 1, borderColor: '#99f6e4', borderRadius: 14, padding: 14, marginBottom: 16 },
  alertSuccessText: { color: '#0f766e', fontSize: 13, fontWeight: '600' },
  alertError: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 14, padding: 14, marginBottom: 16 },
  alertErrorText: { color: '#dc2626', fontSize: 13, fontWeight: '600' },
  card: { backgroundColor: '#ffffff', borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', padding: 20, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardHeading: { fontSize: 12, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16 },
  statusList: { gap: 14 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusLabel: { fontSize: 14, color: '#475569', fontWeight: '500' },
  statusValue: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  textMuted: { color: '#f59e0b', fontWeight: '600' },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  badgeTeal: { backgroundColor: '#ccfbf1' },
  badgeTextTeal: { color: '#0f766e', fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  badgeRed: { backgroundColor: '#fee2e2' },
  badgeTextRed: { color: '#dc2626', fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  badgeAmber: { backgroundColor: '#fef3c7' },
  badgeTextAmber: { color: '#d97706', fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  badgeText: { fontSize: 12, fontWeight: '600' },
  emptyBox: { alignItems: 'center', paddingVertical: 16 },
  emptyText: { fontSize: 13, color: '#94a3b8' },
  actionSection: { gap: 14 },
  btnTimeIn: { backgroundColor: '#0f766e', borderRadius: 16, paddingVertical: 16, alignItems: 'center', shadowColor: '#0f766e', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  btnTimeInText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  btnSubtext: { color: '#99f6e4', fontSize: 11, marginTop: 2 },
  btnTimeOut: { backgroundColor: '#1e293b', borderRadius: 16, paddingVertical: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 3 },
  btnTimeOutText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  btnSubtextMuted: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  completeCard: { backgroundColor: '#f0fdfa', borderWidth: 1, borderColor: '#99f6e4', borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  completeTitle: { color: '#0f766e', fontSize: 16, fontWeight: '700' },
  completeSub: { color: '#0d9488', fontSize: 11, marginTop: 2 },
  permissionContainer: { flex: 1, backgroundColor: '#f8fafc', padding: 24, justifyContent: 'center', alignItems: 'center' },
  permissionIcon: { fontSize: 48, marginBottom: 16 },
  permissionTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginBottom: 8, textAlign: 'center' },
  permissionText: { fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  btnPrimary: { backgroundColor: '#0f766e', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24, width: '100%', alignItems: 'center', marginBottom: 12 },
  btnPrimaryText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  btnCancel: { paddingVertical: 10, alignItems: 'center' },
  btnCancelText: { color: '#64748b', fontSize: 13 },
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  cameraOverlay: { position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center', gap: 16 },
  cameraTag: { color: '#ffffff', fontSize: 13, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, fontWeight: '600' },
  shutterOuter: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#ffffff', borderWidth: 4, borderColor: '#14b8a6', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#0f766e' },
  backBtn: { position: 'absolute', top: 50, left: 20, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  backBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '600' },
  submittingText: { color: '#475569', fontSize: 13, fontWeight: '500' },
});
