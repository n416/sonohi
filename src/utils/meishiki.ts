import { Solar, Lunar } from 'lunar-javascript';

// 五行のスコア用型
export type GogyoScore = {
  wood: number;
  fire: number;
  earth: number;
  metal: number;
  water: number;
};

export type Meishiki = {
  year: number;
  month: number;
  day: number;
  time: string;
  kanchi: {
    year: string;
    month: string;
    day: string;
    time: string;
  };
  gogyoScore: GogyoScore;
  nikkanGogyo: keyof GogyoScore;
  logs: string[];
};

// 天干の五行属性マップ
const tenkanMap: Record<string, keyof GogyoScore> = {
  '甲': 'wood', '乙': 'wood',
  '丙': 'fire', '丁': 'fire',
  '戊': 'earth', '己': 'earth',
  '庚': 'metal', '辛': 'metal',
  '壬': 'water', '癸': 'water'
};

// 地支の蔵干割合（パーセンテージ）マップ
// 余気・中気・本気を含めた各五行への影響度（合計1.0）
const zokanMap: Record<string, Partial<Record<keyof GogyoScore, number>>> = {
  '子': { water: 1.0 },
  '丑': { water: 0.3, metal: 0.2, earth: 0.5 },
  '寅': { earth: 0.3, fire: 0.3, wood: 0.4 },
  '卯': { wood: 1.0 },
  '辰': { wood: 0.3, water: 0.2, earth: 0.5 },
  '巳': { earth: 0.3, metal: 0.3, fire: 0.4 },
  '午': { fire: 0.7, earth: 0.3 },
  '未': { fire: 0.3, wood: 0.2, earth: 0.5 },
  '申': { earth: 0.3, water: 0.3, metal: 0.4 },
  '酉': { metal: 1.0 },
  '戌': { metal: 0.3, fire: 0.2, earth: 0.5 },
  '亥': { wood: 0.3, water: 0.7 }
};

// 時支から時刻への変換（おおよその開始時刻または中間時刻）
const jishiToHour: Record<string, number> = {
  '子': 0, // 23:00 - 0:59
  '丑': 2, // 1:00 - 2:59
  '寅': 4, // 3:00 - 4:59
  '卯': 6, // 5:00 - 6:59
  '辰': 8, // 7:00 - 8:59
  '巳': 10, // 9:00 - 10:59
  '午': 12, // 11:00 - 12:59
  '未': 14, // 13:00 - 14:59
  '申': 16, // 15:00 - 16:59
  '酉': 18, // 17:00 - 18:59
  '戌': 20, // 19:00 - 20:59
  '亥': 22  // 21:00 - 22:59
};

/**
 * 年月日と時間から命式と五行スコアを算出する
 */
export const calculateMeishiki = (year: number, month: number, day: number, time: string): Meishiki => {
  const isTimeUnknown = time === '不明';
  const hour = isTimeUnknown ? 12 : (jishiToHour[time] ?? 12);

  const solar = Solar.fromYmdHms(year, month, day, hour, 0, 0);
  const lunar = solar.getLunar();
  const baZi = lunar.getEightChar();

  // 年柱、月柱、日柱、時柱の取得
  const yearKanchi = baZi.getYear();
  const monthKanchi = baZi.getMonth();
  const dayKanchi = baZi.getDay();
  const timeKanchi = isTimeUnknown ? '不明' : baZi.getTime();

  // 日干の五行を取得
  const nikkan = dayKanchi.charAt(0);
  const nikkanGogyo = tenkanMap[nikkan] || 'wood'; // フォールバック

  // 1文字あたりのベースポイント（8文字で100点満点とするなら、1文字12.5点）
  const BASE_POINT = 12.5;

  const gogyoScore: GogyoScore = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };

  // 天干のスコア加算処理
  const addTenkanScore = (kanchi: string) => {
    if (!kanchi || kanchi === '不明') return;
    const kan = kanchi.charAt(0);
    const attr = tenkanMap[kan];
    if (attr) {
      gogyoScore[attr] += BASE_POINT;
    }
  };

  // 地支（蔵干）のスコア加算処理
  const addZokanScore = (kanchi: string) => {
    if (!kanchi || kanchi === '不明') return;
    const shi = kanchi.charAt(1);
    const zokan = zokanMap[shi];
    if (zokan) {
      (Object.keys(zokan) as Array<keyof GogyoScore>).forEach(attr => {
        gogyoScore[attr] += BASE_POINT * (zokan[attr] as number);
      });
    }
  };

  // 各柱の計算
  [yearKanchi, monthKanchi, dayKanchi, timeKanchi].forEach(kanchi => {
    addTenkanScore(kanchi);
    addZokanScore(kanchi);
  });

  // 少数第1位で丸める処理
  (Object.keys(gogyoScore) as Array<keyof GogyoScore>).forEach(key => {
    gogyoScore[key] = Math.round(gogyoScore[key] * 10) / 10;
  });

  const logs = [
    `lunar-javascriptを用いて命式を算出しました。`,
    `年月日: ${year}年${month}月${day}日 ${isTimeUnknown ? '(時間不明)' : time + 'の刻'}`,
    `抽出干支: ${yearKanchi} / ${monthKanchi} / ${dayKanchi} / ${timeKanchi}`,
    `日干: ${nikkan} (${nikkanGogyo})`,
    isTimeUnknown ? `※時間が不明なため、時柱分のスコア（25点）は加算されていません。` : `※蔵干を考慮した五行スコアを算出完了。`
  ];

  return {
    year,
    month,
    day,
    time,
    kanchi: {
      year: yearKanchi,
      month: monthKanchi,
      day: dayKanchi,
      time: timeKanchi
    },
    gogyoScore,
    nikkanGogyo,
    logs
  };
};
