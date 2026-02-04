/**
 * Journal Storage - Save and retrieve journal conversations
 */

import { redis, getAIIdentity } from '@/lib/db/redis';

const PREFIX = 'tarot-journal:';

export interface JournalMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface JournalEntry {
  id: string;
  userId: string;
  date: string;  // YYYY-MM-DD
  messages: JournalMessage[];
  summary?: string;
  mood?: string;
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
 * Get or create today's journal entry
 */
export async function getTodayJournal(userId: string): Promise<JournalEntry> {
  const date = getTodayDate();
  const key = `${PREFIX}entry:${userId}:${date}`;

  const existing = await redis.get<JournalEntry>(key);
  if (existing) {
    return existing;
  }

  // Create new entry
  const entry: JournalEntry = {
    id: `${userId}-${date}`,
    userId,
    date,
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await redis.set(key, entry);

  // Add to index
  await addToIndex(userId, date);

  return entry;
}

/**
 * Add a message to today's journal
 */
export async function addMessage(
  userId: string,
  message: Omit<JournalMessage, 'timestamp'>
): Promise<JournalEntry> {
  const entry = await getTodayJournal(userId);

  entry.messages.push({
    ...message,
    timestamp: new Date().toISOString(),
  });
  entry.updatedAt = new Date().toISOString();

  const key = `${PREFIX}entry:${userId}:${entry.date}`;
  await redis.set(key, entry);

  return entry;
}

/**
 * Update journal entry (summary, mood, etc.)
 */
export async function updateJournal(
  userId: string,
  date: string,
  updates: Partial<Pick<JournalEntry, 'summary' | 'mood'>>
): Promise<JournalEntry | null> {
  const key = `${PREFIX}entry:${userId}:${date}`;
  const entry = await redis.get<JournalEntry>(key);

  if (!entry) return null;

  const updated = {
    ...entry,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await redis.set(key, updated);
  return updated;
}

/**
 * Get journal entry for a specific date
 */
export async function getJournalByDate(userId: string, date: string): Promise<JournalEntry | null> {
  const key = `${PREFIX}entry:${userId}:${date}`;
  return redis.get<JournalEntry>(key);
}

/**
 * Get recent journal entries
 */
export async function getRecentJournals(userId: string, limit: number = 7): Promise<JournalEntry[]> {
  const indexKey = `${PREFIX}index:${userId}`;
  const dates = await redis.get<string[]>(indexKey) || [];

  const entries: JournalEntry[] = [];
  for (const date of dates.slice(0, limit)) {
    const entry = await getJournalByDate(userId, date);
    if (entry) entries.push(entry);
  }

  return entries;
}

/**
 * Add date to user's journal index
 */
async function addToIndex(userId: string, date: string): Promise<void> {
  const indexKey = `${PREFIX}index:${userId}`;
  const dates = await redis.get<string[]>(indexKey) || [];

  if (!dates.includes(date)) {
    dates.unshift(date);
    // Keep last 365 days
    await redis.set(indexKey, dates.slice(0, 365));
  }
}

/**
 * Get all journal dates for a user
 */
export async function getJournalDates(userId: string): Promise<string[]> {
  const indexKey = `${PREFIX}index:${userId}`;
  return await redis.get<string[]>(indexKey) || [];
}

/**
 * Get journal streak (consecutive days)
 */
export async function getStreak(userId: string): Promise<number> {
  const dates = await getJournalDates(userId);

  if (dates.length === 0) return 0;

  let streak = 0;
  let checkDate = getTodayDate();

  for (const date of dates) {
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

/**
 * Get journal entries from the most recent Monday to today
 */
export async function getJournalsFromMonday(userId: string): Promise<JournalEntry[]> {
  const today = new Date();
  // Get JST today
  const jstToday = new Date(today.getTime() + (9 * 60 * 60 * 1000));

  // Day: 0 (Sun), 1 (Mon), ..., 6 (Sat)
  const day = jstToday.getUTCDay();
  const diff = jstToday.getUTCDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday

  const monday = new Date(jstToday.setDate(diff));
  const mondayDate = monday.toISOString().split('T')[0];

  return getJournalsFromDate(userId, mondayDate);
}

/**
 * Get journal entries within the past N days from today
 */
export async function getJournalsFromPastDays(userId: string, days: number = 7): Promise<JournalEntry[]> {
  const today = new Date();
  const jstToday = new Date(today.getTime() + (9 * 60 * 60 * 1000));

  const pastDate = new Date(jstToday);
  pastDate.setDate(pastDate.getDate() - days);
  const startDate = pastDate.toISOString().split('T')[0];

  return getJournalsFromDate(userId, startDate);
}

/**
 * Common logic to fetch journals from a start date to today
 */
async function getJournalsFromDate(userId: string, startDate: string): Promise<JournalEntry[]> {
  const dates = await getJournalDates(userId);
  const relevantDates = dates.filter((d: string) => d >= startDate);

  const entries: JournalEntry[] = [];
  for (const date of relevantDates) {
    const entry = await getJournalByDate(userId, date);
    if (entry) entries.push(entry);
  }

  return entries;
}
