/**
 * Tarot Card Data for George Tarot Journal
 * Major Arcana - 22 cards with deep interpretations
 */

export interface TarotCard {
  suit?: string;
  rank?: string;
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
  image?: string;     // 静止画ファイルパス (new)
}

export interface DrawnCard {
  card: TarotCard;
  position: 'upright' | 'reversed';
  // Helper for easier checking
  isReversed: boolean;
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
    videoFile: "愚者.mp4",
    image: "/tarot-assets/major_00.png",
    image: "/tarot-assets/major_00.png"
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
    videoFile: "魔術師.mp4",
    image: "/tarot-assets/major_01.png"
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
    videoFile: "女教皇.mp4",
    image: "/tarot-assets/major_02.png"
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
    videoFile: "女帝.mp4",
    image: "/tarot-assets/major_03.png"
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
    videoFile: "皇帝.mp4",
    image: "/tarot-assets/major_04.png"
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
    videoFile: "教皇.mp4",
    image: "/tarot-assets/major_05.png"
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
    videoFile: "恋人.mp4",
    image: "/tarot-assets/major_06.png"
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
    videoFile: "戦車.mp4",
    image: "/tarot-assets/major_07.png"
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
    videoFile: "力.mp4",
    image: "/tarot-assets/major_08.png"
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
    videoFile: "隠者.mp4",
    image: "/tarot-assets/major_09.png"
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
    videoFile: "運命の輪.mp4",
    image: "/tarot-assets/major_10.png"
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
    videoFile: "正義.mp4",
    image: "/tarot-assets/major_11.png"
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
    videoFile: "吊るされた男.mp4",
    image: "/tarot-assets/major_12.png"
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
    videoFile: "死神.mp4",
    image: "/tarot-assets/major_13.png"
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
    videoFile: "節制.mp4",
    image: "/tarot-assets/major_14.png"
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
    videoFile: "悪魔.mp4",
    image: "/tarot-assets/major_15.png"
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
    videoFile: "塔.mp4",
    image: "/tarot-assets/major_16.png"
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
    videoFile: "星.mp4",
    image: "/tarot-assets/major_17.png"
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
    videoFile: "月.mp4",
    image: "/tarot-assets/major_18.png"
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
    videoFile: "太陽.mp4",
    image: "/tarot-assets/major_19.png"
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
    videoFile: "審判.mp4",
    image: "/tarot-assets/major_20.png"
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
    videoFile: "世界.mp4",
    image: "/tarot-assets/major_21.png"
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
  // Ensure ALL_CARDS is available (it is defined at the end of this module)
  // Determine if we should draw from Full Deck or Major Only.
  // For now, default to FULL DECK as per Phase 2.
  const deck = ALL_CARDS;
  const index = Math.floor(Math.random() * deck.length);
  return deck[index];
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
  return ALL_CARDS.find(card => card.id === id);
}

/**
 * Get card by name (Japanese or English)
 */
export function getCardByName(name: string): TarotCard | undefined {
  const normalized = name.toLowerCase().trim();
  return ALL_CARDS.find(
    card =>
      card.name === name ||
      card.nameEn.toLowerCase() === normalized ||
      card.nameEn.toLowerCase().includes(normalized) ||
      normalized.includes(card.name)
  );
}

