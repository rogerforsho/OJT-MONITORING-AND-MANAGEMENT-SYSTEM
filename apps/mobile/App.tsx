import { clearAttendanceIdentity } from './src/lib/attendanceCache';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { supabase } from './src/lib/supabase';
import AuthNavigator from './src/navigation/AuthNavigator';
import StudentNavigator from './src/navigation/StudentNavigator';
import { getAuthUser } from './src/services/auth';
import type { AuthUser } from '@ojt/shared';

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const refreshUser = async () => {
      try {
        const profile = await getAuthUser();
        if (!cancelled) setUser(profile);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void refreshUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        void clearAttendanceIdentity();
      } else if (event === 'SIGNED_IN') {
        // Supabase calls listeners under its auth lock. Query after it releases.
        setTimeout(() => { if (!cancelled) void refreshUser(); }, 0);
      }
    });

    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#14b8a6" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user && user.account_status === 'active' && user.role === 'Student'
        ? <StudentNavigator />
        : <AuthNavigator />
      }
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: '#042f2e', alignItems: 'center', justifyContent: 'center' },
});
