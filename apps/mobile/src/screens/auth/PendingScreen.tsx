import { View, Text, TouchableOpacity } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';

type Props = { navigation: NativeStackNavigationProp<AuthStackParamList, 'Pending'> };

export default function PendingScreen({ navigation }: Props) {
  return (
    <View className="flex-1 bg-teal-950 justify-center px-6">
      <View className="bg-white rounded-2xl p-6 shadow-xl items-center">
        <View className="w-16 h-16 rounded-full bg-teal-50 border-2 border-teal-200 items-center justify-center mb-4">
          <Text className="text-3xl">⏳</Text>
        </View>
        <Text className="text-xl font-bold text-slate-900 mb-2">Registration Submitted</Text>
        <Text className="text-sm text-slate-500 text-center leading-relaxed mb-5">
          Your account is pending approval by the OJT Coordinator. You'll be able to sign in once approved.
        </Text>

        <View className="w-full bg-teal-50 border border-teal-100 rounded-xl px-4 py-4 mb-5">
          <Text className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-2">What happens next?</Text>
          {[
            'Your registration details are reviewed by the Coordinator',
            'You will be notified once approved',
            'Sign in after approval to access your OJT dashboard',
          ].map((item, i) => (
            <View key={i} className="flex-row gap-2 mb-1.5">
              <Text className="text-teal-500 text-sm">✓</Text>
              <Text className="text-sm text-slate-600 flex-1">{item}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
          <Text className="text-sm text-teal-700 font-medium">Back to Sign In</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
