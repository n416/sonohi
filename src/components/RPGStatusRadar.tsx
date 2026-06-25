import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Sparkles } from 'lucide-react';

export type GogyoScore = { wood: number; fire: number; earth: number; metal: number; water: number };

export type TimeBuff = {
  layer: string;
  name: string;
  effect: Record<StatKey, number>;
};

type Props = {
  scores: GogyoScore;
  nikkanGogyo: string; // '木' | '火' | '土' | '金' | '水'
  nikkanKan: string;
  timeBuffs?: TimeBuff[];
};

const gogyoArray = ['木', '火', '土', '金', '水'];

const classNames: Record<string, string> = {
  '木': '森の賢者',
  '火': '炎の魔術師',
  '土': '大地の守護者',
  '金': '鋼の剣士',
  '水': '氷の導き手'
};

const statsLabels = [
  'HP / 基本体力 (比劫)',
  'ATK / 攻撃力 (食傷)',
  'DEX / 獲得力 (財星)',
  'DEF / 耐久力 (官殺)',
  'MP / 魔力 (印星)'
];

export const statsKeys = ['HP', 'ATK', 'DEX', 'DEF', 'MP'] as const;
export type StatKey = typeof statsKeys[number];

export const calculateRPGStats = (scores: GogyoScore, nikkanGogyo: string, buffs: TimeBuff[] = []) => {
  const baseIndex = gogyoArray.indexOf(nikkanGogyo);
  const scoreArray = [scores.wood, scores.fire, scores.earth, scores.metal, scores.water];
  
  const data = statsLabels.map((label, idx) => {
    // baseIndexから順に時計回りで属性を割り当てる
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

export const RPGStatusRadar: React.FC<Props> = ({ scores, nikkanGogyo, nikkanKan, timeBuffs = [] }) => {
  const data = calculateRPGStats(scores, nikkanGogyo, timeBuffs);
  const className = classNames[nikkanGogyo] || '未知の冒険者';

  return (
    <div className="bg-slate-950/80 border border-slate-700/50 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
      {/* ネオンエフェクトの背景装飾 */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 blur-[100px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-fuchsia-600/10 blur-[100px] rounded-full pointer-events-none"></div>

      <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
        
        {/* レーダーチャート部分 */}
        <div className="w-full md:w-1/2 h-72 md:h-80 -ml-4">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="65%" data={data}>
              <PolarGrid stroke="#334155" />
              <PolarAngleAxis 
                dataKey="subject" 
                tick={{ fill: '#cbd5e1', fontSize: 11, fontWeight: 'bold' }} 
              />
              <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
              <Radar
                name="Base Stats"
                dataKey="baseValue"
                stroke="#475569"
                strokeWidth={2}
                strokeDasharray="3 3"
                fill="#475569"
                fillOpacity={0.1}
              />
              <Radar
                name="Current Stats"
                dataKey="currentValue"
                stroke="#8b5cf6"
                strokeWidth={3}
                fill="url(#colorUv)"
                fillOpacity={0.6}
              />
              <defs>
                <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#d946ef" stopOpacity={0.2}/>
                </linearGradient>
              </defs>
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)' }}
                itemStyle={{ color: '#c7d2fe', fontWeight: 'bold' }}
                cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* フレーバーテキスト部分 */}
        <div className="w-full md:w-1/2 text-center md:text-left space-y-5">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-fuchsia-500/10 to-indigo-500/10 text-fuchsia-400 text-[10px] font-black tracking-widest border border-fuchsia-500/20 mb-3 uppercase">
              Class Analysis
            </div>
            <h3 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-indigo-400 via-fuchsia-400 to-pink-400 leading-tight">
              あなたのクラスは<br/>
              【{className}（日干: {nikkanKan}）】です
            </h3>
          </div>
          
          <p className="text-xs md:text-sm text-slate-400 leading-relaxed font-medium">
            五行のバランスをRPGのステータスに変換しました。
            あなた自身の属性である「<span className="text-slate-200 font-bold">{nikkanGogyo}</span>」を基準（HP）とし、五行の相生・相剋の関係性から各パラメーターを算出しています。
          </p>
          
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3 mt-6">
            {data.map((stat, i) => {
              const diff = stat.currentValue - stat.baseValue;
              const isBuffed = diff > 0;
              return (
              <div key={i} className="bg-slate-900/80 backdrop-blur-md rounded-xl p-3 border border-slate-700/50 shadow-inner relative">
                <div className="text-[9px] md:text-[10px] text-slate-400 mb-1 font-bold truncate" title={stat.subject}>
                  {stat.subject}
                </div>
                <div className="text-lg md:text-xl font-black text-slate-200 flex items-baseline gap-1">
                  {stat.currentValue}
                  <span className="text-[10px] text-slate-500 font-medium">pts</span>
                </div>
                {isBuffed && (
                  <div className="absolute top-2 right-2 text-[10px] font-bold text-emerald-400">
                    +{diff}
                  </div>
                )}
              </div>
            )})}
          </div>
        </div>

      </div>

      {/* アクティブ・バフ（装備スロット） */}
      {timeBuffs && timeBuffs.length > 0 && (
        <div className="mt-8 border-t border-slate-700/50 pt-6 z-10 relative">
          <h4 className="text-sm font-bold text-indigo-400 mb-4 flex items-center gap-2 uppercase tracking-widest">
            <Sparkles size={16} /> Active Time Buffs
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {timeBuffs.map((buff, i) => (
              <div key={i} className="bg-slate-800/40 border border-slate-700 rounded-xl p-3 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-fuchsia-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="text-[10px] text-slate-400 mb-1 font-bold">{buff.layer}</div>
                <div className="text-sm font-black text-slate-200 mb-2 truncate">{buff.name}</div>
                <div className="flex flex-wrap gap-1">
                  {statsKeys.map(key => {
                    if (buff.effect[key] > 0) {
                      return (
                        <span key={key} className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                          {key}+{buff.effect[key]}
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
    </div>
  );
};
