import { Solar } from 'lunar-javascript';
import { calculateMeishiki } from './meishiki';
import { calculateRPGStats } from './rpgEngine';
import { getYearlyBuffScore, BRANCHES } from './suijiEngine';
import { getAllPatchIds, PATCH_REGISTRY } from './patchRegistry';

export type CalibrationYears = {
  atkYear: number;
  defYear: number;
  hpYear: number;
  chuYear: number;
};

export type CalibrationCache = {
  meishikiNormal: any;
  meishikiYashiji: any;
  yearlyData: Array<{
    year: number;
    buffScore: { wood: number, fire: number, earth: number, metal: number, water: number };
    yearBranch: string;
  }>;
};

// 支のインデックス取得
const getBranchIndex = (branch: string) => BRANCHES.indexOf(branch);

// 冲の判定
const isChu = (b1: string, b2: string) => {
  if (b1 === '不明' || b2 === '不明' || !b1 || !b2) return false;
  const idx1 = getBranchIndex(b1);
  const idx2 = getBranchIndex(b2);
  return Math.abs(idx1 - idx2) === 6;
};

export const createCalibrationCache = (birthYear: number, birthMonth: number, birthDay: number, time: string): CalibrationCache => {
  const meishikiNormal = calculateMeishiki(birthYear, birthMonth, birthDay, time);
  
  const d = new Date(birthYear, birthMonth - 1, birthDay);
  d.setDate(d.getDate() + 1);
  const meishikiYashiji = calculateMeishiki(birthYear, birthMonth, d.getDate(), time);
  
  const currentYear = new Date().getFullYear();
  const startYear = birthYear + 10;
  
  const yearlyData = [];
  for (let y = startYear; y <= currentYear; y++) {
    const buffScore = getYearlyBuffScore(y);
    const solar = Solar.fromYmdHms(y, 7, 1, 12, 0, 0);
    const yearBranch = solar.getLunar().getYearInGanZhi().charAt(1);
    yearlyData.push({ year: y, buffScore, yearBranch });
  }
  
  return { meishikiNormal, meishikiYashiji, yearlyData };
};

/**
 * 現在のパッチ状態のもとで、各パラメータが極端になる年を算出する（キャッシュ利用）
 */
export const calculateCalibrationYears = (
  time: string,
  activePatches: string[],
  cache: CalibrationCache
): CalibrationYears => {
  
  const baseMeishiki = (activePatches.includes('PATCH_YASHIJI') && time === '子') 
    ? cache.meishikiYashiji 
    : cache.meishikiNormal;
    
  let meishiki = baseMeishiki;
  activePatches.forEach(patchId => {
    const patch = PATCH_REGISTRY[patchId];
    if (patch && patch.apply) {
      meishiki = patch.apply(meishiki);
    }
  });
  
  let maxAtk = -Infinity;
  let maxDef = -Infinity;
  let minHp = Infinity;
  
  const currentYear = new Date().getFullYear();
  let atkYear = currentYear - 1;
  let defYear = currentYear - 2;
  let hpYear = currentYear - 3;
  let chuYear = currentYear - 4;

  let latestChuYear = -1;

  for (const data of cache.yearlyData) {
    const { year: y, buffScore: yearlyBuff, yearBranch } = data;
    
    // パッチによる補正
    const buffMultiplier = activePatches.includes('PATCH_KUBOU') ? 0.5 : 1.0;
    
    const buffedScore = {
      wood: meishiki.gogyoScore.wood + (yearlyBuff.wood * buffMultiplier),
      fire: meishiki.gogyoScore.fire + (yearlyBuff.fire * buffMultiplier),
      earth: meishiki.gogyoScore.earth + (yearlyBuff.earth * buffMultiplier),
      metal: meishiki.gogyoScore.metal + (yearlyBuff.metal * buffMultiplier),
      water: meishiki.gogyoScore.water + (yearlyBuff.water * buffMultiplier),
    };

    // 貪合忘冲パッチがない場合のみ冲をチェック
    if (!activePatches.includes('PATCH_CHU_GOU')) {
      const hasChu = isChu(yearBranch, meishiki.kanchi.year.charAt(1)) ||
                     isChu(yearBranch, meishiki.kanchi.month.charAt(1)) ||
                     isChu(yearBranch, meishiki.kanchi.day.charAt(1)) ||
                     (time !== '不明' && isChu(yearBranch, meishiki.kanchi.time.charAt(1)));
      
      if (hasChu) {
        latestChuYear = y;
      }
    }

    const stats = calculateRPGStats(buffedScore, meishiki.nikkanGogyo, []);
    
    const atk = stats.find(s => s.key === 'ATK')?.currentValue || 0;
    const def = stats.find(s => s.key === 'DEF')?.currentValue || 0;
    const hp = stats.find(s => s.key === 'HP')?.currentValue || 0;

    if (atk > maxAtk) {
      maxAtk = atk;
      atkYear = y;
    }
    if (def > maxDef) {
      maxDef = def;
      defYear = y;
    }
    if (hp < minHp) {
      minHp = hp;
      hpYear = y;
    }
  }

  if (latestChuYear !== -1) {
    chuYear = latestChuYear;
  } else if (activePatches.includes('PATCH_CHU_GOU')) {
    chuYear = 0; // 冲が発生しない（回避された）
  }

  return { atkYear, defYear, hpYear, chuYear };
};

