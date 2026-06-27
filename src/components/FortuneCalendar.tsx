import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Flame, Heart, Shield, Zap, Target } from 'lucide-react';
import { getDailyBuffForDate, getScore, type StatKey } from '../utils/rpgEngine';

type Props = {
  selectedDates: Date[];
  onSelectDate: (date: Date) => void;
  baseDiagnosisType: 'shinkyo' | 'shinjaku';
};

export const FortuneCalendar: React.FC<Props> = ({ selectedDates, onSelectDate, baseDiagnosisType }) => {
  // 表示用基準月（通常は最後に選択された日付）
  const [viewDate, setViewDate] = useState<Date>(
    new Date(selectedDates.length > 0 ? selectedDates[selectedDates.length - 1] : new Date())
  );
  const [viewMode, setViewMode] = useState<'day' | 'month' | 'year'>('day');

  useEffect(() => {
    if (selectedDates.length > 0) {
      setViewDate(new Date(selectedDates[selectedDates.length - 1]));
    }
  }, [selectedDates]);

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();

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
        const score = getScore(buff, baseDiagnosisType);
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

  // 最大バフのアイコンと色を取得する関数
  const getMaxBuffInfo = (buff: Record<StatKey, number>) => {
    const keys = Object.keys(buff) as StatKey[];
    let maxKey: StatKey = 'HP';
    let maxVal = -Infinity;

    for (const key of keys) {
      if (buff[key] > maxVal) {
        maxVal = buff[key];
        maxKey = key;
      }
    }

    if (maxVal <= 0) return null;

    switch (maxKey) {
      case 'HP': return { icon: <Heart size={10} />, colorClass: 'text-rose-400 bg-rose-500/10 border-rose-500/20', iconColor: 'text-rose-500' };
      case 'ATK': return { icon: <Flame size={10} />, colorClass: 'text-orange-400 bg-orange-500/10 border-orange-500/20', iconColor: 'text-orange-500' };
      case 'DEX': return { icon: <Target size={10} />, colorClass: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20', iconColor: 'text-yellow-500' };
      case 'DEF': return { icon: <Shield size={10} />, colorClass: 'text-blue-400 bg-blue-500/10 border-blue-500/20', iconColor: 'text-blue-500' };
      case 'MP': return { icon: <Zap size={10} />, colorClass: 'text-purple-400 bg-purple-500/10 border-purple-500/20', iconColor: 'text-purple-500' };
    }
  };

  return (
    <div className="bg-slate-900/80 border border-indigo-500/30 rounded-3xl p-2 md:p-4 shadow-2xl relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 md:w-48 md:h-48 bg-indigo-600/10 blur-[100px] rounded-full pointer-events-none transition-all duration-1000 group-hover:bg-indigo-500/20"></div>

      <div className="flex flex-col items-center gap-2 mb-2 pb-2 relative z-10">
        <div className="flex items-center justify-center gap-1 w-full">
          {viewMode === 'day' && (
            <button onClick={handlePrevYear} className="p-1 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-colors shrink-0" title="前年">
              <ChevronsLeft size={16} />
            </button>
          )}
          <button onClick={() => {
            if (viewMode === 'day') handlePrevMonth();
            else if (viewMode === 'month') handlePrevYear();
            else if (viewMode === 'year') setViewDate(new Date(viewYear - 12, viewMonth, 1));
          }} className="p-1 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-colors shrink-0" title="前へ">
            <ChevronLeft size={16} />
          </button>

          <button
            onClick={() => {
              if (viewMode === 'day') setViewMode('month');
              else if (viewMode === 'month') setViewMode('year');
              else setViewMode('day');
            }}
            className="text-xs md:text-sm font-black text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 px-3 py-1.5 rounded-xl tracking-widest shadow-inner min-w-[100px] text-center mx-1 transition-colors shrink-0"
          >
            {viewMode === 'day' && `${viewYear} / ${String(viewMonth + 1).padStart(2, '0')}`}
            {viewMode === 'month' && `${viewYear}年`}
            {viewMode === 'year' && `${viewYear - 5} - ${viewYear + 6}`}
          </button>

          <button onClick={() => {
            if (viewMode === 'day') handleNextMonth();
            else if (viewMode === 'month') handleNextYear();
            else if (viewMode === 'year') setViewDate(new Date(viewYear + 12, viewMonth, 1));
          }} className="p-1 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-colors shrink-0" title="次へ">
            <ChevronRight size={16} />
          </button>
          {viewMode === 'day' && (
            <button onClick={handleNextYear} className="p-1 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-colors shrink-0" title="次年">
              <ChevronsRight size={16} />
            </button>
          )}
        </div>
      </div>

      {viewMode === 'day' && (
        <>
          <div className="grid grid-cols-7 gap-1 text-center text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest relative z-10 mb-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-1 relative z-10">
            {days.map((date, idx) => {
              if (!date) return <div key={idx} className="h-8 md:h-12"></div>;

              const selectedIndex = selectedDates.findIndex(d => isSameDate(date, d));
              const isSelected = selectedIndex !== -1;
              const buff = getDailyBuffForDate(date);
              const maxBuffInfo = getMaxBuffInfo(buff);

              let cellColor = maxBuffInfo ? maxBuffInfo.colorClass : 'bg-slate-800/30 border-slate-700/30';
              let textColor = maxBuffInfo ? 'text-white' : 'text-slate-500';

              let ringClass = '';
              if (isSelected) {
                if (selectedIndex === 0) {
                  ringClass = 'ring-2 ring-indigo-400 shadow-[0_0_15px_rgba(129,140,248,0.5)] z-10';
                  cellColor = 'bg-indigo-500/20 border-indigo-500/50'; // 選択されたらベース色を変える
                  textColor = 'text-white font-black';
                } else if (selectedIndex === 1) {
                  ringClass = 'ring-2 ring-pink-400 shadow-[0_0_15px_rgba(244,114,182,0.5)] z-10';
                  cellColor = 'bg-pink-500/20 border-pink-500/50';
                  textColor = 'text-white font-black';
                }
              }

              return (
                <button
                  key={idx}
                  onClick={() => onSelectDate(date)}
                  className={`h-8 md:h-12 rounded-lg border flex flex-col items-center justify-center transition-all duration-300 transform hover:scale-105 ${cellColor} ${ringClass}`}
                >
                  <span className={`text-xs md:text-sm transition-transform ${textColor}`}>{date.getDate()}</span>

                  {maxBuffInfo ? (
                    <div className={`flex items-center gap-0.5 text-[8px] md:text-[9px] font-bold mt-0.5 opacity-90 ${maxBuffInfo.iconColor}`}>
                      {maxBuffInfo.icon}
                      <span>+{Math.max(...Object.values(buff))}</span>
                    </div>
                  ) : (
                    <span className="text-[8px] md:text-[9px] text-slate-600 mt-0.5">-</span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {viewMode === 'month' && (
        <div className="grid grid-cols-4 gap-2 relative z-10 py-4">
          {Array.from({ length: 12 }).map((_, i) => {
            const isSelected = i === viewMonth;
            return (
              <button
                key={i}
                onClick={() => {
                  onSelectDate(findBestDate(viewYear, i));
                  setViewMode('day');
                }}
                className={`h-10 md:h-12 rounded-xl border flex flex-col items-center justify-center font-bold transition-all hover:scale-105 ${isSelected ? 'bg-indigo-500/30 border-indigo-500/50 text-white' : 'bg-slate-800/30 border-slate-700/50 text-slate-400 hover:bg-slate-700/50'
                  }`}
              >
                <span className="text-xs md:text-sm">{i + 1}月</span>
              </button>
            );
          })}
        </div>
      )}

      {viewMode === 'year' && (
        <div className="grid grid-cols-4 gap-2 relative z-10 py-4">
          {Array.from({ length: 12 }).map((_, i) => {
            const y = viewYear - 5 + i;
            const isSelected = y === viewYear;
            return (
              <button
                key={i}
                onClick={() => {
                  onSelectDate(findBestDate(y));
                  setViewMode('month');
                }}
                className={`h-10 md:h-12 rounded-xl border flex flex-col items-center justify-center font-bold transition-all hover:scale-105 ${isSelected ? 'bg-indigo-500/30 border-indigo-500/50 text-white' : 'bg-slate-800/30 border-slate-700/50 text-slate-400 hover:bg-slate-700/50'
                  }`}
              >
                <span className="text-xs md:text-sm">{y}年</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

