import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// Obsidian vault path (iCloud)
const OBSIDIAN_DAILY_PATH = '/Users/yuushinakashima/Library/Mobile Documents/iCloud~md~obsidian/Documents/second-brain/daily';

export async function POST(request: NextRequest) {
    try {
        const { title, summary, messages, date, userName, aiName } = await request.json();

        if (!title || !messages) {
            return NextResponse.json({ error: 'Title and messages are required' }, { status: 400 });
        }

        // Use provided date or today's date
        const dateStr = date || new Date().toISOString().split('T')[0];

        // Create markdown content (Obsidian style)
        const markdownContent = `---
title: "${title}"
date: ${dateStr}
tags:
  - tarot
  - journal
---

# ${title}
**日付:** ${dateStr}

## 要約
${summary || '（要約なし）'}

## 対話履歴
${messages.map((m: any) => `### ${m.role === 'user' ? (userName || 'わたし') : (aiName || 'ジョージ')}\n${m.content}`).join('\n\n')}
`;

        // Ensure directory exists
        if (!existsSync(OBSIDIAN_DAILY_PATH)) {
            await mkdir(OBSIDIAN_DAILY_PATH, { recursive: true });
        }

        // Check if file already exists, append number if so
        let filename = `${dateStr}.md`;
        let filepath = path.join(OBSIDIAN_DAILY_PATH, filename);
        let counter = 1;

        while (existsSync(filepath)) {
            filename = `${dateStr} ${counter}.md`;
            filepath = path.join(OBSIDIAN_DAILY_PATH, filename);
            counter++;
        }

        // Write file
        await writeFile(filepath, markdownContent, 'utf-8');

        return NextResponse.json({
            success: true,
            filename,
            path: filepath,
            message: `ジャーナルを保存しました: ${filename}`
        });

    } catch (error) {
        console.error('Save to Obsidian error:', error);
        return NextResponse.json({
            error: 'Failed to save to Obsidian',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
