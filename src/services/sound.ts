import { Audio } from 'expo-av';

const SOUND_FILES: Record<string, number> = {
  chime: require('../assets/sounds/chime.mp3'),
  bell: require('../assets/sounds/bell.mp3'),
  pulse: require('../assets/sounds/pulse.mp3'),
  siren: require('../assets/sounds/siren.mp3'),
  beacon: require('../assets/sounds/beacon.mp3'),
  cascade: require('../assets/sounds/cascade.mp3'),
};

let alarmSound: Audio.Sound | null = null;
let previewSound: Audio.Sound | null = null;

function resolveFile(id: string): number {
  return SOUND_FILES[id] ?? SOUND_FILES.chime;
}

export async function playAlarmSound(soundId: string): Promise<void> {
  await stopAlarmSound();
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    staysActiveInBackground: true,
    shouldDuckAndroid: false,
    interruptionModeIOS: 1,
    interruptionModeAndroid: 1,
  });
  const { sound } = await Audio.Sound.createAsync(resolveFile(soundId), {
    isLooping: true,
    volume: 1.0,
    shouldPlay: true,
  });
  alarmSound = sound;
}

export async function stopAlarmSound(): Promise<void> {
  if (!alarmSound) return;
  const s = alarmSound;
  alarmSound = null;
  try {
    await s.stopAsync();
  } catch {}
  try {
    await s.unloadAsync();
  } catch {}
}

export async function previewAlarmSound(soundId: string): Promise<void> {
  await stopPreviewSound();
  await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
  const { sound } = await Audio.Sound.createAsync(resolveFile(soundId), {
    volume: 1.0,
    shouldPlay: true,
  });
  previewSound = sound;
  sound.setOnPlaybackStatusUpdate((status) => {
    if ('didJustFinish' in status && status.didJustFinish) {
      stopPreviewSound();
    }
  });
}

export async function stopPreviewSound(): Promise<void> {
  if (!previewSound) return;
  const s = previewSound;
  previewSound = null;
  try {
    await s.stopAsync();
  } catch {}
  try {
    await s.unloadAsync();
  } catch {}
}
