import { useState, useEffect, useMemo } from 'react';
import { Settings, MessageCircle, Sparkles, CheckCircle2, Circle, ChevronDown, ChevronUp } from 'lucide-react';
import { DiagnosisReport } from './components/DiagnosisReport';
import { RPGStatusRadar } from './components/RPGStatusRadar';
import { FortuneCalendar } from './components/FortuneCalendar';
import { calculateRPGStats, getDailyBuffForDate, generateDiagnosis, type TimeBuff } from './utils/rpgEngine';
import { StickyMiniStatus } from './components/StickyMiniStatus';
import { AITimeInferenceChat } from './components/AITimeInferenceChat';

import { calculateMeishiki, type Meishiki, type GogyoScore } from './utils/meishiki';

// ==========================================
// 1. コア演算エンジン（パッチ処理ロジック）
// ==========================================

type Patch = {
  id: string;
  name: string;
  description: string;
  apply: (m: Meishiki) => Meishiki;
};

// ダミー計算関数は ./utils/meishiki.ts の calculateMeishiki に移行しました。

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
  }
};

const evaluateMeishiki = (base: Meishiki, activePatchIds: string[]): Meishiki => {
  return activePatchIds.reduce((currentMeishiki, patchId) => {
    const patch = PATCH_REGISTRY[patchId];
    return patch ? patch.apply(currentMeishiki) : currentMeishiki;
  }, base);
};

// 運勢マトリョーシカ（多重バフ）ダミーデータの生成処理はコンポーネント内に移動しました。

// ==========================================
// 2. LLM推時チャット（時間逆算インターフェース）
// ==========================================

