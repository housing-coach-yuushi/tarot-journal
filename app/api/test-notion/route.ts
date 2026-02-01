
import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@notionhq/client';

export async function GET(request: NextRequest) {
    const token = process.env.NOTION_API_KEY;
    const dbId = process.env.NOTION_DATABASE_ID;

    if (!token || !dbId) {
        return NextResponse.json({
            error: 'Environment variables missing',
            token: !!token,
            dbId: !!dbId
        }, { status: 500 });
    }

    const notion = new Client({ auth: token });

    try {
        const db = await notion.databases.retrieve({ database_id: dbId });

        // Try a test write
        const testPage = await notion.pages.create({
            parent: { database_id: dbId },
            properties: {
                'Name': { title: [{ text: { content: '🚨 ブラウザ疎通テスト (' + new Date().toLocaleString() + ')' } }] },
                'Date': { date: { start: new Date().toISOString().split('T')[0] } },
                'Content': { rich_text: [{ text: { content: 'George Appからの直接テストです。' } }] },
                'Status': { select: { name: '未処理' } }
            }
        });

        return NextResponse.json({
            success: true,
            database: db.title[0]?.plain_text,
            testPageUrl: testPage.url
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message,
            code: error.code,
            tip: error.message.includes('Could not find object') ? 'Notion側で「接続先」に George Journal が追加されているか確認してください。' : undefined
        }, { status: 500 });
    }
}
