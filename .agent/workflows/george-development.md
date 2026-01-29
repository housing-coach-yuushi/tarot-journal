---
description: How to develop and deploy the George Tarot Journal PWA
---

# George Tarot Journal 開発ワークフロー

このプロジェクトは、Next.js をベースとした PWA であり、Gemini Live 級の低遅延ボイス体験とチャット機能を備えた「タロット・ジャーナル」を構築します。
**全ての AI 機能は Kie.ai (KEIAPI) に統一します。**

---

## 0. Clawdbot 人格テンプレートの取得 (Git から)
Clawdbot の公式リポジトリから、人格設定の核となる MD ファイルをダウンロードします。

// turbo
```bash
mkdir -p lib/clawdbot && \
curl -o lib/clawdbot/SOUL.md https://raw.githubusercontent.com/clawdbot/clawdbot/main/docs/reference/templates/SOUL.md && \
curl -o lib/clawdbot/IDENTITY.md https://raw.githubusercontent.com/clawdbot/clawdbot/main/docs/reference/templates/IDENTITY.md && \
curl -o lib/clawdbot/BOOTSTRAP.md https://raw.githubusercontent.com/clawdbot/clawdbot/main/docs/reference/templates/BOOTSTRAP.md && \
curl -o lib/clawdbot/USER.md https://raw.githubusercontent.com/clawdbot/clawdbot/main/docs/reference/templates/USER.md
```

取得後、`SOUL.md` と `IDENTITY.md` を George（バーのマスター）向けにカスタマイズします。

---

## 1. 環境構築
1. プロジェクトディレクトリで Next.js インスタンスを作成:
// turbo
```bash
npx -y create-next-app@latest ./ --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*"
```
2. 必要なライブラリのインストール:
// turbo
```bash
npm install framer-motion lucide-react stripe @stripe/stripe-js
```
3. `.env.local` に Kie.ai (KEIAPI) のキーを設定:
```
KEIAPI_KEY=your_keiapi_key_here
```

---

## 2. AI 統合 (全て Kie.ai 経由・最新モデル)

| 機能 | Kie.ai モデル | 備考 |
| :--- | :--- | :--- |
| **LLM (思考)** | **Gemini 3.0 Flash** | 2025年12月リリース、高速推論 |
| **TTS (音声合成)** | **ElevenLabs Flash v2.5** | リアルタイム推奨（v3はまだalpha） |
| **STT (音声認識)** | **ElevenLabs Scribe v1** | 99言語対応、話者分離 |

> **Note**: ElevenLabs v3 (alpha) は表現力が最高ですが、リアルタイム版がまだないため、低遅延が必要な本プロジェクトでは **v2.5 Flash** を使用します。

### 実装ファイル
- `lib/keiapi/client.ts`: Kie.ai API クライアント（LLM, TTS, STT 共通）。
- `hooks/useGeorge.ts`: ボイス＆テキスト統合のカスタムフック。

---

## 3. UI実装 (Gemini Live 完全クローン)

### ボイスモード
- `components/Visualizer.tsx`: Canvas API で波形アニメーション (60fps)。
- `components/LiveCaption.tsx`: ストリーミング字幕（SSE で一文字ずつ表示）。

### チャットモード
- `components/ChatPanel.tsx`: スライド式履歴 UI + テキスト入力。
- `components/JournalHistory.tsx`: 過去の占い結果をカード形式で表示。

### 割り込み (Barge-in) 対応
- `hooks/useVAD.ts`: ユーザーが話し始めたらジョージの再生を停止する VAD ロジック。

### デザインシステム
- `theme/colors.ts`: ダーク基調 + ネオングラデーション。
- Framer Motion で全画面遷移を滑らかに。

---

## 4. ジャーナル・DB連携
1. `lib/db.ts`: Firebase または Supabase で対話ログを永続化。
2. プレミアム機能として Obsidian 連携（Local REST API）を追加。

---

## 5. デプロイ (Google Cloud Run)
1. Dockerfile の作成。
// turbo
2. ビルドとデプロイ:
```bash
gcloud run deploy george-journal --source . --platform managed --allow-unauthenticated
```
3. Cloud Run 設定:
   - 「常に CPU を割り当てる」を有効化。
   - 「セッション アフィニティ」を有効化して低遅延を維持。

---

## 6. Gemini Live UX チェックリスト
- [ ] 超低遅延ボイス応答 (Kie.ai TTS ストリーム)
- [ ] リアルタイム波形アニメーション
- [ ] ライブ字幕 (SSE ストリーム)
- [ ] ボイス ↔ チャット切り替え
- [ ] 割り込み (VAD) 対応
- [ ] Clawdbot 流「入魂」フロー (BOOTSTRAP.md)
