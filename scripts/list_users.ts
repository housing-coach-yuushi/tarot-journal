
import { redis } from '../lib/db/redis';

async function listAllUsers() {
    console.log('--- Listing All Users in Redis ---');
    try {
        const users = await redis.smembers('tarot-journal:users');
        console.log(`Total users found: ${users.length}`);

        for (const userId of users) {
            const profile = await redis.get(`tarot-journal:user:${userId}`);
            const journalCount = await redis.zcard(`tarot-journal:journals:${userId}`);
            console.log(`User: ${userId} | Profile: ${JSON.stringify(profile)} | Journals: ${journalCount}`);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

listAllUsers();
