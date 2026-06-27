import { pipeline, env, cos_sim, type PipelineType } from '@xenova/transformers';

// Hugging Face Hubから直接取得するよう、ローカルモデルを無効化
env.allowLocalModels = false;

// GitHub Pages環境でのWASMファイル404エラーを防ぐため、WASMバックエンドをCDNに向ける
env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.14.0/dist/';

class PipelineSingleton {
  static task: PipelineType = 'feature-extraction';
  static model = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
  static instance: any = null;

  static async getInstance(progress_callback: Function) {
    if (this.instance === null) {
      this.instance = await pipeline(this.task, this.model, { progress_callback });
    }
    return this.instance;
  }
}

// 5属性を判定するためのテキスト定義
const CATEGORIES = {
  HP: "過労、働きすぎ、自我の衝突、パートナーとの喧嘩、キャパオーバー、独立起業、自立、圧倒的なバイタリティでの達成、スポーツでの大活躍",
  ATK: "暴走、失言、炎上、衝動的な行動での失敗、空回り、自己表現の大爆発、クリエイティブな大ブレイク、作品のヒット、自由な環境への移行",
  DEX: "お金の損失、投資の失敗、支配力の低下、部下とのトラブル、大金の獲得、大きな商談の成立、事業の成功、結婚、良い出会い",
  DEF: "外からの圧力、パワハラ、重すぎる責任、法的なトラブル、メンタルの不調、大抜擢、昇進、就職、社会的な成功、責任ある立場の獲得",
  MP: "考えすぎ、行動できない停滞、引きこもり、目上の人とのトラブル、大きな学び、難関資格の取得、精神的な悟り、素晴らしい師匠・メンターとの出会い"
};

// プロフィール入力判定用のテキスト定義
const PROFILE_INTENTS = {
  DATE: "生年月日、誕生日、生まれた年、月、日の入力。1990年生まれ、5月15日です、などの回答。",
  TIME: "生まれた時間、時刻、何時何分、子平、刻の入力。14時頃、夕方、夜中、などの回答。",
  UNKNOWN: "わからない、不明、覚えていない、知らない、などの回答。",
  INFERENCE: "時間を推測してほしい、推時、AIに任せる、占ってほしい、などの回答。",
  GREETING: "こんにちは、よろしく、ありがとう、などの挨拶や、上記以外の無関係な発言。"
};

// キャッシュ用のベクトル
const categoryEmbeddings: Record<string, any> = {};
const profileIntentEmbeddings: Record<string, any> = {};

// エンティティ抽出用のヘルパー関数
const extractEntities = (text: string) => {
  const toHalfWidth = (str: string) => str.replace(/[！-～]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)).replace(/　/g, ' ');
  let normalizedText = toHalfWidth(text);
  
  // 午前・午後の表記を24時間制に変換
  normalizedText = normalizedText.replace(/午後(\d{1,2})時/g, (_, p1) => {
    let h = parseInt(p1, 10);
    if (h < 12) h += 12;
    return h + '時';
  });
  normalizedText = normalizedText.replace(/午前(\d{1,2})時/g, (_, p1) => {
    let h = parseInt(p1, 10);
    if (h === 12) h = 0;
    return h + '時';
  });
  
  const entities: { year?: number, month?: number, day?: number, time?: string } = {};
  
  const dateMatch = normalizedText.match(/(19|20)\d{2}[年/.-]?\s*\d{1,2}[月/.-]?\s*\d{1,2}日?/);
  if (dateMatch) {
    const nums = dateMatch[0].match(/\d+/g);
    if (nums && nums.length >= 3) {
      entities.year = parseInt(nums[0], 10);
      entities.month = parseInt(nums[1], 10);
      entities.day = parseInt(nums[2], 10);
    }
  }

  const timeRegex = /(\d{1,2})時|子|丑|寅|卯|辰|巳|午(?!前|後)|未|申|酉|戌|亥/;
  const timeMatch = normalizedText.match(timeRegex);
  if (timeMatch) {
    const matchText = timeMatch[0];
    if (matchText.includes('時')) {
      const hour = parseInt(matchText, 10);
      const zishiMap = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
      entities.time = zishiMap[Math.floor((hour + 1) % 24 / 2)];
    } else {
      entities.time = matchText;
    }
  }
  
  return entities;
};

self.addEventListener('message', async (event) => {
  const { type, text } = event.data;

  try {
    if (type === 'init') {
      const extractor = await PipelineSingleton.getInstance((x: any) => {
        // UIにプログレスイベントを送信
        self.postMessage({ type: 'progress', data: x });
      });

      // 推論速度を上げるため、カテゴリのテキストをあらかじめベクトル化しておく
      for (const [key, description] of Object.entries(CATEGORIES)) {
        const output = await extractor(description, { pooling: 'mean', normalize: true });
        categoryEmbeddings[key] = output.data;
      }

      // プロフィール意図用のテキストもベクトル化
      for (const [key, description] of Object.entries(PROFILE_INTENTS)) {
        const output = await extractor(description, { pooling: 'mean', normalize: true });
        profileIntentEmbeddings[key] = output.data;
      }

      self.postMessage({ type: 'ready' });
    }

    if (type === 'classify') {
      const extractor = await PipelineSingleton.getInstance(() => {});

      // ユーザー入力テキストのベクトル化
      const output = await extractor(text, { pooling: 'mean', normalize: true });
      const inputEmbedding = output.data;

      let bestMatch = '';
      let highestScore = -Infinity;

      // コサイン類似度で一番近い属性を探す
      for (const [key, embedding] of Object.entries(categoryEmbeddings)) {
        const score = cos_sim(inputEmbedding, embedding);
        if (score > highestScore) {
          highestScore = score;
          bestMatch = key;
        }
      }

      self.postMessage({ type: 'result', result: bestMatch, score: highestScore, inputText: text });
    }

    if (type === 'extract_profile') {
      const extractor = await PipelineSingleton.getInstance(() => {});
      const output = await extractor(text, { pooling: 'mean', normalize: true });
      const inputEmbedding = output.data;

      let bestIntent = '';
      let highestScore = -Infinity;

      for (const [key, embedding] of Object.entries(profileIntentEmbeddings)) {
        const score = cos_sim(inputEmbedding, embedding);
        if (score > highestScore) {
          highestScore = score;
          bestIntent = key;
        }
      }

      // 意図にかかわらず、セーフティネットとしてエンティティ抽出は走らせておく
      const extractedData = extractEntities(text);

      self.postMessage({ 
        type: 'profile_extracted', 
        intent: bestIntent, 
        score: highestScore, 
        data: extractedData,
        inputText: text 
      });
    }

  } catch (error: any) {
    self.postMessage({ type: 'error', error: error.message });
  }
});
