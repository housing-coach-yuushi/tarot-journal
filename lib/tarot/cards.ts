/**
 * Tarot Card Data for George Tarot Journal
 * Major Arcana - 22 cards with deep interpretations
 */

export interface TarotCard {
  id: number;
  name: string;
  nameEn: string;
  symbol: string;
  keywords: string[];
  meaning: {
    upright: string;
    reversed: string;
  };
  reflection: {
    morning: string;  // 朝の問いかけ
    evening: string;  // 夜の振り返り
  };
  element: 'fire' | 'water' | 'earth' | 'air' | 'spirit';
  color: string;  // テーマカラー（グラデーション用）
  videoFile: string;  // 動画ファイル名
}

export const MAJOR_ARCANA: TarotCard[] = [
  {
    id: 0,
    name: "愚者",
    nameEn: "The Fool",
    symbol: "🃏",
    keywords: ["始まり", "冒険", "自由", "純粋"],
    meaning: {
      upright: "新たな旅立ち。恐れを手放し、未知へ飛び込む勇気。",
      reversed: "無謀さへの警告。立ち止まって考える時。"
    },
    reflection: {
      morning: "今日、何か新しいことに挑戦できるとしたら？",
      evening: "今日、どんな「初めて」があった？"
    },
    element: "air",
    color: "#ffd700",
    videoFile: "愚者.mp4"
  },
  {
    id: 1,
    name: "魔術師",
    nameEn: "The Magician",
    symbol: "🪄",
    keywords: ["創造", "意志", "スキル", "行動"],
    meaning: {
      upright: "あなたには全ての道具が揃っている。今こそ行動の時。",
      reversed: "才能の浪費。エネルギーの分散に注意。"
    },
    reflection: {
      morning: "今日、自分の力で何を創り出せる？",
      evening: "今日、自分の能力をどう活かせた？"
    },
    element: "fire",
    color: "#ff6b35",
    videoFile: "魔術師.mp4"
  },
  {
    id: 2,
    name: "女教皇",
    nameEn: "The High Priestess",
    symbol: "🌙",
    keywords: ["直感", "神秘", "静寂", "内なる声"],
    meaning: {
      upright: "答えはあなたの内側にある。静かに耳を澄ませて。",
      reversed: "直感を無視している。表面だけを見ている。"
    },
    reflection: {
      morning: "心の奥で、何を感じている？",
      evening: "今日、直感に従った瞬間はあった？"
    },
    element: "water",
    color: "#4a90d9",
    videoFile: "女教皇.mp4"
  },
  {
    id: 3,
    name: "女帝",
    nameEn: "The Empress",
    symbol: "🌸",
    keywords: ["豊穣", "美", "愛", "創造性"],
    meaning: {
      upright: "豊かさの流れに身を委ねて。与えることで受け取る。",
      reversed: "自分を満たすことを忘れている。"
    },
    reflection: {
      morning: "今日、何を育てたい？",
      evening: "今日、どんな美しさを感じた？"
    },
    element: "earth",
    color: "#2ecc71",
    videoFile: "女帝.mp4"
  },
  {
    id: 4,
    name: "皇帝",
    nameEn: "The Emperor",
    symbol: "👑",
    keywords: ["秩序", "構造", "責任", "リーダーシップ"],
    meaning: {
      upright: "自分の王国を築く時。規律と決断が力になる。",
      reversed: "支配欲か無力感。バランスを見直して。"
    },
    reflection: {
      morning: "今日、何をコントロールできる？",
      evening: "今日、どこで責任を果たせた？"
    },
    element: "fire",
    color: "#e74c3c",
    videoFile: "皇帝.mp4"
  },
  {
    id: 5,
    name: "法王",
    nameEn: "The Hierophant",
    symbol: "📿",
    keywords: ["伝統", "教え", "信念", "精神性"],
    meaning: {
      upright: "先人の知恵に学ぶ時。師を見つけるか、師になるか。",
      reversed: "形骸化した慣習への疑問。自分の道を模索。"
    },
    reflection: {
      morning: "今日、誰から何を学べる？",
      evening: "今日、何か大切な価値観に触れた？"
    },
    element: "earth",
    color: "#9b59b6",
    videoFile: "教皇.mp4"
  },
  {
    id: 6,
    name: "恋人",
    nameEn: "The Lovers",
    symbol: "💕",
    keywords: ["選択", "愛", "調和", "価値観"],
    meaning: {
      upright: "心に従う選択を。真の愛と統合の時。",
      reversed: "価値観の不一致。本当に望むものは何？"
    },
    reflection: {
      morning: "今日、心が本当に望んでいることは？",
      evening: "今日、どんな選択をした？その理由は？"
    },
    element: "air",
    color: "#ff69b4",
    videoFile: "恋人.mp4"
  },
  {
    id: 7,
    name: "戦車",
    nameEn: "The Chariot",
    symbol: "⚡",
    keywords: ["意志", "勝利", "前進", "克服"],
    meaning: {
      upright: "障害を越えて突き進む時。強い意志が道を拓く。",
      reversed: "方向性の喪失。一度立ち止まって再確認を。"
    },
    reflection: {
      morning: "今日、何を乗り越えたい？",
      evening: "今日、どんな困難と向き合えた？"
    },
    element: "water",
    color: "#3498db",
    videoFile: "戦車.mp4"
  },
  {
    id: 8,
    name: "力",
    nameEn: "Strength",
    symbol: "🦁",
    keywords: ["勇気", "忍耐", "優しさ", "内なる力"],
    meaning: {
      upright: "本当の強さは優しさの中に。恐れを受け入れて超える。",
      reversed: "自信喪失か過信。力の使い方を見直して。"
    },
    reflection: {
      morning: "今日、どんな強さが必要？",
      evening: "今日、優しさで乗り越えられたことは？"
    },
    element: "fire",
    color: "#f39c12",
    videoFile: "力.mp4"
  },
  {
    id: 9,
    name: "隠者",
    nameEn: "The Hermit",
    symbol: "🏔️",
    keywords: ["内省", "孤独", "探求", "導き"],
    meaning: {
      upright: "一人の時間が答えを与える。内なる灯火を信じて。",
      reversed: "孤立しすぎ。他者との繋がりも必要。"
    },
    reflection: {
      morning: "今日、自分と向き合う時間を取れる？",
      evening: "今日、静かに考えられた時間はあった？"
    },
    element: "earth",
    color: "#7f8c8d",
    videoFile: "隠者.mp4"
  },
  {
    id: 10,
    name: "運命の輪",
    nameEn: "Wheel of Fortune",
    symbol: "🎡",
    keywords: ["変化", "サイクル", "運命", "転機"],
    meaning: {
      upright: "運命が動き出す。変化を受け入れ、流れに乗る。",
      reversed: "変化への抵抗。しがみつくのをやめて。"
    },
    reflection: {
      morning: "今日、どんな変化が起きそう？",
      evening: "今日、運命の巡り合わせを感じた瞬間は？"
    },
    element: "fire",
    color: "#8e44ad",
    videoFile: "運命の輪.mp4"
  },
  {
    id: 11,
    name: "正義",
    nameEn: "Justice",
    symbol: "⚖️",
    keywords: ["公平", "真実", "因果", "決断"],
    meaning: {
      upright: "因果は巡る。誠実さが最善の結果を生む。",
      reversed: "不公平感。事実を冷静に見直して。"
    },
    reflection: {
      morning: "今日、どんな判断を迫られそう？",
      evening: "今日、誠実でいられた瞬間は？"
    },
    element: "air",
    color: "#1abc9c",
    videoFile: "正義.mp4"
  },
  {
    id: 12,
    name: "吊るされた男",
    nameEn: "The Hanged Man",
    symbol: "🔄",
    keywords: ["停滞", "視点転換", "手放す", "犠牲"],
    meaning: {
      upright: "見方を180度変えてみて。待つことも行動のひとつ。",
      reversed: "無駄な抵抗。降参することで道が開ける。"
    },
    reflection: {
      morning: "今日、手放せるものは何？",
      evening: "今日、違う視点で見られたことは？"
    },
    element: "water",
    color: "#00bcd4",
    videoFile: "吊るされた男.mp4"
  },
  {
    id: 13,
    name: "死神",
    nameEn: "Death",
    symbol: "🦋",
    keywords: ["終わり", "変容", "再生", "解放"],
    meaning: {
      upright: "終わりは新しい始まり。変容を恐れないで。",
      reversed: "変化への抵抗。手放すべきものを握りしめている。"
    },
    reflection: {
      morning: "今日、何を終わらせる準備ができている？",
      evening: "今日、何かが終わり、何が始まった？"
    },
    element: "water",
    color: "#2c3e50",
    videoFile: "死神.mp4"
  },
  {
    id: 14,
    name: "節制",
    nameEn: "Temperance",
    symbol: "🌈",
    keywords: ["調和", "バランス", "忍耐", "統合"],
    meaning: {
      upright: "極端を避け、中庸を見つける。時間が答えを醸成する。",
      reversed: "アンバランス。何かに偏りすぎていないか。"
    },
    reflection: {
      morning: "今日、どんなバランスを意識する？",
      evening: "今日、調和が取れた瞬間は？"
    },
    element: "fire",
    color: "#e91e63",
    videoFile: "節制.mp4"
  },
  {
    id: 15,
    name: "悪魔",
    nameEn: "The Devil",
    symbol: "⛓️",
    keywords: ["束縛", "欲望", "執着", "影"],
    meaning: {
      upright: "何があなたを縛っている？鎖は自分で外せる。",
      reversed: "解放の兆し。自由への一歩を踏み出す。"
    },
    reflection: {
      morning: "今日、何から自由になりたい？",
      evening: "今日、何かに囚われていた時間は？"
    },
    element: "earth",
    color: "#c0392b",
    videoFile: "悪魔.mp4"
  },
  {
    id: 16,
    name: "塔",
    nameEn: "The Tower",
    symbol: "⚡",
    keywords: ["崩壊", "覚醒", "解放", "真実"],
    meaning: {
      upright: "偽りの構造が崩れる。痛みを伴う解放。",
      reversed: "変化の抵抗。いずれ崩れるものを支え続けている。"
    },
    reflection: {
      morning: "今日、真実と向き合う覚悟は？",
      evening: "今日、何かが壊れて見えた真実は？"
    },
    element: "fire",
    color: "#d35400",
    videoFile: "塔.mp4"
  },
  {
    id: 17,
    name: "星",
    nameEn: "The Star",
    symbol: "⭐",
    keywords: ["希望", "癒し", "インスピレーション", "信頼"],
    meaning: {
      upright: "暗闘の後の希望。自分を信じて進んで。",
      reversed: "希望を見失っている。小さな光を探して。"
    },
    reflection: {
      morning: "今日、何に希望を感じる？",
      evening: "今日、心が癒された瞬間は？"
    },
    element: "air",
    color: "#00bcd4",
    videoFile: "星.mp4"
  },
  {
    id: 18,
    name: "月",
    nameEn: "The Moon",
    symbol: "🌕",
    keywords: ["幻想", "不安", "潜在意識", "直感"],
    meaning: {
      upright: "見えないものを感じる時。恐れと向き合う。",
      reversed: "恐れの正体を見極める。幻想から目覚める。"
    },
    reflection: {
      morning: "今日、心の奥で何を恐れている？",
      evening: "今日、不安と向き合えた瞬間は？"
    },
    element: "water",
    color: "#9c27b0",
    videoFile: "月.mp4"
  },
  {
    id: 19,
    name: "太陽",
    nameEn: "The Sun",
    symbol: "☀️",
    keywords: ["喜び", "成功", "活力", "明晰"],
    meaning: {
      upright: "最高のエネルギー。ありのままで輝く時。",
      reversed: "自信過剰か自己否定。バランスを取り戻して。"
    },
    reflection: {
      morning: "今日、何があなたを輝かせる？",
      evening: "今日、一番楽しかった瞬間は？"
    },
    element: "fire",
    color: "#ffc107",
    videoFile: "太陽.mp4"
  },
  {
    id: 20,
    name: "審判",
    nameEn: "Judgement",
    symbol: "🔔",
    keywords: ["覚醒", "再生", "呼びかけ", "許し"],
    meaning: {
      upright: "目覚めの時。過去を許し、新しい自分へ。",
      reversed: "過去に囚われている。自分を許すことから始めて。"
    },
    reflection: {
      morning: "今日、何から目覚める準備ができている？",
      evening: "今日、何を手放し、何を受け入れた？"
    },
    element: "fire",
    color: "#ff5722",
    videoFile: "審判.mp4"
  },
  {
    id: 21,
    name: "世界",
    nameEn: "The World",
    symbol: "🌍",
    keywords: ["完成", "統合", "達成", "新たな始まり"],
    meaning: {
      upright: "一つのサイクルの完成。全てが繋がる瞬間。",
      reversed: "完成への最後の一歩。何が足りない？"
    },
    reflection: {
      morning: "今日、何を完成させたい？",
      evening: "今日、何かが繋がった感覚はあった？"
    },
    element: "earth",
    color: "#4caf50",
    videoFile: "世界.mp4"
  }
];

