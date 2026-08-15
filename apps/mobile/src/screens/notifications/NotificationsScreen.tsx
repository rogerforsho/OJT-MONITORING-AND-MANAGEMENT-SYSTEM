import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, StyleSheet,
} from 'react-native';
import { listStudentFeed, markNotificationRead, type MobileFeedItem } from '../../services/notifications';

export default function NotificationsScreen() {
  const [feed, setFeed] = useState<MobileFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'announcements' | 'alerts'>('all');

  const load = useCallback(async () => {
    setError('');
    const res = await listStudentFeed();
    if (res.error) {
      setError(res.error.message);
    } else {
      setFeed(res.data || []);
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

  const handleItemPress = async (item: MobileFeedItem) => {
    if (item.type === 'notification' && item.status === 'unread') {
      await markNotificationRead(item.id);
      setFeed(prev => prev.map(f => f.id === item.id ? { ...f, status: 'read' } : f));
    }
  };

  const filteredFeed = feed.filter(item => {
    if (filter === 'announcements') return item.type === 'announcement';
    if (filter === 'alerts') return item.type === 'notification';
    return true;
  });

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Notifications</Text>
        <Text style={s.subtitle}>Announcements & Status Updates</Text>

        {/* Filter Pills */}
        <View style={s.filterRow}>
          <TouchableOpacity
            onPress={() => setFilter('all')}
            style={[s.filterPill, filter === 'all' && s.filterPillActive]}
          >
            <Text style={[s.filterText, filter === 'all' && s.filterTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFilter('announcements')}
            style={[s.filterPill, filter === 'announcements' && s.filterPillActive]}
          >
            <Text style={[s.filterText, filter === 'announcements' && s.filterTextActive]}>
              📢 Announcements
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFilter('alerts')}
            style={[s.filterPill, filter === 'alerts' && s.filterPillActive]}
          >
            <Text style={[s.filterText, filter === 'alerts' && s.filterTextActive]}>
              🔔 Direct Alerts
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {!!error && (
        <View style={s.alertError}>
          <Text style={s.alertErrorText}>⚠ {error}</Text>
        </View>
      )}

      {/* Feed List */}
      <FlatList
        data={filteredFeed}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0f766e']} />}
        ListEmptyComponent={
          <View style={s.emptyBox}>
            <Text style={{ fontSize: 36, marginBottom: 8 }}>🔔</Text>
            <Text style={s.emptyTitle}>No notifications</Text>
            <Text style={s.emptySub}>
              You're all caught up with your OJT coordinator and supervisor updates.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isAnnouncement = item.type === 'announcement';
          const isUnread = item.status === 'unread';

          return (
            <TouchableOpacity
              onPress={() => handleItemPress(item)}
              activeOpacity={0.85}
              style={[s.feedCard, isUnread && s.feedCardUnread]}
            >
              <View style={s.cardTop}>
                <View style={s.tagRow}>
                  <Text style={{ fontSize: 14 }}>{isAnnouncement ? '📢' : '🔔'}</Text>
                  <Text style={s.tagText}>
                    {isAnnouncement ? 'ANNOUNCEMENT' : 'DIRECT NOTICE'}
                  </Text>
                </View>
                <Text style={s.dateText}>
                  {new Date(item.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                </Text>
              </View>

              <Text style={s.feedTitle}>{item.title}</Text>
              <Text style={s.feedMessage}>{item.message}</Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16 },
  title: { fontSize: 26, fontWeight: '800', color: '#0f172a' },
  subtitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
  filterRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  filterPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0' },
  filterPillActive: { backgroundColor: '#0f766e', borderColor: '#0f766e' },
  filterText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  filterTextActive: { color: '#ffffff' },
  alertError: { marginHorizontal: 24, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 12, padding: 12, marginBottom: 12 },
  alertErrorText: { color: '#dc2626', fontSize: 13, fontWeight: '600' },
  listContent: { paddingHorizontal: 24, paddingBottom: 32, gap: 12 },
  feedCard: { backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  feedCardUnread: { backgroundColor: '#f0fdfa', borderColor: '#99f6e4' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tagText: { fontSize: 11, fontWeight: '800', color: '#0f766e', letterSpacing: 0.5 },
  dateText: { fontSize: 11, color: '#94a3b8' },
  feedTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  feedMessage: { fontSize: 13, color: '#475569', lineHeight: 18 },
  emptyBox: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#334155' },
  emptySub: { fontSize: 13, color: '#94a3b8', textAlign: 'center', marginTop: 4, paddingHorizontal: 20 },
});
