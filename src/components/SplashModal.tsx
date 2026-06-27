import { useState } from 'react';
import { Sparkles, X } from 'lucide-react';

interface SplashModalProps {
  onClose: () => void;
}

export function SplashModal({ onClose }: SplashModalProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem('sonohi_hide_splash', 'true');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header Decoration */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none" />

        {/* Content Area */}
        <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar relative z-10 space-y-6 text-slate-300 leading-relaxed">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl md:text-2xl font-extrabold text-white flex items-center gap-2">
              <Sparkles className="text-indigo-400" />
              ようこそ
            </h2>
            <button
              onClick={handleClose}
              className="p-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-full transition-colors text-slate-400 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4 text-sm md:text-base">
            <p>
              このソフトは、占いを全く信じない開発者が『当たる占いがある』という話を聞き、『なぜ当たるのか？』を理詰めで考えて作ったものです。
            </p>
            <p>
              特定の人に当たる占い師も、別の人には当たらない。でも、そこそこ当たる占いもある……そんなカオスな状況を見て、『その人向けに占いルールそのものをチューン（最適化）できればいいのではないか？』と思いつきました。<br />
              そこから四柱推命の様々な流派を調べ上げ、存在するすべての流派をAIに読み込ませてプラグイン化しました。
            </p>
            <p>
              開発者である私自身は全く使いませんが、妙に当たって気持ちの悪いソフトに仕上がっています。<br />
              結果を決して鵜呑みにせず、酒の肴や話のネタ（あるいは賭け事のトリガー……私はしませんが）など、あくまでお遊び要素としてお楽しみください。<br />
              Googleカレンダー連携をつけるなどの暴挙にも出ています。
            </p>
            <p>
              完全無料・広告なし、ただの遊びで運用しています。<br />
              なにか追加してほしい機能があれば、Xアカウント <a href="https://x.com/n416" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">@n416</a> までご連絡ください。
            </p>
            <p className="font-bold text-white pt-2">
              それでも、機能面では現在世の中にあるどんな占いソフトよりも優れているという自負があります。<br />
              それでは、心ゆくまでお楽しみください！
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700/50 bg-slate-800/30 flex flex-col sm:flex-row items-center justify-between gap-4 z-10 shrink-0">
          <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer hover:text-slate-300 transition-colors">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900"
            />
            次から表示しない
          </label>
          <button
            onClick={handleClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-colors shadow-lg shadow-indigo-500/20"
          >
            はじめる
          </button>
        </div>
      </div>
    </div>
  );
}
