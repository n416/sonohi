// RPGステータスおよび診断に関するコアロジック

export type GogyoScore = { wood: number; fire: number; earth: number; metal: number; water: number };

export const statsKeys = ['HP', 'ATK', 'DEX', 'DEF', 'MP'] as const;
export type StatKey = typeof statsKeys[number];

export type TimeBuff = {
  layer: string;
  name: string;
  effect: Record<StatKey, number>;
};

export type DiagnosisType = 'shinkyo' | 'shinjaku';

const gogyoArray = ['木', '火', '土', '金', '水'];
const statsLabels = [
  'HP / 基本体力 (比劫)',
  'ATK / 攻撃力 (食傷)',
  'DEX / 獲得力 (財星)',
  'DEF / 耐久力 (官殺)',
  'MP / 魔力 (印星)'
];

// --- RPGStatusRadar から移動 ---
export const calculateRPGStats = (scores: GogyoScore, nikkanGogyo: string, buffs: TimeBuff[] = []) => {
  const baseIndex = gogyoArray.indexOf(nikkanGogyo);
  const scoreArray = [scores.wood, scores.fire, scores.earth, scores.metal, scores.water];
  
  const data = statsLabels.map((label, idx) => {
    const scoreIndex = (baseIndex + idx) % 5;
    const key = statsKeys[idx];
    const baseValue = scoreArray[scoreIndex];
    const buffAmount = buffs.reduce((sum, buff) => sum + (buff.effect[key] || 0), 0);
    return {
      key,
      subject: label,
      baseValue: baseValue,
      currentValue: baseValue + buffAmount,
      fullMark: 100 + buffAmount,
    };
  });

  return data;
};

// --- DiagnosisReport から移動 ---
export const generateDiagnosis = (statsData: { key: StatKey; baseValue: number; currentValue: number }[], useCurrent: boolean = false) => {
  const getValue = (key: StatKey) => {
    const stat = statsData.find(s => s.key === key);
    if (!stat) return 0;
    return useCurrent ? stat.currentValue : stat.baseValue;
  };

  const basePower = getValue('HP') + getValue('MP');
  const worldBurden = getValue('ATK') + getValue('DEX') + getValue('DEF');

  let maxKey: StatKey = statsData[0].key;
  let minKey: StatKey = statsData[0].key;
  let maxVal = useCurrent ? statsData[0].currentValue : statsData[0].baseValue;
  let minVal = useCurrent ? statsData[0].currentValue : statsData[0].baseValue;

  statsData.forEach(stat => {
    const val = useCurrent ? stat.currentValue : stat.baseValue;
    if (val > maxVal) {
      maxVal = val;
      maxKey = stat.key;
    }
    if (val < minVal) {
      minVal = val;
      minKey = stat.key;
    }
  });

  const featureTitles: Record<StatKey, string> = {
    ATK: "攻撃特化",
    DEX: "機動特化",
    DEF: "防御特化",
    MP: "魔力特化",
    HP: "体力特化"
  };

  const isMikyo = basePower >= worldBurden;
  const baseTitle = isMikyo ? "アタッカー" : "ディフェンダー";
  const featureTitle = featureTitles[maxKey];
  const finalTitle = `【${baseTitle} / ${featureTitle}】`;

  const description = isMikyo
    ? `あなたの本来のベースパワーは外界の負荷を上回っており、非常にタフでエネルギーが有り余っている状態です。特に『${maxKey}』の能力が突出しているため、この強みを活かせる環境に身を置くことが重要です。`
    : `あなたは本来、外の世界から過剰な負荷を抱え込んでおり、明確に休息が必要な状態です。最大の武器は『${maxKey}』です。`;

  const subText = isMikyo
    ? `※『${minKey}』が弱点となっているため、勢い余って足をすくわれないよう注意してください。`
    : `※致命的な弱点である『${minKey}』は無理に補おうとせず、まずは周囲に頼れる味方を見つけることが先決です。`;

  return {
    type: (isMikyo ? 'shinkyo' : 'shinjaku') as DiagnosisType,
    basePower,
    worldBurden,
    title: finalTitle,
    description,
    subText
  };
};

// --- FortuneCalendar から移動 ---
const pseudoRandom = (seed: number) => {
  let x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
};

export const getDailyBuffForDate = (date: Date): Record<StatKey, number> => {
  const seed = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  const keys: StatKey[] = ['HP', 'ATK', 'DEX', 'DEF', 'MP'];
  
  const targetKey = keys[Math.floor(pseudoRandom(seed) * keys.length)];
  const amount = Math.floor(pseudoRandom(seed + 1) * 30) - 10;
  
  const effect = { HP: 0, ATK: 0, DEX: 0, DEF: 0, MP: 0 } as Record<StatKey, number>;
  effect[targetKey] = amount;
  return effect;
};

export const calculateDeviations = (scores: number[]) => {
  const avg = scores.reduce((a, b) => a + b, 0) / (scores.length || 1);
  const variance = scores.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / (scores.length || 1);
  const stdDev = Math.sqrt(variance);
  return scores.map(score => stdDev === 0 ? 50 : Math.round(((score - avg) / stdDev) * 10 + 50));
};

export const getStatus = (buff: Record<StatKey, number>, baseDiagnosisType: DiagnosisType) => {
  let goodScore = 0;
  let badScore = 0;
  
  const energyBuff = (buff.HP || 0) + (buff.MP || 0);
  const consumeBuff = (buff.ATK || 0) + (buff.DEX || 0) + (buff.DEF || 0);
  
  if (baseDiagnosisType === 'shinkyo') {
    if (consumeBuff > 0) goodScore += consumeBuff;
    if (consumeBuff < 0) badScore -= consumeBuff;
    if (energyBuff > 0) badScore += energyBuff;
    if (energyBuff < 0) goodScore -= energyBuff;
  } else {
    if (energyBuff > 0) goodScore += energyBuff;
    if (energyBuff < 0) badScore -= energyBuff;
    if (consumeBuff > 0) badScore += consumeBuff;
    if (consumeBuff < 0) goodScore -= consumeBuff;
  }
  
  // 閾値を > 5 に戻して、NORMALの日が適度に出現するように調整
  if (goodScore > 5 && goodScore > badScore) return 'good';
  if (badScore > 5 && badScore > goodScore) return 'bad';
  return 'normal';
};

export const getScore = (buff: Record<StatKey, number>, baseDiagnosisType: DiagnosisType) => {
  const energyBuff = (buff.HP || 0) + (buff.MP || 0);
  const consumeBuff = (buff.ATK || 0) + (buff.DEX || 0) + (buff.DEF || 0);
  return baseDiagnosisType === 'shinkyo' ? consumeBuff - energyBuff : energyBuff - consumeBuff;
};
