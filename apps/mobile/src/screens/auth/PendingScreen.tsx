import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';

type Props = { navigation: NativeStackNavigationProp<AuthStackParamList, 'Pending'> };

export default function PendingScreen({ navigation }: Props) {
  return (
    <View style={s.root}>
      <View style={s.card}>
        <View style={s.iconWrapper}>
          <Text style={{ fontSize: 32 }}>⏳</Text>
        </View>
        <Text style={s.title}>Registration Submitted</Text>
        <Text style={s.subtitle}>
          Your account is pending review and approval by the OJT Coordinator. You will be able to sign in once approved.
        </Text>

        <View style={s.infoBox}>
          <Text style={s.infoTitle}>What happens next?</Text>
          {[
            'Your registration details are validated by the Coordinator',
            'You will be notified once your account is active',
            'Sign in after approval to access your OJT dashboard',
          ].map((item, i) => (
            <View key={i} style={s.stepRow}>
              <Text style={s.check}>✓</Text>
              <Text style={s.stepText}>{item}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={s.btn} onPress={() => navigation.navigate('SignIn')}>
          <Text style={s.btnText}>Back to Sign In</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#042f2e', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  card: { backgroundColor: '#ffffff', borderRadius: 24, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5 },
  iconWrapper: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#f0fdfa', borderWidth: 2, borderColor: '#99f6e4', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  infoBox: { width: '100%', backgroundColor: '#f0fdfa', borderWidth: 1, borderColor: '#ccfbf1', borderRadius: 16, padding: 16, marginBottom: 24 },
  infoTitle: { fontSize: 12, fontWeight: '700', color: '#0f766e', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  stepRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  check: { color: '#0d9488', fontSize: 14, fontWeight: '700' },
  stepText: { fontSize: 13, color: '#334155', flex: 1, lineHeight: 18 },
  btn: { width: '100%', backgroundColor: '#0f766e', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
});
