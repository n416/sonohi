import { Solar } from 'lunar-javascript';
import { tenkanMap, zokanMap, type GogyoScore } from './meishiki';
import { calculateRPGStats, type StatKey } from './rpgEngine';

export type FutureEvent = {
  dateStr: string;
  timestamp: number;
  diffValue: number;
};

export type AttributePrediction = {
  statKey: StatKey;
  topEvents: FutureEvent[]; // トップ3
};

export type FuturePrediction = {
  ATK: AttributePrediction;
  DEF: AttributePrediction;
  HP: AttributePrediction;
  DEX: AttributePrediction;
  MP: AttributePrediction;
  ATK_DEX: AttributePrediction; // 恋愛（その他）用: ATK+DEX複合スコア
};

const calcBuffScore = (kanchi: string): Record<keyof GogyoScore, number> => {
  const BASE_POINT = 12.5;
  const buffEffect: Record<keyof GogyoScore, number> = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  const kan = kanchi.charAt(0);
  const shi = kanchi.charAt(1);

  const kanAttr = tenkanMap[kan];
  if (kanAttr) buffEffect[kanAttr] += BASE_POINT;

  const zokan = zokanMap[shi];
  if (zokan) {
    (Object.keys(zokan) as Array<keyof GogyoScore>).forEach(attr => {
      buffEffect[attr] += BASE_POINT * (zokan[attr] as number);
    });
  }
  
  (Object.keys(buffEffect) as Array<keyof GogyoScore>).forEach(key => {
    buffEffect[key] = Math.round(buffEffect[key] * 10) / 10;
  });
  
  return buffEffect;
};

export const getDailyBuffScore = (year: number, month: number, day: number) => {
  const solar = Solar.fromYmdHms(year, month, day, 12, 0, 0);
  const lunar = solar.getLunar();
  
  const yBuff = calcBuffScore(lunar.getYearInGanZhi());
  const mBuff = calcBuffScore(lunar.getMonthInGanZhi());
  const dBuff = calcBuffScore(lunar.getDayInGanZhi());

  const totalBuff: Record<keyof GogyoScore, number> = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  (Object.keys(totalBuff) as Array<keyof GogyoScore>).forEach(key => {
    totalBuff[key] = Math.round((yBuff[key] + mBuff[key] + dBuff[key]) * 10) / 10;
  });

  return totalBuff;
};

export const calculateFutureEvents = (
  baseScore: GogyoScore,
  nikkanGogyo: string,
  daysLimit: number = 365
): FuturePrediction => {

  const baseStats = calculateRPGStats(baseScore, nikkanGogyo, []);

  const results: Record<StatKey | 'ATK_DEX', FutureEvent[]> = {
    ATK: [],
    DEF: [],
    HP: [],
    DEX: [],
    MP: [],
    ATK_DEX: []
  };

  const today = new Date();
  
  // 指定期間を走査
  for (let i = 1; i <= daysLimit; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    
    const buff = getDailyBuffScore(d.getFullYear(), d.getMonth() + 1, d.getDate());
    const buffedScore = {
      wood: baseScore.wood + buff.wood,
      fire: baseScore.fire + buff.fire,
      earth: baseScore.earth + buff.earth,
      metal: baseScore.metal + buff.metal,
      water: baseScore.water + buff.water,
    };

    const buffedStats = calculateRPGStats(buffedScore, nikkanGogyo, []);

    buffedStats.forEach(stat => {
      const baseStat = baseStats.find(s => s.key === stat.key);
      if (baseStat) {
        // 現在値との差分（今回はバフ上昇効果のみを見る）
        const diff = Math.round((stat.currentValue - baseStat.currentValue) * 10) / 10;
        if (diff > 0) {
          results[stat.key as StatKey].push({
            dateStr: `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`,
            timestamp: d.getTime(),
            diffValue: diff
          });
        }
      }
    });

    // ATK_DEX 複合スコアの計算
    const atkStat = buffedStats.find(s => s.key === 'ATK');
    const dexStat = buffedStats.find(s => s.key === 'DEX');
    const baseAtk = baseStats.find(s => s.key === 'ATK');
    const baseDex = baseStats.find(s => s.key === 'DEX');
    
    if (atkStat && dexStat && baseAtk && baseDex) {
      const diffAtk = Math.round((atkStat.currentValue - baseAtk.currentValue) * 10) / 10;
      const diffDex = Math.round((dexStat.currentValue - baseDex.currentValue) * 10) / 10;
      const totalDiff = diffAtk + diffDex;
      if (totalDiff > 0) {
        results['ATK_DEX'].push({
          dateStr: `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`,
          timestamp: d.getTime(),
          diffValue: Math.round(totalDiff * 10) / 10
        });
      }
    }
  }

  // トップ5をソートして抽出
  const getTop5 = (events: FutureEvent[]) => {
    return events
      .sort((a, b) => {
        if (b.diffValue !== a.diffValue) {
          return b.diffValue - a.diffValue; // スコアの降順
        }
        return a.timestamp - b.timestamp; // 同点の場合は近い日付を優先
      })
      .slice(0, 5);
  };

  return {
    ATK: { statKey: 'ATK', topEvents: getTop5(results.ATK) },
    DEF: { statKey: 'DEF', topEvents: getTop5(results.DEF) },
    HP: { statKey: 'HP', topEvents: getTop5(results.HP) },
    DEX: { statKey: 'DEX', topEvents: getTop5(results.DEX) },
    MP: { statKey: 'MP', topEvents: getTop5(results.MP) },
    ATK_DEX: { statKey: 'ATK' as StatKey, topEvents: getTop5(results.ATK_DEX) }, // statKeyは仮
  };
};
