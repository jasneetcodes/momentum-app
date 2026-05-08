import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import AlarmSetupScreen from '../app/(main)/AlarmSetupScreen';
import ManageTagsScreen from '../app/(main)/ManageTagsScreen';
import NFCRegisterScreen from '../app/(main)/NFCRegisterScreen';
import SettingsScreen from '../app/(main)/SettingsScreen';
import MainTabs from './MainTabs';
import type { MainStackParamList } from './types';

const Stack = createNativeStackNavigator<MainStackParamList>();

export default function MainNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="ManageTags" component={ManageTagsScreen} />
      <Stack.Screen name="NFCRegister" component={NFCRegisterScreen} />
      <Stack.Screen
        name="AlarmSetup"
        component={AlarmSetupScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
    </Stack.Navigator>
  );
}
