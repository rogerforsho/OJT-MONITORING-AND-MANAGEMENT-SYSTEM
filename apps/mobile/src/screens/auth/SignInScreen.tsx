import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { signIn } from '../../services/auth';
import NetworkToast from '../../components/NetworkToast';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;

export default function SignInScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSlow, setIsSlow] = useState(false);
  const [error, setError] = useState('');

  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState('');

  async function handleSignIn() {
    setError('');
    setLoading(true);
    setIsSlow(false);

    const timer = setTimeout(() => {
      setIsSlow(true);
    }, 2500);

    const result = await signIn({ email, password });
    clearTimeout(timer);
    setIsSlow(false);
    setLoading(false);

    if (result.error) {
      setError(result.error.message);
    }
  }

  async function handleReset() {
    if (!resetEmail.trim()) {
      setResetMsg('Please enter your institutional email.');
      return;
    }
    setResetLoading(true);
    setResetMsg('');
    const { requestPasswordReset } = await import('../../services/auth');
    const res = await requestPasswordReset(resetEmail);
    setResetLoading(false);
    if (res.error) {
      setResetMsg(res.error.message);
    } else {
      setResetMsg('If that email is registered, a password recovery link has been dispatched.');
    }
  }

  if (showForgot) {
    return (
      <View style={s.root}>
        <View style={s.inner}>
          <View style={s.card}>
            <Text style={s.title}>Password Recovery</Text>
            <Text style={s.subtitle}>Enter your institutional email to receive a recovery link.</Text>

            <Text style={s.label}>Institutional Email</Text>
            <TextInput
              style={s.input}
              value={resetEmail}
              onChangeText={setResetEmail}
              placeholder="username@cdm.edu.ph"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            
            {!!resetMsg && (
              <View style={resetMsg.includes('dispatched') ? s.alertSuccess : s.alertError}>
                <Text style={resetMsg.includes('dispatched') ? s.alertSuccessText : s.alertErrorText}>{resetMsg}</Text>
              </View>
            )}
            
            <TouchableOpacity style={s.btn} onPress={handleReset} disabled={resetLoading}>
              {resetLoading ? <ActivityIndicator color="#FFCC00" /> : <Text style={s.btnText}>Send Reset Link</Text>}
            </TouchableOpacity>
            
            <TouchableOpacity onPress={() => setShowForgot(false)} style={s.linkContainer}>
              <Text style={s.link}>← Return to Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
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
            <Text style={s.brandSub}>OJT Monitoring & Management System</Text>
            <View style={s.badge}>
              <Text style={s.badgeText}>ICS • IBE Trainee Portal</Text>
            </View>
          </View>

          {/* Action Card */}
          <View style={s.card}>
            <Text style={s.title}>Sign In</Text>
            <Text style={s.subtitle}>Enter your institutional credentials to continue.</Text>

            <Text style={s.label}>Institutional Email</Text>
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="username@cdm.edu.ph"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={s.label}>Password</Text>
            <View style={s.passwordContainer}>
              <TextInput
                style={s.passwordInput}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••••••"
                placeholderTextColor="#94a3b8"
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={s.eyeButton}
                activeOpacity={0.7}
              >
                <Text style={s.eyeIcon}>{showPassword ? '👁️' : '🔒'}</Text>
              </TouchableOpacity>
            </View>

            {!!error && (
              <View style={s.alertError}><Text style={s.alertErrorText}>{error}</Text></View>
            )}

            <TouchableOpacity style={s.btn} onPress={handleSignIn} disabled={loading} activeOpacity={0.85}>
              {loading ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator size="small" color="#FFCC00" />
                  <Text style={s.btnText}>
                    {isSlow ? 'Connecting to CdM servers...' : 'Authenticating...'}
                  </Text>
                </View>
              ) : (
                <Text style={s.btnText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <View style={s.row}>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={s.link}>Student Registration</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowForgot(true)}>
                <Text style={s.linkMuted}>Forgot password?</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* System Evaluation Footnote */}
          <Text style={s.footnote}>ISO/IEC 25010:2023 Evaluated • Version 1.0</Text>
        </View>
      </ScrollView>
      <NetworkToast isSlow={isSlow} />
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#062415' },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 40 },
  brand: { alignItems: 'center', marginBottom: 24 },
  logoContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#ffffff',
    padding: 3,
    borderWidth: 2.5,
    borderColor: '#FFCC00',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  logo: { width: '100%', height: '100%', borderRadius: 32 },
  brandTitle: { fontSize: 20, fontWeight: '900', color: '#FFCC00', letterSpacing: 0.5 },
  brandSub: { fontSize: 13, fontWeight: '700', color: '#ffffff', marginTop: 2 },
  badge: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: 'rgba(6,36,21,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255,204,0,0.4)',
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#FFCC00' },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  title: { fontSize: 22, fontWeight: '800', color: '#0A3D24', marginBottom: 2 },
  subtitle: { fontSize: 12, color: '#64748b', marginBottom: 18 },
  label: { fontSize: 12, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  input: {
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    marginBottom: 14,
    backgroundColor: '#f8fafc',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    marginBottom: 14,
    paddingRight: 10,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  eyeButton: { padding: 4 },
  eyeIcon: { fontSize: 16 },
  btn: {
    backgroundColor: '#0A3D24',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,204,0,0.3)',
    shadowColor: '#0A3D24',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  btnText: { color: '#FFCC00', fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  link: { fontSize: 12, color: '#0A3D24', fontWeight: '700' },
  linkMuted: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  linkContainer: { alignItems: 'center', marginTop: 8 },
  alertError: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  alertErrorText: { fontSize: 12, color: '#dc2626', fontWeight: '600' },
  alertSuccess: {
    backgroundColor: 'rgba(10,61,36,0.1)',
    borderWidth: 1,
    borderColor: '#0A3D24',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  alertSuccessText: { fontSize: 12, color: '#0A3D24', fontWeight: '700' },
  footnote: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
});
