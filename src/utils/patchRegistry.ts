import type { Meishiki } from './meishiki';

export type Patch = {
  id: string;
  name: string;
  description: string;
  apply: (m: Meishiki) => Meishiki;
};

export const PATCH_REGISTRY: Record<string, Patch> = {
  "PATCH_KANGOU": {
    id: "PATCH_KANGOU",
    name: "干合パッチ (木・火エネルギー増幅)",
    description: "特定の干が並んだと仮定し、五行の木と火のスコアを増加させます。",
    apply: (m) => ({
      ...m,
      gogyoScore: {
        ...m.gogyoScore,
        wood: m.gogyoScore.wood + 15,
        fire: m.gogyoScore.fire + 10,
        metal: Math.max(0, m.gogyoScore.metal - 10)
      },
      logs: [...m.logs, "[パッチ適用] 干合パッチ: 木(+15) 火(+10) 金(-10) に補正しました。"]
    })
  },
  "PATCH_KUBOU": {
    id: "PATCH_KUBOU",
    name: "空亡パッチ (全体スコア減点)",
    description: "空亡（天中殺）条件に該当したと仮定し、全体のエネルギーを減衰させます。",
    apply: (m) => ({
      ...m,
      gogyoScore: {
        wood: Math.max(0, m.gogyoScore.wood - 5),
        fire: Math.max(0, m.gogyoScore.fire - 5),
        earth: Math.max(0, m.gogyoScore.earth - 5),
        metal: Math.max(0, m.gogyoScore.metal - 5),
        water: Math.max(0, m.gogyoScore.water - 5)
      },
      logs: [...m.logs, "[パッチ適用] 空亡パッチ: 全五行スコアを(-5)減点しました。"]
    })
  },
  "PATCH_SANGOU": {
    id: "PATCH_SANGOU",
    name: "三合会局パッチ (属性特化バフ)",
    description: "十二支が3つ揃ったと仮定し、最も高い五行スコアを極大化（+30）させます。",
    apply: (m) => {
      const maxKey = Object.keys(m.gogyoScore).reduce((a, b) => m.gogyoScore[a as keyof typeof m.gogyoScore] > m.gogyoScore[b as keyof typeof m.gogyoScore] ? a : b) as keyof typeof m.gogyoScore;
      const newScore = { ...m.gogyoScore };
      newScore[maxKey] += 30;
      Object.keys(newScore).forEach(k => {
        if (k !== maxKey) newScore[k as keyof typeof m.gogyoScore] = Math.max(0, newScore[k as keyof typeof m.gogyoScore] - 5);
      });
      return {
        ...m,
        gogyoScore: newScore,
        logs: [...m.logs, `[パッチ適用] 三合会局: ${maxKey}属性を極大化(+30)し、他を減衰(-5)させました。`]
      };
    }
  },
  "PATCH_GETSUREI": {
    id: "PATCH_GETSUREI",
    name: "月令重視パッチ (ベース倍率アップ)",
    description: "生まれた月の影響を最大化します。現在最も高い五行スコアを1.5倍にします。",
    apply: (m) => {
      const maxKey = Object.keys(m.gogyoScore).reduce((a, b) => m.gogyoScore[a as keyof typeof m.gogyoScore] > m.gogyoScore[b as keyof typeof m.gogyoScore] ? a : b) as keyof typeof m.gogyoScore;
      const newScore = { ...m.gogyoScore };
      newScore[maxKey] = Math.floor(newScore[maxKey] * 1.5);
      return {
        ...m,
        gogyoScore: newScore,
        logs: [...m.logs, `[パッチ適用] 月令重視: ${maxKey}属性のスコアを1.5倍に強化しました。`]
      };
    }
  },
  "PATCH_SETSUIRI": {
    id: "PATCH_SETSUIRI",
    name: "節入り丸めパッチ",
    description: "節入りの時間を厳密に見ず、日で切り捨てて計算する。（全体ステータスを少し平準化）",
    apply: (m) => {
      const newScore = { ...m.gogyoScore };
      const maxKey = Object.keys(newScore).reduce((a, b) => newScore[a as keyof typeof m.gogyoScore] > newScore[b as keyof typeof m.gogyoScore] ? a : b) as keyof typeof m.gogyoScore;
      const minKey = Object.keys(newScore).reduce((a, b) => newScore[a as keyof typeof m.gogyoScore] < newScore[b as keyof typeof m.gogyoScore] ? a : b) as keyof typeof m.gogyoScore;
      const diff = Math.floor(newScore[maxKey] * 0.1);
      newScore[maxKey] = Math.max(0, newScore[maxKey] - diff);
      newScore[minKey] += diff;
      return {
        ...m,
        gogyoScore: newScore,
        logs: [...m.logs, `[パッチ適用] 節入り丸めパッチ: ${maxKey}属性から${minKey}属性へ ${diff} ポイント平準化しました。`]
      };
    }
  },
  "PATCH_ZOUKAN_BASE": {
    id: "PATCH_ZOUKAN_BASE",
    name: "蔵干表変更パッチ",
    description: "別の流派の月律分野表を採用したと仮定し、属性を特定の五行（土）にシフトさせます。",
    apply: (m) => {
      const newScore = { ...m.gogyoScore };
      newScore.earth += 10;
      return {
        ...m,
        gogyoScore: newScore,
        logs: [...m.logs, `[パッチ適用] 蔵干表変更パッチ: 月律分野表の変更により、土属性に(+10)シフトしました。`]
      };
    }
  },
  "PATCH_ZOUKAN_HONKI": {
    id: "PATCH_ZOUKAN_HONKI",
    name: "蔵干本気パッチ",
    description: "雑気（余気・中気）を捨て、本気のみで計算する。一番低い微弱な五行を0にし、その分を一番高い五行に加算して純化します。",
    apply: (m) => {
      const newScore = { ...m.gogyoScore };
      const minKey = Object.keys(newScore).reduce((a, b) => newScore[a as keyof typeof m.gogyoScore] < newScore[b as keyof typeof m.gogyoScore] ? a : b) as keyof typeof m.gogyoScore;
      const maxKey = Object.keys(newScore).reduce((a, b) => newScore[a as keyof typeof m.gogyoScore] > newScore[b as keyof typeof m.gogyoScore] ? a : b) as keyof typeof m.gogyoScore;

      const transferVal = newScore[minKey];
      newScore[minKey] = 0;
      newScore[maxKey] += transferVal;

      return {
        ...m,
        gogyoScore: newScore,
        logs: [...m.logs, `[パッチ適用] 蔵干本気パッチ: 最も低い${minKey}属性(${transferVal})を切り捨て、${maxKey}属性に加算して純化しました。`]
      };
    }
  },
  "PATCH_RITSUUN": {
    id: "PATCH_RITSUUN",
    name: "立運繰り上げパッチ",
    description: "大運の計算で余りを切り捨てず繰り上げます。（運命の巡りが早まると解釈し全体スコアに微小加算）",
    apply: (m) => {
      return {
        ...m,
        gogyoScore: {
          wood: m.gogyoScore.wood + 2,
          fire: m.gogyoScore.fire + 2,
          earth: m.gogyoScore.earth + 2,
          metal: m.gogyoScore.metal + 2,
          water: m.gogyoScore.water + 2
        },
        logs: [...m.logs, `[パッチ適用] 立運繰り上げパッチ: 運命の巡りが早まり、全属性に(+2)加算しました。`]
      };
    }
  },
  "PATCH_TSUKON": {
    id: "PATCH_TSUKON",
    name: "通根強化パッチ",
    description: "天干の星が地支に根を張る力を強く評価します。上位2つの属性にそれぞれ+10のボーナスを与えます。",
    apply: (m) => {
      const newScore = { ...m.gogyoScore };
      const sortedKeys = Object.keys(newScore).sort((a, b) => newScore[b as keyof typeof m.gogyoScore] - newScore[a as keyof typeof m.gogyoScore]) as (keyof typeof m.gogyoScore)[];
      newScore[sortedKeys[0]] += 10;
      newScore[sortedKeys[1]] += 10;
      return {
        ...m,
        gogyoScore: newScore,
        logs: [...m.logs, `[パッチ適用] 通根強化パッチ: 上位属性(${sortedKeys[0]}, ${sortedKeys[1]})にそれぞれ+10のボーナスを与えました。`]
      };
    }
  },
  "PATCH_KANGOU_STRICT": {
    id: "PATCH_KANGOU_STRICT",
    name: "干合厳密化パッチ",
    description: "干合の条件を厳しくし、月令を得ていないと化気しないとします。（干合パッチの効力を半減・相殺）",
    apply: (m) => {
      const newScore = { ...m.gogyoScore };
      newScore.wood = Math.max(0, newScore.wood - 7);
      newScore.fire = Math.max(0, newScore.fire - 5);
      newScore.metal = newScore.metal + 5;
      return {
        ...m,
        gogyoScore: newScore,
        logs: [...m.logs, `[パッチ適用] 干合厳密化パッチ: 条件厳密化により干合の効力を半減（木-7, 火-5, 金+5）させました。`]
      };
    }
  },
  "PATCH_HANKAI": {
    id: "PATCH_HANKAI",
    name: "半会パッチ",
    description: "三合のうち2つだけでも効果を発揮すると仮定し、2番目に高い属性スコアを強化（+15）します。",
    apply: (m) => {
      const newScore = { ...m.gogyoScore };
      const sortedKeys = Object.keys(newScore).sort((a, b) => newScore[b as keyof typeof m.gogyoScore] - newScore[a as keyof typeof m.gogyoScore]) as (keyof typeof m.gogyoScore)[];
      const targetKey = sortedKeys[1];
      newScore[targetKey] += 15;
      return {
        ...m,
        gogyoScore: newScore,
        logs: [...m.logs, `[パッチ適用] 半会パッチ: 2番目に高い${targetKey}属性を強化(+15)しました。`]
      };
    }
  },
  "PATCH_HOUGOU": {
    id: "PATCH_HOUGOU",
    name: "方合パッチ",
    description: "季節が揃う方合を、三合より強い最強バフとします。最も高い属性を極限まで高め、残りを0にします。",
    apply: (m) => {
      const newScore = { ...m.gogyoScore };
      const maxKey = Object.keys(newScore).reduce((a, b) => newScore[a as keyof typeof m.gogyoScore] > newScore[b as keyof typeof m.gogyoScore] ? a : b) as keyof typeof m.gogyoScore;
      Object.keys(newScore).forEach(k => {
        if (k !== maxKey) {
          newScore[k as keyof typeof m.gogyoScore] = 0;
        }
      });
      newScore[maxKey] += 50;
      return {
        ...m,
        gogyoScore: newScore,
        logs: [...m.logs, `[パッチ適用] 方合パッチ: 究極の属性特化。${maxKey}属性を+50し、他を全て0にしました。`]
      };
    }
  },
  "PATCH_SHIGOU": {
    id: "PATCH_SHIGOU",
    name: "支合パッチ",
    description: "十二支の結びつきによるステータスアップ。一番低い属性数値を底上げ（+10）します。",
    apply: (m) => {
      const newScore = { ...m.gogyoScore };
      const minKey = Object.keys(newScore).reduce((a, b) => newScore[a as keyof typeof m.gogyoScore] < newScore[b as keyof typeof m.gogyoScore] ? a : b) as keyof typeof m.gogyoScore;
      newScore[minKey] += 10;
      return {
        ...m,
        gogyoScore: newScore,
        logs: [...m.logs, `[パッチ適用] 支合パッチ: 一番低い${minKey}属性を底上げ(+10)しました。`]
      };
    }
  },
  "PATCH_CHU_GOU": {
    id: "PATCH_CHU_GOU",
    name: "貪合忘冲パッチ",
    description: "冲（反発）より合（結びつき）を優先し、マイナス効果を打ち消します。全体スコアを平均に近づけます。",
    apply: (m) => {
      const newScore = { ...m.gogyoScore };
      const values = Object.values(newScore);
      const total = values.reduce((sum, v) => sum + v, 0);
      const avg = Math.floor(total / 5);
      Object.keys(newScore).forEach(k => {
        const current = newScore[k as keyof typeof m.gogyoScore];
        const diff = avg - current;
        newScore[k as keyof typeof m.gogyoScore] = current + Math.floor(diff / 2);
      });
      return {
        ...m,
        gogyoScore: newScore,
        logs: [...m.logs, `[パッチ適用] 貪合忘冲パッチ: 争いを避け、全属性のスコアを平均に近づけました。`]
      };
    }
  },
  "PATCH_TENSEN": {
    id: "PATCH_TENSEN",
    name: "天戦地冲パッチ (属性反転)",
    description: "天と地が相剋する大波乱状態。全属性のスコアが平均値から反転します。",
    apply: (m) => {
      const newScore = { ...m.gogyoScore };
      const values = Object.values(newScore);
      const total = values.reduce((sum, v) => sum + v, 0);
      const avg = total / 5;
      Object.keys(newScore).forEach(k => {
        const diff = newScore[k as keyof typeof m.gogyoScore] - avg;
        newScore[k as keyof typeof m.gogyoScore] = Math.max(0, Math.floor(avg - diff));
      });
      return {
        ...m,
        gogyoScore: newScore,
        logs: [...m.logs, `[パッチ適用] 天戦地冲: 全属性のスコアを反転（シャッフル）させました。`]
      };
    }
  },
  "PATCH_GOKAN_KUBOU": {
    id: "PATCH_GOKAN_KUBOU",
    name: "互換空亡パッチ",
    description: "年柱からの空亡も採用する、より厳しいデバフ。空亡による減点を倍増（-10）させます。",
    apply: (m) => {
      return {
        ...m,
        gogyoScore: {
          wood: Math.max(0, m.gogyoScore.wood - 10),
          fire: Math.max(0, m.gogyoScore.fire - 10),
          earth: Math.max(0, m.gogyoScore.earth - 10),
          metal: Math.max(0, m.gogyoScore.metal - 10),
          water: Math.max(0, m.gogyoScore.water - 10)
        },
        logs: [...m.logs, "[パッチ適用] 互換空亡パッチ: 厳しいデバフにより、全五行スコアを(-10)減点しました。"]
      };
    }
  },
  "PATCH_SHINSATSU": {
    id: "PATCH_SHINSATSU",
    name: "神殺パッチ",
    description: "羊刃や魁罡などの特殊星を採用します。特定の属性が激しく上下し、攻撃的でピーキーなステータスになります。",
    apply: (m) => {
      const newScore = { ...m.gogyoScore };
      newScore.metal += 30;
      newScore.wood = Math.max(0, newScore.wood - 20);
      newScore.water = Math.max(0, newScore.water - 10);
      return {
        ...m,
        gogyoScore: newScore,
        logs: [...m.logs, `[パッチ適用] 神殺パッチ: 特殊星の影響で金属性が暴走(+30)、木(-20)と水(-10)が大きく削られました。`]
      };
    }
  },
  "PATCH_YASHIJI": {
    id: "PATCH_YASHIJI",
    name: "夜子時パッチ (翌日扱い)",
    description: "23時以降を翌日として計算する流派のルール。※オンにすると生年月日がリセットされます。",
    apply: (m) => {
      return {
        ...m,
        logs: [...m.logs, `[パッチ適用] 夜子時採用: 計算ロジックに夜子時ルールを適用しています。`]
      };
    }
  }
};

export const getAllPatchIds = () => Object.keys(PATCH_REGISTRY);
