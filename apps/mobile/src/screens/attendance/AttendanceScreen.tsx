import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  ScrollView, Alert as RNAlert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Network from 'expo-network';
import { recordTimeIn, recordTimeOut, getTodayAttendance, getPendingQueueCount } from '../../services/attendance';
import type { DbAttendance } from '@ojt/shared';

type Step = 'idle' | 'scanning' | 'selfie' | 'submitting';

export default function AttendanceScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [step, setStep] = useState<Step>('idle');
  const [todayRecord, setTodayRecord] = useState<DbAttendance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [scannedToken, setScannedToken] = useState('');
  const [selfieUri, setSelfieUri] = useState('');
  const [mode, setMode] = useState<'time_in' | 'time_out'>('time_in');
  const cameraRef = useRef<CameraView>(null);
  const scanLock = useRef(false);

  useEffect(() => {
    loadState();
  }, []);

  async function loadState() {
    setLoading(true);
    const [record, network, pending] = await Promise.all([
      getTodayAttendance(),
      Network.getNetworkStateAsync(),
      getPendingQueueCount(),
    ]);
    setTodayRecord(record);
    setIsOnline(!!(network.isConnected && network.isInternetReachable));
    setPendingCount(pending);
    setLoading(false);
  }

  function startTimeIn() {
    setError('');
    setSuccess('');
    setMode('time_in');
    setStep('scanning');
    scanLock.current = false;
  }

  function startTimeOut() {
    setError('');
    setSuccess('');
    setMode('time_out');
    setStep('selfie'); // Time out doesn't need QR
  }

  async function handleQrScanned({ data }: { data: string }) {
    if (scanLock.current) return;
    scanLock.current = true;
    setScannedToken(data);
    setStep('selfie');
  }

  async function captureSelfie() {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.6, base64: false });
      if (!photo) return;
      setSelfieUri(photo.uri);
      await submitAttendance(photo.uri);
    } catch {
      setError('Failed to capture selfie. Please try again.');
      setStep(mode === 'time_in' ? 'scanning' : 'idle');
    }
  }

  async function submitAttendance(uri: string) {
    setStep('submitting');
    setError('');

    let result;
    if (mode === 'time_in') {
      result = await recordTimeIn(uri, scannedToken);
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

    const offline = 'data' in result && result.data && 'offline' in result.data
      ? result.data.offline
      : false;

    setSuccess(
      offline
        ? `${mode === 'time_in' ? 'Time In' : 'Time Out'} saved offline. Will sync when connected.`
        : `${mode === 'time_in' ? 'Time In' : 'Time Out'} recorded successfully.`
    );
    setStep('idle');
    await loadState();
  }

  if (loading) {
    return (
      <View className="flex-1 bg-slate-50 items-center justify-center">
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  // QR Scanner
  if (step === 'scanning') {
    if (!permission?.granted) {
      return (
        <View className="flex-1 bg-slate-50 items-center justify-center px-6">
          <Text className="text-slate-700 text-center mb-4">Camera permission is required to scan QR codes.</Text>
          <TouchableOpacity onPress={requestPermission} className="bg-teal-700 px-6 py-3 rounded-lg">
            <Text className="text-white font-semibold">Grant Permission</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View className="flex-1 bg-black">
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          onBarcodeScanned={handleQrScanned}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        />
        <View className="absolute inset-0 items-center justify-center">
          <View className="w-64 h-64 border-2 border-teal-400 rounded-2xl" />
          <Text className="text-white text-sm mt-4 bg-black/50 px-4 py-2 rounded-full">
            Point camera at the QR code
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setStep('idle')}
          className="absolute top-12 left-5 bg-black/50 px-4 py-2 rounded-full"
        >
          <Text className="text-white text-sm">Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Selfie capture
  if (step === 'selfie') {
    if (!permission?.granted) {
      requestPermission();
      return null;
    }
    return (
      <View className="flex-1 bg-black">
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing="front" />
        <View className="absolute bottom-12 inset-x-0 items-center gap-4">
          <Text className="text-white text-sm bg-black/50 px-4 py-2 rounded-full">
            Take a selfie for {mode === 'time_in' ? 'Time In' : 'Time Out'} evidence
          </Text>
          <TouchableOpacity
            onPress={captureSelfie}
            className="w-16 h-16 rounded-full bg-white border-4 border-teal-500 items-center justify-center"
          >
            <View className="w-12 h-12 rounded-full bg-teal-600" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          onPress={() => setStep(mode === 'time_in' ? 'scanning' : 'idle')}
          className="absolute top-12 left-5 bg-black/50 px-4 py-2 rounded-full"
        >
          <Text className="text-white text-sm">Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Submitting
  if (step === 'submitting') {
    return (
      <View className="flex-1 bg-slate-50 items-center justify-center gap-3">
        <ActivityIndicator size="large" color="#0f766e" />
        <Text className="text-slate-600 text-sm">Recording attendance...</Text>
      </View>
    );
  }

  // Main idle view
  return (
    <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={{ padding: 24 }}>
      <Text className="text-2xl font-bold text-slate-900 mb-1">Attendance</Text>
      <Text className="text-sm text-slate-500 mb-6">
        {new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </Text>

      {/* Connectivity banner */}
      {!isOnline && (
        <View className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 flex-row items-center gap-2">
          <Text className="text-amber-600 text-sm font-medium">⚠ Offline</Text>
          <Text className="text-amber-600 text-sm flex-1">Attendance will be saved and synced when connected.</Text>
        </View>
      )}

      {/* Pending sync banner */}
      {pendingCount > 0 && (
        <View className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4">
          <Text className="text-blue-700 text-sm font-medium">
            {pendingCount} record{pendingCount > 1 ? 's' : ''} pending sync
          </Text>
        </View>
      )}

      {/* Success / Error */}
      {!!success && (
        <View className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 mb-4">
          <Text className="text-teal-700 text-sm">{success}</Text>
        </View>
      )}
      {!!error && (
        <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
          <Text className="text-red-600 text-sm">{error}</Text>
        </View>
      )}

      {/* Today's status card */}
      <View className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-6">
        <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Today's Status</Text>
        {todayRecord ? (
          <View className="gap-3">
            <View className="flex-row justify-between items-center">
              <Text className="text-sm text-slate-600">Time In</Text>
              <Text className="text-sm font-semibold text-slate-900">
                {new Date(todayRecord.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            <View className="flex-row justify-between items-center">
              <Text className="text-sm text-slate-600">Time Out</Text>
              <Text className={`text-sm font-semibold ${todayRecord.time_out ? 'text-slate-900' : 'text-amber-500'}`}>
                {todayRecord.time_out
                  ? new Date(todayRecord.time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : 'Not yet recorded'}
              </Text>
            </View>
            <View className="flex-row justify-between items-center">
              <Text className="text-sm text-slate-600">Status</Text>
              <View className={`px-2 py-0.5 rounded-full ${todayRecord.late_status === 'late' ? 'bg-red-100' : 'bg-teal-100'}`}>
                <Text className={`text-xs font-medium capitalize ${todayRecord.late_status === 'late' ? 'text-red-600' : 'text-teal-700'}`}>
                  {todayRecord.late_status}
                </Text>
              </View>
            </View>
            <View className="flex-row justify-between items-center">
              <Text className="text-sm text-slate-600">Verification</Text>
              <View className={`px-2 py-0.5 rounded-full ${
                todayRecord.verification_status === 'verified' ? 'bg-teal-100' :
                todayRecord.verification_status === 'rejected' ? 'bg-red-100' : 'bg-amber-100'
              }`}>
                <Text className={`text-xs font-medium capitalize ${
                  todayRecord.verification_status === 'verified' ? 'text-teal-700' :
                  todayRecord.verification_status === 'rejected' ? 'text-red-600' : 'text-amber-700'
                }`}>
                  {todayRecord.verification_status}
                </Text>
              </View>
            </View>
            {todayRecord.sync_status === 'pending_sync' && (
              <View className="bg-blue-50 rounded-lg px-3 py-2">
                <Text className="text-xs text-blue-600">⏳ Pending synchronization</Text>
              </View>
            )}
            {todayRecord.sync_status === 'conflict' && (
              <View className="bg-red-50 rounded-lg px-3 py-2">
                <Text className="text-xs text-red-600">⚠ Sync conflict — contact your coordinator</Text>
              </View>
            )}
          </View>
        ) : (
          <Text className="text-sm text-slate-400">No attendance recorded yet today.</Text>
        )}
      </View>

      {/* Action buttons */}
      <View className="gap-3">
        {!todayRecord && (
          <TouchableOpacity
            onPress={startTimeIn}
            className="bg-teal-700 rounded-xl py-4 items-center"
          >
            <Text className="text-white font-semibold text-base">📷 Time In</Text>
            <Text className="text-teal-200 text-xs mt-0.5">Scan QR code + selfie required</Text>
          </TouchableOpacity>
        )}

        {todayRecord && !todayRecord.time_out && (
          <TouchableOpacity
            onPress={startTimeOut}
            className="bg-slate-800 rounded-xl py-4 items-center"
          >
            <Text className="text-white font-semibold text-base">📷 Time Out</Text>
            <Text className="text-slate-400 text-xs mt-0.5">Selfie required</Text>
          </TouchableOpacity>
        )}

        {todayRecord?.time_out && (
          <View className="bg-teal-50 border border-teal-200 rounded-xl py-4 items-center">
            <Text className="text-teal-700 font-semibold text-base">✓ Attendance Complete</Text>
            <Text className="text-teal-500 text-xs mt-0.5">Both Time In and Time Out recorded</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
