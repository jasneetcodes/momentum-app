import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StatusBar, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Display } from '../../components/Display';
import { Input } from '../../components/Input';
import { MonoLabel } from '../../components/MonoLabel';
import { PulsingRing } from '../../components/PulsingRing';
import { SlabButton } from '../../components/SlabButton';
import { useThemeColors } from '../../hooks/useThemeColors';
import { cancelRead, initNfc, readTagUid } from '../../services/nfc';
import { useNfcStore } from '../../stores/nfcStore';

type Step = 'prompt' | 'reading' | 'naming' | 'error';

const LABEL_SUGGESTIONS = ['Kitchen', 'Desk', 'Bathroom', 'Bedside'];

export default function NFCRegisterScreen() {
  const navigation = useNavigation();
  const { barStyle, bg, ink, muted, border, accent } = useThemeColors();
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
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={['top']}>
      <StatusBar barStyle={barStyle} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 18 }}>
        <Pressable
          onPress={handleCancel}
          hitSlop={12}
          style={{ width: 48, height: 48, borderWidth: 1.5, borderColor: border, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name={step === 'naming' ? 'close' : 'chevron-back'} size={26} color={ink} />
        </Pressable>
        <Display size={34} weight="black" color={ink} uppercase letterSpacing={-34 * 0.03}>Add tag</Display>
      </View>

      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: 32 }}>
        {step === 'prompt' && (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <PulsingRing size={196} color={accent}>
              <View style={{ width: 112, height: 112, borderRadius: 56, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="radio-outline" size={58} color={bg} />
              </View>
            </PulsingRing>
            <Display size={30} weight="black" color={ink} uppercase style={{ textAlign: 'center', lineHeight: 34, marginTop: 34 }}>
              Hold the tag{'\n'}to your phone
            </Display>
            <MonoLabel color={muted} size={13} letterSpacing={13 * 0.08} uppercase={false} style={{ textAlign: 'center', lineHeight: 20, marginTop: 16, marginBottom: 32 }}>
              Place it against the back of your device
            </MonoLabel>
            <SlabButton label="Start scanning" fullWidth onPress={startScan} />
          </View>
        )}

        {step === 'reading' && (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={accent} />
            <Display size={22} weight="bold" color={ink} style={{ marginTop: 28, textAlign: 'center' }}>Reading your tag...</Display>
            <MonoLabel color={muted} size={13} uppercase={false} style={{ marginTop: 12, textAlign: 'center' }}>
              Hold the tag steady against the back of your phone.
            </MonoLabel>
            <Pressable onPress={handleCancel} style={{ marginTop: 40 }}>
              <MonoLabel color={accent} size={13}>Cancel</MonoLabel>
            </Pressable>
          </View>
        )}

        {step === 'naming' && (
          <View style={{ flex: 1, paddingTop: 12 }}>
            <MonoLabel color={muted} size={12} letterSpacing={12 * 0.22} style={{ marginBottom: 14 }}>Name it</MonoLabel>
            <Input
              placeholder="Kitchen, Desk, Bathroom…"
              value={label}
              onChangeText={setLabel}
              autoCapitalize="words"
              autoCorrect={false}
              autoFocus
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
              {LABEL_SUGGESTIONS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setLabel(s)}
                  style={{ paddingHorizontal: 18, paddingVertical: 14, borderWidth: 1.5, borderColor: border }}
                >
                  <MonoLabel color={muted} size={14} letterSpacing={14 * 0.1}>{s}</MonoLabel>
                </Pressable>
              ))}
            </View>
            <View style={{ marginTop: 40 }}>
              <SlabButton label="Save tag" fullWidth loading={saving} onPress={handleSave} />
            </View>
          </View>
        )}

        {step === 'error' && (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#EF44441A', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
              <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
            </View>
            <Display size={22} weight="bold" color={ink} style={{ textAlign: 'center' }}>Something went wrong</Display>
            <MonoLabel color={muted} size={13} uppercase={false} style={{ textAlign: 'center', marginTop: 12, marginBottom: 40, lineHeight: 20 }}>
              {errorMsg}
            </MonoLabel>
            <SlabButton label="Try again" fullWidth onPress={() => setStep('prompt')} />
            <Pressable onPress={handleCancel} style={{ marginTop: 24 }}>
              <MonoLabel color={accent} size={13}>Go back</MonoLabel>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
