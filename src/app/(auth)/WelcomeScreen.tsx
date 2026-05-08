import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { StatusBar, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { Text } from '../../components/Text';
import { useThemeColors } from '../../hooks/useThemeColors';

export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Signup: undefined;
};

type NavProp = NativeStackNavigationProp<AuthStackParamList, 'Welcome'>;

export default function WelcomeScreen() {
  const navigation = useNavigation<NavProp>();
  const { barStyle } = useThemeColors();

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <StatusBar barStyle={barStyle} />

      <View className="flex-1 items-center justify-center px-8">
        <View className="items-center mb-20">
          <View className="w-16 h-16 rounded-2xl items-center justify-center mb-6 bg-accent">
            <Text className="text-white text-2xl font-bold">M</Text>
          </View>
          <Text variant="display" className="text-4xl tracking-tight">
            Momentum
          </Text>
          <Text variant="muted" className="text-base mt-3 text-center">
            Wake up. Lock in.
          </Text>
        </View>

        <View className="w-full gap-3">
          <Button
            label="Create Account"
            fullWidth
            onPress={() => navigation.navigate('Signup')}
          />
          <Button
            label="Log In"
            variant="secondary"
            fullWidth
            onPress={() => navigation.navigate('Login')}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
