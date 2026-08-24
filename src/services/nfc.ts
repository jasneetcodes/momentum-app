import { Platform } from 'react-native';
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

/**
 * Whether the device's NFC radio is currently turned on. Only meaningful on
 * Android — iOS has no system-level NFC toggle exposed to apps, so this
 * always resolves true there (hardware support is covered by initNfc()).
 */
export async function isNfcEnabled(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    return await NfcManager.isEnabled();
  } catch {
    return true;
  }
}

/** Opens the system NFC settings toggle. Android only. */
export async function openNfcSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await NfcManager.goToNfcSetting();
  } catch {}
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
