import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
  Image,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { signIn, requestInstitutionalPasswordReset } from '../../services/auth';
import NetworkToast from '../../components/NetworkToast';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'SignIn'>;
};

interface RememberedProfile {
  full_name: string;
  email: string;
  role: string;
}

const REMEMBERED_KEY = 'ojt_mobile_remembered_profile';

export default function SignInScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSlow, setIsSlow] = useState(false);
  const [error, setError] = useState('');

  // Quick Login / Remembered Profile State
  const [rememberedProfile, setRememberedProfile] = useState<RememberedProfile | null>(null);
  const [useAnotherAccount, setUseAnotherAccount] = useState(false);

  // Forgot Password / Account Recovery State
  const [showForgot, setShowForgot] = useState(false);
  const [resetRole, setResetRole] = useState<'Student' | 'Staff'>('Student');
  const [resetEmail, setResetEmail] = useState('');
  const [resetStudentNumber, setResetStudentNumber] = useState('');
  const [resetEmployeeNumber, setResetEmployeeNumber] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState('');

  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Load remembered profile from secure storage on launch
    SecureStore.getItemAsync(REMEMBERED_KEY)
      .then((stored) => {
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed && parsed.email) {
              setRememberedProfile(parsed);
              setEmail(parsed.email);
            }
          } catch (e) {
            console.error('Failed to parse remembered profile:', e);
          }
        }
      })
      .catch(() => {});
  }, []);

  async function handleSignIn() {
    setError('');
    setIsSlow(false);

    if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
    slowTimerRef.current = setTimeout(() => {
      setIsSlow(true);
    }, 2000);

    setLoading(true);

    const targetEmail = rememberedProfile && !useAnotherAccount ? rememberedProfile.email : email;
    const result = await signIn({ email: targetEmail, password });

    if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
    setLoading(false);
    setIsSlow(false);

    if (result.error) {
      setError(result.error.message);
    } else if (result.data) {
      // Save profile for quick login next time
      const profileToSave: RememberedProfile = {
        full_name: result.data.full_name,
        email: result.data.email,
        role: result.data.role,
      };
      setRememberedProfile(profileToSave);
      SecureStore.setItemAsync(REMEMBERED_KEY, JSON.stringify(profileToSave)).catch(() => {});
    }
  }

  async function handleRemoveRememberedProfile() {
    await SecureStore.deleteItemAsync(REMEMBERED_KEY).catch(() => {});
    setRememberedProfile(null);
    setUseAnotherAccount(true);
    setEmail('');
    setPassword('');
  }

  async function handleReset() {
    setResetMsg('');
    if (!resetEmail.trim()) {
      setResetMsg('Please enter your student email.');
      return;
    }
    if (!resetStudentNumber.trim()) {
      setResetMsg('Please enter your official CdM Student Number.');
      return;
    }

    setResetLoading(true);
    const result = await requestInstitutionalPasswordReset(resetEmail, resetStudentNumber, 'Student');
    setResetLoading(false);

    if (result.error) {
      setResetMsg(result.error.message);
    } else {
      setResetMsg('Identity verified! A secure password recovery link has been dispatched to your student inbox.');
    }
  }

  // VIEW 1: Account Recovery / Forgot Password Form
  if (showForgot) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.root}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={s.inner}>
            <View style={s.brand}>
              <View style={s.logoContainer}>
                <Image source={require('../../../assets/logo.png')} style={s.logo} resizeMode="contain" />
              </View>
              <Text style={s.brandTitle}>Colegio de Montalban</Text>
              <Text style={s.brandSub}>Student Trainee Account Recovery</Text>
            </View>

            <View style={s.card}>
              <Text style={s.title}>Reset Password</Text>
              <Text style={s.subtitle}>Verify your student identity to receive a recovery link.</Text>

              <View style={s.infoNotice}>
                <Ionicons name="shield-checkmark" size={14} color="#854d0e" />
                <Text style={s.infoNoticeText}>
                  <Text style={{ fontWeight: '800' }}>Student Verification:</Text> Please enter your official CdM Student Number (e.g. 2021-00123-CM) to verify account ownership.
                </Text>
              </View>

              <Text style={s.label}>Registered Student Email</Text>
              <TextInput
                style={s.input}
                value={resetEmail}
                onChangeText={setResetEmail}
                placeholder="student@cdm.edu.ph"
                placeholderTextColor="#94a3b8"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={s.label}>CdM Student ID Number</Text>
              <TextInput
                style={s.input}
                value={resetStudentNumber}
                onChangeText={setResetStudentNumber}
                placeholder="e.g. 2021-00123-CM"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
              />

              {!!resetMsg && (
                <View style={resetMsg.includes('dispatched') || resetMsg.includes('verified') ? s.alertSuccess : s.alertError}>
                  <Text style={resetMsg.includes('dispatched') || resetMsg.includes('verified') ? s.alertSuccessText : s.alertErrorText}>
                    {resetMsg}
                  </Text>
                </View>
              )}

              <TouchableOpacity style={s.btn} onPress={handleReset} disabled={resetLoading} activeOpacity={0.85}>
                {resetLoading ? (
                  <ActivityIndicator color="#FFCC00" />
                ) : (
                  <Text style={s.btnText}>Verify Student ID & Send Link</Text>
                )}
              </TouchableOpacity>

              <View style={{ marginTop: 10, padding: 10, backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' }}>
                <Text style={{ fontSize: 10, color: '#64748b', textAlign: 'center' }}>
                  👔 <Text style={{ fontWeight: '700' }}>Faculty or Coordinator?</Text> Please access the Web Portal on your computer to recover your staff account.
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => { setShowForgot(false); setResetMsg(''); }}
                style={s.linkContainer}
              >
                <Text style={s.link}>← Return to Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // VIEW 2: Remembered Account Quick Login Card (Like Google / Facebook)
  if (rememberedProfile && !useAnotherAccount) {
    const firstName = rememberedProfile.full_name.split(' ')[0] || 'User';

    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.root}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={s.inner}>
            <View style={s.brand}>
              <View style={s.logoContainer}>
                <Image source={require('../../../assets/logo.png')} style={s.logo} resizeMode="contain" />
              </View>
              <Text style={s.brandTitle}>Colegio de Montalban</Text>
              <Text style={s.brandSub}>OJT Monitoring & Management System</Text>
              <View style={s.badge}>
                <Text style={s.badgeText}>ICS • IBE Trainee Portal</Text>
              </View>
            </View>

            <View style={s.card}>
              {/* Profile Avatar Card */}
              <View style={s.quickProfileContainer}>
                <View style={s.quickAvatar}>
                  <Text style={s.quickAvatarText}>
                    {firstName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={s.quickName}>{rememberedProfile.full_name}</Text>
                <Text style={s.quickEmail}>{rememberedProfile.email}</Text>
                <View style={s.quickBadge}>
                  <Text style={s.quickBadgeText}>{rememberedProfile.role}</Text>
                </View>
              </View>

              <Text style={s.label}>Password for {firstName}</Text>
              <View style={s.passwordContainer}>
                <TextInput
                  style={s.passwordInput}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter password..."
                  placeholderTextColor="#94a3b8"
                  secureTextEntry={!showPassword}
                  autoFocus={true}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={s.eyeButton}
                  activeOpacity={0.7}
                >
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="#64748b" />
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
                  <Text style={s.btnText}>Continue as {firstName}</Text>
                )}
              </TouchableOpacity>

              <View style={s.row}>
                <TouchableOpacity onPress={() => setUseAnotherAccount(true)}>
                  <Text style={s.link}>Use Another Account</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleRemoveRememberedProfile}>
                  <Text style={s.linkMuted}>Remove Profile</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={s.footnote}>ISO/IEC 25010:2023 Evaluated • Version 1.0</Text>
          </View>
        </ScrollView>
        <NetworkToast isSlow={isSlow} />
      </KeyboardAvoidingView>
    );
  }

  // VIEW 3: Standard Clean Sign-In Form
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.root}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={s.inner}>
          {/* Institutional Brand Header */}
          <View style={s.brand}>
            <View style={s.logoContainer}>
              <Image source={require('../../../assets/logo.png')} style={s.logo} resizeMode="contain" />
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
                placeholder="••••••••"
                placeholderTextColor="#94a3b8"
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={s.eyeButton}
                activeOpacity={0.7}
              >
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="#64748b" />
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

            {rememberedProfile && useAnotherAccount && (
              <TouchableOpacity
                onPress={() => setUseAnotherAccount(false)}
                style={{ marginTop: 14, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 12, color: '#0A3D24', fontWeight: '700' }}>
                  ← Back to {rememberedProfile.full_name.split(' ')[0]}'s Account
                </Text>
              </TouchableOpacity>
            )}
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 3,
    marginBottom: 14,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  tabTextActive: { color: '#0A3D24', fontWeight: '800' },
  infoNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fefce8',
    borderWidth: 1,
    borderColor: '#fef08a',
    borderRadius: 10,
    padding: 10,
    gap: 8,
    marginBottom: 14,
  },
  infoNoticeText: { fontSize: 11, color: '#854d0e', flex: 1, lineHeight: 16 },
  quickProfileContainer: {
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
  },
  quickAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0A3D24',
    borderWidth: 2,
    borderColor: '#FFCC00',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickAvatarText: { color: '#FFCC00', fontSize: 22, fontWeight: '900' },
  quickName: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  quickEmail: { fontSize: 12, color: '#64748b', marginTop: 1 },
  quickBadge: {
    marginTop: 6,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 12,
  },
  quickBadgeText: { fontSize: 10, fontWeight: '800', color: '#047857', textTransform: 'uppercase' },
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
