import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Quote {
  text: string;
  author: string;
}

const CACHE_KEY = '@momentum/dailyQuote';
const API_URL = 'https://stoic-quotes.com/api/quote';

// Fallback for network failure — kept small and well-known, not a full
// offline library. Picked deterministically per day so a flaky network
// still shows a "different" quote day to day rather than always the first.
const FALLBACK_QUOTES: Quote[] = [
  { text: 'You have power over your mind — not outside events. Realize this, and you will find strength.', author: 'Marcus Aurelius' },
  { text: 'We suffer more often in imagination than in reality.', author: 'Seneca' },
  { text: 'He who is not satisfied with a little, is satisfied with nothing.', author: 'Epicurus' },
  { text: "It's not what happens to you, but how you react to it that matters.", author: 'Epictetus' },
  { text: 'Waste no more time arguing about what a good man should be. Be one.', author: 'Marcus Aurelius' },
  { text: 'No man is free who is not master of himself.', author: 'Epictetus' },
  { text: 'Difficulties strengthen the mind, as labor does the body.', author: 'Seneca' },
];

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86_400_000);
}

async function readCache(): Promise<{ date: string; quote: Quote } | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeCache(quote: Quote): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ date: todayKey(), quote }));
  } catch {}
}

/**
 * One quote per calendar day, not per app open — cached locally so it's
 * stable all day and only rotates at midnight. Falls back to a small
 * bundled list (also cached for the day) on network failure, so this is at
 * most one fetch attempt per day either way.
 */
export async function getDailyQuote(): Promise<Quote> {
  const cached = await readCache();
  if (cached && cached.date === todayKey()) return cached.quote;

  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    if (typeof data?.text === 'string' && typeof data?.author === 'string') {
      const quote: Quote = { text: data.text, author: data.author };
      await writeCache(quote);
      return quote;
    }
    throw new Error('unexpected response shape');
  } catch {
    const quote = FALLBACK_QUOTES[dayOfYear(new Date()) % FALLBACK_QUOTES.length];
    await writeCache(quote);
    return quote;
  }
}
