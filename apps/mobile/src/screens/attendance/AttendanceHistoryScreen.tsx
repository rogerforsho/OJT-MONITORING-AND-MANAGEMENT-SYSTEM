import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, RefreshControl,
  ActivityIndicator, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { fetchOwnAttendance } from '../../services/attendance';
import type { DbAttendance } from '@ojt/shared';

export default function AttendanceHistoryScreen() {
  const insets = useSafeAreaInsets();
  const [records, setRecords] = useState<DbAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadHistory = useCallback(async () => {
    setError('');
    const result = await fetchOwnAttendance(1, 50);
    if (result.error) {
      setError(result.error.message);
    } else {
      setRecords(result.data?.records ?? []);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const onRefresh = () => {
    setRefreshing(true);
    loadHistory();
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#0A3D24" />
      </View>
    );
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Text style={s.headerKicker}>Colegio de Montalban OJT</Text>
        <Text style={s.title}>Attendance History</Text>
        <Text style={s.subtitle}>{records.length} logged session{records.length !== 1 ? 's' : ''}</Text>
      </View>

      {!!error && (
        <View style={s.alertError}>
          <Ionicons name="alert-circle" size={16} color="#dc2626" />
          <Text style={s.alertErrorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={records}
        keyExtractor={(item) => item.attendance_id}
        contentContainerStyle={s.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0A3D24']} />}
        ListEmptyComponent={
          <View style={s.emptyContainer}>
            <Ionicons name="calendar-outline" size={40} color="#94a3b8" style={{ marginBottom: 8 }} />
            <Text style={s.emptyTitle}>No attendance records found</Text>
            <Text style={s.emptySub}>Your verified time in and out records will appear here.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={s.card}>
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
                <Text style={[s.timeValue, item.late_status === 'late' ? s.textRed : s.textGreen]}>
                  {item.late_status.replace('_', ' ')}
                </Text>
              </View>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f4f6f9' },
  center: { flex: 1, backgroundColor: '#f4f6f9', alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  headerKicker: { fontSize: 11, fontWeight: '800', color: '#0A3D24', textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { fontSize: 24, fontWeight: '900', color: '#062415' },
  subtitle: { fontSize: 12, color: '#64748b', marginTop: 2 },
  alertError: { marginHorizontal: 20, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 12, padding: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  alertErrorText: { color: '#dc2626', fontSize: 13, fontWeight: '600', flex: 1 },
  listContent: { paddingHorizontal: 20, paddingBottom: 24, gap: 12 },
  card: { backgroundColor: '#ffffff', borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0', padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  dateText: { fontSize: 14, fontWeight: '800', color: '#062415' },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  badgeGreen: { backgroundColor: 'rgba(10,61,36,0.1)' },
  badgeTextGreen: { color: '#0A3D24', fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
  badgeRed: { backgroundColor: '#fee2e2' },
  badgeTextRed: { color: '#dc2626', fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
  badgeAmber: { backgroundColor: '#fef3c7' },
  badgeTextAmber: { color: '#d97706', fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
  badgeText: { fontSize: 11, fontWeight: '600' },
  timeGrid: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#f1f5f9' },
  timeCol: { alignItems: 'flex-start' },
  timeLabel: { fontSize: 11, color: '#64748b', marginBottom: 2, fontWeight: '500' },
  timeValue: { fontSize: 13, fontWeight: '800', color: '#0f172a', textTransform: 'capitalize' },
  textMuted: { color: '#f59e0b' },
  textRed: { color: '#dc2626' },
  textGreen: { color: '#0A3D24' },
  emptyContainer: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#334155' },
  emptySub: { fontSize: 13, color: '#94a3b8', textAlign: 'center', marginTop: 4, paddingHorizontal: 20 },
});
