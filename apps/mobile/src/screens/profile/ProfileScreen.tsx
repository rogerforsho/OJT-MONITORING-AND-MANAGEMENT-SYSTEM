import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { signOut } from '../../services/auth';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: student } = await supabase
        .from('students')
        .select('*, users(full_name, email)')
        .eq('user_id', user.id)
        .maybeSingle();

      const { data: assignment } = await supabase
        .from('student_assignments')
        .select('*, companies(company_name), supervisors:users!supervisors_user_id_fkey(full_name)')
        .eq('student_id', student?.student_id)
        .eq('assignment_status', 'active')
        .maybeSingle();

      setProfile({ user, student, assignment });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function handleSignOut() {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of your Colegio de Montalban OJT account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);
            await signOut();
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: '#062415' }]}>
        <ActivityIndicator color="#FFCC00" size="large" />
      </View>
    );
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={s.header}>
          <View style={s.logoContainer}>
            <Image
              source={require('../../../assets/logo.png')}
              style={s.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={s.name}>{profile?.student?.users?.full_name || profile?.user?.email || 'Student Trainee'}</Text>
          <Text style={s.email}>{profile?.user?.email}</Text>
          <View style={s.badge}>
            <Text style={s.badgeText}>{profile?.student?.course || 'BSIT'} &bull; 4th Year Intern</Text>
          </View>
        </View>

        {/* Academic Details Card */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Academic Standing</Text>
          <View style={s.row}>
            <Text style={s.label}>Student Number</Text>
            <Text style={s.value}>{profile?.student?.student_number || 'N/A'}</Text>
          </View>
          <View style={s.divider} />
          <View style={s.row}>
            <Text style={s.label}>Institution</Text>
            <Text style={s.value}>Colegio de Montalban</Text>
          </View>
          <View style={s.divider} />
          <View style={s.row}>
            <Text style={s.label}>Department</Text>
            <Text style={s.value}>Institute of Computing Studies</Text>
          </View>
          <View style={s.divider} />
          <View style={s.row}>
            <Text style={s.label}>Required Practicum</Text>
            <Text style={s.valueBold}>486.0 Hours</Text>
          </View>
        </View>

        {/* Host Training Establishment Card */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Host Training Placement</Text>
          <View style={s.row}>
            <Text style={s.label}>Company</Text>
            <Text style={s.value}>{profile?.assignment?.companies?.company_name || 'Assignment Pending'}</Text>
          </View>
          <View style={s.divider} />
          <View style={s.row}>
            <Text style={s.label}>Supervisor</Text>
            <Text style={s.value}>{profile?.assignment?.supervisors?.full_name || 'Designated by Host'}</Text>
          </View>
        </View>

        {/* Technical Standard Notice */}
        <View style={s.infoCard}>
          <Text style={s.infoText}>🛡️ ISO/IEC 25010:2023 Evaluated Enterprise Standard</Text>
        </View>

        {/* Single Dedicated Sign Out Button */}
        <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut} disabled={loggingOut} activeOpacity={0.85}>
          {loggingOut ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={s.signOutBtnText}>🚪 Sign Out</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f4f6f9' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: 20, paddingBottom: 40 },
  header: {
    backgroundColor: '#062415',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,204,0,0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ffffff',
    padding: 3,
    borderWidth: 2.5,
    borderColor: '#FFCC00',
    marginBottom: 12,
  },
  logo: { width: '100%', height: '100%', borderRadius: 34 },
  name: { fontSize: 20, fontWeight: '900', color: '#ffffff', textAlign: 'center' },
  email: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  badge: {
    marginTop: 10,
    backgroundColor: 'rgba(255,204,0,0.15)',
    borderWidth: 1,
    borderColor: '#FFCC00',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: { fontSize: 12, fontWeight: '800', color: '#FFCC00' },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: { fontSize: 13, fontWeight: '800', color: '#0A3D24', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 6 },
  label: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  value: { fontSize: 13, color: '#0f172a', fontWeight: '600' },
  valueBold: { fontSize: 13, color: '#0A3D24', fontWeight: '800' },
  infoCard: {
    backgroundColor: 'rgba(10,61,36,0.06)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(10,61,36,0.15)',
  },
  infoText: { fontSize: 11, color: '#0A3D24', fontWeight: '700' },
  signOutBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 4,
  },
  signOutBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
});