export const MINOR_ARCANA: TarotCard[] = [
  {
    "id": 22,
    "name": "Ace of Wands",
    "suit": "Wands",
    "rank": "Ace",
    "symbol": "Ace",
    "keywords": [
      "Wands",
      "Ace",
      "Fire"
    ],
    "image": "/tarot-assets/wands_01.png",
    "meaning": {
      "upright": "The Ace of Wands signifies the essence of Fire in the realm of Ace.",
      "reversed": "Reversed, the Ace of Wands suggests a blockage or internal focus on Fire energy."
    },
    "reflection": {
      "morning": "How does the energy of the Ace of Wands influence your start today?",
      "evening": "In what ways did you experience the Ace of Wands today?"
    },
    "element": "Fire",
    "themeColor": "#E34234",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 23,
    "name": "Two of Wands",
    "suit": "Wands",
    "rank": "Two",
    "symbol": "Two",
    "keywords": [
      "Wands",
      "Two",
      "Fire"
    ],
    "image": "/tarot-assets/wands_02.png",
    "meaning": {
      "upright": "The Two of Wands signifies the essence of Fire in the realm of Two.",
      "reversed": "Reversed, the Two of Wands suggests a blockage or internal focus on Fire energy."
    },
    "reflection": {
      "morning": "How does the energy of the Two of Wands influence your start today?",
      "evening": "In what ways did you experience the Two of Wands today?"
    },
    "element": "Fire",
    "themeColor": "#E34234",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 24,
    "name": "Three of Wands",
    "suit": "Wands",
    "rank": "Three",
    "symbol": "Three",
    "keywords": [
      "Wands",
      "Three",
      "Fire"
    ],
    "image": "/tarot-assets/wands_03.png",
    "meaning": {
      "upright": "The Three of Wands signifies the essence of Fire in the realm of Three.",
      "reversed": "Reversed, the Three of Wands suggests a blockage or internal focus on Fire energy."
    },
    "reflection": {
      "morning": "How does the energy of the Three of Wands influence your start today?",
      "evening": "In what ways did you experience the Three of Wands today?"
    },
    "element": "Fire",
    "themeColor": "#E34234",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 25,
    "name": "Four of Wands",
    "suit": "Wands",
    "rank": "Four",
    "symbol": "Four",
    "keywords": [
      "Wands",
      "Four",
      "Fire"
    ],
    "image": "/tarot-assets/wands_04.png",
    "meaning": {
      "upright": "The Four of Wands signifies the essence of Fire in the realm of Four.",
      "reversed": "Reversed, the Four of Wands suggests a blockage or internal focus on Fire energy."
    },
    "reflection": {
      "morning": "How does the energy of the Four of Wands influence your start today?",
      "evening": "In what ways did you experience the Four of Wands today?"
    },
    "element": "Fire",
    "themeColor": "#E34234",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 26,
    "name": "Five of Wands",
    "suit": "Wands",
    "rank": "Five",
    "symbol": "Five",
    "keywords": [
      "Wands",
      "Five",
      "Fire"
    ],
    "image": "/tarot-assets/wands_05.png",
    "meaning": {
      "upright": "The Five of Wands signifies the essence of Fire in the realm of Five.",
      "reversed": "Reversed, the Five of Wands suggests a blockage or internal focus on Fire energy."
    },
    "reflection": {
      "morning": "How does the energy of the Five of Wands influence your start today?",
      "evening": "In what ways did you experience the Five of Wands today?"
    },
    "element": "Fire",
    "themeColor": "#E34234",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 27,
    "name": "Six of Wands",
    "suit": "Wands",
    "rank": "Six",
    "symbol": "Six",
    "keywords": [
      "Wands",
      "Six",
      "Fire"
    ],
    "image": "/tarot-assets/wands_06.png",
    "meaning": {
      "upright": "The Six of Wands signifies the essence of Fire in the realm of Six.",
      "reversed": "Reversed, the Six of Wands suggests a blockage or internal focus on Fire energy."
    },
    "reflection": {
      "morning": "How does the energy of the Six of Wands influence your start today?",
      "evening": "In what ways did you experience the Six of Wands today?"
    },
    "element": "Fire",
    "themeColor": "#E34234",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 28,
    "name": "Seven of Wands",
    "suit": "Wands",
    "rank": "Seven",
    "symbol": "Seven",
    "keywords": [
      "Wands",
      "Seven",
      "Fire"
    ],
    "image": "/tarot-assets/wands_07.png",
    "meaning": {
      "upright": "The Seven of Wands signifies the essence of Fire in the realm of Seven.",
      "reversed": "Reversed, the Seven of Wands suggests a blockage or internal focus on Fire energy."
    },
    "reflection": {
      "morning": "How does the energy of the Seven of Wands influence your start today?",
      "evening": "In what ways did you experience the Seven of Wands today?"
    },
    "element": "Fire",
    "themeColor": "#E34234",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 29,
    "name": "Eight of Wands",
    "suit": "Wands",
    "rank": "Eight",
    "symbol": "Eight",
    "keywords": [
      "Wands",
      "Eight",
      "Fire"
    ],
    "image": "/tarot-assets/wands_08.png",
    "meaning": {
      "upright": "The Eight of Wands signifies the essence of Fire in the realm of Eight.",
      "reversed": "Reversed, the Eight of Wands suggests a blockage or internal focus on Fire energy."
    },
    "reflection": {
      "morning": "How does the energy of the Eight of Wands influence your start today?",
      "evening": "In what ways did you experience the Eight of Wands today?"
    },
    "element": "Fire",
    "themeColor": "#E34234",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 30,
    "name": "Nine of Wands",
    "suit": "Wands",
    "rank": "Nine",
    "symbol": "Nine",
    "keywords": [
      "Wands",
      "Nine",
      "Fire"
    ],
    "image": "/tarot-assets/wands_09.png",
    "meaning": {
      "upright": "The Nine of Wands signifies the essence of Fire in the realm of Nine.",
      "reversed": "Reversed, the Nine of Wands suggests a blockage or internal focus on Fire energy."
    },
    "reflection": {
      "morning": "How does the energy of the Nine of Wands influence your start today?",
      "evening": "In what ways did you experience the Nine of Wands today?"
    },
    "element": "Fire",
    "themeColor": "#E34234",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 31,
    "name": "Ten of Wands",
    "suit": "Wands",
    "rank": "Ten",
    "symbol": "Ten",
    "keywords": [
      "Wands",
      "Ten",
      "Fire"
    ],
    "image": "/tarot-assets/wands_10.png",
    "meaning": {
      "upright": "The Ten of Wands signifies the essence of Fire in the realm of Ten.",
      "reversed": "Reversed, the Ten of Wands suggests a blockage or internal focus on Fire energy."
    },
    "reflection": {
      "morning": "How does the energy of the Ten of Wands influence your start today?",
      "evening": "In what ways did you experience the Ten of Wands today?"
    },
    "element": "Fire",
    "themeColor": "#E34234",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 32,
    "name": "Page of Wands",
    "suit": "Wands",
    "rank": "Page",
    "symbol": "Page",
    "keywords": [
      "Wands",
      "Page",
      "Fire"
    ],
    "image": "/tarot-assets/wands_11.png",
    "meaning": {
      "upright": "The Page of Wands signifies the essence of Fire in the realm of Page.",
      "reversed": "Reversed, the Page of Wands suggests a blockage or internal focus on Fire energy."
    },
    "reflection": {
      "morning": "How does the energy of the Page of Wands influence your start today?",
      "evening": "In what ways did you experience the Page of Wands today?"
    },
    "element": "Fire",
    "themeColor": "#E34234",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 33,
    "name": "Knight of Wands",
    "suit": "Wands",
    "rank": "Knight",
    "symbol": "Knight",
    "keywords": [
      "Wands",
      "Knight",
      "Fire"
    ],
    "image": "/tarot-assets/wands_12.png",
    "meaning": {
      "upright": "The Knight of Wands signifies the essence of Fire in the realm of Knight.",
      "reversed": "Reversed, the Knight of Wands suggests a blockage or internal focus on Fire energy."
    },
    "reflection": {
      "morning": "How does the energy of the Knight of Wands influence your start today?",
      "evening": "In what ways did you experience the Knight of Wands today?"
    },
    "element": "Fire",
    "themeColor": "#E34234",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 34,
    "name": "Queen of Wands",
    "suit": "Wands",
    "rank": "Queen",
    "symbol": "Queen",
    "keywords": [
      "Wands",
      "Queen",
      "Fire"
    ],
    "image": "/tarot-assets/wands_13.png",
    "meaning": {
      "upright": "The Queen of Wands signifies the essence of Fire in the realm of Queen.",
      "reversed": "Reversed, the Queen of Wands suggests a blockage or internal focus on Fire energy."
    },
    "reflection": {
      "morning": "How does the energy of the Queen of Wands influence your start today?",
      "evening": "In what ways did you experience the Queen of Wands today?"
    },
    "element": "Fire",
    "themeColor": "#E34234",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 35,
    "name": "King of Wands",
    "suit": "Wands",
    "rank": "King",
    "symbol": "King",
    "keywords": [
      "Wands",
      "King",
      "Fire"
    ],
    "image": "/tarot-assets/wands_14.png",
    "meaning": {
      "upright": "The King of Wands signifies the essence of Fire in the realm of King.",
      "reversed": "Reversed, the King of Wands suggests a blockage or internal focus on Fire energy."
    },
    "reflection": {
      "morning": "How does the energy of the King of Wands influence your start today?",
      "evening": "In what ways did you experience the King of Wands today?"
    },
    "element": "Fire",
    "themeColor": "#E34234",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 36,
    "name": "Ace of Cups",
    "suit": "Cups",
    "rank": "Ace",
    "symbol": "Ace",
    "keywords": [
      "Cups",
      "Ace",
      "Water"
    ],
    "image": "/tarot-assets/cups_01.png",
    "meaning": {
      "upright": "The Ace of Cups signifies the essence of Water in the realm of Ace.",
      "reversed": "Reversed, the Ace of Cups suggests a blockage or internal focus on Water energy."
    },
    "reflection": {
      "morning": "How does the energy of the Ace of Cups influence your start today?",
      "evening": "In what ways did you experience the Ace of Cups today?"
    },
    "element": "Water",
    "themeColor": "#4169E1",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 37,
    "name": "Two of Cups",
    "suit": "Cups",
    "rank": "Two",
    "symbol": "Two",
    "keywords": [
      "Cups",
      "Two",
      "Water"
    ],
    "image": "/tarot-assets/cups_02.png",
    "meaning": {
      "upright": "The Two of Cups signifies the essence of Water in the realm of Two.",
      "reversed": "Reversed, the Two of Cups suggests a blockage or internal focus on Water energy."
    },
    "reflection": {
      "morning": "How does the energy of the Two of Cups influence your start today?",
      "evening": "In what ways did you experience the Two of Cups today?"
    },
    "element": "Water",
    "themeColor": "#4169E1",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 38,
    "name": "Three of Cups",
    "suit": "Cups",
    "rank": "Three",
    "symbol": "Three",
    "keywords": [
      "Cups",
      "Three",
      "Water"
    ],
    "image": "/tarot-assets/cups_03.png",
    "meaning": {
      "upright": "The Three of Cups signifies the essence of Water in the realm of Three.",
      "reversed": "Reversed, the Three of Cups suggests a blockage or internal focus on Water energy."
    },
    "reflection": {
      "morning": "How does the energy of the Three of Cups influence your start today?",
      "evening": "In what ways did you experience the Three of Cups today?"
    },
    "element": "Water",
    "themeColor": "#4169E1",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 39,
    "name": "Four of Cups",
    "suit": "Cups",
    "rank": "Four",
    "symbol": "Four",
    "keywords": [
      "Cups",
      "Four",
      "Water"
    ],
    "image": "/tarot-assets/cups_04.png",
    "meaning": {
      "upright": "The Four of Cups signifies the essence of Water in the realm of Four.",
      "reversed": "Reversed, the Four of Cups suggests a blockage or internal focus on Water energy."
    },
    "reflection": {
      "morning": "How does the energy of the Four of Cups influence your start today?",
      "evening": "In what ways did you experience the Four of Cups today?"
    },
    "element": "Water",
    "themeColor": "#4169E1",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 40,
    "name": "Five of Cups",
    "suit": "Cups",
    "rank": "Five",
    "symbol": "Five",
    "keywords": [
      "Cups",
      "Five",
      "Water"
    ],
    "image": "/tarot-assets/cups_05.png",
    "meaning": {
      "upright": "The Five of Cups signifies the essence of Water in the realm of Five.",
      "reversed": "Reversed, the Five of Cups suggests a blockage or internal focus on Water energy."
    },
    "reflection": {
      "morning": "How does the energy of the Five of Cups influence your start today?",
      "evening": "In what ways did you experience the Five of Cups today?"
    },
    "element": "Water",
    "themeColor": "#4169E1",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 41,
    "name": "Six of Cups",
    "suit": "Cups",
    "rank": "Six",
    "symbol": "Six",
    "keywords": [
      "Cups",
      "Six",
      "Water"
    ],
    "image": "/tarot-assets/cups_06.png",
    "meaning": {
      "upright": "The Six of Cups signifies the essence of Water in the realm of Six.",
      "reversed": "Reversed, the Six of Cups suggests a blockage or internal focus on Water energy."
    },
    "reflection": {
      "morning": "How does the energy of the Six of Cups influence your start today?",
      "evening": "In what ways did you experience the Six of Cups today?"
    },
    "element": "Water",
    "themeColor": "#4169E1",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 42,
    "name": "Seven of Cups",
    "suit": "Cups",
    "rank": "Seven",
    "symbol": "Seven",
    "keywords": [
      "Cups",
      "Seven",
      "Water"
    ],
    "image": "/tarot-assets/cups_07.png",
    "meaning": {
      "upright": "The Seven of Cups signifies the essence of Water in the realm of Seven.",
      "reversed": "Reversed, the Seven of Cups suggests a blockage or internal focus on Water energy."
    },
    "reflection": {
      "morning": "How does the energy of the Seven of Cups influence your start today?",
      "evening": "In what ways did you experience the Seven of Cups today?"
    },
    "element": "Water",
    "themeColor": "#4169E1",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 43,
    "name": "Eight of Cups",
    "suit": "Cups",
    "rank": "Eight",
    "symbol": "Eight",
    "keywords": [
      "Cups",
      "Eight",
      "Water"
    ],
    "image": "/tarot-assets/cups_08.png",
    "meaning": {
      "upright": "The Eight of Cups signifies the essence of Water in the realm of Eight.",
      "reversed": "Reversed, the Eight of Cups suggests a blockage or internal focus on Water energy."
    },
    "reflection": {
      "morning": "How does the energy of the Eight of Cups influence your start today?",
      "evening": "In what ways did you experience the Eight of Cups today?"
    },
    "element": "Water",
    "themeColor": "#4169E1",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 44,
    "name": "Nine of Cups",
    "suit": "Cups",
    "rank": "Nine",
    "symbol": "Nine",
    "keywords": [
      "Cups",
      "Nine",
      "Water"
    ],
    "image": "/tarot-assets/cups_09.png",
    "meaning": {
      "upright": "The Nine of Cups signifies the essence of Water in the realm of Nine.",
      "reversed": "Reversed, the Nine of Cups suggests a blockage or internal focus on Water energy."
    },
    "reflection": {
      "morning": "How does the energy of the Nine of Cups influence your start today?",
      "evening": "In what ways did you experience the Nine of Cups today?"
    },
    "element": "Water",
    "themeColor": "#4169E1",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 45,
    "name": "Ten of Cups",
    "suit": "Cups",
    "rank": "Ten",
    "symbol": "Ten",
    "keywords": [
      "Cups",
      "Ten",
      "Water"
    ],
    "image": "/tarot-assets/cups_10.png",
    "meaning": {
      "upright": "The Ten of Cups signifies the essence of Water in the realm of Ten.",
      "reversed": "Reversed, the Ten of Cups suggests a blockage or internal focus on Water energy."
    },
    "reflection": {
      "morning": "How does the energy of the Ten of Cups influence your start today?",
      "evening": "In what ways did you experience the Ten of Cups today?"
    },
    "element": "Water",
    "themeColor": "#4169E1",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 46,
    "name": "Page of Cups",
    "suit": "Cups",
    "rank": "Page",
    "symbol": "Page",
    "keywords": [
      "Cups",
      "Page",
      "Water"
    ],
    "image": "/tarot-assets/cups_11.png",
    "meaning": {
      "upright": "The Page of Cups signifies the essence of Water in the realm of Page.",
      "reversed": "Reversed, the Page of Cups suggests a blockage or internal focus on Water energy."
    },
    "reflection": {
      "morning": "How does the energy of the Page of Cups influence your start today?",
      "evening": "In what ways did you experience the Page of Cups today?"
    },
    "element": "Water",
    "themeColor": "#4169E1",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 47,
    "name": "Knight of Cups",
    "suit": "Cups",
    "rank": "Knight",
    "symbol": "Knight",
    "keywords": [
      "Cups",
      "Knight",
      "Water"
    ],
    "image": "/tarot-assets/cups_12.png",
    "meaning": {
      "upright": "The Knight of Cups signifies the essence of Water in the realm of Knight.",
      "reversed": "Reversed, the Knight of Cups suggests a blockage or internal focus on Water energy."
    },
    "reflection": {
      "morning": "How does the energy of the Knight of Cups influence your start today?",
      "evening": "In what ways did you experience the Knight of Cups today?"
    },
    "element": "Water",
    "themeColor": "#4169E1",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 48,
    "name": "Queen of Cups",
    "suit": "Cups",
    "rank": "Queen",
    "symbol": "Queen",
    "keywords": [
      "Cups",
      "Queen",
      "Water"
    ],
    "image": "/tarot-assets/cups_13.png",
    "meaning": {
      "upright": "The Queen of Cups signifies the essence of Water in the realm of Queen.",
      "reversed": "Reversed, the Queen of Cups suggests a blockage or internal focus on Water energy."
    },
    "reflection": {
      "morning": "How does the energy of the Queen of Cups influence your start today?",
      "evening": "In what ways did you experience the Queen of Cups today?"
    },
    "element": "Water",
    "themeColor": "#4169E1",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 49,
    "name": "King of Cups",
    "suit": "Cups",
    "rank": "King",
    "symbol": "King",
    "keywords": [
      "Cups",
      "King",
      "Water"
    ],
    "image": "/tarot-assets/cups_14.png",
    "meaning": {
      "upright": "The King of Cups signifies the essence of Water in the realm of King.",
      "reversed": "Reversed, the King of Cups suggests a blockage or internal focus on Water energy."
    },
    "reflection": {
      "morning": "How does the energy of the King of Cups influence your start today?",
      "evening": "In what ways did you experience the King of Cups today?"
    },
    "element": "Water",
    "themeColor": "#4169E1",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 50,
    "name": "Ace of Swords",
    "suit": "Swords",
    "rank": "Ace",
    "symbol": "Ace",
    "keywords": [
      "Swords",
      "Ace",
      "Air"
    ],
    "image": "/tarot-assets/swords_01.png",
    "meaning": {
      "upright": "The Ace of Swords signifies the essence of Air in the realm of Ace.",
      "reversed": "Reversed, the Ace of Swords suggests a blockage or internal focus on Air energy."
    },
    "reflection": {
      "morning": "How does the energy of the Ace of Swords influence your start today?",
      "evening": "In what ways did you experience the Ace of Swords today?"
    },
    "element": "Air",
    "themeColor": "#C0C0C0",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 51,
    "name": "Two of Swords",
    "suit": "Swords",
    "rank": "Two",
    "symbol": "Two",
    "keywords": [
      "Swords",
      "Two",
      "Air"
    ],
    "image": "/tarot-assets/swords_02.png",
    "meaning": {
      "upright": "The Two of Swords signifies the essence of Air in the realm of Two.",
      "reversed": "Reversed, the Two of Swords suggests a blockage or internal focus on Air energy."
    },
    "reflection": {
      "morning": "How does the energy of the Two of Swords influence your start today?",
      "evening": "In what ways did you experience the Two of Swords today?"
    },
    "element": "Air",
    "themeColor": "#C0C0C0",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 52,
    "name": "Three of Swords",
    "suit": "Swords",
    "rank": "Three",
    "symbol": "Three",
    "keywords": [
      "Swords",
      "Three",
      "Air"
    ],
    "image": "/tarot-assets/swords_03.png",
    "meaning": {
      "upright": "The Three of Swords signifies the essence of Air in the realm of Three.",
      "reversed": "Reversed, the Three of Swords suggests a blockage or internal focus on Air energy."
    },
    "reflection": {
      "morning": "How does the energy of the Three of Swords influence your start today?",
      "evening": "In what ways did you experience the Three of Swords today?"
    },
    "element": "Air",
    "themeColor": "#C0C0C0",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 53,
    "name": "Four of Swords",
    "suit": "Swords",
    "rank": "Four",
    "symbol": "Four",
    "keywords": [
      "Swords",
      "Four",
      "Air"
    ],
    "image": "/tarot-assets/swords_04.png",
    "meaning": {
      "upright": "The Four of Swords signifies the essence of Air in the realm of Four.",
      "reversed": "Reversed, the Four of Swords suggests a blockage or internal focus on Air energy."
    },
    "reflection": {
      "morning": "How does the energy of the Four of Swords influence your start today?",
      "evening": "In what ways did you experience the Four of Swords today?"
    },
    "element": "Air",
    "themeColor": "#C0C0C0",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 54,
    "name": "Five of Swords",
    "suit": "Swords",
    "rank": "Five",
    "symbol": "Five",
    "keywords": [
      "Swords",
      "Five",
      "Air"
    ],
    "image": "/tarot-assets/swords_05.png",
    "meaning": {
      "upright": "The Five of Swords signifies the essence of Air in the realm of Five.",
      "reversed": "Reversed, the Five of Swords suggests a blockage or internal focus on Air energy."
    },
    "reflection": {
      "morning": "How does the energy of the Five of Swords influence your start today?",
      "evening": "In what ways did you experience the Five of Swords today?"
    },
    "element": "Air",
    "themeColor": "#C0C0C0",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 55,
    "name": "Six of Swords",
    "suit": "Swords",
    "rank": "Six",
    "symbol": "Six",
    "keywords": [
      "Swords",
      "Six",
      "Air"
    ],
    "image": "/tarot-assets/swords_06.png",
    "meaning": {
      "upright": "The Six of Swords signifies the essence of Air in the realm of Six.",
      "reversed": "Reversed, the Six of Swords suggests a blockage or internal focus on Air energy."
    },
    "reflection": {
      "morning": "How does the energy of the Six of Swords influence your start today?",
      "evening": "In what ways did you experience the Six of Swords today?"
    },
    "element": "Air",
    "themeColor": "#C0C0C0",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 56,
    "name": "Seven of Swords",
    "suit": "Swords",
    "rank": "Seven",
    "symbol": "Seven",
    "keywords": [
      "Swords",
      "Seven",
      "Air"
    ],
    "image": "/tarot-assets/swords_07.png",
    "meaning": {
      "upright": "The Seven of Swords signifies the essence of Air in the realm of Seven.",
      "reversed": "Reversed, the Seven of Swords suggests a blockage or internal focus on Air energy."
    },
    "reflection": {
      "morning": "How does the energy of the Seven of Swords influence your start today?",
      "evening": "In what ways did you experience the Seven of Swords today?"
    },
    "element": "Air",
    "themeColor": "#C0C0C0",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 57,
    "name": "Eight of Swords",
    "suit": "Swords",
    "rank": "Eight",
    "symbol": "Eight",
    "keywords": [
      "Swords",
      "Eight",
      "Air"
    ],
    "image": "/tarot-assets/swords_08.png",
    "meaning": {
      "upright": "The Eight of Swords signifies the essence of Air in the realm of Eight.",
      "reversed": "Reversed, the Eight of Swords suggests a blockage or internal focus on Air energy."
    },
    "reflection": {
      "morning": "How does the energy of the Eight of Swords influence your start today?",
      "evening": "In what ways did you experience the Eight of Swords today?"
    },
    "element": "Air",
    "themeColor": "#C0C0C0",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 58,
    "name": "Nine of Swords",
    "suit": "Swords",
    "rank": "Nine",
    "symbol": "Nine",
    "keywords": [
      "Swords",
      "Nine",
      "Air"
    ],
    "image": "/tarot-assets/swords_09.png",
    "meaning": {
      "upright": "The Nine of Swords signifies the essence of Air in the realm of Nine.",
      "reversed": "Reversed, the Nine of Swords suggests a blockage or internal focus on Air energy."
    },
    "reflection": {
      "morning": "How does the energy of the Nine of Swords influence your start today?",
      "evening": "In what ways did you experience the Nine of Swords today?"
    },
    "element": "Air",
    "themeColor": "#C0C0C0",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 59,
    "name": "Ten of Swords",
    "suit": "Swords",
    "rank": "Ten",
    "symbol": "Ten",
    "keywords": [
      "Swords",
      "Ten",
      "Air"
    ],
    "image": "/tarot-assets/swords_10.png",
    "meaning": {
      "upright": "The Ten of Swords signifies the essence of Air in the realm of Ten.",
      "reversed": "Reversed, the Ten of Swords suggests a blockage or internal focus on Air energy."
    },
    "reflection": {
      "morning": "How does the energy of the Ten of Swords influence your start today?",
      "evening": "In what ways did you experience the Ten of Swords today?"
    },
    "element": "Air",
    "themeColor": "#C0C0C0",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 60,
    "name": "Page of Swords",
    "suit": "Swords",
    "rank": "Page",
    "symbol": "Page",
    "keywords": [
      "Swords",
      "Page",
      "Air"
    ],
    "image": "/tarot-assets/swords_11.png",
    "meaning": {
      "upright": "The Page of Swords signifies the essence of Air in the realm of Page.",
      "reversed": "Reversed, the Page of Swords suggests a blockage or internal focus on Air energy."
    },
    "reflection": {
      "morning": "How does the energy of the Page of Swords influence your start today?",
      "evening": "In what ways did you experience the Page of Swords today?"
    },
    "element": "Air",
    "themeColor": "#C0C0C0",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 61,
    "name": "Knight of Swords",
    "suit": "Swords",
    "rank": "Knight",
    "symbol": "Knight",
    "keywords": [
      "Swords",
      "Knight",
      "Air"
    ],
    "image": "/tarot-assets/swords_12.png",
    "meaning": {
      "upright": "The Knight of Swords signifies the essence of Air in the realm of Knight.",
      "reversed": "Reversed, the Knight of Swords suggests a blockage or internal focus on Air energy."
    },
    "reflection": {
      "morning": "How does the energy of the Knight of Swords influence your start today?",
      "evening": "In what ways did you experience the Knight of Swords today?"
    },
    "element": "Air",
    "themeColor": "#C0C0C0",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 62,
    "name": "Queen of Swords",
    "suit": "Swords",
    "rank": "Queen",
    "symbol": "Queen",
    "keywords": [
      "Swords",
      "Queen",
      "Air"
    ],
    "image": "/tarot-assets/swords_13.png",
    "meaning": {
      "upright": "The Queen of Swords signifies the essence of Air in the realm of Queen.",
      "reversed": "Reversed, the Queen of Swords suggests a blockage or internal focus on Air energy."
    },
    "reflection": {
      "morning": "How does the energy of the Queen of Swords influence your start today?",
      "evening": "In what ways did you experience the Queen of Swords today?"
    },
    "element": "Air",
    "themeColor": "#C0C0C0",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 63,
    "name": "King of Swords",
    "suit": "Swords",
    "rank": "King",
    "symbol": "King",
    "keywords": [
      "Swords",
      "King",
      "Air"
    ],
    "image": "/tarot-assets/swords_14.png",
    "meaning": {
      "upright": "The King of Swords signifies the essence of Air in the realm of King.",
      "reversed": "Reversed, the King of Swords suggests a blockage or internal focus on Air energy."
    },
    "reflection": {
      "morning": "How does the energy of the King of Swords influence your start today?",
      "evening": "In what ways did you experience the King of Swords today?"
    },
    "element": "Air",
    "themeColor": "#C0C0C0",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 64,
    "name": "Ace of Pentacles",
    "suit": "Pentacles",
    "rank": "Ace",
    "symbol": "Ace",
    "keywords": [
      "Pentacles",
      "Ace",
      "Earth"
    ],
    "image": "/tarot-assets/pentacles_01.png",
    "meaning": {
      "upright": "The Ace of Pentacles signifies the essence of Earth in the realm of Ace.",
      "reversed": "Reversed, the Ace of Pentacles suggests a blockage or internal focus on Earth energy."
    },
    "reflection": {
      "morning": "How does the energy of the Ace of Pentacles influence your start today?",
      "evening": "In what ways did you experience the Ace of Pentacles today?"
    },
    "element": "Earth",
    "themeColor": "#228B22",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 65,
    "name": "Two of Pentacles",
    "suit": "Pentacles",
    "rank": "Two",
    "symbol": "Two",
    "keywords": [
      "Pentacles",
      "Two",
      "Earth"
    ],
    "image": "/tarot-assets/pentacles_02.png",
    "meaning": {
      "upright": "The Two of Pentacles signifies the essence of Earth in the realm of Two.",
      "reversed": "Reversed, the Two of Pentacles suggests a blockage or internal focus on Earth energy."
    },
    "reflection": {
      "morning": "How does the energy of the Two of Pentacles influence your start today?",
      "evening": "In what ways did you experience the Two of Pentacles today?"
    },
    "element": "Earth",
    "themeColor": "#228B22",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 66,
    "name": "Three of Pentacles",
    "suit": "Pentacles",
    "rank": "Three",
    "symbol": "Three",
    "keywords": [
      "Pentacles",
      "Three",
      "Earth"
    ],
    "image": "/tarot-assets/pentacles_03.png",
    "meaning": {
      "upright": "The Three of Pentacles signifies the essence of Earth in the realm of Three.",
      "reversed": "Reversed, the Three of Pentacles suggests a blockage or internal focus on Earth energy."
    },
    "reflection": {
      "morning": "How does the energy of the Three of Pentacles influence your start today?",
      "evening": "In what ways did you experience the Three of Pentacles today?"
    },
    "element": "Earth",
    "themeColor": "#228B22",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 67,
    "name": "Four of Pentacles",
    "suit": "Pentacles",
    "rank": "Four",
    "symbol": "Four",
    "keywords": [
      "Pentacles",
      "Four",
      "Earth"
    ],
    "image": "/tarot-assets/pentacles_04.png",
    "meaning": {
      "upright": "The Four of Pentacles signifies the essence of Earth in the realm of Four.",
      "reversed": "Reversed, the Four of Pentacles suggests a blockage or internal focus on Earth energy."
    },
    "reflection": {
      "morning": "How does the energy of the Four of Pentacles influence your start today?",
      "evening": "In what ways did you experience the Four of Pentacles today?"
    },
    "element": "Earth",
    "themeColor": "#228B22",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 68,
    "name": "Five of Pentacles",
    "suit": "Pentacles",
    "rank": "Five",
    "symbol": "Five",
    "keywords": [
      "Pentacles",
      "Five",
      "Earth"
    ],
    "image": "/tarot-assets/pentacles_05.png",
    "meaning": {
      "upright": "The Five of Pentacles signifies the essence of Earth in the realm of Five.",
      "reversed": "Reversed, the Five of Pentacles suggests a blockage or internal focus on Earth energy."
    },
    "reflection": {
      "morning": "How does the energy of the Five of Pentacles influence your start today?",
      "evening": "In what ways did you experience the Five of Pentacles today?"
    },
    "element": "Earth",
    "themeColor": "#228B22",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 69,
    "name": "Six of Pentacles",
    "suit": "Pentacles",
    "rank": "Six",
    "symbol": "Six",
    "keywords": [
      "Pentacles",
      "Six",
      "Earth"
    ],
    "image": "/tarot-assets/pentacles_06.png",
    "meaning": {
      "upright": "The Six of Pentacles signifies the essence of Earth in the realm of Six.",
      "reversed": "Reversed, the Six of Pentacles suggests a blockage or internal focus on Earth energy."
    },
    "reflection": {
      "morning": "How does the energy of the Six of Pentacles influence your start today?",
      "evening": "In what ways did you experience the Six of Pentacles today?"
    },
    "element": "Earth",
    "themeColor": "#228B22",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 70,
    "name": "Seven of Pentacles",
    "suit": "Pentacles",
    "rank": "Seven",
    "symbol": "Seven",
    "keywords": [
      "Pentacles",
      "Seven",
      "Earth"
    ],
    "image": "/tarot-assets/pentacles_07.png",
    "meaning": {
      "upright": "The Seven of Pentacles signifies the essence of Earth in the realm of Seven.",
      "reversed": "Reversed, the Seven of Pentacles suggests a blockage or internal focus on Earth energy."
    },
    "reflection": {
      "morning": "How does the energy of the Seven of Pentacles influence your start today?",
      "evening": "In what ways did you experience the Seven of Pentacles today?"
    },
    "element": "Earth",
    "themeColor": "#228B22",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 71,
    "name": "Eight of Pentacles",
    "suit": "Pentacles",
    "rank": "Eight",
    "symbol": "Eight",
    "keywords": [
      "Pentacles",
      "Eight",
      "Earth"
    ],
    "image": "/tarot-assets/pentacles_08.png",
    "meaning": {
      "upright": "The Eight of Pentacles signifies the essence of Earth in the realm of Eight.",
      "reversed": "Reversed, the Eight of Pentacles suggests a blockage or internal focus on Earth energy."
    },
    "reflection": {
      "morning": "How does the energy of the Eight of Pentacles influence your start today?",
      "evening": "In what ways did you experience the Eight of Pentacles today?"
    },
    "element": "Earth",
    "themeColor": "#228B22",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 72,
    "name": "Nine of Pentacles",
    "suit": "Pentacles",
    "rank": "Nine",
    "symbol": "Nine",
    "keywords": [
      "Pentacles",
      "Nine",
      "Earth"
    ],
    "image": "/tarot-assets/pentacles_09.png",
    "meaning": {
      "upright": "The Nine of Pentacles signifies the essence of Earth in the realm of Nine.",
      "reversed": "Reversed, the Nine of Pentacles suggests a blockage or internal focus on Earth energy."
    },
    "reflection": {
      "morning": "How does the energy of the Nine of Pentacles influence your start today?",
      "evening": "In what ways did you experience the Nine of Pentacles today?"
    },
    "element": "Earth",
    "themeColor": "#228B22",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 73,
    "name": "Ten of Pentacles",
    "suit": "Pentacles",
    "rank": "Ten",
    "symbol": "Ten",
    "keywords": [
      "Pentacles",
      "Ten",
      "Earth"
    ],
    "image": "/tarot-assets/pentacles_10.png",
    "meaning": {
      "upright": "The Ten of Pentacles signifies the essence of Earth in the realm of Ten.",
      "reversed": "Reversed, the Ten of Pentacles suggests a blockage or internal focus on Earth energy."
    },
    "reflection": {
      "morning": "How does the energy of the Ten of Pentacles influence your start today?",
      "evening": "In what ways did you experience the Ten of Pentacles today?"
    },
    "element": "Earth",
    "themeColor": "#228B22",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 74,
    "name": "Page of Pentacles",
    "suit": "Pentacles",
    "rank": "Page",
    "symbol": "Page",
    "keywords": [
      "Pentacles",
      "Page",
      "Earth"
    ],
    "image": "/tarot-assets/pentacles_11.png",
    "meaning": {
      "upright": "The Page of Pentacles signifies the essence of Earth in the realm of Page.",
      "reversed": "Reversed, the Page of Pentacles suggests a blockage or internal focus on Earth energy."
    },
    "reflection": {
      "morning": "How does the energy of the Page of Pentacles influence your start today?",
      "evening": "In what ways did you experience the Page of Pentacles today?"
    },
    "element": "Earth",
    "themeColor": "#228B22",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 75,
    "name": "Knight of Pentacles",
    "suit": "Pentacles",
    "rank": "Knight",
    "symbol": "Knight",
    "keywords": [
      "Pentacles",
      "Knight",
      "Earth"
    ],
    "image": "/tarot-assets/pentacles_12.png",
    "meaning": {
      "upright": "The Knight of Pentacles signifies the essence of Earth in the realm of Knight.",
      "reversed": "Reversed, the Knight of Pentacles suggests a blockage or internal focus on Earth energy."
    },
    "reflection": {
      "morning": "How does the energy of the Knight of Pentacles influence your start today?",
      "evening": "In what ways did you experience the Knight of Pentacles today?"
    },
    "element": "Earth",
    "themeColor": "#228B22",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 76,
    "name": "Queen of Pentacles",
    "suit": "Pentacles",
    "rank": "Queen",
    "symbol": "Queen",
    "keywords": [
      "Pentacles",
      "Queen",
      "Earth"
    ],
    "image": "/tarot-assets/pentacles_13.png",
    "meaning": {
      "upright": "The Queen of Pentacles signifies the essence of Earth in the realm of Queen.",
      "reversed": "Reversed, the Queen of Pentacles suggests a blockage or internal focus on Earth energy."
    },
    "reflection": {
      "morning": "How does the energy of the Queen of Pentacles influence your start today?",
      "evening": "In what ways did you experience the Queen of Pentacles today?"
    },
    "element": "Earth",
    "themeColor": "#228B22",
    "videoFile": "placeholder.mp4"
  },
  {
    "id": 77,
    "name": "King of Pentacles",
    "suit": "Pentacles",
    "rank": "King",
    "symbol": "King",
    "keywords": [
      "Pentacles",
      "King",
      "Earth"
    ],
    "image": "/tarot-assets/pentacles_14.png",
    "meaning": {
      "upright": "The King of Pentacles signifies the essence of Earth in the realm of King.",
      "reversed": "Reversed, the King of Pentacles suggests a blockage or internal focus on Earth energy."
    },
    "reflection": {
      "morning": "How does the energy of the King of Pentacles influence your start today?",
      "evening": "In what ways did you experience the King of Pentacles today?"
    },
    "element": "Earth",
    "themeColor": "#228B22",
    "videoFile": "placeholder.mp4"
  }
];

export const ALL_CARDS: TarotCard[] = [...MAJOR_ARCANA, ...MINOR_ARCANA];
