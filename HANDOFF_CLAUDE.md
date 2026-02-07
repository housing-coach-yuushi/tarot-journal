# 引き継ぎメモ（tarot-journal）

## 現在の方針
- STT は **現状のブラウザ SpeechRecognition** を維持（Deepgram streaming には戻していない）
- 体験の主軸は CAMJAPAN/ICF の「あり続ける（Maintains Presence）」
- テクニック押し付けではなく、ユーザーのペースを崩さない対話を優先

## 今日反映した変更

### 1) 音声要素エラー（audio element error）対策
対象: `app/page.tsx`

- `audio.src = ''` を廃止し、`removeAttribute('src') + load()` に統一
- `onError` で `MEDIA_ERR_ABORTED` は無視（停止/切替時の擬似エラーを除外）
- blob URL の revoke を `currentSrc` ベースで安全化

狙い:
- マイク操作直後などで出ていた「音声要素エラー」の誤検知を減らす

### 2) 長押しSTTの継続性改善（長時間ジャーナル向け）
対象: `hooks/useSpeechRecognition.ts`

- 収音が `onend` / `no-speech` で切れても、**長押し中は自動再開**
- セッションを跨いだ transcript を連結保持
- 指を離した時だけ最終送信（既存 UX を維持）

狙い:
- 「日記として長く話したい」ケースで途中切断しにくくする

### 3) チェックイン音声の自動再生ブロック対策
対象: `app/page.tsx`

- `unlockAudio()` で、実際に使う `audioRef` 要素を先に無音再生して prime
- チェックイン自動再生中の `NotAllowed` は失敗扱いを抑え、「ユーザー操作待ち」として扱う

狙い:
- iOS/Safari の autoplay 制限に引っかかる頻度を下げる

### 4) CAMJAPANナレッジに基づく Presence 優先プロンプト
対象: `lib/clawdbot/bootstrap.ts`

- `getRegularSystemPrompt()` に以下を追加
  - ICF「あり続ける（Maintains Presence）」を最優先
  - 1ターン1問い、急いで分析/助言しない、許可を取って深掘り
  - CAMJAPAN 6ステップは「裏の地図」として必要時のみ使用
- bootstrap/new user 用プロンプトにも、急がせない姿勢を追加

狙い:
- コーチングの質感を「構造先行」ではなく「同席先行」に揃える

## 直近コミット
- `9851e8e` Fix audio element false errors and extend long-hold STT
- （次コミットで）チェックイン autoplay 対策 + Presence prompt 反映予定

## 既知の状態
- `eslint app/page.tsx` には既存の `no-explicit-any` 等が残っている（今回範囲外）
- 既存の未追跡/ローカルファイル:
  - `.claude/settings.local.json`（ローカル設定）

## 主に触ったファイル
- `app/page.tsx`
- `hooks/useSpeechRecognition.ts`
- `lib/clawdbot/bootstrap.ts`
- `HANDOFF_CLAUDE.md`

## 次回の確認手順（実機）
1. iPhone Safari で起動し「タップして始める」
2. チェックイン音声が即失敗ログにならないか確認
3. マイク長押しで 60秒以上話し、途中無音を挟んでも継続できるか確認
4. 離したタイミングでのみ送信されるか確認
