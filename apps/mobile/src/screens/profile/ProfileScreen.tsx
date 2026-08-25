import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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

      let assignment = null;
      if (student?.student_id) {
        const { data: assignData } = await supabase
          .from('student_assignments')
          .select(`
            *,
            companies ( company_name ),
            supervisors ( users ( full_name ) )
          `)
          .eq('student_id', student.student_id)
          .eq('assignment_status', 'active')
          .maybeSingle();
        assignment = assignData;
      }

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

  const course = (profile?.student?.course || '').toUpperCase();
  const isICS = course.includes('BSIT') || course.includes('BS-CPE') || course.includes('BSCPE') || course.includes('INFORMATION TECHNOLOGY') || course.includes('COMPUTER ENGINEERING');
  const departmentName = isICS ? 'Institute of Computing Studies (ICS)' : 'Institute of Business and Entrepreneurship (IBE)';

  const supervisorUser = (profile?.assignment?.supervisors as any)?.users;
  const supervisorName = Array.isArray(supervisorUser)
    ? supervisorUser[0]?.full_name
    : supervisorUser?.full_name || 'Designated by Host';

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
            <Text style={s.value}>{departmentName}</Text>
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
            <Text style={s.value}>{supervisorName}</Text>
          </View>
        </View>

        {/* System Status Notice */}
        <View style={s.infoCard}>
          <Ionicons name="shield-checkmark-outline" size={16} color="#0A3D24" />
          <Text style={s.infoText}>Colegio de Montalban OJT Practicum Platform</Text>
        </View>

        {/* Single Dedicated Sign Out Button */}
        <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut} disabled={loggingOut} activeOpacity={0.85}>
          {loggingOut ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="log-out-outline" size={18} color="#ffffff" />
              <Text style={s.signOutBtnText}>Sign Out</Text>
            </View>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: '100%', height: '100%', borderRadius: 32 },
  name: { fontSize: 18, fontWeight: '800', color: '#ffffff', textAlign: 'center', marginBottom: 2 },
  email: { fontSize: 12, color: '#94a3b8', textAlign: 'center', marginBottom: 12 },
  badge: {
    backgroundColor: 'rgba(255,204,0,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,204,0,0.4)',
  },
  badgeText: { fontSize: 11, fontWeight: '800', color: '#FFCC00', textTransform: 'uppercase', letterSpacing: 0.5 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  cardTitle: { fontSize: 11, fontWeight: '800', color: '#0A3D24', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  value: { fontSize: 13, fontWeight: '700', color: '#1e293b', flex: 1, textAlign: 'right' },
  valueBold: { fontSize: 14, fontWeight: '900', color: '#0A3D24' },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 10 },
  infoCard: {
    backgroundColor: 'rgba(10,61,36,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(10,61,36,0.15)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  infoText: { fontSize: 11, color: '#0A3D24', fontWeight: '700', textAlign: 'center' },
  signOutBtn: {
    backgroundColor: '#e11d48',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#e11d48',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  signOutBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
});