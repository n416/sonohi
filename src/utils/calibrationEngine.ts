import { Solar } from 'lunar-javascript';
import { calculateMeishiki } from './meishiki';
import { calculateRPGStats } from './rpgEngine';
import { getYearlyBuffScore, BRANCHES } from './suijiEngine';

export const AVAILABLE_PATCHES = [
  'PATCH_KUBOU',
  'PATCH_YASHIJI',
  'PATCH_CHU_GOU',
  'PATCH_SHINSATSU'
];

export type CalibrationYears = {
  atkYear: number;
  defYear: number;
  hpYear: number;
  chuYear: number;
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

/**
 * 現在のパッチ状態のもとで、各パラメータが極端になる年を算出する
 */
export const calculateCalibrationYears = (
  birthYear: number,
  birthMonth: number,
  birthDay: number,
  time: string,
  activePatches: string[] = []
): CalibrationYears => {
  
  // PATCH_YASHIJI が有効で時間が子の場合、日を+1して計算する（簡易的な夜子時対応）
  let calcDay = birthDay;
  if (activePatches.includes('PATCH_YASHIJI') && time === '子') {
    const d = new Date(birthYear, birthMonth - 1, birthDay);
    d.setDate(d.getDate() + 1);
    calcDay = d.getDate();
  }

  const meishiki = calculateMeishiki(birthYear, birthMonth, calcDay, time);
  
  const currentYear = new Date().getFullYear();
  const startYear = birthYear + 10; // 10歳くらいから現在まで
  
  let maxAtk = -Infinity;
  let maxDef = -Infinity;
  let minHp = Infinity;
  
  let atkYear = currentYear - 1;
  let defYear = currentYear - 2;
  let hpYear = currentYear - 3;
  let chuYear = currentYear - 4;

  let latestChuYear = -1;

  for (let y = startYear; y <= currentYear; y++) {
    const yearlyBuff = getYearlyBuffScore(y);
    
    // パッチによる補正
    if (activePatches.includes('PATCH_KUBOU')) {
      Object.keys(yearlyBuff).forEach(k => {
        yearlyBuff[k as keyof typeof yearlyBuff] *= 0.5;
      });
    }

    const buffedScore = {
      wood: meishiki.gogyoScore.wood + yearlyBuff.wood,
      fire: meishiki.gogyoScore.fire + yearlyBuff.fire,
      earth: meishiki.gogyoScore.earth + yearlyBuff.earth,
      metal: meishiki.gogyoScore.metal + yearlyBuff.metal,
      water: meishiki.gogyoScore.water + yearlyBuff.water,
    };

    // 貪合忘冲パッチがない場合のみ冲をチェック
    if (!activePatches.includes('PATCH_CHU_GOU')) {
      const solar = Solar.fromYmdHms(y, 7, 1, 12, 0, 0);
      const yearBranch = solar.getLunar().getYearInGanZhi().charAt(1);
      
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
 * 焼きなまし法による次のパッチ状態の生成（近傍探索）
 * ランダムに1つのパッチの有効/無効を切り替える
 */
export const getNextPatchState = (currentPatches: string[]): string[] => {
  const nextPatches = [...currentPatches];
  const targetPatch = AVAILABLE_PATCHES[Math.floor(Math.random() * AVAILABLE_PATCHES.length)];
  
  const idx = nextPatches.indexOf(targetPatch);
  if (idx !== -1) {
    nextPatches.splice(idx, 1);
  } else {
    nextPatches.push(targetPatch);
  }
  
  return nextPatches;
};

/**
 * 焼きなまし法の遷移確率判定
 * 新しいスコア（YESの数）が良ければ必ず遷移、悪ければ確率的に遷移
 */
export const shouldAcceptNewState = (oldScore: number, newScore: number, temperature: number): boolean => {
  if (newScore > oldScore) return true;
  if (temperature <= 0) return false;
  
  const probability = Math.exp((newScore - oldScore) / temperature);
  return Math.random() < probability;
};
