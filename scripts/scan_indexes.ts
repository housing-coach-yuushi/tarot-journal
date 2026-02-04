
import { redis } from '../lib/db/redis';

async function scanIndexes() {
    console.log('--- Scanning Journal Indexes in Redis ---');
    try {
        const keys = await redis.keys('tarot-journal:index:*');
        console.log(`Found ${keys.length} index keys.`);

        for (const key of keys) {
            const userId = key.split(':').pop();
            const dates = await redis.get<string[]>(key) || [];
            console.log(`Key: ${key} | User: ${userId} | Dates count: ${dates.length}`);

            if (dates.length > 0) {
                console.log(`  Recent dates: ${dates.slice(0, 3).join(', ')}`);
                const latestDate = dates[0];
                const entryKey = `tarot-journal:entry:${userId}:${latestDate}`;
                const entry = await redis.get(entryKey);
                console.log(`  Latest Entry (${latestDate}): ${JSON.stringify(entry).substring(0, 300)}...`);
            }
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

scanIndexes();
