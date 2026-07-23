import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { fetchOwnAttendance } from '../../services/attendance';
import type { DbAttendance } from '@ojt/shared';

const PAGE_SIZE = 20;

function StatusPill({ value, type }: { value: string; type: 'verification' | 'late' | 'sync' }) {
  const colors: Record<string, string> = {
    verified: 'bg-teal-100 text-teal-700',
    pending: 'bg-amber-100 text-amber-700',
    rejected: 'bg-red-100 text-red-600',
    on_time: 'bg-teal-100 text-teal-700',
    late: 'bg-red-100 text-red-600',
    unknown: 'bg-slate-100 text-slate-500',
    synced: 'bg-teal-100 text-teal-700',
    pending_sync: 'bg-blue-100 text-blue-700',
    conflict: 'bg-red-100 text-red-600',
  };
  const style = colors[value] ?? 'bg-slate-100 text-slate-500';
  return (
    <View className={`px-2 py-0.5 rounded-full ${style.split(' ')[0]}`}>
      <Text className={`text-xs font-medium capitalize ${style.split(' ')[1]}`}>
        {value.replace('_', ' ')}
      </Text>
    </View>
  );
}

export default function AttendanceHistoryScreen() {
  const [records, setRecords] = useState<DbAttendance[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (p: number, append = false) => {
    if (p === 1) setLoading(true); else setLoadingMore(true);
    setError('');
    const result = await fetchOwnAttendance(p, PAGE_SIZE);
    if (p === 1) setLoading(false); else setLoadingMore(false);
    if (result.error) { setError(result.error.message); return; }
    setRecords(prev => append ? [...prev, ...result.data!.records] : result.data!.records);
    setTotal(result.data!.total);
  }, []);

  useEffect(() => { load(1); }, [load]);

  function loadMore() {
    const nextPage = page + 1;
    if (records.length >= total) return;
    setPage(nextPage);
    load(nextPage, true);
  }

  if (loading) {
    return (
      <View className="flex-1 bg-slate-50 items-center justify-center">
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50">
      <View className="px-6 pt-6 pb-4">
        <Text className="text-2xl font-bold text-slate-900">Attendance History</Text>
        <Text className="text-sm text-slate-500 mt-0.5">{total} record{total !== 1 ? 's' : ''}</Text>
      </View>

      {!!error && (
        <View className="mx-6 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
          <Text className="text-red-600 text-sm">{error}</Text>
        </View>
      )}

      <FlatList
        data={records}
        keyExtractor={item => item.attendance_id}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24, gap: 12 }}
        ListEmptyComponent={
          <View className="items-center py-20">
            <Text className="text-4xl mb-3">📋</Text>
            <Text className="text-slate-400 text-sm">No attendance records yet.</Text>
          </View>
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={loadingMore ? <ActivityIndicator color="#0f766e" className="py-4" /> : null}
        renderItem={({ item }) => (
          <View className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <View className="flex-row justify-between items-start mb-3">
              <Text className="font-semibold text-slate-900">{item.attendance_date}</Text>
              <StatusPill value={item.verification_status} type="verification" />
            </View>
            <View className="flex-row gap-4 mb-3">
              <View className="flex-1">
                <Text className="text-xs text-slate-400 mb-0.5">Time In</Text>
                <Text className="text-sm font-medium text-slate-900">
                  {new Date(item.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-xs text-slate-400 mb-0.5">Time Out</Text>
                <Text className={`text-sm font-medium ${item.time_out ? 'text-slate-900' : 'text-amber-500'}`}>
                  {item.time_out
                    ? new Date(item.time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : 'Pending'}
                </Text>
              </View>
            </View>
            <View className="flex-row gap-2 flex-wrap">
              <StatusPill value={item.late_status} type="late" />
              <StatusPill value={item.sync_status} type="sync" />
              {item.sync_status === 'conflict' && (
                <Text className="text-xs text-red-500 self-center">Contact coordinator</Text>
              )}
            </View>
          </View>
        )}
      />
    </View>
  );
}
