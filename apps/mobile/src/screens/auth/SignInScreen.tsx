import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, StyleSheet,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { signIn, requestPasswordReset } from '../../services/auth';

type Props = { navigation: NativeStackNavigationProp<AuthStackParamList, 'SignIn'> };

export default function SignInScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState('');

  async function handleSignIn() {
    setError('');
    setLoading(true);
    const result = await signIn({ email, password });
    setLoading(false);
    if (result.error) { setError(result.error.message); return; }
  }

  async function handleReset() {
    setResetMsg('');
    setResetLoading(true);
    const result = await requestPasswordReset(resetEmail);
    setResetLoading(false);
    setResetMsg(result.error ? result.error.message : 'If that email is registered, a reset link has been sent.');
  }

  if (showForgot) {
    return (
      <View style={s.root}>
        <View style={s.card}>
          <Text style={s.title}>Reset Password</Text>
          <Text style={s.subtitle}>Enter your email to receive a reset link.</Text>
          <Text style={s.label}>Email</Text>
          <TextInput style={s.input} value={resetEmail} onChangeText={setResetEmail}
            placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
          {!!resetMsg && (
            <View style={resetMsg.includes('sent') ? s.alertSuccess : s.alertError}>
              <Text style={resetMsg.includes('sent') ? s.alertSuccessText : s.alertErrorText}>{resetMsg}</Text>
            </View>
          )}
          <TouchableOpacity style={s.btn} onPress={handleReset} disabled={resetLoading}>
            {resetLoading ? <ActivityIndicator color="white" /> : <Text style={s.btnText}>Send Reset Link</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowForgot(false)}>
            <Text style={s.link}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
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
            <Text style={s.title}>Welcome back</Text>
            <Text style={s.subtitle}>Sign in to your OJT account</Text>
            <Text style={s.label}>Email</Text>
            <TextInput style={s.input} value={email} onChangeText={setEmail}
              placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
            <Text style={s.label}>Password</Text>
            <TextInput style={s.input} value={password} onChangeText={setPassword}
              placeholder="••••••••" secureTextEntry />
            {!!error && (
              <View style={s.alertError}><Text style={s.alertErrorText}>{error}</Text></View>
            )}
            <TouchableOpacity style={s.btn} onPress={handleSignIn} disabled={loading}>
              {loading ? <ActivityIndicator color="white" /> : <Text style={s.btnText}>Sign In</Text>}
            </TouchableOpacity>
            <View style={s.row}>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={s.link}>Create an account</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowForgot(true)}>
                <Text style={s.linkMuted}>Forgot password?</Text>
              </TouchableOpacity>
            </View>
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
  label: { fontSize: 13, fontWeight: '500', color: '#334155', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#0f172a', marginBottom: 12 },
  btn: { backgroundColor: '#0f766e', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginBottom: 16 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  link: { fontSize: 13, color: '#0f766e' },
  linkMuted: { fontSize: 13, color: '#94a3b8' },
  alertError: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 12 },
  alertErrorText: { fontSize: 13, color: '#dc2626' },
  alertSuccess: { backgroundColor: '#f0fdfa', borderWidth: 1, borderColor: '#99f6e4', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 12 },
  alertSuccessText: { fontSize: 13, color: '#0f766e' },
});