/**
 * Get video URL for a card
 */
export function getCardVideoUrl(card: TarotCard): string {
  return `/video/${encodeURIComponent(card.videoFile)}`;
}

/**
 * Draw a random card (truly random, not seeded)
 */
export function drawRandomCard(): TarotCard {
  const index = Math.floor(Math.random() * MAJOR_ARCANA.length);
  return MAJOR_ARCANA[index];
}

/**
 * Get a random card for daily draw
 */
export function drawDailyCard(seed?: string): TarotCard {
  // Use date as seed for consistent daily card
  const today = seed || new Date().toISOString().split('T')[0];
  const hash = today.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const index = hash % MAJOR_ARCANA.length;
  return MAJOR_ARCANA[index];
}

/**
 * Get card by ID
 */
export function getCardById(id: number): TarotCard | undefined {
  return MAJOR_ARCANA.find(card => card.id === id);
}

/**
 * Get card by name (Japanese or English)
 */
export function getCardByName(name: string): TarotCard | undefined {
  const normalized = name.toLowerCase().trim();
  return MAJOR_ARCANA.find(
    card =>
      card.name === name ||
      card.nameEn.toLowerCase() === normalized ||
      card.nameEn.toLowerCase().includes(normalized) ||
      normalized.includes(card.name)
  );
}
