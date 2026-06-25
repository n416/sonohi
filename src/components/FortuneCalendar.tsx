import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import type { StatKey } from './RPGStatusRadar';

// 擬似乱数ジェネレーター（日付シード用）
const pseudoRandom = (seed: number) => {
  let x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
};

export const getDailyBuffForDate = (date: Date): Record<StatKey, number> => {
  const seed = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  const keys: StatKey[] = ['HP', 'ATK', 'DEX', 'DEF', 'MP'];
  
  // 1つのステータスに特化したバフを付与する（-10 〜 +20）
  const targetKey = keys[Math.floor(pseudoRandom(seed) * keys.length)];
  const amount = Math.floor(pseudoRandom(seed + 1) * 30) - 10;
  
  const effect = { HP: 0, ATK: 0, DEX: 0, DEF: 0, MP: 0 };
  effect[targetKey] = amount;
  return effect;
};

// 偏差値計算ユーティリティ
const calculateDeviations = (scores: number[]) => {
  const avg = scores.reduce((a, b) => a + b, 0) / (scores.length || 1);
  const variance = scores.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / (scores.length || 1);
  const stdDev = Math.sqrt(variance);
  return scores.map(score => stdDev === 0 ? 50 : Math.round(((score - avg) / stdDev) * 10 + 50));
};

type Props = {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  baseStatsData: { key: StatKey; baseValue: number }[];
  baseDiagnosisType: 'shinkyo' | 'shinjaku';
};

