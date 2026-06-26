import { X, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';
import { generateDailyAdvice, type StatKey } from '../utils/rpgEngine';

type DailyAdviceModalProps = {
  isOpen: boolean;
  onClose: () => void;
  dataList: {
    date: Date;
    stats: { key: StatKey; baseValue: number; currentValue: number }[];
  }[];
  activePatches: string[];
};

export function DailyAdviceModal({ isOpen, onClose, dataList, activePatches }: DailyAdviceModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="relative bg-slate-900 border border-slate-700/50 rounded-2xl w-full max-w-xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Sparkles size={18} className="text-indigo-400" />
            本日のアクション指針
          </h2>
          <button 
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-8 custom-scrollbar">
          {dataList.map((data, index) => {
            const advice = generateDailyAdvice(data.date, data.stats, activePatches);
            const isSecond = index === 1;
            const colorConfig = isSecond 
              ? { text: 'text-pink-400', border: 'border-pink-500/30', bg: 'bg-pink-500/10' }
              : { text: 'text-indigo-400', border: 'border-indigo-500/30', bg: 'bg-indigo-500/10' };

            return (
              <div key={data.date.getTime()} className="space-y-4">
                <h3 className={`text-sm font-bold flex items-center gap-2 pb-2 border-b ${colorConfig.border} ${colorConfig.text}`}>
                  <span>{data.date.getMonth() + 1}/{data.date.getDate()} の詳細解説</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/50 flex flex-col gap-3">
                    <h4 className="font-bold text-emerald-400 flex items-center gap-2 text-sm">
                      <CheckCircle size={16} />
                      オススメの行動 (DO)
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {advice.doText}
                    </p>
                  </div>

                  <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/50 flex flex-col gap-3">
                    <h4 className="font-bold text-rose-400 flex items-center gap-2 text-sm">
                      <AlertCircle size={16} />
                      避けるべき行動 (DON'T)
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {advice.dontText}
                    </p>
                  </div>
                </div>

                <div className={`rounded-xl p-4 border ${colorConfig.border} ${colorConfig.bg}`}>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium">
                    <span className="font-bold text-white mr-1">総評:</span>
                    {advice.summary}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
