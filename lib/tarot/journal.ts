/**
 * Tarot Journal - Daily reading and journal storage
 */

import { redis } from '@/lib/db/redis';
import { ALL_CARDS, type TarotCard } from './cards';

const PREFIX = 'tarot-journal:';

export interface DailyReading {
  date: string;  // YYYY-MM-DD
  cardId: number;
  userId: string;
  drawnAt: string;
  reflection?: string;
  mood?: 'great' | 'good' | 'neutral' | 'difficult' | 'challenging';
  insights?: string[];
  gratitude?: string[];
}

export interface JournalEntry {
  id: string;
  date: string;
  reading: DailyReading;
  conversation: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
  summary?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Get today's date in YYYY-MM-DD format (JST)
 */
export function getTodayDate(): string {
  const now = new Date();
  // Convert to JST (UTC+9)
  const jst = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  return jst.toISOString().split('T')[0];
}

/**
 * Generate a deterministic but varied daily card
 * Uses user ID + date as seed for personalized daily card
 */
export function generateDailyCard(userId: string, date: string = getTodayDate()): TarotCard {
  const seed = `${userId}:${date}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  const index = Math.abs(hash) % ALL_CARDS.length;
  return ALL_CARDS[index];
}

/**
 * Check if user has already drawn today's card
 */
export async function hasTodayReading(userId: string): Promise<boolean> {
  const date = getTodayDate();
  const reading = await redis.get<DailyReading>(`${PREFIX}reading:${userId}:${date}`);
  return reading !== null;
}

/**
 * Get today's reading for a user
 */
export async function getTodayReading(userId: string): Promise<DailyReading | null> {
  const date = getTodayDate();
  return redis.get<DailyReading>(`${PREFIX}reading:${userId}:${date}`);
}

/**
 * Draw today's card and save the reading
 */
export async function drawTodayCard(userId: string): Promise<{ card: TarotCard; reading: DailyReading; isNew: boolean }> {
  const date = getTodayDate();

  // Check if already drawn
  const existing = await getTodayReading(userId);
  if (existing) {
    const card = ALL_CARDS.find(c => c.id === existing.cardId)!;
    return { card, reading: existing, isNew: false };
  }

  // Generate new card
  const card = generateDailyCard(userId, date);

  const reading: DailyReading = {
    date,
    cardId: card.id,
    userId,
    drawnAt: new Date().toISOString(),
  };

  // Save reading
  await redis.set(`${PREFIX}reading:${userId}:${date}`, reading);

  return { card, reading, isNew: true };
}

/**
 * Update today's reading with reflection
 */
export async function updateReading(
  userId: string,
  updates: Partial<Pick<DailyReading, 'reflection' | 'mood' | 'insights' | 'gratitude'>>
): Promise<DailyReading | null> {
  const date = getTodayDate();
  const reading = await getTodayReading(userId);

  if (!reading) return null;

  const updated = { ...reading, ...updates };
  await redis.set(`${PREFIX}reading:${userId}:${date}`, updated);

  return updated;
}

/**
 * Save a complete journal entry
 */
export async function saveJournalEntry(
  userId: string,
  entry: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'>
): Promise<JournalEntry> {
  const id = `${entry.date}-${Date.now()}`;
  const now = new Date().toISOString();

  const journalEntry: JournalEntry = {
    ...entry,
    id,
    createdAt: now,
    updatedAt: now,
  };

  // Save entry
  await redis.set(`${PREFIX}journal:${userId}:${entry.date}`, journalEntry);

  // Add to user's journal index
  const indexKey = `${PREFIX}journal-index:${userId}`;
  const index = await redis.get<string[]>(indexKey) || [];
  if (!index.includes(entry.date)) {
    index.unshift(entry.date);
    // Keep last 365 days
    await redis.set(indexKey, index.slice(0, 365));
  }

  return journalEntry;
}

/**
 * Get journal entry for a specific date
 */
export async function getJournalEntry(userId: string, date: string): Promise<JournalEntry | null> {
  return redis.get<JournalEntry>(`${PREFIX}journal:${userId}:${date}`);
}

/**
 * Get recent journal entries
 */
export async function getRecentJournals(userId: string, limit: number = 7): Promise<JournalEntry[]> {
  const indexKey = `${PREFIX}journal-index:${userId}`;
  const index = await redis.get<string[]>(indexKey) || [];

  const entries: JournalEntry[] = [];
  for (const date of index.slice(0, limit)) {
    const entry = await getJournalEntry(userId, date);
    if (entry) entries.push(entry);
  }

  return entries;
}

/**
 * Get reading history for calendar view
 */
export async function getReadingHistory(
  userId: string,
  month: number,
  year: number
): Promise<Map<string, DailyReading>> {
  const history = new Map<string, DailyReading>();

  // Get all days in the month
  const daysInMonth = new Date(year, month, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    const reading = await redis.get<DailyReading>(`${PREFIX}reading:${userId}:${date}`);
    if (reading) {
      history.set(date, reading);
    }
  }

  return history;
}

/**
 * Get streak - consecutive days of journaling
 */
export async function getJournalStreak(userId: string): Promise<number> {
  const indexKey = `${PREFIX}journal-index:${userId}`;
  const index = await redis.get<string[]>(indexKey) || [];

  if (index.length === 0) return 0;

  let streak = 0;
  const today = getTodayDate();
  let checkDate = today;

  for (const date of index) {
    if (date === checkDate) {
      streak++;
      // Calculate previous day
      const d = new Date(checkDate);
      d.setDate(d.getDate() - 1);
      checkDate = d.toISOString().split('T')[0];
    } else {
      break;
    }
  }

  return streak;
}
