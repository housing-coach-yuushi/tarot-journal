# George Tarot Journal - Claude Code 引き継ぎドキュメント

## 📋 プロジェクト概要

**名前**: George Tarot Journal  
**目的**: 自己変革を促すジャーナリング（振り返り）PWA（Clawdbot式）
**場所**: `/Users/yuushinakashima/Library/CloudStorage/GoogleDrive-yuushi226@gmail.com/マイドライブ/george app/george-tarot-journal`

### コンセプト
- **ジャーナリング主軸**: 毎日の振り返り（CAMJAPAN「３つの変化」に基づく）をメイン機能とする
- **タロット（裏メニュー）**: 占いは内省を深めるための「きっかけ」として位置づける隠し機能
- **Clawdbot式ブートストラップ**: AIが「目覚め」、ユーザーと一緒に自分のアイデンティティ（名前、性格、話し方、絵文字）を決める

---

## 🏗️ 現在の状態

### ✅ 完了した作業

1. **プロジェクトセットアップ**
   - Next.js 16 + TypeScript + Tailwind CSS
   - PWA対応準備完了

2. **Kie.ai API 統合**
   - エンドポイント: `https://api.kie.ai/gemini-3-flash/v1/chat/completions`
   - モデル: `gemini-3-flash`
   - **重要**: モデル名はURLパスに含める形式
   - クライアント: `/lib/keiapi/client.ts`

3. **Upstash Redis データベース**
   - george-bar-appと同じインスタンスを共有
   - プレフィックス: `tarot-journal:`
   - クライアント: `/lib/db/redis.ts`

4. **ブートストラップシステム**
   - `/lib/clawdbot/bootstrap.ts`
   - AI Identity と User Profile の保存・読み込み
   - 初期「目覚め」プロンプト実装済み

5. **保存済みデータ（Redis内）**
   - AI Identity: `カイ` 🎴（タロット占い師、クール系）
   - User: `裕士`
   - 会話履歴: 保存中

---

## 📁 重要なファイル構造

```
george-tarot-journal/
├── app/
│   ├── api/
│   │   └── chat/
│   │       └── route.ts      # チャットAPI（POST/GET）
│   ├── page.tsx              # メインチャットUI
│   ├── layout.tsx
│   └── globals.css
├── components/
│   └── ChatInterface.tsx     # チャットUIコンポーネント
├── lib/
│   ├── db/
│   │   └── redis.ts          # Upstash Redisクライアント
│   ├── keiapi/
│   │   └── client.ts         # Kie.ai APIクライアント
│   └── clawdbot/
│       └── bootstrap.ts      # ブートストラップロジック
├── .env.local                # 環境変数
└── package.json
```

---

## 🔑 環境変数 (.env.local)

```env
# Kie.ai API Key
KEIAPI_KEY=e93182223f9c247b808eea4199889ce2

# Upstash Redis
KV_REST_API_URL=https://relaxed-mule-45113.upstash.io
KV_REST_API_TOKEN=AbA5AAIncDIxNTg2MjJmZmU4NDY0ZDc2ODY5NzVmZmY1MDFlNTNlYXAyNDUxMTM
```

---

## 🔌 API仕様

### Kie.ai Chat API

```typescript
// エンドポイント形式
const endpoint = `https://api.kie.ai/${model}/v1/chat/completions`;

// リクエスト
const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    messages: [{ role: 'user', content: 'message' }],
    stream: false,
  }),
});
```

### 内部 Chat API (/api/chat)

**POST** - メッセージ送信
```json
{
  "message": "ユーザーメッセージ",
  "history": [{ "role": "user", "content": "..." }],
  "userId": "default"
}
```

**POST** - データ保存
```json
{
  "saveData": {
    "identity": { "name": "カイ", "creature": "タロット占い師", "vibe": "クール系", "emoji": "🎴" },
    "user": { "name": "裕士", "callName": "裕士さん" }
  }
}
```

**GET** - ステータス確認
```
/api/chat?userId=default
```

---

## 🗄️ Redis データ構造

```typescript
// AI Identity
"tarot-journal:ai-identity" → {
  name: string,
  personality: string,
  speakingStyle: string,
  emoji: string,
  createdAt: string,
  updatedAt: string
}

// User Profile
"tarot-journal:user:{userId}" → {
  userId: string,
  displayName: string,
  createdAt: string,
  updatedAt: string
}

// Conversation History
"tarot-journal:history:{userId}" → {
  messages: Array<{
    role: 'user' | 'assistant',
    content: string,
    timestamp: string
  }>
}
```

---

## 🚧 次のタスク（優先順）

### 1. フロントエンドUI修正（高優先）
- **問題**: JavaScriptでメッセージ送信が不安定
- **対応**: 
  - React stateとの連携を修正
  - form の onSubmit ハンドラを確認
  - 入力フィールドのvalue管理を修正

### 2. ブートストラップ完了後の通常モード
- ブートストラップ完了後は「目覚め」ではなく通常の挨拶
- `getRegularSystemPrompt()` が使われる
- タロットジャーナルとしての機能開始

### 3. タロットカード機能
- george-bar-appからタロットデータをインポート
- `/Users/yuushinakashima/.../george-bar-app/lib/tarot-data.ts`
- 毎日のカード引き機能

### 4. ジャーナル機能
- 毎日の振り返り記録
- タロットカードと連携した内省プロンプト
- 履歴の表示と管理

### 5. PWA完全対応
- Service Worker
- オフライン対応
- プッシュ通知（オプション）

---

## 📝 注意事項

1. **Kie.ai API のレスポンス時間**
   - 8-11秒かかることがある
   - フロントエンドでローディング表示必須

2. **ブートストラップリセット**
   - Redisから `tarot-journal:ai-identity` を削除すると再ブートストラップ
   - テスト時に使用可能

3. **george-bar-app との関係**
   - 同じ Upstash インスタンスを共有
   - プレフィックスで分離: `tarot-journal:` vs 直接キー

---

## 🧪 テストコマンド

```bash
# 開発サーバー起動
cd george-tarot-journal
npm run dev

# ブートストラップ状態確認
curl http://localhost:3000/api/chat

# メッセージ送信テスト
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"こんにちは"}'

# データ保存テスト
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"saveData":{"identity":{"name":"テスト"}}}'
```

---

## 📚 参考リソース

- **Clawdbot**: https://github.com/dezoito/clawdbot（ブートストラップの参考）
- **george-bar-app**: 同じディレクトリ内（タロットデータ、UI参考）
- **Kie.ai Docs**: https://kie.ai/market（APIドキュメント）

---

*Generated: 2026-01-28 14:04 JST*
