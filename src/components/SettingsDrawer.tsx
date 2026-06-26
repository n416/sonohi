import { X, CheckCircle2, Circle, Sparkles } from 'lucide-react';

export interface PatchConfig {
  id: string;
  name: string;
  description: string;
}

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activePatches: string[];
  togglePatch: (id: string) => void;
  patches: PatchConfig[];
}

export function SettingsDrawer({
  isOpen, onClose,
  activePatches, togglePatch, patches
}: SettingsDrawerProps) {
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex justify-end">
      {/* オーバーレイ */}
      <div 
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* ドロワー本体 */}
      <div className="relative w-full max-w-md bg-slate-900 border-l border-slate-700 shadow-2xl h-full flex flex-col overflow-y-auto animate-in slide-in-from-right">
        
        <div className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 p-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Sparkles size={20} className="text-pink-400" />
            拡張モジュール管理
          </h2>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* パッチ設定 */}

          <section>
            <h3 className="text-sm font-bold text-slate-400 mb-4 flex items-center gap-2">
              <Sparkles size={16} className="text-pink-400" />
              適用パッチ（ローカルルール）
            </h3>

            <div className="mb-6 bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-sm text-slate-300 leading-relaxed space-y-3">
              <p>
                これは四柱推命に、トランプの「大富豪」のように<strong>様々な独自ルール</strong>が存在するために作られています。
              </p>
              <p>
                よくわからないと思いますので、適当にチェックしてみてください。
              </p>
              <p>
                「なんとなく、これ正解率高いんじゃない？」と思うなら、それが貴方に合う独自ルールの組み合わせのはずです。<br />
                実は世の中の占い師さんは、これの組み合わせで独自性を出しています。
              </p>
            </div>

            <div className="space-y-3">
              {patches.map(patch => {
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
                    <div className="mt-0.5 shrink-0">
                      {isActive ? <CheckCircle2 size={20} className="text-indigo-400" /> : <Circle size={20} />}
                    </div>
                    <div>
                      <div className="font-bold text-sm mb-1">{patch.name}</div>
                      <div className="text-xs opacity-70 leading-relaxed">{patch.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <div className="mt-auto p-6 border-t border-slate-800">
          <button 
            onClick={onClose}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-4 rounded-xl transition-colors"
          >
            設定を閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
