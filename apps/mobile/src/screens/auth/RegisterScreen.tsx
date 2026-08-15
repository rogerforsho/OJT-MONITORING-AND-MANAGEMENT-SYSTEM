import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, StyleSheet,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { registerStudent } from '../../services/auth';

type Props = { navigation: NativeStackNavigationProp<AuthStackParamList, 'Register'> };

const COURSES = ['BSIT', 'BSBA', 'BSCS', 'BSECE', 'BSA', 'BSHM'];

export default function RegisterScreen({ navigation }: Props) {
  const [form, setForm] = useState({
    full_name: '', email: '', password: '', confirm_password: '',
    student_number: '', course: '', year_level: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit() {
    setError('');
    if (form.password !== form.confirm_password) { setError('Passwords do not match.'); return; }
    setLoading(true);
    const result = await registerStudent({
      full_name: form.full_name, email: form.email, password: form.password,
      student_number: form.student_number, course: form.course,
      year_level: parseInt(form.year_level) || 0,
    });
    setLoading(false);
    if (result.error) { setError(result.error.message); return; }
    navigation.navigate('Pending');
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.root}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={s.inner}>
          <View style={s.brand}>
            <View style={s.brandIcon}><Text style={{ fontSize: 28 }}>🎓</Text></View>
            <Text style={s.brandTitle}>OJT Monitoring System</Text>
            <Text style={s.brandSub}>Colegio de Montalban</Text>
          </View>
          <View style={s.card}>
            <Text style={s.title}>Student Registration</Text>
            <Text style={s.subtitle}>Create your account. Approval required before access.</Text>

            {([
              { label: 'Full Name', field: 'full_name', placeholder: 'Juan Dela Cruz', keyboard: 'default' },
              { label: 'Email', field: 'email', placeholder: 'you@example.com', keyboard: 'email-address' },
              { label: 'Student Number', field: 'student_number', placeholder: '2024-00001', keyboard: 'default' },
            ] as const).map(({ label, field, placeholder, keyboard }) => (
              <View key={field} style={s.fieldGroup}>
                <Text style={s.label}>{label}</Text>
                <TextInput style={s.input} value={form[field]} onChangeText={(v: string) => set(field, v)}
                  placeholder={placeholder} keyboardType={keyboard}
                  autoCapitalize={field === 'email' ? 'none' : 'words'} />
              </View>
            ))}

            <View style={s.fieldGroup}>
              <Text style={s.label}>Course</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={s.pillRow}>
                  {COURSES.map(c => (
                    <TouchableOpacity key={c} onPress={() => set('course', c)}
                      style={[s.pill, form.course === c && s.pillActive]}>
                      <Text style={[s.pillText, form.course === c && s.pillTextActive]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={s.fieldGroup}>
              <Text style={s.label}>Year Level</Text>
              <View style={s.pillRow}>
                {[4].map(y => (
                  <TouchableOpacity key={y} onPress={() => set('year_level', String(y))}
                    style={[s.pill, s.pillFlex, form.year_level === String(y) && s.pillActive]}>
                    <Text style={[s.pillText, form.year_level === String(y) && s.pillTextActive]}>4th Year Intern</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {([
              { label: 'Password', field: 'password', placeholder: 'Min. 8 characters' },
              { label: 'Confirm Password', field: 'confirm_password', placeholder: 'Re-enter password' },
            ] as const).map(({ label, field, placeholder }) => (
              <View key={field} style={s.fieldGroup}>
                <Text style={s.label}>{label}</Text>
                <TextInput style={s.input} value={form[field]} onChangeText={(v: string) => set(field, v)}
                  placeholder={placeholder} secureTextEntry />
              </View>
            ))}

            {!!error && (
              <View style={s.alertError}><Text style={s.alertErrorText}>{error}</Text></View>
            )}

            <TouchableOpacity style={s.btn} onPress={handleSubmit} disabled={loading}>
              {loading ? <ActivityIndicator color="white" /> : <Text style={s.btnText}>Create Account</Text>}
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
  root: { flex: 1, backgroundColor: '#042f2e' },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 48 },
  brand: { alignItems: 'center', marginBottom: 32 },
  brandIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(20,184,166,0.2)', borderWidth: 1, borderColor: 'rgba(94,234,212,0.3)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  brandTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  brandSub: { fontSize: 13, color: 'rgba(153,246,228,0.7)', marginTop: 4 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 24 },
  title: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#64748b', marginBottom: 20 },
  fieldGroup: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '500', color: '#334155', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#0f172a' },
  pillRow: { flexDirection: 'row', gap: 8 },
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  pillFlex: { flex: 1, alignItems: 'center' },
  pillActive: { backgroundColor: '#0f766e', borderColor: '#0f766e' },
  pillText: { fontSize: 12, fontWeight: '500', color: '#334155' },
  pillTextActive: { color: '#fff' },
  btn: { backgroundColor: '#0f766e', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginBottom: 16, marginTop: 4 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  alertError: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 12 },
  alertErrorText: { fontSize: 13, color: '#dc2626' },
  linkCenter: { textAlign: 'center', fontSize: 13, color: '#64748b' },
  linkBold: { color: '#0f766e', fontWeight: '500' },
});
