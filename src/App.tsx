import { useState, useEffect, useRef, useMemo } from 'react';
import { Settings, MessageCircle, Sparkles, Key, CheckCircle2, Circle, AlertCircle, RefreshCw, Send, X, ChevronDown, ChevronUp } from 'lucide-react';
import { DiagnosisReport } from './components/DiagnosisReport';
import { RPGStatusRadar, type TimeBuff, calculateRPGStats } from './components/RPGStatusRadar';
import { FortuneCalendar, getDailyBuffForDate } from './components/FortuneCalendar';
import { generateDiagnosis } from './components/DiagnosisReport';
import { StickyMiniStatus } from './components/StickyMiniStatus';

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

const SuijiChat = ({ apiKey, onComplete, onCancel }: { apiKey: string, onComplete: (time: string) => void, onCancel: () => void }) => {
  const [messages, setMessages] = useState<{role: string, content: string}[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([{ 
      role: "assistant", 
      content: "生まれた時間が不明とのことですね。\nあなたの過去の転機（大病、転職、結婚、大きな事故など）が起きた年齢や時期について、いくつか教えていただけますか？そこから時間を推測します。" 
    }]);
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    
    const newMessages = [...messages, { role: "user", content: input }];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const systemPrompt = `あなたは四柱推命の推時専門家です。ユーザーの過去の転機（大病や転職など）をヒアリングし、12パターンの時間（子, 丑, 寅, 卯, 辰, 巳, 午, 未, 申, 酉, 戌, 亥）から最も合致する時間を特定してください。確信を持てたら、会話の最後に必ず {"determined_shi": "午"} のようなJSON形式のみを出力して終了してください。JSON以外の文字列は絶対に含めないでください。`;
      
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "gpt-4o-mini", // プロトタイプ用軽量モデル
          messages: [
            { role: "system", content: systemPrompt },
            ...newMessages.map(m => ({ role: m.role, content: m.content }))
          ]
        })
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      
      const reply = data.choices[0].message.content;
      
      const jsonMatch = reply.match(/\{[\s\S]*"determined_shi"\s*:\s*"([^"]+)"[\s\S]*\}/);
      if (jsonMatch) {
        onComplete(jsonMatch[1]);
      } else {
        setMessages([...newMessages, { role: "assistant", content: reply }]);
      }
    } catch (e: any) {
      setMessages([...newMessages, { role: "assistant", content: `APIエラーが発生しました: ${e.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden h-[80vh]">
        <div className="bg-slate-800 p-4 border-b border-slate-700 flex justify-between items-center">
          <div className="flex items-center gap-2 text-indigo-400">
            <MessageCircle size={20} />
            <h3 className="font-bold">AI推時チャット（出生時間特定）</h3>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl p-4 whitespace-pre-wrap ${
                msg.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-tr-none' 
                  : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-800 text-slate-400 rounded-2xl rounded-tl-none p-4 border border-slate-700 flex items-center gap-2">
                <RefreshCw className="animate-spin" size={16} /> 考慮中...
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-800 border-t border-slate-700 flex gap-2">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="例：28歳の時に大きな病気をしました..."
            className="flex-1 bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500"
            disabled={isLoading}
          />
          <button 
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 rounded-xl flex items-center gap-2 transition-colors font-bold"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
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
  const [apiKey, setApiKey] = useState("");
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

  // リアクティブな自動計算
  useEffect(() => {
    const initial = calculateMeishiki(year, month, day, time);
    const finalResult = evaluateMeishiki(initial, activePatches);
    setResult(finalResult);
  }, [year, month, day, time, activePatches]);

  const baseData = useMemo(() => {
    if (!result) return null;
    const nikkanGogyo = getGogyoFromKan(result.kanchi.day.charAt(0));
    const baseStats = calculateRPGStats(result.gogyoScore, nikkanGogyo, []);
    const baseDiagnosis = generateDiagnosis(baseStats, false);
    return { nikkanGogyo, baseStats, baseDiagnosisType: baseDiagnosis.type };
  }, [result]);

  const finalStatsData = useMemo(() => {
    if (!result || !baseData) return null;
    const dailyBuffEffect = getDailyBuffForDate(selectedDate);
    const currentTimeBuffs: TimeBuff[] = [
      { layer: "大運 (10年)", name: "炎のフィールド", effect: { HP: 15, ATK: 5, DEX: 0, DEF: 0, MP: 0 } },
      { layer: "年運 (1年)", name: "知識の雨", effect: { HP: 0, ATK: 0, DEX: 0, DEF: 0, MP: 10 } },
      { layer: "月運 (1ヶ月)", name: "プレッシャー", effect: { HP: 0, ATK: 0, DEX: 0, DEF: 5, MP: 0 } },
      { layer: "日運 (選択日)", name: "タイムトラベル中", effect: dailyBuffEffect }
    ];
    const finalStats = calculateRPGStats(result.gogyoScore, baseData.nikkanGogyo, currentTimeBuffs);
    const finalDiagnosis = generateDiagnosis(finalStats, true);
    return { finalStats, finalDiagnosis, currentTimeBuffs };
  }, [result, baseData, selectedDate]);

  const startChat = () => {
    if (!apiKey) {
      console.log("時間が「不明」の場合、推時のためにOpenAI APIキーが必要です。");
      return;
    }
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
                <Key size={18} className="text-indigo-400" />
                OpenAI API設定
              </h2>
              <input 
                type="password" 
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
              />
              <p className="text-xs text-slate-500 mt-2 flex items-start gap-1">
                <AlertCircle size={14} className="shrink-0" />
                推時（時間特定）チャットを利用する場合のみ必要です。計算自体はローカルで行われます。
              </p>
            </div>

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
                baseStatsData={baseData.baseStats}
                baseDiagnosisType={baseData.baseDiagnosisType}
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
        <SuijiChat 
          apiKey={apiKey} 
          onComplete={(determinedTime) => {
            setIsChatMode(false);
            setTime(determinedTime);
          }}
          onCancel={() => setIsChatMode(false)}
        />
      )}
    </div>
  );
}
