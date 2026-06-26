import { Solar } from 'lunar-javascript';
import { calculateMeishiki, tenkanMap, zokanMap, type GogyoScore } from './meishiki';
import { calculateRPGStats, type StatKey } from './rpgEngine';

export const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

const PARAM_DETAILS: Record<string, { name: string, reason: string }> = {
  'HP': { name: '比劫', reason: 'ご自身のキャパシティを超えた過労や、他者との自我の衝突' },
  'ATK': { name: '食傷', reason: '感情の爆発や衝動的な行動による失敗、あるいは空回り' },
  'DEX': { name: '財星', reason: 'お金の損失や、ご自身のコントロールが及ばない事態' },
  'DEF': { name: '官殺', reason: '外部からの強い圧力、重すぎる責任やメンタルへの負荷' },
  'MP': { name: '印星', reason: '考えすぎて動けなくなる停滞、あるいは目上の人との関係の悩み' }
};

export const extractTraumaYear = (input: string, birthYear: number): number => {
  const toHalfWidth = (str: string) => str.replace(/[！-～]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)).replace(/　/g, ' ');
  const normalizedInput = toHalfWidth(input);

  const yearMatch = normalizedInput.match(/(19\d{2}|20\d{2})年?/);
  if (yearMatch) {
    return parseInt(yearMatch[1], 10);
  }

  const ageMatch = normalizedInput.match(/(\d{1,3})[歳才]/);
  if (ageMatch) {
    const age = parseInt(ageMatch[1], 10);
    return birthYear + age;
  }

  return new Date().getFullYear() - 10;
};

export const getYearlyBuffScore = (year: number): Record<keyof GogyoScore, number> => {
  const solar = Solar.fromYmdHms(year, 7, 1, 12, 0, 0);
  const lunar = solar.getLunar();
  const yearKanchi = lunar.getYearInGanZhi();
  
  const BASE_POINT = 12.5; // meishiki.tsと同じウェイト
  const buffEffect: Record<keyof GogyoScore, number> = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  
  const kan = yearKanchi.charAt(0);
  const shi = yearKanchi.charAt(1);

  // 天干の追加
  const kanAttr = tenkanMap[kan];
  if (kanAttr) {
    buffEffect[kanAttr] += BASE_POINT;
  }

  // 地支（蔵干）の追加
  const zokan = zokanMap[shi];
  if (zokan) {
    (Object.keys(zokan) as Array<keyof GogyoScore>).forEach(attr => {
      buffEffect[attr] += BASE_POINT * (zokan[attr] as number);
    });
  }

  // 少数第1位で丸める
  (Object.keys(buffEffect) as Array<keyof GogyoScore>).forEach(key => {
    buffEffect[key] = Math.round(buffEffect[key] * 10) / 10;
  });

  return buffEffect;
};

export const inferTrueTimePillar = (
  birthYear: number, 
  birthMonth: number, 
  birthDay: number, 
  traumaYear: number,
  targetParameter: StatKey,
  input: string
): { time: string, explanation: string } => {
  
  const yearlyBuffScore = getYearlyBuffScore(traumaYear);

  let bestBranch = '子';
  let maxTargetStat = -1;

  for (const branch of BRANCHES) {
    const initialMeishiki = calculateMeishiki(birthYear, birthMonth, birthDay, branch);
    
    const buffedScore = {
      wood: initialMeishiki.gogyoScore.wood + yearlyBuffScore.wood,
      fire: initialMeishiki.gogyoScore.fire + yearlyBuffScore.fire,
      earth: initialMeishiki.gogyoScore.earth + yearlyBuffScore.earth,
      metal: initialMeishiki.gogyoScore.metal + yearlyBuffScore.metal,
      water: initialMeishiki.gogyoScore.water + yearlyBuffScore.water,
    };
    
    // トラウマ年のバフを加算してRPGステータスを算出
    const statsArray = calculateRPGStats(buffedScore, initialMeishiki.nikkanGogyo, []);
    
    // ターゲットパラメータ（DEFなど）の値を取得
    const targetStatObj = statsArray.find(s => s.key === targetParameter);
    const targetValue = targetStatObj ? targetStatObj.currentValue : 0;

    // 最もターゲットパラメータが極端（最大）になる時支を探す
    if (targetValue > maxTargetStat) {
      maxTargetStat = targetValue;
      bestBranch = branch;
    }
  }

  const detail = PARAM_DETAILS[targetParameter as string];
  const explanation = `入力いただいた「${input}」というお話から、当時の状況を分析しました。

この出来事には、【${detail?.reason || ''}】という要素が強く表れています。これは四柱推命のステータスにおいて『${targetParameter}（${detail?.name || ''}）』の属性が過剰に刺激されたことで起きた事象だと推論されます。

${traumaYear}年は地球全体に特定の五行エネルギーが強く降っていた年です（天候バフ）。AIによる12パターンの時柱総当たりシミュレーションの結果、この年に${targetParameter}のステータスが最も致命的な数値（${Math.round(maxTargetStat)}）に跳ね上がるのは、あなたの生まれ時間が『${bestBranch}の刻』だった場合のみです。

よって、過去の出来事のパラメータと四柱推命カレンダーエンジンの全探索逆算理論に基づき、生まれ時間は『${bestBranch}の刻』であると確定しました。`;

  return { time: bestBranch, explanation };
};
