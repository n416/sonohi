import { X, CheckCircle2, Circle, Sparkles, ChevronDown, BookOpen } from 'lucide-react';

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
  applyPreset: (presetIds: string[]) => void;
  onRequestYashijiMode: () => void;
  patches: PatchConfig[];
}

const PRESETS = [
  { name: '極端', icon: '🔥', description: 'ピーキーなステータス', patches: ['PATCH_SANGOU', 'PATCH_HOUGOU', 'PATCH_SHINSATSU', 'PATCH_GOKAN_KUBOU'] },
  { name: '普通', icon: '🌱', description: 'ベースの命式のみ', patches: [] },
  { name: '緩慢', icon: '🕊️', description: '平準化・衝突回避', patches: ['PATCH_SETSUIRI', 'PATCH_CHU_GOU', 'PATCH_SHIGOU', 'PATCH_RITSUUN'] },
  { name: 'おすすめ', icon: '✨', description: '現代の主流派ルール', patches: ['PATCH_GETSUREI', 'PATCH_ZOUKAN_HONKI', 'PATCH_KANGOU_STRICT'] },
];

export function SettingsDrawer({
  isOpen, onClose,
  activePatches, togglePatch, applyPreset, onRequestYashijiMode, patches
}: SettingsDrawerProps) {
  
  if (!isOpen) return null;

  const isYashijiMode = activePatches.includes('PATCH_YASHIJI');

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
          {/* 基本モード設定（夜子時） */}
          <section>
            <h3 className="text-sm font-bold text-slate-400 mb-4 flex items-center gap-2">
              <Sparkles size={16} className="text-pink-400" />
              暦の基本モード（夜子時の扱い）
            </h3>
            <div className="flex bg-slate-800 p-1 rounded-xl mb-2">
              <button
                onClick={() => isYashijiMode && onRequestYashijiMode()}
                className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${
                  !isYashijiMode ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                標準（23時で翌日）
              </button>
              <button
                onClick={() => !isYashijiMode && onRequestYashijiMode()}
                className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${
                  isYashijiMode ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                古典（0時で翌日）
              </button>
            </div>
            <p className="text-xs text-slate-500 px-2 mb-4">※モードを切り替えると出生日時の前提が変わるため、生年月日がリセットされます。</p>

            <details className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden group">
              <summary className="p-3 text-sm font-bold text-slate-300 cursor-pointer hover:bg-slate-700/50 transition-colors flex items-center justify-between list-none [&::-webkit-details-marker]:hidden">
                <div className="flex items-center gap-2">
                  <BookOpen size={16} className="text-indigo-400" />
                  なぜ「23時」が標準なの？
                </div>
                <ChevronDown size={16} className="text-slate-500 group-open:rotate-180 transition-transform" />
              </summary>
              <div className="p-4 pt-0 text-xs text-slate-300 leading-relaxed space-y-3 border-t border-slate-700/50 mt-2 pt-3">
                <p>
                  私たちの現代の感覚では「日付が変わるのは夜中の0時」が常識ですが、四柱推命（古代の干支暦）の世界では<strong>「子の刻（23:00〜）」が1日の始まり</strong>と定義されています。
                </p>
                <p>
                  そのため、占いの世界では<strong>「23時になった瞬間に翌日がスタートする」のが大昔からの標準（多数派ルール）</strong>となっています。実際、ネット上の無料占いサイトの大部分はこの「23時切り替え」を採用しています。
                </p>
                <p>
                  しかし、後世の占い師たちが「いや、いくら時間が『子』になっても、夜中の0時を越えるまでは日付を変えるべきではない！」という例外ルールを作りました。これが<strong>「夜子時（0時で翌日）」</strong>と呼ばれる古典派のルールです。
                </p>
                <p>
                  この「23時で翌日にするか、0時まで当日のまま粘るか」という解釈の違い（夜子時問題）は、プロの占い師同士でも永遠に論争になっている<strong>超メジャーな二大派閥の争い</strong>です。どちらのモードを選ぶかで、あなたの「日柱（最も重要なステータス）」が丸一日ズレる可能性がある、非常に重要な設定なのです。
                </p>
              </div>
            </details>
          </section>

          {/* プリセット選択 */}
          <section>
            <h3 className="text-sm font-bold text-slate-400 mb-4 flex items-center gap-2">
              <Sparkles size={16} className="text-pink-400" />
              流派プリセット一括適用
            </h3>
            <div className="grid grid-cols-2 gap-3 mb-2">
              {PRESETS.map(preset => (
                <button
                  key={preset.name}
                  onClick={() => applyPreset(preset.patches)}
                  className="p-3 bg-slate-800/80 border border-slate-700 hover:border-indigo-500/50 rounded-xl transition-all text-left group"
                >
                  <div className="text-sm font-bold text-slate-200 group-hover:text-indigo-300 transition-colors flex items-center gap-2 mb-1">
                    <span>{preset.icon}</span>
                    {preset.name}
                  </div>
                  <div className="text-xs text-slate-500 leading-tight">{preset.description}</div>
                </button>
              ))}
            </div>
          </section>

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
              {patches.filter(p => p.id !== 'PATCH_YASHIJI').map(patch => {
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
