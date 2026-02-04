
import { redis } from '../lib/db/redis';

async function scanJournals() {
    console.log('--- Scanning Journals in Redis ---');
    try {
        const keys = await redis.keys('tarot-journal:journals:*');
        console.log(`Found ${keys.length} journal lists.`);

        for (const key of keys) {
            const userId = key.split(':').pop();
            const count = await redis.zcard(key);
            console.log(`Key: ${key} | User: ${userId} | Count: ${count}`);

            if (count > 0) {
                const latest = await redis.zrevrange(key, 0, 0);
                console.log(`  Latest Entry ID: ${latest[0]}`);
                const data = await redis.get(`tarot-journal:journal:${userId}:${latest[0]}`);
                console.log(`  Latest Entry Data: ${JSON.stringify(data).substring(0, 200)}...`);
            }
        }

        // Also check profile for user-8e8cb8d2-2342-4493-bcae-86b0f36988e2
        const testUser = 'user-8e8cb8d2-2342-4493-bcae-86b0f36988e2';
        const profile = await redis.get(`tarot-journal:user:${testUser}`);
        console.log(`\nTest User Profile: ${JSON.stringify(profile)}`);

    } catch (error) {
        console.error('Error:', error);
    }
}

scanJournals();
