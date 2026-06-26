import React from 'react';
import { X, Sword, Shield, Zap, Book, Heart } from 'lucide-react';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export const StatusHelpModal: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const statDetails = [
    {
      key: 'HP',
      name: '基本体力 (比劫)',
      icon: <Heart size={16} className="text-emerald-400" />,
      color: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
      description: '自己の確立、独立心、そして純粋なエネルギーの総量を表します。',
      advice: '【おすすめの行動】\n自分の意志で決断し、新しいことを始めるのに最適なタイミングです。周囲に流されず、主体的に動くことで道が開けます。'
    },
    {
      key: 'MP',
      name: '魔力・知性 (印星)',
      icon: <Book size={16} className="text-purple-400" />,
      color: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
      description: '思考力、学習能力、インプットの深さを表します。エネルギーを吸収する力です。',
      advice: '【おすすめの行動】\n読書や勉強、深く考える時間に充ててください。資格取得の準備や、複雑な問題の戦略を練るのに最高な状態です。'
    },
    {
      key: 'ATK',
      name: '攻撃力・表現 (食傷)',
      icon: <Sword size={16} className="text-rose-400" />,
      color: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
      description: '自己表現、クリエイティビティ、そして外に向かってエネルギーを放出する力です。',
      advice: '【おすすめの行動】\nアイデアを形にする、SNSで発信する、クリエイティブな趣味に没頭するなど、アウトプットを意識すると吉です。'
    },
    {
      key: 'DEX',
      name: '獲得力・人脈 (財星)',
      icon: <Zap size={16} className="text-amber-400" />,
      color: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
      description: 'コミュニケーション能力、ネットワーク構築、現実的な利益をコントロールする力です。',
      advice: '【おすすめの行動】\n人との交流を増やし、人脈を広げるのに適しています。また、お金の管理や投資計画を見直すのにも良い時期です。'
    },
    {
      key: 'DEF',
      name: '耐久力・責任 (官殺)',
      icon: <Shield size={16} className="text-indigo-400" />,
      color: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400',
      description: '自制心、責任感、社会的な役割を全うする実行力を表します。',
      advice: '【おすすめの行動】\n与えられたタスクを淡々とこなし、社会的な信用を積み上げる時期です。ルールや期限を守り、堅実に進めましょう。'
    }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div 
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl relative overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-indigo-500/10 to-transparent pointer-events-none"></div>

        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 relative z-10">
          <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Zap size={16} className="text-yellow-400" />
            ステータス解説とおすすめ行動
          </h2>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="overflow-y-auto p-4 space-y-4 custom-scrollbar relative z-10">
          <p className="text-xs text-slate-400 mb-2 leading-relaxed">
            各パラメータは、四柱推命の「通変星」に対応したエネルギー（運勢の傾向）を表しています。強化されているステータスに合わせて行動を選択することで、よりスムーズに一日を過ごせます。
          </p>

          <div className="space-y-3">
            {statDetails.map(stat => (
              <div key={stat.key} className="bg-slate-950/50 rounded-xl p-3 border border-slate-800">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-1.5 rounded-lg border ${stat.color}`}>
                    {stat.icon}
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-200">{stat.key}</h3>
                    <p className="text-[10px] text-slate-500 font-medium">{stat.name}</p>
                  </div>
                </div>
                
                <p className="text-xs text-slate-300 mb-2 leading-relaxed">
                  {stat.description}
                </p>
                
                <div className="bg-slate-800/50 rounded-lg p-2.5 border border-slate-700/50 text-xs text-indigo-200 leading-relaxed whitespace-pre-wrap font-medium">
                  {stat.advice}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
