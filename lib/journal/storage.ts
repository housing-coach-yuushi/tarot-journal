/**
 * Journal Storage - Save and retrieve journal conversations
 */

import { redis, getAIIdentity } from '@/lib/db/redis';

const PREFIX = 'tarot-journal:';
const JOURNAL_INDEX_MAX = 365;
const JOURNAL_ENTRY_TTL_SEC = 60 * 60 * 24 * 365; // 365 days
const JOURNAL_INDEX_TTL_SEC = 60 * 60 * 24 * 365; // align with index size

const journalIndexUpsertScript = redis.createScript<number>(`
  redis.call('LREM', KEYS[1], 0, ARGV[1])
  redis.call('LPUSH', KEYS[1], ARGV[1])
  redis.call('LTRIM', KEYS[1], 0, tonumber(ARGV[2]))
  return 1
`);

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
  await redis.expire(key, JOURNAL_ENTRY_TTL_SEC);

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
  await redis.expire(key, JOURNAL_ENTRY_TTL_SEC);

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
  await redis.expire(key, JOURNAL_ENTRY_TTL_SEC);
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
  const type = await redis.type(indexKey);

  if (type === 'string') {
    const legacy = await redis.get<string[]>(indexKey);
    await redis.del(indexKey);
    if (legacy?.length) {
      for (const d of legacy) {
        await redis.lpush(indexKey, d);
      }
      await redis.ltrim(indexKey, 0, JOURNAL_INDEX_MAX - 1);
      await redis.expire(indexKey, JOURNAL_INDEX_TTL_SEC);
    }
  }

  await journalIndexUpsertScript.exec([indexKey], [date, String(JOURNAL_INDEX_MAX - 1)]);
  await redis.expire(indexKey, JOURNAL_INDEX_TTL_SEC);
}

/**
 * Get all journal dates for a user
 */
export async function getJournalDates(userId: string): Promise<string[]> {
  const indexKey = `${PREFIX}index:${userId}`;
  const type = await redis.type(indexKey);

  if (type === 'string') {
    const legacy = await redis.get<string[]>(indexKey);
    await redis.del(indexKey);
    if (legacy?.length) {
      for (const d of legacy) {
        await redis.lpush(indexKey, d);
      }
      await redis.ltrim(indexKey, 0, JOURNAL_INDEX_MAX - 1);
      await redis.expire(indexKey, JOURNAL_INDEX_TTL_SEC);
      return legacy;
    }
    return [];
  }

  return await redis.lrange<string>(indexKey, 0, -1) || [];
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
 * Directly checks each date instead of relying on index
 */
export async function getJournalsFromPastDays(userId: string, days: number = 7): Promise<JournalEntry[]> {
  const entries: JournalEntry[] = [];
  const today = new Date();
  const jstToday = new Date(today.getTime() + (9 * 60 * 60 * 1000));

  // Check each date in range directly
  for (let i = 0; i < days; i++) {
    const date = new Date(jstToday);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    const entry = await getJournalByDate(userId, dateStr);
    if (entry && entry.messages.length > 0) {
      entries.push(entry);
    }
  }

  // Sort by date ascending (oldest first)
  return entries.sort((a, b) => a.date.localeCompare(b.date));
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
