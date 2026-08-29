import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { StatusBar, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Display } from '../../components/Display';
import { MonoLabel } from '../../components/MonoLabel';
import { SlabButton } from '../../components/SlabButton';
import { useThemeColors } from '../../hooks/useThemeColors';

export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
};

type NavProp = NativeStackNavigationProp<AuthStackParamList, 'Welcome'>;

export default function WelcomeScreen() {
  const navigation = useNavigation<NavProp>();
  const { barStyle, bg, ink, muted, accent } = useThemeColors();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      <StatusBar barStyle={barStyle} />
      <View style={{ flex: 1, padding: 28, justifyContent: 'space-between' }}>
        <View>
          <MonoLabel color={accent} size={12} letterSpacing={12 * 0.28}>Momentum</MonoLabel>
          <View style={{ width: 72, height: 72, backgroundColor: accent, alignItems: 'center', justifyContent: 'center', marginTop: 56 }}>
            <Display size={40} weight="black" color={bg} lineHeight={40}>M</Display>
          </View>
          <Display size={76} weight="black" color={ink} uppercase lineHeight={65} style={{ marginTop: 36 }}>
            Wake{'\n'}up.{'\n'}
            <Display size={76} weight="black" color={accent} uppercase lineHeight={65}>Lock{'\n'}in.</Display>
          </Display>
          <MonoLabel color={muted} size={13} letterSpacing={13 * 0.12} style={{ lineHeight: 21, marginTop: 28, maxWidth: 270 }}>
            No snooze. No dismiss button.{'\n'}Only the tag gets you out.
          </MonoLabel>
        </View>

        <View style={{ gap: 12 }}>
          <SlabButton label="Create account" fullWidth onPress={() => navigation.navigate('Signup')} />
          <SlabButton label="Log in" variant="secondary" fullWidth onPress={() => navigation.navigate('Login')} />
        </View>
      </View>
    </SafeAreaView>
  );
}
