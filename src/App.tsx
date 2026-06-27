import { useState, useEffect, useMemo } from 'react';
import { Settings, MessageCircle, Sparkles, ChevronDown, ChevronUp, User, X } from 'lucide-react';
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
import { FuturePredictionModal } from './components/FuturePredictionModal';
import { SplashModal } from './components/SplashModal';

// ==========================================
// 1. コア演算エンジン（パッチ処理ロジック）
// ==========================================

import { PATCH_REGISTRY } from './utils/patchRegistry';

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
  const [gender, setGender] = useState<'male'|'female'|'other'>(() => (localStorage.getItem('sonohi_gender') as 'male'|'female'|'other') || 'other');
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
  const [showMainClearConfirm, setShowMainClearConfirm] = useState(false);
  const [isAdviceModalOpen, setIsAdviceModalOpen] = useState(false);
  const [isFutureModalOpen, setIsFutureModalOpen] = useState(false);
  const [isCalibrated, setIsCalibrated] = useState(() => localStorage.getItem('sonohi_calibrated') === 'true');
  const [alertData, setAlertData] = useState<{title: string, message: string, showInferenceBtn: boolean, showCalibrationBtn: boolean} | null>(null);
  const [showRomance, setShowRomance] = useState(() => localStorage.getItem('sonohi_show_romance') !== 'false');
  const [yashijiAlertOpen, setYashijiAlertOpen] = useState(false);
  const [isSplashOpen, setIsSplashOpen] = useState(() => localStorage.getItem('sonohi_hide_splash') !== 'true');

  // --- 直感的操作のための状態（1〜2日選択） ---
  const [selectedDates, setSelectedDates] = useState<Date[]>([new Date()]);

  // 設定の自動保存
  useEffect(() => {
    if (isOnboarding) return; // オンボーディング完了前は自動保存しない
    
    localStorage.setItem('sonohi_gender', gender);
    localStorage.setItem('sonohi_show_romance', showRomance.toString());
    localStorage.setItem('sonohi_year', year.toString());
    localStorage.setItem('sonohi_month', month.toString());
    localStorage.setItem('sonohi_day', day.toString());
    localStorage.setItem('sonohi_time', time);
    localStorage.setItem('sonohi_patches', JSON.stringify(activePatches));
    localStorage.setItem('sonohi_calibrated', isCalibrated.toString());
  }, [gender, showRomance, year, month, day, time, activePatches, isOnboarding, isCalibrated]);

  const accuracy = useMemo(() => {
    let acc = 0;
    if (year !== 1990 || !isOnboarding) acc = 50;
    if (acc === 50 && time !== "不明") acc = 75;
    if (acc === 75 && isCalibrated) acc = 100;
    return acc;
  }, [year, isOnboarding, time, isCalibrated]);

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

  const handleUpdateProfile = (newYear: number, newMonth: number, newDay: number, newTime: string, newPatches?: string[], newIsCalibrated?: boolean) => {
    setYear(newYear);
    setMonth(newMonth);
    setDay(newDay);
    setTime(newTime);
    if (newPatches && newPatches.length > 0) {
      setActivePatches(newPatches);
    }
    if (newIsCalibrated !== undefined) {
      setIsCalibrated(newIsCalibrated);
    }
  };

  const handleClearData = () => {
    const keysToRemove = [
      'sonohi_year', 'sonohi_month', 'sonohi_day', 'sonohi_time',
      'sonohi_gender', 'sonohi_show_romance', 'sonohi_patches', 'sonohi_hide_splash', 'sonohi_calibrated'
    ];
    keysToRemove.forEach(k => localStorage.removeItem(k));
    window.location.reload();
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
    setSelectedDates([date]);
  };

  const startChat = () => {
    setIsChatMode(true);
  };

  const handleFeatureClick = (feature: 'advice' | 'future') => {
    if (accuracy < 75) {
      setAlertData({
        title: '精度不足 (75%未満)',
        message: 'この機能を利用するには、運勢同調精度が75%以上（出生時間の入力済）である必要があります。',
        showInferenceBtn: true,
        showCalibrationBtn: false
      });
      return;
    }
    if (feature === 'advice') setIsAdviceModalOpen(true);
    if (feature === 'future') setIsFutureModalOpen(true);
  };

  return (
    <div className="h-[100dvh] flex flex-col bg-slate-950 text-slate-300 font-sans selection:bg-indigo-500/30 overflow-hidden">
      
      {/* 精度メーター */}
      <div className="flex-none bg-slate-900 border-b border-slate-700/50 p-2 md:p-3 flex items-center justify-between gap-4 z-40 relative">
        <div className="flex items-center gap-1 md:gap-2">
          <Sparkles size={16} className={accuracy >= 100 ? "text-yellow-400" : "text-indigo-400"} />
          <span className="text-xs md:text-sm font-bold text-slate-300 whitespace-nowrap">運勢同調精度</span>
        </div>
        <div className="flex-1 max-w-md bg-slate-950 rounded-full h-2 md:h-3 overflow-hidden border border-slate-800 relative">
          <div 
            className={`absolute top-0 left-0 h-full transition-all duration-1000 ${accuracy >= 100 ? 'bg-gradient-to-r from-yellow-500 to-amber-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]' : 'bg-gradient-to-r from-indigo-500 to-fuchsia-500'}`} 
            style={{ width: `${accuracy}%` }} 
          />
        </div>
        <div className={`text-xs md:text-sm font-bold w-12 text-right ${accuracy >= 100 ? 'text-yellow-400' : 'text-slate-300'}`}>
          {accuracy}%
        </div>
      </div>

      {/* 2ペイン・スプリットレイアウト */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">

        {/* 上半分/左ペイン：カレンダー */}
        <div className="w-full lg:w-5/12 flex-none lg:flex-1 lg:h-full flex flex-col bg-slate-950/50 relative">

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
            </div>

            <div className="flex items-center gap-1 bg-slate-900/50 rounded-lg border border-slate-700/50 p-0.5">
              {showMainClearConfirm ? (
                <>
                  <button onClick={() => setShowMainClearConfirm(false)} className="text-[10px] text-slate-400 hover:text-white px-2 py-1 transition-colors">キャンセル</button>
                  <button onClick={handleClearData} className="text-[10px] text-red-400 hover:text-red-300 font-bold px-2 py-1 bg-red-500/10 rounded transition-colors">本当に初期化</button>
                </>
              ) : (
                <button
                  onClick={() => setShowMainClearConfirm(true)}
                  className="flex items-center gap-1 bg-slate-800/80 backdrop-blur hover:bg-red-500/20 hover:text-red-400 text-slate-400 px-2 py-1 rounded transition-colors text-[10px] font-bold"
                >
                  <X size={12} />
                  全クリア
                </button>
              )}
            </div>
          </div>

          <div className="px-2 pb-2 md:px-4 md:pb-4 pt-1 md:pt-2 lg:overflow-y-auto custom-scrollbar">
            {result && baseData ? (
              <FortuneCalendar
                selectedDates={selectedDates}
                onSelectDate={handleSelectDate}
                baseDiagnosisType={baseData.currentBaseDiagnosisType}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 flex-col gap-2">
                <Settings size={24} className="animate-spin opacity-20" />
                <p className="text-xs font-medium">初期化中...</p>
              </div>
            )}
          </div>

          {result && baseData && (
            <div className="flex-none p-2 md:p-4 pt-2 md:pt-4 border-t border-slate-800/50 bg-slate-950/80 backdrop-blur-sm z-30 space-y-2">
              {/* 私のトリセツ（旧：キャラ特性）ボタン */}
              <button
                onClick={() => setIsProfileOpen(true)}
                className="w-full relative overflow-hidden group bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 border border-emerald-500/30 rounded-2xl p-3 transition-all shadow-sm"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="relative font-bold text-emerald-300 text-sm flex items-center justify-center gap-2">
                  <User size={18} className="text-emerald-400" />
                  私のトリセツ
                </span>
              </button>

              <div className="flex gap-2">
                {/* 本日のアクション指針ボタン */}
                <button
                  onClick={() => handleFeatureClick('advice')}
                  className="flex-1 relative overflow-hidden group bg-gradient-to-r from-indigo-500/20 to-purple-500/20 hover:from-indigo-500/30 hover:to-purple-500/30 border border-indigo-500/30 rounded-2xl p-3 transition-all shadow-sm"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="relative font-bold text-indigo-300 text-[10px] md:text-xs flex items-center justify-center gap-1.5">
                    <Sparkles size={14} className="text-indigo-400" />
                    本日のアクション指針
                  </span>
                </button>

                {/* 未来予測ボタン */}
                <button
                  onClick={() => handleFeatureClick('future')}
                  className="flex-1 relative overflow-hidden group bg-gradient-to-r from-fuchsia-500/20 to-pink-500/20 hover:from-fuchsia-500/30 hover:to-pink-500/30 border border-fuchsia-500/30 rounded-2xl p-3 transition-all shadow-sm"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="relative font-bold text-fuchsia-300 text-[10px] md:text-xs flex items-center justify-center gap-1.5">
                    <Sparkles size={14} className="text-fuchsia-400" />
                    未来予測
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 下半分/右ペイン：鑑定結果 */}
        <div className="w-full lg:w-7/12 flex-1 lg:h-full overflow-y-auto custom-scrollbar bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-700 shadow-[0_-15px_40px_rgba(0,0,0,0.5)] lg:shadow-none z-20 relative">

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

              {/* レーダーチャート */}
              <RPGStatusRadar
                scores={result.gogyoScore}
                nikkanGogyo={baseData.nikkanGogyo}
                primaryData={{
                  date: finalStatsDataList[0].date,
                  timeBuffs: finalStatsDataList[0].currentTimeBuffs
                }}
                domainMax={monthlyMaxDomain}
              />

              {/* 診断レポート */}
              <div className="flex flex-col gap-3 md:gap-6">
                {finalStatsDataList.map((data) => {
                  const { nikkanGogyo } = baseData;

                  return (
                    <div key={data.date.getTime()} className="space-y-2 md:space-y-4">
                      <h3 className="text-xs font-bold pb-1 flex items-center gap-1.5 text-indigo-400">
                        <div className="w-2 h-2 rounded-full bg-indigo-500" />
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

      {!isSplashOpen && isSystemChatOpen && (
        <ProfileChat
          currentYear={year}
          currentMonth={month}
          currentDay={day}
          currentTime={time}
          isOnboarding={isOnboarding}
          onUpdateProfile={handleUpdateProfile}
          onClearData={handleClearData}
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

      {baseData && result && isFutureModalOpen && (
        <FuturePredictionModal
          baseScore={result.gogyoScore}
          nikkanGogyo={baseData.nikkanGogyo}
          gender={gender}
          onGenderChange={setGender}
          showRomance={showRomance}
          onToggleRomance={() => setShowRomance(!showRomance)}
          onClose={() => setIsFutureModalOpen(false)}
        />
      )}

      {isSplashOpen && (
        <SplashModal onClose={() => setIsSplashOpen(false)} onClearData={handleClearData} />
      )}

      {alertData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-xl max-w-sm w-full relative overflow-hidden animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-slate-100 mb-3 flex items-center gap-2">
              <span className="text-indigo-400"><MessageCircle size={24} /></span> {alertData.title}
            </h3>
            <p className="text-slate-300 text-sm mb-6 leading-relaxed">
              {alertData.message}
            </p>
            <div className="flex flex-col gap-2">
              {alertData.showInferenceBtn && (
                <button
                  onClick={() => {
                    setAlertData(null);
                    startChat();
                  }}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  <Sparkles size={16} /> AIによる出生時間の推時へ
                </button>
              )}
              {alertData.showCalibrationBtn && (
                <button
                  onClick={() => {
                    setAlertData(null);
                    setIsSystemChatOpen(true);
                  }}
                  className="w-full bg-emerald-600/80 hover:bg-emerald-500 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  <Sparkles size={16} /> 運勢のキャリブレーションへ
                </button>
              )}
              <button
                onClick={() => setAlertData(null)}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2 px-4 rounded-lg transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
