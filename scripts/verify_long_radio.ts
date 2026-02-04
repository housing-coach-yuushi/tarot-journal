
import { getUserProfile, redis } from '../lib/db/redis';
import { getJournalByDate } from '../lib/journal/storage';
import { generateWeeklyRadioScript } from '../lib/journal/radio_script_generator';

async function verifyLongRadio() {
    // This user has at least one journal entry
    const userId = 'user-f16dd102-e458-4627-aed1-a6a82adf825d';
    console.log(`--- Verifying Long Radio for User: ${userId} ---`);

    try {
        const profile = await getUserProfile(userId);
        const userName = profile?.displayName || 'User';
        console.log(`User Name: ${userName}`);

        // Manual journals for testing volume
        const journals = [
            {
                id: 'test-1',
                userId,
                date: '2026-02-01',
                messages: [
                    { role: 'user', content: '今日は新しいプロジェクトを開始した。不安もあるが楽しみだ。', timestamp: new Date().toISOString() },
                    { role: 'assistant', content: 'それは素晴らしい一歩ですね。', timestamp: new Date().toISOString() }
                ],
                summary: 'プロジェクト開始。不安と期待が入り混じる。',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 'test-2',
                userId,
                date: '2026-02-02',
                messages: [
                    { role: 'user', content: 'タロットで太陽を引いた。元気が出た。', timestamp: new Date().toISOString() },
                    { role: 'assistant', content: 'ポジティブなエネルギーが溢れていますね。', timestamp: new Date().toISOString() }
                ],
                summary: 'タロット「太陽」。エネルギーの充填。',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 'test-3',
                userId,
                date: '2026-02-03',
                messages: [
                    { role: 'user', content: '深夜まで作業してしまった。少し疲れているが、達成感はある。', timestamp: new Date().toISOString() }
                ],
                summary: '深夜作業と達成感。休息の必要性。',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        ] as any[];

        console.log(`Using ${journals.length} mock journals for volume test.`);

        const script = await generateWeeklyRadioScript(userId, userName, journals);
        console.log(`\nScript Title: ${script.title}`);
        console.log(`Lines Count: ${script.lines.length}`);

        script.lines.forEach((l, i) => {
            console.log(`${i + 1}. [${l.speaker}]: ${l.text}`);
        });

    } catch (error) {
        console.error('Verification Failed:', error);
    }
}

verifyLongRadio();
