export interface AlarmSound {
  id: string;
  name: string;
}

export const ALARM_SOUNDS: AlarmSound[] = [
  { id: 'chime', name: 'Chime' },
  { id: 'bell', name: 'Bell' },
  { id: 'pulse', name: 'Pulse' },
  { id: 'siren', name: 'Siren' },
  { id: 'beacon', name: 'Beacon' },
  { id: 'cascade', name: 'Cascade' },
];

export const DEFAULT_SOUND = 'chime';
