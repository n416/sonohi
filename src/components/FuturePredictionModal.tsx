import { useEffect, useState } from 'react';
import { X, Calendar, Sparkles, Zap, Shield, Heart, Target, Brain, Crown, Clock, User, Users, CalendarPlus } from 'lucide-react';
import { calculateFutureEvents, type FuturePrediction } from '../utils/futureEngine';
import { type StatKey } from './RPGStatusRadar';

import { type GogyoScore } from '../utils/meishiki';

interface FuturePredictionModalProps {
  baseScore: GogyoScore;
  nikkanGogyo: string;
  gender?: 'male' | 'female' | 'other';
  onGenderChange?: (gender: 'male' | 'female' | 'other') => void;
  showRomance?: boolean;
  onToggleRomance?: () => void;
  onClose: () => void;
}

type TabType = StatKey | 'ROMANCE';
type PeriodType = 'short' | 'mid' | 'long';

const PERIODS: Record<PeriodType, { label: string; days: number }> = {
  short: { label: '短期 (60日)', days: 60 },
  mid: { label: '中期 (1年)', days: 365 },
  long: { label: '長期 (10年)', days: 3650 }
};

export const FuturePredictionModal = ({ baseScore, nikkanGogyo, gender, onGenderChange, showRomance = true, onToggleRomance, onClose }: FuturePredictionModalProps) => {
  const [prediction, setPrediction] = useState<FuturePrediction | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('DEX');
  const [period, setPeriod] = useState<PeriodType>('mid');
  const [isCalculating, setIsCalculating] = useState(true);

  useEffect(() => {
    setIsCalculating(true);
    // UIをブロックしないように非同期で実行
    const timer = setTimeout(() => {
      const res = calculateFutureEvents(baseScore, nikkanGogyo, PERIODS[period].days);
      setPrediction(res);
      setIsCalculating(false);
    }, 100);
    return () => clearTimeout(timer);
  }, [baseScore, nikkanGogyo, period]);

  useEffect(() => {
    if (!showRomance && activeTab === 'ROMANCE') {
      setActiveTab('DEX');
    }
  }, [showRomance, activeTab]);

  const allTabs: { key: TabType; icon: React.ReactNode; label: string; color: string; desc: string; advice: string }[] = [
    { 
      key: 'ROMANCE', 
      icon: (!gender || gender === 'other') ? <Users size={16} /> : <Heart size={16} />, 
      label: (!gender || gender === 'other') ? '交際・人脈' : '恋愛・結婚運', 
      color: (!gender || gender === 'other') ? 'text-purple-300 border-purple-400/50 bg-purple-400/10' : 'text-pink-400 border-pink-500/50 bg-pink-500/10',
      desc: gender === 'male' ? '財星（妻・恋人）。運命的な出会いや関係の進展が期待できる特異点です！' 
          : gender === 'female' ? '官星（夫・恋人）。素晴らしい出会いや結婚への進展が期待できる最高の日です！' 
          : '食傷生財。自己アピール力と人脈・交際運が同時に高まる最高の日です！',
      advice: (!gender || gender === 'other')
            ? 'あなたの魅力が自然と伝わり、良い縁が繋がりやすい日です。積極的に人と関わってみましょう！'
            : 'パートナー探し、告白、プロポーズ、あるいは大切な人との特別な時間を過ごすのに最も適した「大吉日」です！'
    },
    { 
      key: 'DEX', 
      icon: <Target size={16} />, 
      label: '財運・勝負', 
      color: 'text-amber-400 border-amber-500/50 bg-amber-500/10',
      desc: '器用さ・財星。お金やコントロール力が極大化する日です。',
      advice: '宝くじの購入や競馬などの勝負事、あるいは大きな買い物や投資を決断するのに最も適した「限界突破」のタイミングです！'
    },
    { 
      key: 'ATK', 
      icon: <Zap size={16} />, 
      label: '攻撃・表現', 
      color: 'text-rose-400 border-rose-500/50 bg-rose-500/10',
      desc: '攻撃力・食傷。表現力や直感が冴え渡る日です。',
      advice: '仕事での大きなプレゼン、あるいは新しいプロジェクトを立ち上げるなど人生の「大勝負」を仕掛けるべき日です！'
    },
    { 
      key: 'HP', 
      icon: <User size={16} />, 
      label: '独立・自己主張', 
      color: 'text-emerald-400 border-emerald-500/50 bg-emerald-500/10',
      desc: '体力・比劫。自我が強まり、独立心が限界突破する日です。',
      advice: '一人で何かに没頭したり、フリーランスとしての活動を広げたり、周りに流されず自分の意志を貫くのに最適な日です！'
    },
    { 
      key: 'DEF', 
      icon: <Shield size={16} />, 
      label: '防御・忍耐', 
      color: 'text-cyan-400 border-cyan-500/50 bg-cyan-500/10',
      desc: '防御力・官殺。プレッシャーが高まる試練と防衛戦の日です。',
      advice: 'あえて目立った行動は避け、ルーチンワークやルールの整備、自己防衛に徹することで、強力なデバフをやり過ごせます。'
    },
    { 
      key: 'MP', 
      icon: <Brain size={16} />, 
      label: '知識・学習', 
      color: 'text-purple-400 border-purple-500/50 bg-purple-500/10',
      desc: '魔力・印星。吸収力と学習能力が極大化する日です。',
      advice: '難解な専門書を読んだり、資格勉強を一気に進めたり、目上の人から貴重な教えを請うのに最高のタイミングです！'
    }
  ];

  const tabs = allTabs.filter(t => showRomance || t.key !== 'ROMANCE');
  const currentTabInfo = tabs.find(t => t.key === activeTab) || tabs[0];
  const actualStatKey = activeTab === 'ROMANCE' 
    ? (gender === 'male' ? 'DEX' : gender === 'female' ? 'DEF' : 'ATK_DEX') 
    : (activeTab as StatKey | 'ATK_DEX');

  const getGoogleCalendarDate = (timestamp: number, addDays = 0) => {
    const d = new Date(timestamp);
    d.setDate(d.getDate() + addDays);
    return `${d.getFullYear()}${(d.getMonth() + 1).toString().padStart(2, '0')}${d.getDate().toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-slate-900 border border-indigo-500/30 w-full max-w-3xl rounded-2xl shadow-[0_0_40px_rgba(79,70,229,0.15)] flex flex-col overflow-hidden relative max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-700/50 bg-slate-800/50 shrink-0 flex flex-col gap-3">
          
          {/* 上段：タイトルと閉じるボタン */}
          <div className="flex justify-between items-center w-full">
            <div className="flex items-center gap-2 text-indigo-400">
              <Sparkles size={20} className="animate-pulse" />
              <h3 className="font-bold tracking-widest text-sm md:text-base">AI未来予測システム</h3>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* 下段：コントロール群 */}
          <div className="flex flex-wrap items-center gap-3">
            {/* 期間切り替えセグメント */}
            <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
              {(Object.keys(PERIODS) as PeriodType[]).map(pKey => (
                <button
                  key={pKey}
                  onClick={() => setPeriod(pKey)}
                  className={`px-3 py-1 text-xs font-bold rounded-md flex items-center gap-1 transition-all whitespace-nowrap ${
                    period === pKey
                      ? 'bg-indigo-500/20 text-indigo-300 shadow-[0_0_10px_rgba(99,102,241,0.2)]'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Clock size={12} />
                  {PERIODS[pKey].label}
                </button>
              ))}
            </div>

            {/* 恋愛運トグル */}
            {onToggleRomance && (
              <div className="flex items-center gap-2 sm:ml-auto">
                <button
                  onClick={onToggleRomance}
                  className={`px-3 py-1 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all border whitespace-nowrap ${
                    showRomance 
                      ? (!gender || gender === 'other')
                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-[0_0_10px_rgba(168,85,247,0.2)]'
                        : 'bg-pink-500/20 text-pink-300 border-pink-500/50 shadow-[0_0_10px_rgba(236,72,153,0.2)]'
                      : 'bg-slate-900 text-slate-500 border-slate-700 hover:text-slate-300'
                  }`}
                  title="表示を切り替えます"
                >
                  {(!gender || gender === 'other') ? (
                    <Users size={14} className={!showRomance ? "opacity-50" : ""} />
                  ) : (
                    <Heart size={14} className={!showRomance ? "opacity-50" : ""} />
                  )}
                  <span>
                    {(!gender || gender === 'other') ? '交際' : '恋愛'}
                  </span>
                </button>

                {showRomance && onGenderChange && (
                  <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
                    <button
                      onClick={() => onGenderChange('male')}
                      className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all whitespace-nowrap ${
                        gender === 'male' ? 'bg-indigo-500/20 text-indigo-300 shadow-[0_0_10px_rgba(99,102,241,0.2)]' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      男性用
                    </button>
                    <button
                      onClick={() => onGenderChange('female')}
                      className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all whitespace-nowrap ${
                        gender === 'female' ? 'bg-pink-500/20 text-pink-300 shadow-[0_0_10px_rgba(236,72,153,0.2)]' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      女性用
                    </button>
                    <button
                      onClick={() => onGenderChange('other')}
                      className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all whitespace-nowrap ${
                        gender === 'other' || !gender ? 'bg-purple-500/20 text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.2)]' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      他
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col h-full overflow-hidden">
          {/* Tabs */}
          <div className="flex flex-wrap shrink-0 border-b border-slate-700/50 bg-slate-900/50 p-2 gap-2">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex flex-auto justify-center items-center gap-2 px-3 py-2 rounded-lg font-bold text-xs md:text-sm whitespace-nowrap transition-all ${
                  activeTab === tab.key 
                    ? `${tab.color} border shadow-[0_0_15px_rgba(255,255,255,0.1)]` 
                    : 'text-slate-400 border border-transparent hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-4 md:p-6 overflow-y-auto custom-scrollbar flex-1 relative">
            {isCalculating || !prediction ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                <p className="text-slate-400 text-sm animate-pulse">
                  未来 {PERIODS[period].days}日間のタイムラインを走査中...
                </p>
              </div>
            ) : (
              <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                
                <div className="text-center space-y-2 mb-4">
                  <h2 className={`text-lg md:text-xl font-bold flex justify-center items-center gap-2 ${currentTabInfo.color.split(' ')[0]}`}>
                    {currentTabInfo.icon} {currentTabInfo.label} の特異点 TOP5
                  </h2>
                  <p className="text-xs md:text-sm text-slate-400">{currentTabInfo.desc}</p>
                </div>

                <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-3 md:p-4 mb-4">
                  <h4 className="text-indigo-400 font-bold text-xs md:text-sm mb-1.5 flex items-center gap-2">
                    <Sparkles size={14} /> AIからの実践アドバイス
                  </h4>
                  <p className="text-slate-300 text-xs md:text-sm leading-relaxed">
                    {currentTabInfo.advice}
                  </p>
                </div>

                <div className="space-y-3">
                  {prediction[actualStatKey].topEvents.map((event, index) => {
                    const isFirst = index === 0;
                    return (
                      <div 
                        key={`${event.timestamp}-${index}`} 
                        className={`relative p-3 md:p-4 rounded-xl border transition-all ${
                          isFirst 
                            ? `${currentTabInfo.color.split(' ')[1]} bg-slate-800/80 shadow-[0_0_20px_rgba(255,255,255,0.05)]` 
                            : 'border-slate-700/50 bg-slate-800/30'
                        }`}
                      >
                        {isFirst && (
                          <div className={`absolute -top-2.5 left-4 px-2 py-0.5 text-[10px] font-bold flex items-center gap-1 rounded-full ${currentTabInfo.color}`}>
                            <Crown size={12} /> 第1位
                          </div>
                        )}
                        {!isFirst && (
                          <div className="absolute -top-2.5 left-4 bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-slate-400 flex items-center gap-1 border border-slate-700 rounded-full">
                            第{index + 1}位
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between gap-4 mt-1.5">
                          <div className="flex items-center gap-2">
                            <Calendar size={16} className={isFirst ? currentTabInfo.color.split(' ')[0] : 'text-slate-500'} />
                            <div className="text-lg md:text-xl font-bold text-slate-200 tracking-tight">
                              {event.dateStr}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3 md:gap-4">
                            <a
                              href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`【特異点】${currentTabInfo.label}`)}&dates=${getGoogleCalendarDate(event.timestamp)}/${getGoogleCalendarDate(event.timestamp, 1)}&details=${encodeURIComponent(currentTabInfo.desc + '\n変動スコア: +' + (event.diffValue > 0 ? event.diffValue : 0))}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`p-1.5 md:p-2 rounded-lg transition-colors border ${
                                isFirst ? 'border-slate-600/50 hover:bg-slate-700/50 text-slate-300' : 'border-slate-700/50 hover:bg-slate-700/50 text-slate-400'
                              }`}
                              title="Googleカレンダーに登録"
                            >
                              <CalendarPlus size={16} />
                            </a>

                            <div className="text-right">
                              <div className="text-[9px] text-slate-500 font-bold mb-0.5">変動スコア</div>
                              <div className={`text-base md:text-lg font-bold ${currentTabInfo.color.split(' ')[0]}`}>
                                +{event.diffValue > 0 ? event.diffValue : 0}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {prediction[actualStatKey].topEvents.length === 0 && (
                    <div className="text-center py-10 text-slate-500">
                      指定期間内に、この属性が大きく上昇する特異点は見つかりませんでした。
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
