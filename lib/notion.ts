
import { Client } from '@notionhq/client';

const notion = new Client({
    auth: process.env.NOTION_API_KEY,
});

const DATABASE_ID = process.env.NOTION_DATABASE_ID;

export async function syncJournalToNotion(data: {
    date: string;
    content: string;
    mood?: string;
    summary?: string;
}) {
    if (!DATABASE_ID || !process.env.NOTION_API_KEY) {
        console.warn('Notion API key or Database ID is missing. Skipping sync.');
        return;
    }

    try {
        // Check if entry for this date already exists
        const response = await notion.databases.query({
            database_id: DATABASE_ID,
            filter: {
                property: 'Date',
                date: {
                    equals: data.date,
                },
            },
        });

        if (response.results.length > 0) {
            // Update existing page
            const pageId = response.results[0].id;
            await notion.pages.update({
                page_id: pageId,
                properties: {
                    'Content': {
                        rich_text: [{ text: { content: data.content } }],
                    },
                    'Status': {
                        select: { name: '未処理' }, // Reset to unprocessed if updated
                    },
                },
            });
            console.log(`Updated Notion page for ${data.date}`);
        } else {
            // Create new page
            await notion.pages.create({
                parent: { database_id: DATABASE_ID },
                properties: {
                    'Name': {
                        title: [{ text: { content: `Journal ${data.date}` } }],
                    },
                    'Date': {
                        date: { start: data.date },
                    },
                    'Content': {
                        rich_text: [{ text: { content: data.content } }],
                    },
                    'Status': {
                        select: { name: '未処理' },
                    },
                },
            });
            console.log(`Created Notion page for ${data.date}`);
        }
    } catch (error) {
        console.error('Failed to sync to Notion:', error);
    }
}
