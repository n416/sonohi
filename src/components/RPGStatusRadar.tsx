import React, { useState } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Sparkles, Swords, HelpCircle, Heart, Flame, Target, Shield, Zap } from 'lucide-react';

import { 
  type GogyoScore, 
  type TimeBuff, 
  type StatKey, 
  statsKeys, 
  calculateRPGStats 
} from '../utils/rpgEngine';
import { StatusHelpModal } from './StatusHelpModal';

export type { GogyoScore, TimeBuff, StatKey };

type Props = {
  scores: GogyoScore;
  nikkanGogyo: string; // '木' | '火' | '土' | '金' | '水'
  primaryData: {
    date?: Date;
    timeBuffs: TimeBuff[];
  };
  secondaryData?: {
    date?: Date;
    timeBuffs: TimeBuff[];
  };
  domainMax?: number;
};

export const RPGStatusRadar: React.FC<Props> = ({ scores, nikkanGogyo, primaryData, secondaryData, domainMax }) => {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const data1 = calculateRPGStats(scores, nikkanGogyo, primaryData.timeBuffs);
  const data2 = secondaryData ? calculateRPGStats(scores, nikkanGogyo, secondaryData.timeBuffs) : null;

  const isCompareMode = !!data2;

  const getStatIcon = (key: string, size = 12, className = "") => {
    switch (key) {
      case 'HP': return <Heart size={size} className={className || "text-rose-400"} />;
      case 'ATK': return <Flame size={size} className={className || "text-orange-400"} />;
      case 'DEX': return <Target size={size} className={className || "text-yellow-400"} />;
      case 'DEF': return <Shield size={size} className={className || "text-blue-400"} />;
      case 'MP': return <Zap size={size} className={className || "text-purple-400"} />;
      default: return null;
    }
  };

  const formatDate = (d?: Date) => d ? `${d.getMonth() + 1}/${d.getDate()}` : 'Date';
  const primaryName = isCompareMode ? formatDate(primaryData.date) : 'Current Stats';
  const secondaryName = isCompareMode ? formatDate(secondaryData?.date) : '';

  // チャートの縮尺（スケール）が日運によってブレないように最大値を固定する
  // チャートの縮尺（スケール）が日運によってブレないように最大値を固定する
  const currentMaxFallback = Math.max(
    ...data1.map(d => d.currentValue), 
    data2 ? Math.max(...data2.map(d => d.currentValue)) : 0
  );
  // 余裕を持たせず、そのままの最大値をドメインにする
  const chartDomainMax = domainMax !== undefined ? domainMax : Math.max(20, currentMaxFallback);

  // 結合した描画用データの生成
  const radarData = data1.map((d, i) => {
    const d2 = data2 ? data2[i] : null;
    return {
      subject: d.subject.split(' / ')[0], // ラベルを短くする
      fullSubject: d.subject,
      baseValueChart: Math.max(0, d.baseValue),
      primaryValueChart: Math.max(0, d.currentValue),
      secondaryValueChart: d2 ? Math.max(0, d2.currentValue) : undefined,
      baseValue: d.baseValue,
      primaryValue: d.currentValue,
      secondaryValue: d2 ? d2.currentValue : undefined,
      key: d.key
    };
  });

  const ticks = [
    chartDomainMax * 0.2,
    chartDomainMax * 0.4,
    chartDomainMax * 0.6,
    chartDomainMax * 0.8,
    chartDomainMax
  ];

  // 1日のみの場合の最大バフ計算
  let maxBuffStat = data1[0];
  let maxDiff = 0;
  if (!isCompareMode) {
    maxBuffStat = data1.reduce((max, stat) => {
      const diff = stat.currentValue - stat.baseValue;
      return diff > (max.currentValue - max.baseValue) ? stat : max;
    }, data1[0]);
    maxDiff = Math.round((maxBuffStat.currentValue - maxBuffStat.baseValue) * 10) / 10;
  }

  return (
    <div className="bg-slate-950/80 border border-slate-700/50 rounded-2xl p-2.5 md:p-4 shadow-2xl relative overflow-hidden">
      {/* ネオンエフェクトの背景装飾 */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/10 blur-[50px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-fuchsia-600/10 blur-[50px] rounded-full pointer-events-none"></div>

      <div className="flex flex-col md:flex-row items-center gap-3 md:gap-6 relative z-10">
        
        {/* レーダーチャート部分 */}
        <div className="w-full md:w-1/2 h-40 md:h-56 -ml-2 md:-ml-4">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
              <PolarGrid stroke="#334155" />
              <PolarAngleAxis 
                dataKey="subject" 
                tick={{ fill: '#cbd5e1', fontSize: 9, fontWeight: 'bold' }} 
              />
              <PolarRadiusAxis 
                angle={30} 
                domain={[0, chartDomainMax]} 
                ticks={ticks}
                tick={false} 
                axisLine={false} 
              />
              
              {!isCompareMode && (
                <Radar
                  name="Base Stats"
                  dataKey="baseValueChart"
                  stroke="#475569"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  fill="#475569"
                  fillOpacity={0.1}
                />
              )}
              
              <Radar
                name={primaryName}
                dataKey="primaryValueChart"
                stroke="#818cf8" // indigo-400
                strokeWidth={2}
                fill="url(#colorPrimary)"
                fillOpacity={0.5}
              />
              
              {isCompareMode && (
                <Radar
                  name={secondaryName}
                  dataKey="secondaryValueChart"
                  stroke="#f472b6" // pink-400
                  strokeWidth={2}
                  fill="url(#colorSecondary)"
                  fillOpacity={0.5}
                />
              )}

              <defs>
                <linearGradient id="colorPrimary" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#818cf8" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#818cf8" stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="colorSecondary" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f472b6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#f472b6" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.5)' }}
                itemStyle={{ fontWeight: 'bold', fontSize: '10px' }}
                cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
              />
              {isCompareMode && (
                <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingTop: '4px' }} />
              )}
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* ステータス変化リストビュー */}
        <div className="w-full md:w-1/2 flex flex-col space-y-2.5">
          <div className="border-b border-slate-700/50 pb-2 flex flex-col md:flex-row md:items-center justify-between gap-1.5">
            <h3 className="text-[10px] md:text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
              {isCompareMode ? (
                <><Swords size={12} className="text-amber-400" /> Status Compare</>
              ) : (
                <><Sparkles size={12} className="text-emerald-400" /> Today's Highlight</>
              )}
            </h3>
            {!isCompareMode && (
              maxDiff > 0 ? (
                <button onClick={() => setIsHelpOpen(true)} className="flex items-center gap-1.5 text-[9px] md:text-[10px] font-black text-white bg-gradient-to-r from-emerald-500/20 to-teal-500/20 px-2 py-0.5 rounded-md border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.15)] shrink-0 text-center hover:opacity-80 transition-opacity cursor-pointer">
                  <span className="flex items-center gap-1">
                    {getStatIcon(maxBuffStat.key, 12, "text-emerald-400")}
                    <span className="text-emerald-400">{maxBuffStat.subject.split(' / ')[0]}</span> 強化中
                  </span>
                  <HelpCircle size={10} className="text-emerald-300 opacity-70" />
                </button>
              ) : (
                <button onClick={() => setIsHelpOpen(true)} className="flex items-center gap-1 text-[9px] md:text-[10px] font-black text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700 shrink-0 text-center hover:bg-slate-700 transition-colors cursor-pointer">
                  <span>穏やかな運勢</span>
                  <HelpCircle size={10} className="text-slate-500" />
                </button>
              )
            )}
            {isCompareMode && (
              <button onClick={() => setIsHelpOpen(true)} className="flex items-center gap-1 text-[9px] font-bold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer">
                <HelpCircle size={10} /> 解説
              </button>
            )}
          </div>
          
          <div className="space-y-1.5">
            {radarData.map((stat, i) => {
              const baseValStr = (Math.round(stat.baseValue * 10) / 10).toString();
              const primaryValStr = (Math.round(stat.primaryValue * 10) / 10).toString();
              const secondaryValStr = stat.secondaryValue !== undefined ? (Math.round(stat.secondaryValue * 10) / 10).toString() : '';
              
              if (isCompareMode && stat.secondaryValue !== undefined) {
                // 比較モードのUI
                const diff = Math.round((stat.secondaryValue - stat.primaryValue) * 10) / 10;
                const isSecBetter = diff > 0;
                const isPriBetter = diff < 0;
                
                const priPercentage = Math.min(100, Math.max(0, (stat.primaryValue / chartDomainMax) * 100));
                const secPercentage = Math.min(100, Math.max(0, (stat.secondaryValue / chartDomainMax) * 100));

                return (
                  <div key={i} className="group flex flex-col p-1.5 md:p-2 rounded-lg border bg-slate-900/50 backdrop-blur-sm transition-all hover:bg-slate-800/80 border-slate-700/50">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 w-14 md:w-16 shrink-0">
                          {getStatIcon(stat.key)}
                          <span className="text-[9px] md:text-[10px] font-black text-slate-300 tracking-wider">{stat.subject}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[9px] md:text-[10px] font-bold">
                          <span className={isPriBetter ? 'text-indigo-400' : 'text-slate-400'}>{primaryValStr}</span>
                          <span className="text-slate-600 text-[8px] font-normal">vs</span>
                          <span className={isSecBetter ? 'text-pink-400' : 'text-slate-400'}>{secondaryValStr}</span>
                        </div>
                      </div>
                      <div className="text-[10px] md:text-xs font-black shrink-0">
                        {isSecBetter ? <span className="text-pink-400">+{diff}</span> : isPriBetter ? <span className="text-indigo-400">+{Math.abs(diff)}</span> : <span className="text-slate-500">±0</span>}
                      </div>
                    </div>
                    {/* ダブルプログレスバー */}
                    <div className="w-full space-y-0.5">
                      <div className="w-full h-0.5 bg-slate-950 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" style={{ width: `${priPercentage}%` }}></div>
                      </div>
                      <div className="w-full h-0.5 bg-slate-950 rounded-full overflow-hidden">
                        <div className="h-full bg-pink-500 shadow-[0_0_8px_rgba(244,114,182,0.5)]" style={{ width: `${secPercentage}%` }}></div>
                      </div>
                    </div>
                  </div>
                );
              } else {
                // 単体表示モードのUI
                const diff = Math.round((stat.primaryValue - stat.baseValue) * 10) / 10;
                const isBuffed = diff > 0;
                const isDebuffed = diff < 0;

                const fillPercentage = Math.min(100, Math.max(0, (stat.primaryValue / chartDomainMax) * 100));
                const basePercentage = Math.min(100, Math.max(0, (stat.baseValue / chartDomainMax) * 100));

                return (
                  <div key={i} className={`group flex flex-col p-1.5 md:p-2 rounded-lg border bg-slate-900/50 backdrop-blur-sm transition-all hover:bg-slate-800/80 ${isBuffed ? 'border-emerald-500/30' : isDebuffed ? 'border-rose-500/30' : 'border-slate-700/50'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 w-14 md:w-16 shrink-0">
                          {getStatIcon(stat.key)}
                          <span className="text-[9px] md:text-[10px] font-black text-slate-300 tracking-wider">{stat.subject}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[9px] font-medium">
                          <span className="text-slate-500 line-through">{baseValStr}</span>
                          <span className="text-slate-600">→</span>
                          <span className="text-slate-200">{primaryValStr} <span className="opacity-50 text-[8px]">pts</span></span>
                        </div>
                      </div>
                      <div className={`text-[10px] md:text-xs font-black shrink-0 ${isBuffed ? 'text-emerald-400' : isDebuffed ? 'text-rose-400' : 'text-slate-500'}`}>
                        {diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : '±0'}
                      </div>
                    </div>
                    {/* シングルプログレスバー */}
                    <div className="w-full h-1 bg-slate-950 rounded-full overflow-hidden relative">
                      <div className="absolute top-0 left-0 h-full bg-slate-600" style={{ width: `${basePercentage}%` }}></div>
                      {isBuffed && (
                        <div className="absolute top-0 h-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" style={{ left: `${basePercentage}%`, width: `${fillPercentage - basePercentage}%` }}></div>
                      )}
                      {isDebuffed && (
                        <div className="absolute top-0 h-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]" style={{ left: `${fillPercentage}%`, width: `${basePercentage - fillPercentage}%` }}></div>
                      )}
                    </div>
                  </div>
                );
              }
            })}
          </div>
        </div>

      </div>

      {/* アクティブ・バフリスト */}
      {!isCompareMode && primaryData.timeBuffs.length > 0 && (
        <div className="mt-3 border-t border-slate-700/50 pt-2.5 z-10 relative">
          <h4 className="text-[10px] font-bold text-indigo-400 mb-2 flex items-center gap-1.5 uppercase tracking-widest">
            <Sparkles size={10} /> Active Buffs
          </h4>
          <div className="flex flex-col gap-1.5">
            {primaryData.timeBuffs.map((buff, i) => (
              <div key={i} className="flex items-center justify-between bg-slate-800/40 border border-slate-700/80 rounded-lg p-1.5 px-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-16 text-[8px] text-slate-400 font-bold uppercase">{buff.layer}</div>
                  <div className="text-[10px] font-black text-slate-200">{buff.name}</div>
                </div>
                <div className="flex items-center gap-1 flex-wrap justify-end">
                  {statsKeys.map(key => {
                    if (buff.effect[key] !== 0) {
                      const isPos = buff.effect[key] > 0;
                      return (
                        <span key={key} className={`flex items-center gap-0.5 text-[8px] px-1 py-0.5 rounded font-bold border ${isPos ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'}`}>
                          {getStatIcon(key, 8, isPos ? "text-emerald-400" : "text-rose-400")}
                          <span>{key}{isPos ? '+' : ''}{buff.effect[key]}</span>
                        </span>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ステータス解説モーダル */}
      <StatusHelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
};
