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
  const [dataPrivacyConsent, setDataPrivacyConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit() {
    setError('');
    if (!dataPrivacyConsent) {
      setError('Please agree to the Data Privacy Notice to register.');
      return;
    }
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

            {/* RA 10173 Data Privacy Consent */}
            <TouchableOpacity
              style={s.consentRow}
              onPress={() => setDataPrivacyConsent(!dataPrivacyConsent)}
              activeOpacity={0.8}
            >
              <View style={[s.checkbox, dataPrivacyConsent && s.checkboxChecked]}>
                {dataPrivacyConsent && <Text style={s.checkmark}>✓</Text>}
              </View>
              <Text style={s.consentText}>
                I consent to the collection of my academic & practicum records under the{' '}
                <Text style={{ fontWeight: '700', color: '#0A3D24' }}>Data Privacy Act (RA 10173)</Text>.
              </Text>
            </TouchableOpacity>

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
  subtitle: { fontSize: 12, color: '#64748b', marginBottom: 14 },
  fieldGroup: { marginBottom: 11 },
  label: { fontSize: 11, fontWeight: '700', color: '#334155', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  pillRow: { flexDirection: 'row', gap: 6, paddingVertical: 2 },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  pillActive: { borderColor: '#0A3D24', backgroundColor: '#0A3D24' },
  pillText: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  pillTextActive: { color: '#FFCC00' },
  fixedPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(10,61,36,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(10,61,36,0.2)',
  },
  fixedPillText: { fontSize: 12, fontWeight: '700', color: '#0A3D24' },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    backgroundColor: 'rgba(10,61,36,0.04)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(10,61,36,0.15)',
    marginVertical: 4,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#0A3D24',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: '#0A3D24' },
  checkmark: { color: '#FFCC00', fontSize: 10, fontWeight: '900' },
  consentText: { flex: 1, fontSize: 11, color: '#334155', lineHeight: 15 },
  alertError: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    padding: 9,
    marginBottom: 8,
  },
  alertErrorText: { color: '#b91c1c', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  btn: {
    backgroundColor: '#0A3D24',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  btnText: { color: '#FFCC00', fontSize: 14, fontWeight: '800' },
  linkCenter: { textAlign: 'center', color: '#64748b', fontSize: 12, marginTop: 14 },
  linkBold: { color: '#0A3D24', fontWeight: '800' },
});
