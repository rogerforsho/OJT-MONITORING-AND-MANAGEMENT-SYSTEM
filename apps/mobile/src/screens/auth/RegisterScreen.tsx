import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, StyleSheet, Image,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { registerStudent } from '../../services/auth';

type Props = { navigation: NativeStackNavigationProp<AuthStackParamList, 'Register'> };

const ICS_IBE_COURSES = ['BSIT', 'BSCS', 'BSBA-MKT', 'BSBA-HRM', 'BSBA-FM', 'BSA'];

export default function RegisterScreen({ navigation }: Props) {
  const [form, setForm] = useState({
    full_name: '', email: '', password: '', confirm_password: '',
    student_number: '', course: 'BSIT', year_level: '4',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit() {
    setError('');
    if (!form.full_name.trim() || !form.email.trim() || !form.student_number.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    if (form.password !== form.confirm_password) {
      setError('Passwords do not match.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    const result = await registerStudent({
      full_name: form.full_name,
      email: form.email,
      password: form.password,
      student_number: form.student_number,
      course: form.course,
      year_level: 4,
    });
    setLoading(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    navigation.navigate('Pending');
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.root}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={s.inner}>
          {/* Institutional Brand Header */}
          <View style={s.brand}>
            <View style={s.logoContainer}>
              <Image
                source={require('../../../assets/logo.png')}
                style={s.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={s.brandTitle}>Colegio de Montalban</Text>
            <Text style={s.brandSub}>OJT Trainee Registration</Text>
            <View style={s.badge}>
              <Text style={s.badgeText}>ICS &bull; IBE 4th-Year Standing</Text>
            </View>
          </View>

          {/* Action Card */}
          <View style={s.card}>
            <Text style={s.title}>Create Trainee Account</Text>
            <Text style={s.subtitle}>Coordinator review & approval required before sign in.</Text>

            {([
              { label: 'Full Legal Name', field: 'full_name', placeholder: 'Juan Dela Cruz', keyboard: 'default' },
              { label: 'Institutional Email', field: 'email', placeholder: 'username@cdm.edu.ph', keyboard: 'email-address' },
              { label: 'Student Number', field: 'student_number', placeholder: '2021-00001', keyboard: 'default' },
            ] as const).map(({ label, field, placeholder, keyboard }) => (
              <View key={field} style={s.fieldGroup}>
                <Text style={s.label}>{label}</Text>
                <TextInput
                  style={s.input}
                  value={form[field]}
                  onChangeText={(v: string) => set(field, v)}
                  placeholder={placeholder}
                  placeholderTextColor="#94a3b8"
                  keyboardType={keyboard}
                  autoCapitalize={field === 'email' ? 'none' : 'words'}
                />
              </View>
            ))}

            {/* Course Selector */}
            <View style={s.fieldGroup}>
              <Text style={s.label}>Program / Degree (ICS &bull; IBE)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
                <View style={s.pillRow}>
                  {ICS_IBE_COURSES.map(c => (
                    <TouchableOpacity
                      key={c}
                      onPress={() => set('course', c)}
                      style={[s.pill, form.course === c && s.pillActive]}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.pillText, form.course === c && s.pillTextActive]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Year Level (Fixed 4th Year) */}
            <View style={s.fieldGroup}>
              <Text style={s.label}>Year Standing</Text>
              <View style={s.fixedPill}>
                <Text style={s.fixedPillText}>🎓 4th Year Graduating Trainee</Text>
              </View>
            </View>

            {([
              { label: 'Password', field: 'password', placeholder: 'Min. 8 characters' },
              { label: 'Confirm Password', field: 'confirm_password', placeholder: 'Re-enter password' },
            ] as const).map(({ label, field, placeholder }) => (
              <View key={field} style={s.fieldGroup}>
                <Text style={s.label}>{label}</Text>
                <TextInput
                  style={s.input}
                  value={form[field]}
                  onChangeText={(v: string) => set(field, v)}
                  placeholder={placeholder}
                  placeholderTextColor="#94a3b8"
                  secureTextEntry
                />
              </View>
            ))}

            {!!error && (
              <View style={s.alertError}><Text style={s.alertErrorText}>{error}</Text></View>
            )}

            <TouchableOpacity style={s.btn} onPress={handleSubmit} disabled={loading} activeOpacity={0.85}>
              {loading ? <ActivityIndicator color="#FFCC00" /> : <Text style={s.btnText}>Submit Registration</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
              <Text style={s.linkCenter}>
                Already have an account? <Text style={s.linkBold}>Sign in</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#062415' },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 40 },
  brand: { alignItems: 'center', marginBottom: 20 },
  logoContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ffffff',
    padding: 2.5,
    borderWidth: 2,
    borderColor: '#FFCC00',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  logo: { width: '100%', height: '100%', borderRadius: 28 },
  brandTitle: { fontSize: 18, fontWeight: '900', color: '#FFCC00' },
  brandSub: { fontSize: 12, fontWeight: '700', color: '#ffffff', marginTop: 2 },
  badge: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 2.5,
    borderRadius: 16,
    backgroundColor: 'rgba(6,36,21,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255,204,0,0.4)',
  },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#FFCC00' },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  title: { fontSize: 20, fontWeight: '800', color: '#0A3D24', marginBottom: 2 },
  subtitle: { fontSize: 11, color: '#64748b', marginBottom: 16 },
  fieldGroup: { marginBottom: 10 },
  label: { fontSize: 11, fontWeight: '700', color: '#1e293b', marginBottom: 3 },
  input: {
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  pillRow: { flexDirection: 'row', gap: 6, paddingVertical: 2, paddingHorizontal: 4 },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  pillActive: {
    backgroundColor: '#0A3D24',
    borderColor: '#0A3D24',
  },
  pillText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  pillTextActive: { color: '#FFCC00' },
  fixedPill: {
    backgroundColor: 'rgba(10,61,36,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(10,61,36,0.3)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  fixedPillText: { fontSize: 12, fontWeight: '700', color: '#0A3D24' },
  btn: {
    backgroundColor: '#0A3D24',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,204,0,0.3)',
  },
  btnText: { color: '#FFCC00', fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },
  alertError: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  alertErrorText: { fontSize: 12, color: '#dc2626', fontWeight: '600' },
  linkCenter: { textAlign: 'center', fontSize: 12, color: '#64748b' },
  linkBold: { color: '#0A3D24', fontWeight: '700' },
});