/**
 * 指定されたパッチ構成と年における、特定ステータスの絶対値（振幅）を計算する。
 * YESの場合はこの数値を高めるパッチを、NOの場合はこの数値を下げるパッチを評価する。
 */
export const calculateStatValueForYear = (
  time: string,
  activePatches: string[],
  cache: CalibrationCache,
  statKey: string,
  targetYear: number
): number => {
  const baseMeishiki = (activePatches.includes('PATCH_YASHIJI') && time === '子') 
    ? cache.meishikiYashiji 
    : cache.meishikiNormal;
    
  let meishiki = baseMeishiki;
  activePatches.forEach(patchId => {
    const patch = PATCH_REGISTRY[patchId];
    if (patch && patch.apply) {
      meishiki = patch.apply(meishiki);
    }
  });

  const yd = cache.yearlyData.find(y => y.year === targetYear);
  if (!yd) return 0;

  if (statKey === 'CHU') {
    if (activePatches.includes('PATCH_CHU_GOU')) return 0;
    const hasChu = isChu(yd.yearBranch, meishiki.kanchi.year.charAt(1)) ||
                   isChu(yd.yearBranch, meishiki.kanchi.month.charAt(1)) ||
                   isChu(yd.yearBranch, meishiki.kanchi.day.charAt(1)) ||
                   (time !== '不明' && isChu(yd.yearBranch, meishiki.kanchi.time.charAt(1)));
    return hasChu ? 100 : 0;
  }

  const buffMultiplier = activePatches.includes('PATCH_KUBOU') ? 0.5 : 1.0;

  const buffedScore = {
    wood: meishiki.gogyoScore.wood + (yd.buffScore.wood * buffMultiplier),
    fire: meishiki.gogyoScore.fire + (yd.buffScore.fire * buffMultiplier),
    earth: meishiki.gogyoScore.earth + (yd.buffScore.earth * buffMultiplier),
    metal: meishiki.gogyoScore.metal + (yd.buffScore.metal * buffMultiplier),
    water: meishiki.gogyoScore.water + (yd.buffScore.water * buffMultiplier)
  };
  
  const stats = calculateRPGStats(buffedScore, meishiki.nikkanGogyo, []);
  const targetStat = stats.find(s => s.key === statKey);
  
  // HPは低いほど影響が大きい（ダメージ）ので反転するか、スコアリング側で考慮する
  // 今回のスコアリングは「YES=値が高いほど良い」となっているが、HPの場合は低いほどペナルティなので
  // HPの振幅は「低さ」を絶対値として返す（100 - currentValue）
  if (statKey === 'HP') {
    return targetStat ? Math.max(0, 100 - targetStat.currentValue) : 0;
  }
  
  return targetStat ? targetStat.currentValue : 0;
};

function* getCombinations(arr: string[], r: number): Generator<string[]> {
  const n = arr.length;
  if (r === 0) {
    yield [];
    return;
  }
  if (r === n) {
    yield [...arr];
    return;
  }
  
  const indices = new Array(r);
  for (let i = 0; i < r; i++) indices[i] = i;
  
  while (true) {
    yield indices.map(i => arr[i]);
    
    let i = r - 1;
    while (i >= 0 && indices[i] === i + n - r) {
      i--;
    }
    if (i < 0) break;
    
    indices[i]++;
    for (let j = i + 1; j < r; j++) {
      indices[j] = indices[j - 1] + 1;
    }
  }
}

/**
 * 適用するパッチの数が少ない順（0個, 1個, 2個...）に、
 * 全てのパッチの組み合わせを生成するジェネレータ
 */
export function* generateAllPatchCombinations(): Generator<string[], void, unknown> {
  const allPatches = getAllPatchIds();
  for (let r = 0; r <= allPatches.length; r++) {
    yield* getCombinations(allPatches, r);
  }
}
