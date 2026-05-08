import NfcManager, { NfcTech } from 'react-native-nfc-manager';

let initialized = false;

export async function initNfc(): Promise<boolean> {
  if (initialized) return true;
  const supported = await NfcManager.isSupported();
  if (!supported) return false;
  await NfcManager.start();
  initialized = true;
  return true;
}

export async function readTagUid(): Promise<string> {
  await NfcManager.requestTechnology(NfcTech.Ndef);
  try {
    const tag = await NfcManager.getTag();
    if (!tag?.id) throw new Error('No UID found on tag');
    return tag.id.toUpperCase();
  } finally {
    await NfcManager.cancelTechnologyRequest().catch(() => {});
  }
}

export async function cancelRead(): Promise<void> {
  await NfcManager.cancelTechnologyRequest().catch(() => {});
}
