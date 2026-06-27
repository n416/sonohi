import { useState, useEffect, useMemo } from 'react';
import { Settings, MessageCircle, Sparkles, ChevronDown, ChevronUp, User, ToggleLeft, ToggleRight } from 'lucide-react';
import { DiagnosisReport } from './components/DiagnosisReport';
import { RPGStatusRadar } from './components/RPGStatusRadar';
import { FortuneCalendar } from './components/FortuneCalendar';
import { calculateRPGStats, getDailyBuffForDate, generateDiagnosis, type TimeBuff } from './utils/rpgEngine';
import { AITimeInferenceChat } from './components/AITimeInferenceChat';
import { ProfileChat } from './components/ProfileChat';
import { SettingsDrawer } from './components/SettingsDrawer';
import { calculateMeishiki, type Meishiki, type GogyoScore } from './utils/meishiki';
import { CharacterProfileModal } from './components/CharacterProfileModal';
import { DailyAdviceModal } from './components/DailyAdviceModal';

// ==========================================
// 1. コア演算エンジン（パッチ処理ロジック）
// ==========================================

type Patch = {
  id: string;
  name: string;
  description: string;
  apply: (m: Meishiki) => Meishiki;
};

const PATCH_REGISTRY: Record<string, Patch> = {
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

const evaluateMeishiki = (base: Meishiki, activePatchIds: string[]): Meishiki => {
  return activePatchIds.reduce((currentMeishiki, patchId) => {
    const patch = PATCH_REGISTRY[patchId];
    return patch ? patch.apply(currentMeishiki) : currentMeishiki;
  }, base);
};

// ==========================================
// 3. UIコンポーネント構成 (App)
// ==========================================

const getGogyoFromKan = (kan: string): string => {
  if (['甲', '乙'].includes(kan)) return '木';
  if (['丙', '丁'].includes(kan)) return '火';
  if (['戊', '己'].includes(kan)) return '土';
  if (['庚', '辛'].includes(kan)) return '金';
  if (['壬', '癸'].includes(kan)) return '水';
  return '木'; // fallback
};

export default function App() {
  const [year, setYear] = useState(() => Number(localStorage.getItem('sonohi_year')) || 1990);
  const [month, setMonth] = useState(() => Number(localStorage.getItem('sonohi_month')) || 1);
  const [day, setDay] = useState(() => Number(localStorage.getItem('sonohi_day')) || 1);
  const [time, setTime] = useState(() => localStorage.getItem('sonohi_time') || "不明");
  const [activePatches, setActivePatches] = useState<string[]>(() => {
    const saved = localStorage.getItem('sonohi_patches');
    return saved ? JSON.parse(saved) : [];
  });

  const [result, setResult] = useState<Meishiki | null>(null);
  const [isChatMode, setIsChatMode] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isSystemChatOpen, setIsSystemChatOpen] = useState(() => !localStorage.getItem('sonohi_year'));
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isOnboarding, setIsOnboarding] = useState(() => !localStorage.getItem('sonohi_year'));
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [isAdviceModalOpen, setIsAdviceModalOpen] = useState(false);
  const [yashijiAlertOpen, setYashijiAlertOpen] = useState(false);

  // --- 直感的操作のための状態（1〜2日選択） ---
  const [selectedDates, setSelectedDates] = useState<Date[]>([new Date()]);

  // 設定の自動保存
  useEffect(() => {
    localStorage.setItem('sonohi_year', year.toString());
    localStorage.setItem('sonohi_month', month.toString());
    localStorage.setItem('sonohi_day', day.toString());
    localStorage.setItem('sonohi_time', time);
    localStorage.setItem('sonohi_patches', JSON.stringify(activePatches));
  }, [year, month, day, time, activePatches]);

  const togglePatch = (id: string) => {
    setActivePatches(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const applyPreset = (presetIds: string[]) => {
    setActivePatches(prev => {
      const hasYashiji = prev.includes("PATCH_YASHIJI");
      return hasYashiji ? [...presetIds, "PATCH_YASHIJI"] : presetIds;
    });
  };

  const handleYashijiModeRequest = () => {
    setYashijiAlertOpen(true);
  };

  const handleUpdateProfile = (newYear: number, newMonth: number, newDay: number, newTime: string) => {
    setYear(newYear);
    setMonth(newMonth);
    setDay(newDay);
    setTime(newTime);
  };

  const safeYear = Math.max(1900, Math.min(2100, year || 1990));
  const safeMonth = Math.max(1, Math.min(12, month || 1));
  const safeDay = Math.max(1, Math.min(31, day || 1));

  useEffect(() => {
    try {
      const initial = calculateMeishiki(safeYear, safeMonth, safeDay, time);
      const finalResult = evaluateMeishiki(initial, activePatches);
      setResult(finalResult);
    } catch (error) {
      console.error('命式の計算エラー:', error);
    }
  }, [safeYear, safeMonth, safeDay, time, activePatches]);

  const baseData = useMemo(() => {
    if (!result) return null;
    const nikkanGogyo = getGogyoFromKan(result.kanchi.day.charAt(0));
    const baseStats = calculateRPGStats(result.gogyoScore, nikkanGogyo, []);
    const baseDiagnosis = generateDiagnosis(baseStats, false);

    const baseTimeBuffs: TimeBuff[] = [
      { layer: "大運 (10年)", name: "炎のフィールド", effect: { HP: 15, ATK: 5, DEX: 0, DEF: 0, MP: 0 } },
      { layer: "年運 (1年)", name: "知識の雨", effect: { HP: 0, ATK: 0, DEX: 0, DEF: 0, MP: 10 } },
      { layer: "月運 (1ヶ月)", name: "プレッシャー", effect: { HP: 0, ATK: 0, DEX: 0, DEF: 5, MP: 0 } }
    ];

    const currentBaseStats = calculateRPGStats(result.gogyoScore, nikkanGogyo, baseTimeBuffs);
    const currentBaseDiagnosis = generateDiagnosis(currentBaseStats, true);

    return {
      nikkanGogyo,
      nikkanKan: result.kanchi.day.charAt(0),
      nisshiKan: result.kanchi.day.charAt(1),
      baseStats,
      baseDiagnosisType: baseDiagnosis.type,
      currentBaseStats,
      currentBaseDiagnosisType: currentBaseDiagnosis.type,
      baseTimeBuffs
    };
  }, [result]);

  const finalStatsDataList = useMemo(() => {
    if (!result || !baseData) return [];

    // 選択された日付（最大2日）についてそれぞれ計算
    return selectedDates.map(date => {
      const dailyBuffEffect = getDailyBuffForDate(date);
      const isToday = date.toDateString() === new Date().toDateString();
      const buffName = isToday ? "本日の運勢" : `タイムトラベル (${date.getMonth() + 1}/${date.getDate()})`;

      const currentTimeBuffs: TimeBuff[] = [
        ...baseData.baseTimeBuffs,
        { layer: "日運 (選択日)", name: buffName, effect: dailyBuffEffect }
      ];
      const finalStats = calculateRPGStats(result.gogyoScore, baseData.nikkanGogyo, currentTimeBuffs);
      const finalDiagnosis = generateDiagnosis(finalStats, true);
      return { date, finalStats, finalDiagnosis, currentTimeBuffs };
    });
  }, [result, baseData, selectedDates]);

  const monthlyMaxDomain = useMemo(() => {
    if (!result || !baseData || selectedDates.length === 0) return undefined;

    const targetDate = selectedDates[0];
    const targetYear = targetDate.getFullYear();
    const targetMonth = targetDate.getMonth();
    const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();

    let maxStatValue = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(targetYear, targetMonth, d);
      const dailyBuffEffect = getDailyBuffForDate(date);
      const tempTimeBuffs: TimeBuff[] = [
        ...baseData.baseTimeBuffs,
        { layer: "日運", name: "temp", effect: dailyBuffEffect }
      ];
      const stats = calculateRPGStats(result.gogyoScore, baseData.nikkanGogyo, tempTimeBuffs);

      const currentMax = Math.max(...stats.map(s => s.currentValue));
      if (currentMax > maxStatValue) {
        maxStatValue = currentMax;
      }
    }

    // 余裕を持たせず、その月の絶対的な最大値をスケールの最大値に設定する
    // （最大幸運日がグラフの外枠にぴったりくっつくようにする）
    return Math.max(20, maxStatValue);
  }, [result, baseData, selectedDates]);

  const handleSelectDate = (date: Date) => {
    setSelectedDates(prev => {
      // 通常モードなら常に1つだけ選択
      if (!isCompareMode) {
        return [date];
      }

      // 比較モードのロジック
      const exists = prev.find(d => d.getTime() === date.getTime());
      if (exists) {
        if (prev.length === 1) return prev;
        return prev.filter(d => d.getTime() !== date.getTime());
      }
      if (prev.length >= 2) return [prev[1], date];
      return [...prev, date];
    });
  };

  const toggleCompareMode = () => {
    setIsCompareMode(prev => {
      const next = !prev;
      // 比較モードをオフにしたとき、選択日付が2つあれば最新の1つに絞る
      if (!next && selectedDates.length > 1) {
        setSelectedDates([selectedDates[selectedDates.length - 1]]);
      }
      return next;
    });
  };

  const startChat = () => {
    setIsChatMode(true);
  };

  return (
    <div className="h-[100dvh] flex flex-col bg-slate-950 text-slate-300 font-sans selection:bg-indigo-500/30 overflow-hidden">

      {/* 2ペイン・スプリットレイアウト */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">

        {/* 上半分/左ペイン：カレンダー */}
        <div className="w-full lg:w-5/12 h-[50%] lg:h-full flex flex-col bg-slate-950/50 relative">

          {/* コントロール群 */}
          <div className="flex-none p-2 md:p-4 pb-1 md:pb-2 z-30 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 md:gap-2">
              <button
                onClick={() => setIsSystemChatOpen(true)}
                className="flex items-center gap-1 bg-slate-800/80 backdrop-blur hover:bg-slate-700 text-white px-2 py-1.5 rounded-lg transition-colors text-[10px] font-bold border border-slate-700 shadow-sm"
              >
                <User size={12} />
                {month}/{day}
              </button>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="flex items-center gap-1 bg-slate-800/80 backdrop-blur hover:bg-slate-700 text-white px-2 py-1.5 rounded-lg transition-colors text-[10px] font-bold border border-slate-700 shadow-sm"
              >
                <Sparkles size={12} className="text-pink-400" />
                パッチ
              </button>
              {baseData && (
                <button
                  onClick={() => setIsProfileOpen(true)}
                  className="flex items-center gap-1 bg-indigo-600/80 backdrop-blur hover:bg-indigo-500 text-white px-2 py-1.5 rounded-lg transition-colors text-[10px] font-bold border border-indigo-500 shadow-sm"
                >
                  <User size={12} /> キャラ特性
                </button>
              )}
            </div>

            <button
              onClick={toggleCompareMode}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg transition-colors text-[10px] font-bold border backdrop-blur shadow-sm ${isCompareMode
                  ? 'bg-pink-500/20 text-pink-400 border-pink-500/50'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700'
                }`}
            >
              {isCompareMode ? <ToggleRight size={14} className="text-pink-400" /> : <ToggleLeft size={14} />}
              比較モード
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-2 md:px-4 md:pb-4 pt-1 md:pt-2">
            {result && baseData ? (
              <div className="space-y-4">
                <FortuneCalendar
                  selectedDates={selectedDates}
                  onSelectDate={handleSelectDate}
                  baseDiagnosisType={baseData.currentBaseDiagnosisType}
                />

                {/* 本日のアクション指針（詳細）ボタン */}
                <button
                  onClick={() => setIsAdviceModalOpen(true)}
                  className="w-full relative overflow-hidden group bg-gradient-to-r from-indigo-500/20 to-purple-500/20 hover:from-indigo-500/30 hover:to-purple-500/30 border border-indigo-500/30 rounded-2xl p-4 transition-all"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="relative font-bold text-indigo-300 text-sm flex items-center justify-center gap-2">
                    <Sparkles size={18} className="text-indigo-400" />
                    本日のアクション指針（詳細）を見る
                  </span>
                </button>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 flex-col gap-2">
                <Settings size={24} className="animate-spin opacity-20" />
                <p className="text-xs font-medium">初期化中...</p>
              </div>
            )}
          </div>
        </div>

        {/* 下半分/右ペイン：鑑定結果 */}
        <div className="w-full lg:w-7/12 h-[50%] lg:h-full overflow-y-auto custom-scrollbar bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-700 shadow-[0_-15px_40px_rgba(0,0,0,0.5)] lg:shadow-none z-20 relative">

          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[100px] rounded-full pointer-events-none"></div>

          {result && baseData && finalStatsDataList.length > 0 ? (
            <div className="p-2 md:p-6 space-y-4 max-w-4xl mx-auto">

              {/* 時間不明時チャット（1つだけ表示） */}
              {time === "不明" && (
                <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-indigo-400 font-bold text-[10px]">
                    <MessageCircle size={14} />
                    出生時間不明 (AI推時可能)
                  </div>
                  <button
                    onClick={startChat}
                    className="shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] rounded-lg px-3 py-1.5 flex items-center gap-1 transition-colors"
                  >
                    <Sparkles size={12} /> 推時
                  </button>
                </div>
              )}

              {/* レーダーチャート（1〜2日分を重ね合わせて比較表示） */}
              <RPGStatusRadar
                scores={result.gogyoScore}
                nikkanGogyo={baseData.nikkanGogyo}
                primaryData={{
                  date: finalStatsDataList[0].date,
                  timeBuffs: finalStatsDataList[0].currentTimeBuffs
                }}
                secondaryData={finalStatsDataList[1] ? {
                  date: finalStatsDataList[1].date,
                  timeBuffs: finalStatsDataList[1].currentTimeBuffs
                } : undefined}
                domainMax={monthlyMaxDomain}
              />

              {/* 診断レポート（テキストは縦並びで表示） */}
              <div className="flex flex-col gap-3 md:gap-6">
                {finalStatsDataList.map((data, index) => {
                  const { nikkanGogyo } = baseData;
                  const isSecond = index === 1;

                  // スタイル分岐
                  const colorConfig = isSecond
                    ? { text: 'text-pink-400', border: 'border-pink-500/30', bg: 'bg-pink-500' }
                    : { text: 'text-indigo-400', border: 'border-indigo-500/30', bg: 'bg-indigo-500' };

                  return (
                    <div key={data.date.getTime()} className="space-y-2 md:space-y-4">
                      <h3 className={`text-xs font-bold pb-1 flex items-center gap-1.5 ${colorConfig.text}`}>
                        <div className={`w-2 h-2 rounded-full ${colorConfig.bg}`} />
                        {data.date.getMonth() + 1}/{data.date.getDate()}の運勢
                      </h3>

                      <DiagnosisReport
                        scores={result.gogyoScore}
                        nikkanGogyo={nikkanGogyo}
                        timeBuffs={data.currentTimeBuffs}
                      />
                    </div>
                  );
                })}
              </div>

              {/* 専門データ (共通) */}
              <div className="bg-slate-900/50 border border-slate-700/50 rounded-2xl overflow-hidden mt-8 custom-scrollbar">
                <button
                  onClick={() => setIsDetailsOpen(!isDetailsOpen)}
                  className="w-full flex items-center justify-between p-4 bg-slate-800/30 hover:bg-slate-800/50 transition-colors"
                >
                  <span className="font-bold text-slate-300 text-sm flex items-center gap-2">
                    <Settings size={16} />
                    専門データ（命式・五行スコア・ログ）
                  </span>
                  {isDetailsOpen ? <ChevronUp size={20} className="text-slate-500" /> : <ChevronDown size={20} className="text-slate-500" />}
                </button>

                {isDetailsOpen && (
                  <div className="p-4 md:p-6 border-t border-slate-700/50 space-y-6 md:space-y-8">
                    <div>
                      <h3 className="text-sm font-bold text-slate-400 mb-3 md:mb-4">命式（柱）</h3>
                      <div className="grid grid-cols-4 gap-2 md:gap-4">
                        {['year', 'month', 'day', 'time'].map((type, idx) => {
                          const labels = ['年柱', '月柱', '日柱', '時柱'];
                          return (
                            <div key={type} className="text-center">
                              <div className="text-slate-500 text-[10px] md:text-xs font-bold mb-1 md:mb-2">{labels[idx]}</div>
                              <div className="bg-slate-800 border border-slate-700 rounded-xl p-2 md:p-4 text-lg md:text-2xl font-extrabold text-white shadow-inner">
                                {result.kanchi[type as keyof typeof result.kanchi]}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-slate-400 mb-3 md:mb-4">五行スコア</h3>
                      <div className="grid grid-cols-5 gap-1 md:gap-2">
                        {[
                          { key: 'wood', label: '木', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
                          { key: 'fire', label: '火', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
                          { key: 'earth', label: '土', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
                          { key: 'metal', label: '金', color: 'bg-slate-200/20 text-slate-300 border-slate-300/30' },
                          { key: 'water', label: '水', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' }
                        ].map(g => (
                          <div key={g.key} className={`border rounded-xl p-2 md:p-3 text-center ${g.color}`}>
                            <div className="text-[10px] md:text-xs mb-1">{g.label}</div>
                            <div className="font-bold text-sm md:text-lg">{result.gogyoScore[g.key as keyof GogyoScore]}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-slate-400 mb-2 md:mb-3">演算プロセスログ</h3>
                      <div className="bg-black/40 rounded-xl p-3 md:p-4 font-mono text-[10px] md:text-xs text-slate-400 space-y-1 md:space-y-2 max-h-40 overflow-y-auto border border-slate-800 custom-scrollbar">
                        {result.logs.map((log, i) => (
                          <div key={i} className="flex gap-2">
                            <span className="text-indigo-500">{'>'}</span> {log}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-50">
              <Sparkles size={48} className="mb-4" />
              <p>日付を選択してください</p>
            </div>
          )}
        </div>
      </div>

      {isChatMode && (
        <AITimeInferenceChat
          birthYear={safeYear}
          birthMonth={safeMonth}
          birthDay={safeDay}
          activePatches={activePatches}
          onComplete={(inferredTime) => {
            setTime(inferredTime);
            setIsChatMode(false);
          }}
          onCancel={() => setIsChatMode(false)}
        />
      )}

      {isSystemChatOpen && (
        <ProfileChat
          currentYear={year}
          currentMonth={month}
          currentDay={day}
          currentTime={time}
          isOnboarding={isOnboarding}
          onUpdateProfile={handleUpdateProfile}
          onClose={() => {
            setIsSystemChatOpen(false);
            if (isOnboarding) setIsOnboarding(false);
          }}
          onOpenTimeInference={() => {
            setIsSystemChatOpen(false);
            if (isOnboarding) setIsOnboarding(false);
            setIsChatMode(true);
          }}
        />
      )}

      <SettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        activePatches={activePatches}
        togglePatch={togglePatch}
        applyPreset={applyPreset}
        onRequestYashijiMode={handleYashijiModeRequest}
        patches={Object.values(PATCH_REGISTRY)}
      />

      {baseData && (
        <CharacterProfileModal
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          nikkan={baseData.nikkanKan}
          nisshi={baseData.nisshiKan}
        />
      )}

      {baseData && (
        <DailyAdviceModal
          isOpen={isAdviceModalOpen}
          onClose={() => setIsAdviceModalOpen(false)}
          dataList={finalStatsDataList.map(d => ({ date: d.date, stats: d.finalStats }))}
          activePatches={activePatches}
        />
      )}
      {yashijiAlertOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-xl max-w-sm w-full relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-orange-500"></div>
            <h3 className="text-xl font-bold text-slate-100 mb-3 flex items-center gap-2">
              <span className="text-red-400">⚠️</span> 暦の前提が変更されます
            </h3>
            <p className="text-slate-300 text-sm mb-6 leading-relaxed">
              「夜子時パッチ」を切り替えるため、出生日時の前提条件が崩れます。<br /><br />
              適用する場合、一度生年月日がリセットされますので、再度入力を行ってください。
            </p>
            <div className="flex gap-3">
              <button
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors font-bold text-sm"
                onClick={() => setYashijiAlertOpen(false)}
              >
                キャンセル
              </button>
              <button
                className="flex-1 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 rounded-xl transition-colors font-bold text-sm"
                onClick={() => {
                  setActivePatches(prev =>
                    prev.includes("PATCH_YASHIJI") ? prev.filter(p => p !== "PATCH_YASHIJI") : [...prev, "PATCH_YASHIJI"]
                  );
                  setYear(0);
                  setMonth(1);
                  setDay(1);
                  setTime("不明");
                  localStorage.removeItem('sonohi_year');
                  localStorage.removeItem('sonohi_month');
                  localStorage.removeItem('sonohi_day');
                  localStorage.removeItem('sonohi_time');
                  setIsSettingsOpen(false);
                  setIsSystemChatOpen(true);
                  setYashijiAlertOpen(false);
                }}
              >
                適用する
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