// AI推時チャットの実装は './components/AITimeInferenceChat' に分離しました。

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
  const [year, setYear] = useState(1990);
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState(1);
  const [time, setTime] = useState("不明");
  const [activePatches, setActivePatches] = useState<string[]>([]);
  const [result, setResult] = useState<Meishiki | null>(null);
  const [isChatMode, setIsChatMode] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const junishiList = ["不明", "子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

  const togglePatch = (id: string) => {
    setActivePatches(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  // 日付の範囲を安全にクランプする
  const safeYear = Math.max(1900, Math.min(2100, year || 1990));
  const safeMonth = Math.max(1, Math.min(12, month || 1));
  const safeDay = Math.max(1, Math.min(31, day || 1));

  // リアクティブな自動計算
  useEffect(() => {
    try {
      const initial = calculateMeishiki(safeYear, safeMonth, safeDay, time);
      const finalResult = evaluateMeishiki(initial, activePatches);
      setResult(finalResult);
    } catch (error) {
      console.error('命式の計算エラー:', error);
      // カレンダーエンジンの範囲外エラー（111月など）が起きた場合は無視する
    }
  }, [safeYear, safeMonth, safeDay, time, activePatches]);

  const baseData = useMemo(() => {
    if (!result) return null;
    const nikkanGogyo = getGogyoFromKan(result.kanchi.day.charAt(0));
    const baseStats = calculateRPGStats(result.gogyoScore, nikkanGogyo, []);
    const baseDiagnosis = generateDiagnosis(baseStats, false);
    
    // 現在のベース（大運＋年運＋月運まで適用した状態）
    const baseTimeBuffs: TimeBuff[] = [
      { layer: "大運 (10年)", name: "炎のフィールド", effect: { HP: 15, ATK: 5, DEX: 0, DEF: 0, MP: 0 } },
      { layer: "年運 (1年)", name: "知識の雨", effect: { HP: 0, ATK: 0, DEX: 0, DEF: 0, MP: 10 } },
      { layer: "月運 (1ヶ月)", name: "プレッシャー", effect: { HP: 0, ATK: 0, DEX: 0, DEF: 5, MP: 0 } }
    ];
    
    const currentBaseStats = calculateRPGStats(result.gogyoScore, nikkanGogyo, baseTimeBuffs);
    const currentBaseDiagnosis = generateDiagnosis(currentBaseStats, true);

    return { 
      nikkanGogyo, 
      baseStats, 
      baseDiagnosisType: baseDiagnosis.type,
      currentBaseStats,
      currentBaseDiagnosisType: currentBaseDiagnosis.type,
      baseTimeBuffs
    };
  }, [result]);

  const finalStatsData = useMemo(() => {
    if (!result || !baseData) return null;
    const dailyBuffEffect = getDailyBuffForDate(selectedDate);
    const currentTimeBuffs: TimeBuff[] = [
      ...baseData.baseTimeBuffs,
      { layer: "日運 (選択日)", name: "タイムトラベル中", effect: dailyBuffEffect }
    ];
    const finalStats = calculateRPGStats(result.gogyoScore, baseData.nikkanGogyo, currentTimeBuffs);
    const finalDiagnosis = generateDiagnosis(finalStats, true);
    return { finalStats, finalDiagnosis, currentTimeBuffs };
  }, [result, baseData, selectedDate]);

  const startChat = () => {
    setIsChatMode(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans selection:bg-indigo-500/30">
      {finalStatsData && (
        <StickyMiniStatus 
          finalStats={finalStatsData.finalStats}
          diagnosisTitle={finalStatsData.finalDiagnosis.title}
          selectedDate={selectedDate}
        />
      )}
      <div className="max-w-5xl mx-auto p-6 lg:p-12 pt-8">
        <header className="mb-12 text-center space-y-4">
          <div className="inline-flex items-center justify-center p-3 bg-indigo-500/10 rounded-2xl text-indigo-400 mb-2">
            <Sparkles size={32} />
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">四柱推命 <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">パッチ駆動エンジン</span></h1>
          <p className="text-slate-400 max-w-2xl mx-auto">
            流派による計算ルールの違いをプラグイン（パッチ）としてON/OFFできるローカル演算エンジン。出生時間不明時はAIがヒアリングで特定します。
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-xl">
              <h2 className="flex items-center gap-2 text-white font-bold mb-4">
                <Settings size={18} className="text-purple-400" />
                基本データ
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">年</label>
                  <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-4 py-2" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">月</label>
                  <input type="number" value={month} onChange={e => setMonth(Number(e.target.value))} min={1} max={12} className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-4 py-2" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">日</label>
                  <input type="number" value={day} onChange={e => setDay(Number(e.target.value))} min={1} max={31} className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-4 py-2" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">時間（時支）</label>
                  <select value={time} onChange={e => setTime(e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-4 py-2 appearance-none">
                    {junishiList.map(j => <option key={j} value={j}>{j}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-xl">
              <h2 className="flex items-center gap-2 text-white font-bold mb-4">
                <Sparkles size={18} className="text-pink-400" />
                適用パッチ（ローカルルール）
              </h2>
              <div className="space-y-3">
                {Object.values(PATCH_REGISTRY).map(patch => {
                  const isActive = activePatches.includes(patch.id);
                  return (
                    <button 
                      key={patch.id}
                      onClick={() => togglePatch(patch.id)}
                      className={`w-full text-left flex items-start gap-3 p-4 rounded-2xl border transition-all ${
                        isActive 
                          ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-100' 
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <div className="mt-0.5">
                        {isActive ? <CheckCircle2 size={20} className="text-indigo-400" /> : <Circle size={20} />}
                      </div>
                      <div>
                        <div className="font-bold text-sm mb-1">{patch.name}</div>
                        <div className="text-xs opacity-70">{patch.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {result && baseData && (
              <FortuneCalendar 
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                baseDiagnosisType={baseData.currentBaseDiagnosisType}
              />
            )}
          </div>

          <div className="lg:col-span-7">
            {result ? (
              <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 shadow-2xl overflow-hidden relative">
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/10 blur-3xl rounded-full pointer-events-none"></div>
                
                <h2 className="text-2xl font-bold text-white mb-8 border-b border-slate-800 pb-4">鑑定結果</h2>
                
                {time === "不明" && (
                  <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-2xl p-6 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-indigo-400 font-bold mb-1">
                        <MessageCircle size={18} />
                        出生時間が不明です
                      </div>
                      <p className="text-sm text-slate-400">
                        時間が不明なため、時柱のデータが欠落しています。過去の出来事からAIが推時（時間を特定）できます。
                      </p>
                    </div>
                    <button 
                      onClick={startChat}
                      className="shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl px-6 py-3 flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                    >
                      <Sparkles size={16} />
                      AI推時チャット
                    </button>
                  </div>
                )}
                
                <div className="mb-8">
                  {(() => {
                    if (!baseData || !finalStatsData) return null;
                    const { nikkanGogyo } = baseData;
                    const { currentTimeBuffs } = finalStatsData;

                    return (
                      <>
                        <RPGStatusRadar 
                          scores={result.gogyoScore} 
                          nikkanGogyo={nikkanGogyo} 
                          nikkanKan={result.kanchi.day.charAt(0)} 
                          timeBuffs={currentTimeBuffs}
                        />
                        <DiagnosisReport 
                          scores={result.gogyoScore} 
                          nikkanGogyo={nikkanGogyo} 
                          timeBuffs={currentTimeBuffs}
                        />
                      </>
                    );
                  })()}
                </div>

                <div className="bg-slate-900/50 border border-slate-700/50 rounded-2xl overflow-hidden mt-8">
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
                    <div className="p-6 border-t border-slate-700/50 space-y-8">
                      <div>
                        <h3 className="text-sm font-bold text-slate-400 mb-4">命式（柱）</h3>
                        <div className="grid grid-cols-4 gap-4">
                          {['year', 'month', 'day', 'time'].map((type, idx) => {
                            const labels = ['年柱', '月柱', '日柱', '時柱'];
                            return (
                              <div key={type} className="text-center">
                                <div className="text-slate-500 text-xs font-bold mb-2">{labels[idx]}</div>
                                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-2xl font-extrabold text-white shadow-inner">
                                  {result.kanchi[type as keyof typeof result.kanchi]}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <h3 className="text-sm font-bold text-slate-400 mb-4">五行スコア (演算エンジン出力)</h3>
                        <div className="grid grid-cols-5 gap-2">
                          {[
                            { key: 'wood', label: '木', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
                            { key: 'fire', label: '火', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
                            { key: 'earth', label: '土', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
                            { key: 'metal', label: '金', color: 'bg-slate-200/20 text-slate-300 border-slate-300/30' },
                            { key: 'water', label: '水', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' }
                          ].map(g => (
                            <div key={g.key} className={`border rounded-xl p-3 text-center ${g.color}`}>
                              <div className="text-xs mb-1">{g.label}</div>
                              <div className="font-bold text-lg">{result.gogyoScore[g.key as keyof GogyoScore]}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h3 className="text-sm font-bold text-slate-400 mb-3">演算プロセスログ</h3>
                        <div className="bg-black/40 rounded-xl p-4 font-mono text-xs text-slate-400 space-y-2 max-h-40 overflow-y-auto border border-slate-800">
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
              <div className="h-full bg-slate-900/30 border border-slate-800/50 border-dashed rounded-3xl flex flex-col items-center justify-center p-12 text-slate-500">
                {/* データ入力待機状態（現在初期値が入っているため基本表示されません） */}
                <div className="text-center">
                  <Settings size={48} className="mx-auto mb-4 opacity-20" />
                  <p>データを入力すると<br/>自動的に鑑定結果が表示されます。</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {isChatMode && (
        <AITimeInferenceChat 
          birthYear={safeYear}
          birthMonth={safeMonth}
          birthDay={safeDay}
          onComplete={(inferredTime) => {
            setTime(inferredTime);
            setIsChatMode(false);
          }} 
          onCancel={() => setIsChatMode(false)} 
        />
      )}
    </div>
  );
}
