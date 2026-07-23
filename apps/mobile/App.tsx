import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { supabase } from './src/lib/supabase';
import AuthNavigator from './src/navigation/AuthNavigator';
import StudentNavigator from './src/navigation/StudentNavigator';
import { getAuthUser } from './src/services/auth';
import { syncOfflineQueue } from './src/services/attendance';
import type { AuthUser } from '@ojt/shared';

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAuthUser().then(u => {
      setUser(u);
      setLoading(false);
      if (u?.role === 'Student') syncOfflineQueue();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
      } else if (event === 'SIGNED_IN') {
        const u = await getAuthUser();
        setUser(u);
        if (u?.role === 'Student') syncOfflineQueue();
      }
    });

    return () => subscription.unsubscribe();
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
