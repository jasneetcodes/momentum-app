import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { SafeAreaView, StatusBar, Text, TouchableOpacity, View } from 'react-native';

export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Signup: undefined;
};

type NavProp = NativeStackNavigationProp<AuthStackParamList, 'Welcome'>;

export default function WelcomeScreen() {
  const navigation = useNavigation<NavProp>();

  return (
    <SafeAreaView className="flex-1 bg-zinc-950">
      <StatusBar barStyle="light-content" />

      <View className="flex-1 items-center justify-center px-8">
        {/* Wordmark */}
        <View className="items-center mb-20">
          <View
            className="w-16 h-16 rounded-2xl items-center justify-center mb-6"
            style={{ backgroundColor: '#1944F1' }}
          >
            <Text className="text-white text-2xl font-bold">M</Text>
          </View>
          <Text className="text-white text-4xl font-bold tracking-tight">Momentum</Text>
          <Text className="text-zinc-400 text-base mt-3 text-center leading-relaxed">
            Wake up. Lock in.
          </Text>
        </View>

        {/* CTAs */}
        <View className="w-full">
          <TouchableOpacity
            className="w-full py-4 rounded-2xl items-center mb-3"
            style={{ backgroundColor: '#1944F1' }}
            onPress={() => navigation.navigate('Signup')}
            activeOpacity={0.85}
          >
            <Text className="text-white font-semibold text-base">Create Account</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="w-full py-4 rounded-2xl items-center border border-zinc-700"
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.85}
          >
            <Text className="text-zinc-100 font-semibold text-base">Log In</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
