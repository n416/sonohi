import { pipeline, env, cos_sim, type PipelineType } from '@xenova/transformers';

// Hugging Face Hubから直接取得するようにローカルモデルを無効化
env.allowLocalModels = false;

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
  HP: "過労、働きすぎ、自我の衝突、パートナーとの喧嘩、キャパオーバー",
  ATK: "暴走、失言、炎上、衝動的な行動での失敗、空回り",
  DEX: "お金の損失、投資の失敗、支配力の低下、部下とのトラブル",
  DEF: "外からの圧力、パワハラ、重すぎる責任、法的なトラブル、メンタルの不調",
  MP: "考えすぎ、行動できない停滞、引きこもり、目上の人とのトラブル"
};

// キャッシュ用のベクトル
const categoryEmbeddings: Record<string, any> = {};

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
  } catch (error: any) {
    self.postMessage({ type: 'error', error: error.message });
  }
});
