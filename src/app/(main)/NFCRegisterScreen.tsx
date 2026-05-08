import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StatusBar, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Text } from '../../components/Text';
import { useThemeColors } from '../../hooks/useThemeColors';
import { cancelRead, initNfc, readTagUid } from '../../services/nfc';
import { useNfcStore } from '../../stores/nfcStore';

type Step = 'prompt' | 'reading' | 'naming' | 'error';

const LABEL_SUGGESTIONS = ['Kitchen', 'Desk', 'Bathroom', 'Bedside'];

export default function NFCRegisterScreen() {
  const navigation = useNavigation();
  const { barStyle, ink, accent } = useThemeColors();
  const registerTag = useNfcStore((s) => s.registerTag);

  const [step, setStep] = useState<Step>('prompt');
  const [uid, setUid] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return () => {
      cancelRead();
    };
  }, []);

  const startScan = async () => {
    setErrorMsg('');
    if (Platform.OS === 'web') {
      setErrorMsg('NFC is not supported on web. Run the app on a physical device.');
      setStep('error');
      return;
    }
    const supported = await initNfc();
    if (!supported) {
      setErrorMsg('NFC is not supported on this device.');
      setStep('error');
      return;
    }
    setStep('reading');
    try {
      const tagUid = await readTagUid();
      setUid(tagUid);
      setStep('naming');
    } catch (e: any) {
      if (e?.message?.toLowerCase().includes('cancel')) {
        setStep('prompt');
        return;
      }
      setErrorMsg('Could not read tag. Try again.');
      setStep('error');
    }
  };

  const handleSave = async () => {
    if (!uid) return;
    setSaving(true);
    const err = await registerTag(uid, label);
    setSaving(false);
    if (err === 'invalid_tag') {
      setErrorMsg("This doesn't look like a Momentum tag. Make sure you're using the tag that came with your order.");
      setStep('error');
      return;
    }
    if (err === 'already_registered') {
      setErrorMsg('This tag is already registered to another account.');
      setStep('error');
      return;
    }
    if (err) {
      setErrorMsg('Something went wrong saving your tag. Please try again.');
      setStep('error');
      return;
    }
    navigation.goBack();
  };

  const handleCancel = async () => {
    await cancelRead();
    navigation.goBack();
  };

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark" edges={['top']}>
      <StatusBar barStyle={barStyle} />

      <View className="px-6 pt-4 pb-3 flex-row items-center gap-4">
        <Pressable onPress={handleCancel} hitSlop={12} className="p-1">
          <Ionicons name="chevron-back" size={26} color={ink} />
        </Pressable>
        <Text variant="heading" className="text-2xl">Add tag</Text>
      </View>

      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: 32 }}>
        {step === 'prompt' && (
          <View className="flex-1 items-center justify-center">
            <View
              className="w-32 h-32 rounded-full items-center justify-center mb-8"
              style={{ backgroundColor: `${accent}1A` }}
            >
              <Ionicons name="radio-outline" size={64} color={accent} />
            </View>
            <Text variant="heading" className="text-center mb-3">Hold your tag to your phone</Text>
            <Text variant="muted" className="text-center text-base px-4 mb-12">
              Place the Momentum tag against the back of your device to register it.
            </Text>
            <Button label="Start scanning" fullWidth onPress={startScan} />
          </View>
        )}

        {step === 'reading' && (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={accent} />
            <Text variant="heading" className="mt-8 text-center">Reading your tag...</Text>
            <Text variant="muted" className="mt-3 text-center text-base">
              Hold the tag steady against the back of your phone.
            </Text>
            <Pressable onPress={handleCancel} className="mt-12">
              <Text className="text-base font-semibold text-accent">Cancel</Text>
            </Pressable>
          </View>
        )}

        {step === 'naming' && (
          <View className="flex-1 pt-8">
            <Text variant="heading" className="mb-2">Name your tag</Text>
            <Text variant="muted" className="text-base mb-8">
              Give it a label so you remember where it lives.
            </Text>

            <Input
              label="Tag label"
              placeholder="e.g. Kitchen"
              value={label}
              onChangeText={setLabel}
              autoCapitalize="words"
              autoCorrect={false}
              autoFocus
            />

            <View className="flex-row flex-wrap gap-2 mt-4">
              {LABEL_SUGGESTIONS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setLabel(s)}
                  className="px-3 py-1.5 rounded-full bg-surface dark:bg-surface-dark active:opacity-60"
                >
                  <Text variant="muted" className="text-sm">{s}</Text>
                </Pressable>
              ))}
            </View>

            <Button
              label="Save tag"
              fullWidth
              loading={saving}
              onPress={handleSave}
              className="mt-10"
            />
          </View>
        )}

        {step === 'error' && (
          <View className="flex-1 items-center justify-center">
            <View
              className="w-20 h-20 rounded-full items-center justify-center mb-6"
              style={{ backgroundColor: '#EF44441A' }}
            >
              <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
            </View>
            <Text variant="heading" className="text-center mb-3">Something went wrong</Text>
            <Text variant="muted" className="text-center text-base px-4 mb-10">
              {errorMsg}
            </Text>
            <Button label="Try again" fullWidth onPress={() => setStep('prompt')} />
            <Pressable onPress={handleCancel} className="mt-6">
              <Text className="text-base font-semibold text-accent">Go back</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
