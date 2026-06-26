import React from 'react';
import { calculateRPGStats, type GogyoScore, type TimeBuff, generateDiagnosis, getStatus } from '../utils/rpgEngine';
import { Activity, ArrowRight, Zap, Lightbulb, AlertTriangle } from 'lucide-react';

type Props = {
  scores: GogyoScore;
  nikkanGogyo: string;
  timeBuffs?: TimeBuff[];
};

export const DiagnosisReport: React.FC<Props> = ({ scores, nikkanGogyo, timeBuffs = [] }) => {
  // 日運を含まないベースバフ（大運・年運・月運まで）
  const baseBuffs = timeBuffs.filter(t => !t.layer.includes("日運"));

  // ベース状態の計算（大運・年運・月運まで適用した現在の基本傾向）
  const baseStatsData = calculateRPGStats(scores, nikkanGogyo, baseBuffs);
  const baseDiagnosis = generateDiagnosis(baseStatsData, true); // true = バフ適用後のcurrentValueを使う

  // 日運を含めた最終状態の計算
  const currentStatsData = calculateRPGStats(scores, nikkanGogyo, timeBuffs);
  const currentDiagnosis = generateDiagnosis(currentStatsData, true);

  const isClassChanged = baseDiagnosis.type !== currentDiagnosis.type;

  const totalScore = currentDiagnosis.basePower + currentDiagnosis.worldBurden;
  const basePowerRatio = totalScore > 0 ? (currentDiagnosis.basePower / totalScore) * 100 : 50;

  // 日運バフのGOOD/BAD判定
  const dailyBuff = timeBuffs.find(t => t.layer.includes("日運"));
  let dailyActionAdvice = null;
  if (dailyBuff) {
    const status = getStatus(dailyBuff.effect, baseDiagnosis.type);
    
    if (status === 'good') {
      if (isClassChanged) {
        dailyActionAdvice = {
          status: 'GOOD',
          text: baseDiagnosis.type === 'shinkyo' 
            ? "💡 カレンダー判定：GOOD ── 特大バリア展開の日\n一時的にディフェンダー状態に反転！今日は強固な守りで一切のダメージを無効化できます！"
            : "💡 カレンダー判定：GOOD ── リミットブレイク発動の日\nエネルギーが極限までチャージされ、アタッカー状態に反転！今日は無敵の勢いでガンガン攻めましょう！"
        };
      } else {
        dailyActionAdvice = {
          status: 'GOOD',
          text: baseDiagnosis.type === 'shinkyo' 
            ? "💡 カレンダー判定：GOOD ── 攻撃と行動の日\n有り余るエネルギーを発散させるのに最高の日です。今日はガンガン現実世界を切り拓きましょう！"
            : "💡 カレンダー判定：GOOD ── 回復と防御の日\n過労気味のあなたに回復と防御をもたらす最高の日です。自分のための時間をたっぷり取りましょう！"
        };
      }
    } else if (status === 'bad') {
      if (isClassChanged) {
        dailyActionAdvice = {
          status: 'BAD',
          text: baseDiagnosis.type === 'shinkyo' 
            ? "⚠️ カレンダー判定：BAD ── 深刻なキャパオーバー\n負荷が限界を超え、ディフェンダー状態にダウン！今日だけは絶対に無理をせず、防戦に徹してください。"
            : "⚠️ カレンダー判定：BAD ── 危険なエネルギー暴走\n許容量を超えたエネルギーが流入し、制御不能のアタッカー状態に！衝動的な行動や衝突に要注意です。"
        };
      } else {
        dailyActionAdvice = {
          status: 'BAD',
          text: baseDiagnosis.type === 'shinkyo' 
            ? "⚠️ カレンダー判定：BAD ── 停滞と過剰の日\nエネルギーが過剰に溜まり、空回りしやすい日です。動きたくても動けないフラストレーションに注意してクールダウンを。"
            : "⚠️ カレンダー判定：BAD ── 過労とタスク増幅の日\nさらなるタスクが舞い込みやすく、キャパオーバーの危険があります。絶対に無理をしないでください。"
        };
      }
    }
  }

  let finalStatusText = currentDiagnosis.type === 'shinkyo' ? '【アタッカー】 エネルギー過剰' : '【ディフェンダー】 キャパオーバー';
  let finalStatusColor = currentDiagnosis.type === 'shinkyo' ? 'text-emerald-400' : 'text-rose-400';

  if (dailyBuff) {
    const status = getStatus(dailyBuff.effect, baseDiagnosis.type);
    if (isClassChanged) {
      if (baseDiagnosis.type === 'shinkyo') {
        if (status === 'good') {
          finalStatusText = '【ディフェンダー】 特大バリア展開（完全調和）';
          finalStatusColor = 'text-indigo-400';
        } else {
          finalStatusText = '【ディフェンダー】 深刻なキャパオーバー';
          finalStatusColor = 'text-rose-400';
        }
      } else {
        if (status === 'good') {
          finalStatusText = '【アタッカー】 リミットブレイク（覚醒）';
          finalStatusColor = 'text-yellow-400';
        } else {
          finalStatusText = '【アタッカー】 危険なエネルギー暴走';
          finalStatusColor = 'text-rose-400';
        }
      }
    } else {
      if (currentDiagnosis.type === 'shinkyo') {
        if (status === 'good') {
          finalStatusText = '【アタッカー】 エネルギー発散（絶好調）';
          finalStatusColor = 'text-emerald-400';
        } else if (status === 'bad') {
          finalStatusText = '【アタッカー】 エネルギー過剰（空回り）';
          finalStatusColor = 'text-rose-400';
        }
      } else {
        if (status === 'good') {
          finalStatusText = '【ディフェンダー】 エネルギー補給（回復中）';
          finalStatusColor = 'text-emerald-400';
        } else if (status === 'bad') {
          finalStatusText = '【ディフェンダー】 深刻なキャパオーバー';
          finalStatusColor = 'text-rose-400';
        }
      }
    }
  }

  return (
    <div className="space-y-3 mt-3">
      {/* =========================================
          コンパクト化: 基本クラス (Base Class)
         ========================================= */}
      <div className="flex items-center justify-between bg-slate-900/50 border border-slate-700/50 rounded-xl p-2.5 shadow-sm">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-slate-500" />
          <span className="text-[10px] text-slate-400 font-bold">ベース:</span>
          <span className="text-xs font-black text-slate-200 drop-shadow-sm">{baseDiagnosis.title}</span>
        </div>
      </div>

      {/* =========================================
          カード2: 本日のステータス (Today's Status)
         ========================================= */}
      <div className="bg-slate-800/90 border border-emerald-500/30 rounded-2xl p-3 shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 opacity-50"></div>
        
        <div className="relative z-10 flex flex-col items-center text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold tracking-widest border border-emerald-500/20 uppercase">
            <Zap size={12} />
            Today's Status
          </div>

          <div className="w-full max-w-md bg-slate-900/80 rounded-xl p-3 border border-slate-700/50 shadow-inner relative">
            {isClassChanged && (
              <div className="flex items-center justify-center gap-2 bg-indigo-500/20 border border-indigo-500/50 px-2 py-1.5 rounded-lg text-indigo-300 font-bold text-[10px] animate-pulse mb-3">
                <Zap size={12} className="text-yellow-400" />
                <span className="opacity-70 line-through">{baseDiagnosis.type === 'shinkyo' ? 'アタッカー' : 'ディフェンダー'}</span>
                <ArrowRight size={10} className="text-indigo-400" />
                <span className="text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]">反転: {currentDiagnosis.type === 'shinkyo' ? 'アタッカー' : 'ディフェンダー'}</span>
              </div>
            )}

            <div className="flex justify-between text-[10px] font-bold mb-1.5 px-1">
              <span className="text-emerald-400">Base Power: {currentDiagnosis.basePower}</span>
              <span className="text-rose-400">World Burden: {currentDiagnosis.worldBurden}</span>
            </div>

            <div className="relative h-2 bg-slate-700/50 rounded-full overflow-hidden flex border border-slate-600/50">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-1000 ease-out"
                style={{ width: `${basePowerRatio}%` }}
              ></div>
              <div
                className="h-full bg-gradient-to-r from-rose-400 to-rose-500 transition-all duration-1000 ease-out flex-1"
              ></div>
            </div>

            <div className="mt-2 text-xs font-black text-slate-200 tracking-wide bg-slate-800 py-1.5 rounded-lg border border-slate-700/50">
              最終状態: <span className={finalStatusColor}>
                {finalStatusText}
              </span>
            </div>
          </div>

          {dailyActionAdvice && (
            <div className={`w-full max-w-2xl text-left p-2.5 rounded-lg border shadow-md ${dailyActionAdvice.status === 'GOOD'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-100'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-100'
              }`}>
              <div className="flex items-start gap-2">
                {dailyActionAdvice.status === 'GOOD' ? (
                  <Lightbulb className="text-emerald-400 shrink-0 mt-0.5" size={14} />
                ) : (
                  <AlertTriangle className="text-rose-400 shrink-0 mt-0.5" size={14} />
                )}
                <p className="text-[10px] font-bold leading-relaxed whitespace-pre-wrap">
                  {dailyActionAdvice.text}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
