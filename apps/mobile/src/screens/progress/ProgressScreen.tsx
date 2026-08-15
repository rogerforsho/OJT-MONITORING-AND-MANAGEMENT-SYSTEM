import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { getOwnStudentProgress, type StudentProgressDetail } from '../../services/progress';

export default function ProgressScreen() {
  const [progress, setProgress] = useState<StudentProgressDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    const result = await getOwnStudentProgress();
    if (result.error) {
      setError(result.error.message);
    } else {
      setProgress(result.data);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  const percentage = progress?.percentage || 0;
  const status = progress?.progress_status || 'not_started';

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0f766e']} />}
    >
      <View style={s.header}>
        <Text style={s.title}>Internship Progress</Text>
        <Text style={s.subtitle}>Rendered Hours & Completion Status</Text>
      </View>

      {!!error && (
        <View style={s.alertError}>
          <Text style={s.alertErrorText}>⚠ {error}</Text>
          <TouchableOpacity onPress={load} style={{ marginTop: 6 }}>
            <Text style={s.retryText}>TAP TO RETRY</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Main Teal Progress Card */}
      <View style={s.progressCard}>
        <View style={s.cardTopRow}>
          <Text style={s.cardTopLabel}>OVERALL COMPLETION</Text>
          <View style={s.statusPill}>
            <Text style={s.statusPillText}>{status.replace('_', ' ')}</Text>
          </View>
        </View>

        <View style={s.percentRow}>
          <Text style={s.percentNum}>{percentage}%</Text>
          <Text style={s.percentLabel}>completed</Text>
        </View>

        {/* Progress Bar Track */}
        <View style={s.progressBarTrack}>
          <View
            style={[s.progressBarFill, { width: `${Math.max(4, Math.min(100, percentage))}%` }]}
          />
        </View>

        {/* Hours Stat Grid */}
        <View style={s.hoursGrid}>
          <View>
            <Text style={s.statLabel}>Completed</Text>
            <Text style={s.statVal}>{progress?.completed_hours || 0} hrs</Text>
          </View>
          <View>
            <Text style={s.statLabel}>Remaining</Text>
            <Text style={s.statVal}>{progress?.remaining_hours || 0} hrs</Text>
          </View>
          <View>
            <Text style={s.statLabel}>Required</Text>
            <Text style={s.statVal}>{progress?.required_hours || 486} hrs</Text>
          </View>
        </View>
      </View>

      {/* Assignment Profile Details */}
      <View style={s.profileCard}>
        <Text style={s.profileHeading}>TRAINEE & HOST COMPANY</Text>

        <View style={s.profileList}>
          <View style={s.profileRow}>
            <Text style={s.pLabel}>Student Name</Text>
            <Text style={s.pVal}>{progress?.full_name || '—'}</Text>
          </View>
          <View style={s.profileRow}>
            <Text style={s.pLabel}>Student Number</Text>
            <Text style={s.pVal}>{progress?.student_number || '—'}</Text>
          </View>
          <View style={s.profileRow}>
            <Text style={s.pLabel}>Program</Text>
            <Text style={s.pVal}>{progress?.course || '—'} (Year {progress?.year_level || 4})</Text>
          </View>
          <View style={s.profileRow}>
            <Text style={s.pLabel}>Host Company</Text>
            <Text style={[s.pVal, s.pValTeal]}>{progress?.company_name || 'Not yet assigned'}</Text>
          </View>
          <View style={s.profileRow}>
            <Text style={s.pLabel}>Verified Sessions</Text>
            <Text style={s.pVal}>{progress?.verified_sessions_count || 0} days</Text>
          </View>
        </View>
      </View>

      {/* Info banner */}
      <View style={s.infoBanner}>
        <Text style={{ fontSize: 24 }}>🎓</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.infoBannerTitle}>Colegio de Montalban OJT Standard</Text>
          <Text style={s.infoBannerSub}>
            Hours are automatically updated once company supervisors and coordinators verify attendance.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 24, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' },
  header: { marginBottom: 20 },
  title: { fontSize: 26, fontWeight: '800', color: '#0f172a' },
  subtitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
  alertError: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 14, padding: 14, marginBottom: 16 },
  alertErrorText: { color: '#dc2626', fontSize: 13 },
  retryText: { color: '#b91c1c', fontSize: 11, fontWeight: '700' },
  progressCard: { backgroundColor: '#042f2e', borderRadius: 24, padding: 24, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 4 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardTopLabel: { color: '#99f6e4', fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  statusPill: { backgroundColor: 'rgba(20,184,166,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusPillText: { color: '#5eead4', fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  percentRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 16 },
  percentNum: { fontSize: 44, fontWeight: '900', color: '#ffffff' },
  percentLabel: { fontSize: 14, color: '#99f6e4', fontWeight: '500' },
  progressBarTrack: { width: '100%', height: 10, backgroundColor: 'rgba(15,118,110,0.5)', borderRadius: 5, overflow: 'hidden', marginBottom: 20 },
  progressBarFill: { height: '100%', backgroundColor: '#2dd4bf', borderRadius: 5 },
  hoursGrid: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(15,118,110,0.4)' },
  statLabel: { fontSize: 11, color: '#99f6e4', marginBottom: 2 },
  statVal: { fontSize: 17, fontWeight: '800', color: '#ffffff' },
  profileCard: { backgroundColor: '#ffffff', borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  profileHeading: { fontSize: 11, fontWeight: '700', color: '#94a3b8', letterSpacing: 0.5, marginBottom: 16 },
  profileList: { gap: 14 },
  profileRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pLabel: { fontSize: 13, color: '#64748b' },
  pVal: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  pValTeal: { color: '#0f766e' },
  infoBanner: { backgroundColor: '#f0fdfa', borderWidth: 1, borderColor: '#ccfbf1', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  infoBannerTitle: { fontSize: 12, fontWeight: '700', color: '#0f766e' },
  infoBannerSub: { fontSize: 12, color: '#0d9488', marginTop: 2, lineHeight: 16 },
});
