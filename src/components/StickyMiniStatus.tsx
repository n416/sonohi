import React from 'react';
import type { StatKey } from './RPGStatusRadar';

type Props = {
  finalStats: { key: StatKey; currentValue: number; baseValue: number }[];
  diagnosisTitle: string;
  selectedDate: Date;
};

export const StickyMiniStatus: React.FC<Props> = ({ finalStats, diagnosisTitle, selectedDate }) => {
  return (
    <div className="sticky top-0 z-50 w-full bg-slate-950/80 backdrop-blur-xl border-b border-indigo-500/30 shadow-[0_10px_30px_rgba(0,0,0,0.5)] py-2 md:py-3 px-4 flex flex-col md:flex-row items-center justify-between gap-2 md:gap-4 transition-all">
      <div className="flex items-center justify-between w-full md:w-auto gap-3">
        <div className="bg-indigo-500/20 border border-indigo-500/50 text-indigo-300 font-bold text-[10px] md:text-xs px-2 py-1 rounded shrink-0">
          {selectedDate.getFullYear()}年{selectedDate.getMonth() + 1}月{selectedDate.getDate()}日
        </div>
        <div className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-fuchsia-400 font-black text-sm md:text-base truncate max-w-[150px] md:max-w-none">
          {diagnosisTitle}
        </div>
      </div>
      
      <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 hide-scrollbar">
        {finalStats.map(s => {
          const diff = s.currentValue - s.baseValue;
          return (
            <div key={s.key} className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1 shrink-0">
              <span className="text-[10px] text-slate-500 font-bold">{s.key}</span>
              <span className="text-xs md:text-sm text-slate-200 font-black">{s.currentValue}</span>
              {diff !== 0 && (
                <span className={`text-[9px] font-bold ${diff > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {diff > 0 ? `+${diff}` : diff}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