export const FortuneCalendar: React.FC<Props> = ({ selectedDate, onSelectDate, baseStatsData, baseDiagnosisType }) => {
  const [viewDate, setViewDate] = useState<Date>(new Date(selectedDate));
  const [viewMode, setViewMode] = useState<'day' | 'month' | 'year'>('day');
  
  useEffect(() => {
    setViewDate(new Date(selectedDate));
  }, [selectedDate]);

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();

  // ベストな日を探すヘルパー
  const findBestDate = (targetYear: number, targetMonth?: number) => {
    let bestDate = new Date(targetYear, targetMonth ?? 0, 1);
    let bestScore = -Infinity;

    const startMonth = targetMonth !== undefined ? targetMonth : 0;
    const endMonth = targetMonth !== undefined ? targetMonth : 11;

    for (let m = startMonth; m <= endMonth; m++) {
      const daysInM = new Date(targetYear, m + 1, 0).getDate();
      for (let d = 1; d <= daysInM; d++) {
        const date = new Date(targetYear, m, d);
        const buff = getDailyBuffForDate(date);
        
        // スコアリング: 弱点を補う(+), 長所を抑える(+)
        const score = buff[minKey] * 2 - buff[maxKey];
        if (score > bestScore) {
          bestScore = score;
          bestDate = date;
        }
      }
    }
    return bestDate;
  };

  const handlePrevMonth = () => onSelectDate(findBestDate(viewYear, viewMonth - 1));
  const handleNextMonth = () => onSelectDate(findBestDate(viewYear, viewMonth + 1));
  const handlePrevYear = () => onSelectDate(findBestDate(viewYear - 1, viewMonth));
  const handleNextYear = () => onSelectDate(findBestDate(viewYear + 1, viewMonth));
  
  // 弱点と長所を特定（バフなしのベース状態で判定）
  let maxKey: StatKey = baseStatsData[0].key;
  let minKey: StatKey = baseStatsData[0].key;
  let maxVal = baseStatsData[0].baseValue;
  let minVal = baseStatsData[0].baseValue;
  baseStatsData.forEach(s => {
    if (s.baseValue > maxVal) { maxVal = s.baseValue; maxKey = s.key; }
    if (s.baseValue < minVal) { minVal = s.baseValue; minKey = s.key; }
  });

  const getStatus = (buff: Record<StatKey, number>) => {
    if (buff[minKey] > 5 || (baseDiagnosisType === 'shinkyo' && buff[maxKey] < -5)) return 'good';
    if (buff[maxKey] > 5 || buff[minKey] < -5) return 'bad';
    return 'normal';
  };

  // カレンダーの日付生成
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const days: (Date | null)[] = [];
  
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(viewYear, viewMonth, i));
  }

  const isSameDate = (d1: Date, d2: Date) => 
    d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();

  return (
    <div className="bg-slate-900/80 border border-indigo-500/30 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden mt-6 group">
      <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-600/10 blur-[100px] rounded-full pointer-events-none transition-all duration-1000 group-hover:bg-emerald-500/20"></div>
      
      <div className="flex flex-col items-center gap-4 mb-6 border-b border-slate-700/50 pb-5 relative z-10">
        <div className="text-center">
          <h3 className="text-lg md:text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
            属性バフ・タイムライン
          </h3>
          <p className="text-[10px] md:text-xs text-slate-400 mt-2 font-medium bg-slate-950/50 inline-block px-3 py-1.5 rounded-lg border border-slate-800">
            プレビュー中: <span className="text-emerald-400 font-bold">{selectedDate.getFullYear()}年{selectedDate.getMonth() + 1}月{selectedDate.getDate()}日</span>
          </p>
        </div>
        
        <div className="flex items-center justify-center gap-1 w-full">
          {viewMode === 'day' && (
            <button onClick={handlePrevYear} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-colors shrink-0" title="前年">
              <ChevronsLeft size={18} />
            </button>
          )}
          <button onClick={() => {
            if (viewMode === 'day') handlePrevMonth();
            else if (viewMode === 'month') handlePrevYear();
            else if (viewMode === 'year') setViewDate(new Date(viewYear - 12, viewMonth, 1));
          }} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-colors shrink-0" title="前へ">
            <ChevronLeft size={18} />
          </button>
          
          <button 
            onClick={() => {
              if (viewMode === 'day') setViewMode('month');
              else if (viewMode === 'month') setViewMode('year');
              else setViewMode('day');
            }}
            className="text-sm font-black text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 px-3 py-2 rounded-xl tracking-widest shadow-inner min-w-[110px] text-center mx-1 transition-colors shrink-0"
          >
            {viewMode === 'day' && `${viewYear} / ${String(viewMonth + 1).padStart(2, '0')}`}
            {viewMode === 'month' && `${viewYear}年`}
            {viewMode === 'year' && `${viewYear - 5} - ${viewYear + 6}`}
          </button>
          
          <button onClick={() => {
            if (viewMode === 'day') handleNextMonth();
            else if (viewMode === 'month') handleNextYear();
            else if (viewMode === 'year') setViewDate(new Date(viewYear + 12, viewMonth, 1));
          }} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-colors shrink-0" title="次へ">
            <ChevronRight size={18} />
          </button>
          {viewMode === 'day' && (
            <button onClick={handleNextYear} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-colors shrink-0" title="次年">
              <ChevronsRight size={18} />
            </button>
          )}
        </div>
      </div>

      {viewMode === 'day' && (
        <>
          <div className="grid grid-cols-7 gap-2 mb-2 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest relative z-10">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-2 relative z-10">
            {days.map((date, idx) => {
              if (!date) return <div key={idx} className="h-14 md:h-16"></div>;
          
          const isSelected = isSameDate(date, selectedDate);
          const buff = getDailyBuffForDate(date);
          const status = getStatus(buff);
          
          let cellColor = 'bg-slate-800/30 border-slate-700/50 hover:bg-slate-700/50 hover:border-slate-500/50';
          let textColor = 'text-slate-400';
          let glowEffect = '';

          if (status === 'good') {
            cellColor = 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20';
            textColor = 'text-emerald-400';
          } else if (status === 'bad') {
            cellColor = 'bg-rose-500/10 border-rose-500/30 hover:bg-rose-500/20';
            textColor = 'text-rose-400';
          }

          if (isSelected) {
            if (status === 'good') glowEffect = 'shadow-[0_0_15px_rgba(52,211,153,0.5)] ring-2 ring-emerald-400';
            else if (status === 'bad') glowEffect = 'shadow-[0_0_15px_rgba(244,63,94,0.5)] ring-2 ring-rose-400';
            else glowEffect = 'shadow-[0_0_15px_rgba(129,140,248,0.5)] ring-2 ring-indigo-400';
            
            cellColor = `bg-slate-800/80 ${glowEffect}`;
            textColor = 'text-white font-black scale-110';
          }

          return (
            <button
              key={idx}
              onClick={() => onSelectDate(date)}
              className={`h-14 md:h-16 rounded-xl border flex flex-col items-center justify-center transition-all duration-300 transform ${cellColor}`}
            >
              <span className={`text-sm md:text-base transition-transform ${textColor}`}>{date.getDate()}</span>
              <span className={`text-[9px] font-bold mt-0.5 ${status === 'good' ? 'text-emerald-500/70' : status === 'bad' ? 'text-rose-500/70' : 'text-slate-600'}`}>
                {status === 'good' ? 'GOOD' : status === 'bad' ? 'BAD' : '-'}
              </span>
            </button>
          );
        })}
          </div>
        </>
      )}

      {viewMode === 'month' && (
        <div className="grid grid-cols-4 gap-3 relative z-10 py-6">
          {(() => {
            // 表示される12ヶ月のスコア差分を計算
            const diffs = Array.from({ length: 12 }).map((_, i) => {
              let goodCount = 0;
              let badCount = 0;
              const daysInM = new Date(viewYear, i + 1, 0).getDate();
              for (let d = 1; d <= daysInM; d++) {
                const st = getStatus(getDailyBuffForDate(new Date(viewYear, i, d)));
                if (st === 'good') goodCount++;
                if (st === 'bad') badCount++;
              }
              return goodCount - badCount;
            });

            // 1年の中での各月の偏差値を計算
            const devs = calculateDeviations(diffs);

            return Array.from({ length: 12 }).map((_, i) => {
              const diff = diffs[i];
              const dev = devs[i];
              let status = 'normal';
              // 偏差値55以上（上位）をGood、45以下（下位）をBadとする
              if (dev >= 55) status = 'good';
              if (dev <= 45) status = 'bad';

              let cellColor = i === viewMonth
                ? 'bg-indigo-500/30 border-indigo-500/50 text-white shadow-[0_0_15px_rgba(129,140,248,0.3)]'
                : 'bg-slate-800/30 border-slate-700/50 text-slate-400 hover:bg-slate-700/50 hover:text-slate-200';
              
              if (i !== viewMonth) {
                if (status === 'good') cellColor = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20';
                if (status === 'bad') cellColor = 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20';
              }

              return (
                <button
                  key={i}
                  onClick={() => {
                    onSelectDate(findBestDate(viewYear, i));
                    setViewMode('day');
                  }}
                  className={`h-16 rounded-xl border flex flex-col items-center justify-center font-bold transition-all hover:scale-105 ${cellColor}`}
                >
                  <span className="text-sm">{i + 1}月</span>
                  <span className={`text-[9px] mt-0.5 ${status === 'good' ? 'text-emerald-500/80' : status === 'bad' ? 'text-rose-500/80' : 'text-slate-500'}`}>
                    {diff > 0 ? `+${diff}` : diff < 0 ? diff : '±0'}
                  </span>
                </button>
              );
            });
          })()}
        </div>
      )}

      {viewMode === 'year' && (
        <div className="grid grid-cols-4 gap-3 relative z-10 py-6">
          {(() => {
            // 表示されている12年間のスコア差分を計算
            const diffs = Array.from({ length: 12 }).map((_, i) => {
              const y = viewYear - 5 + i;
              let goodCount = 0;
              let badCount = 0;
              for (let m = 0; m < 12; m++) {
                const daysInM = new Date(y, m + 1, 0).getDate();
                for (let d = 1; d <= daysInM; d++) {
                  const st = getStatus(getDailyBuffForDate(new Date(y, m, d)));
                  if (st === 'good') goodCount++;
                  if (st === 'bad') badCount++;
                }
              }
              return goodCount - badCount;
            });

            // 12年間の中での各年の偏差値を計算
            const devs = calculateDeviations(diffs);

            return Array.from({ length: 12 }).map((_, i) => {
              const y = viewYear - 5 + i;
              const diff = diffs[i];
              const dev = devs[i];
              let status = 'normal';
              // 表示期間内での相対的な偏差で評価
              if (dev >= 55) status = 'good';
              if (dev <= 45) status = 'bad';

              let cellColor = y === viewYear
                ? 'bg-indigo-500/30 border-indigo-500/50 text-white shadow-[0_0_15px_rgba(129,140,248,0.3)]'
                : 'bg-slate-800/30 border-slate-700/50 text-slate-400 hover:bg-slate-700/50 hover:text-slate-200';
              
              if (y !== viewYear) {
                if (status === 'good') cellColor = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20';
                if (status === 'bad') cellColor = 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20';
              }

              return (
                <button
                  key={i}
                  onClick={() => {
                    onSelectDate(findBestDate(y));
                    setViewMode('month');
                  }}
                  className={`h-16 rounded-xl border flex flex-col items-center justify-center font-bold transition-all hover:scale-105 ${cellColor}`}
                >
                  <span className="text-sm">{y}年</span>
                  <span className={`text-[9px] mt-0.5 ${status === 'good' ? 'text-emerald-500/80' : status === 'bad' ? 'text-rose-500/80' : 'text-slate-500'}`}>
                    {diff > 0 ? `+${diff}` : diff < 0 ? diff : '±0'}
                  </span>
                </button>
              );
            });
          })()}
        </div>
      )}
      
      <div className="mt-6 flex flex-wrap gap-4 text-xs justify-end font-medium relative z-10">
        <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div> 
          Good (バランス補正)
        </div>
        <div className="flex items-center gap-2 text-rose-400 bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20">
          <div className="w-2 h-2 rounded-full bg-rose-400 animate-pulse"></div> 
          Bad (偏り増幅)
        </div>
      </div>
    </div>
  );
};
