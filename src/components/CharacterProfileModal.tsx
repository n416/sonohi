import React from 'react';
import { X, User, Shield, Sparkles, CheckCircle2, XCircle } from 'lucide-react';
import { getCharacterProfile } from '../utils/characterProfile';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  nikkan: string;
  nisshi: string;
};

export const CharacterProfileModal: React.FC<Props> = ({ isOpen, onClose, nikkan, nisshi }) => {
  if (!isOpen) return null;

  const profile = getCharacterProfile(nikkan, nisshi);

  const colorStyles: Record<string, string> = {
    emerald: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10 from-emerald-500/20',
    teal: 'text-teal-400 border-teal-500/30 bg-teal-500/10 from-teal-500/20',
    rose: 'text-rose-400 border-rose-500/30 bg-rose-500/10 from-rose-500/20',
    pink: 'text-pink-400 border-pink-500/30 bg-pink-500/10 from-pink-500/20',
    amber: 'text-amber-400 border-amber-500/30 bg-amber-500/10 from-amber-500/20',
    yellow: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10 from-yellow-500/20',
    slate: 'text-slate-300 border-slate-500/30 bg-slate-500/10 from-slate-500/20',
    gray: 'text-gray-300 border-gray-500/30 bg-gray-500/10 from-gray-500/20',
    blue: 'text-blue-400 border-blue-500/30 bg-blue-500/10 from-blue-500/20',
    indigo: 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10 from-indigo-500/20'
  };

  const style = colorStyles[profile.color] || colorStyles.slate;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <div 
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm flex flex-col shadow-2xl relative overflow-hidden max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className={`absolute top-0 inset-x-0 h-40 bg-gradient-to-b ${style} to-transparent pointer-events-none opacity-50`}></div>

        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-800/80 text-slate-400 hover:text-white transition-colors z-20"
        >
          <X size={16} />
        </button>

        <div className="p-6 pt-10 flex flex-col items-center relative z-10 overflow-y-auto custom-scrollbar">
          <div className={`w-20 h-20 rounded-full border-2 flex items-center justify-center mb-4 bg-slate-900 shadow-[0_0_20px_rgba(0,0,0,0.5)] ${style}`}>
            <User size={32} />
          </div>

          <div className="inline-block px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase mb-2 border bg-slate-950/50">
            Base Attribute: {profile.element}
          </div>

          <h2 className={`text-xl font-black mb-1 drop-shadow-md text-center ${style.split(' ')[0]}`}>
            {profile.className}
          </h2>
          
          <h3 className="text-xs text-slate-400 font-bold mb-6 flex items-center gap-1.5 uppercase tracking-widest">
            <Shield size={12} /> {profile.animal}
          </h3>

          <div className="w-full space-y-3">
            <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800">
              <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5 mb-2 border-b border-slate-800 pb-2">
                <Sparkles size={12} className="text-amber-400" /> 特性コンセプト
              </h4>
              <p className="text-sm font-bold text-slate-200 mb-3 leading-relaxed">
                {profile.concept}
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                {profile.description}
              </p>
            </div>

            {profile.actions && (
              <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800 space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 mb-2">
                    <CheckCircle2 size={14} /> 推奨される立ち回り (DO)
                  </h4>
                  <ul className="space-y-1.5">
                    {profile.actions.do.map((text, idx) => (
                      <li key={idx} className="text-xs text-slate-300 flex items-start gap-1.5 leading-relaxed">
                        <span className="text-emerald-500/50 mt-0.5">•</span> {text}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="border-t border-slate-800 pt-3">
                  <h4 className="text-xs font-bold text-rose-400 flex items-center gap-1.5 mb-2">
                    <XCircle size={14} /> 避けるべき立ち回り (DON'T)
                  </h4>
                  <ul className="space-y-1.5">
                    {profile.actions.dont.map((text, idx) => (
                      <li key={idx} className="text-xs text-slate-300 flex items-start gap-1.5 leading-relaxed">
                        <span className="text-rose-500/50 mt-0.5">•</span> {text}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
