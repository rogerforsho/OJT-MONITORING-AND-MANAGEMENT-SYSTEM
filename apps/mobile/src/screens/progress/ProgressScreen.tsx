import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getOwnStudentProgress, type StudentProgressDetail } from '../../services/progress';

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
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
        <ActivityIndicator size="large" color="#0A3D24" />
      </View>
    );
  }

  const percentage = progress?.percentage || 0;
  const status = progress?.progress_status || 'not_started';

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0A3D24']} />}
      >
        <View style={s.header}>
          <Text style={s.headerKicker}>Colegio de Montalban OJT</Text>
          <Text style={s.title}>Practicum Progress</Text>
          <Text style={s.subtitle}>Rendered Hours & Completion Breakdown</Text>
        </View>

        {!!error && (
          <View style={s.alertError}>
            <Text style={s.alertErrorText}>⚠ {error}</Text>
            <TouchableOpacity onPress={load} style={{ marginTop: 6 }}>
              <Text style={s.retryText}>TAP TO RETRY</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Main Emerald Progress Card */}
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
              <Text style={s.statLabel}>Target</Text>
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
            <View style={s.divider} />
            <View style={s.profileRow}>
              <Text style={s.pLabel}>Student Number</Text>
              <Text style={s.pVal}>{progress?.student_number || '—'}</Text>
            </View>
            <View style={s.divider} />
            <View style={s.profileRow}>
              <Text style={s.pLabel}>Program</Text>
              <Text style={s.pVal}>{progress?.course || '—'} (4th Year Intern)</Text>
            </View>
            <View style={s.divider} />
            <View style={s.profileRow}>
              <Text style={s.pLabel}>Host Company</Text>
              <Text style={[s.pVal, s.pValGreen]}>{progress?.company_name || 'Not yet assigned'}</Text>
            </View>
            <View style={s.divider} />
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
              Rendered hours are calculated automatically upon supervisor selfie attendance verification.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f4f6f9' },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: '#f4f6f9', alignItems: 'center', justifyContent: 'center' },
  header: { marginBottom: 20 },
  headerKicker: { fontSize: 11, fontWeight: '800', color: '#0A3D24', textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { fontSize: 24, fontWeight: '900', color: '#062415' },
  subtitle: { fontSize: 12, color: '#64748b', marginTop: 2 },
  alertError: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 14, padding: 14, marginBottom: 16 },
  alertErrorText: { color: '#dc2626', fontSize: 13 },
  retryText: { color: '#b91c1c', fontSize: 11, fontWeight: '700' },
  progressCard: {
    backgroundColor: '#062415',
    borderRadius: 24,
    padding: 22,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,204,0,0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardTopLabel: { color: '#FFCC00', fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  statusPill: { backgroundColor: 'rgba(255,204,0,0.15)', borderWidth: 1, borderColor: '#FFCC00', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  statusPillText: { color: '#FFCC00', fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
  percentRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 14 },
  percentNum: { fontSize: 42, fontWeight: '900', color: '#ffffff' },
  percentLabel: { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  progressBarTrack: { width: '100%', height: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 5, overflow: 'hidden', marginBottom: 18 },
  progressBarFill: { height: '100%', backgroundColor: '#FFCC00', borderRadius: 5 },
  hoursGrid: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)' },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 2, fontWeight: '600' },
  statVal: { fontSize: 16, fontWeight: '900', color: '#ffffff' },
  profileCard: { backgroundColor: '#ffffff', borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', padding: 18, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  profileHeading: { fontSize: 11, fontWeight: '800', color: '#0A3D24', letterSpacing: 0.5, marginBottom: 12, textTransform: 'uppercase' },
  profileList: { gap: 8 },
  profileRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
  divider: { height: 1, backgroundColor: '#f1f5f9' },
  pLabel: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  pVal: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  pValGreen: { color: '#0A3D24', fontWeight: '800' },
  infoBanner: { backgroundColor: 'rgba(10,61,36,0.06)', borderWidth: 1, borderColor: 'rgba(10,61,36,0.2)', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  infoBannerTitle: { fontSize: 12, fontWeight: '800', color: '#0A3D24' },
  infoBannerSub: { fontSize: 11, color: '#062415', marginTop: 2, lineHeight: 16 },
});
