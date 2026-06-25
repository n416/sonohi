import React from 'react';
import { calculateRPGStats, type GogyoScore, type StatKey, type TimeBuff } from './RPGStatusRadar';
import { Activity, ArrowRight, Zap } from 'lucide-react';

type Props = {
  scores: GogyoScore;
  nikkanGogyo: string;
  timeBuffs?: TimeBuff[];
};

export const generateDiagnosis = (statsData: { key: StatKey; baseValue: number; currentValue: number }[], useCurrent: boolean = false) => {
  const getValue = (key: StatKey) => {
    const stat = statsData.find(s => s.key === key);
    if (!stat) return 0;
    return useCurrent ? stat.currentValue : stat.baseValue;
  };

  const basePower = getValue('HP') + getValue('MP');
  const worldBurden = getValue('ATK') + getValue('DEX') + getValue('DEF');

  let maxKey: StatKey = statsData[0].key;
  let minKey: StatKey = statsData[0].key;
  let maxVal = useCurrent ? statsData[0].currentValue : statsData[0].baseValue;
  let minVal = useCurrent ? statsData[0].currentValue : statsData[0].baseValue;

  statsData.forEach(stat => {
    const val = useCurrent ? stat.currentValue : stat.baseValue;
    if (val > maxVal) {
      maxVal = val;
      maxKey = stat.key;
    }
    if (val < minVal) {
      minVal = val;
      minKey = stat.key;
    }
  });

  const featureTitles: Record<StatKey, string> = {
    ATK: "暴走する表現者",
    DEX: "計算高き商人",
    DEF: "鉄壁の防衛者",
    MP: "象牙の塔の賢者",
    HP: "揺るぎなき覇王"
  };

  const isMikyo = basePower >= worldBurden;
  const baseTitle = isMikyo ? "【重戦車クラス】" : "【技巧派クラス】";
  const featureTitle = featureTitles[maxKey];
  const finalTitle = `${baseTitle}${featureTitle}`;

  const description = isMikyo
    ? `あなたのエネルギー（HP+MP: ${basePower}）は外界の負荷を上回っており、非常にタフな状態です。特に『${maxKey}』の能力が突出しているため、この強みを活かしてガンガン現実世界を切り拓いてください。ただし、『${minKey}』が弱点となっているため、勢い余ってここで足をすくわれないよう注意が必要です。`
    : `あなたは現在、自分のキャパシティ（HP+MP: ${basePower}）以上のタスクや負荷を外の世界から抱え込んでいる状態です。最大の武器である『${maxKey}』を活かしたいところですが、まずは致命的な弱点である『${minKey}』を補うか、しっかりと休息（HP/MP）をとって防御力を高めることを最優先にしてください。無理は禁物です。`;

  const subText = isMikyo
    ? `※インプット（MP）ばかりしていると、行動しない頭でっかちになるため注意が必要です。`
    : `※しっかりと学び（MP）、信頼できる仲間（HP）を集めることで、無理なく外界のタスクを処理できるようになります。`;

  return {
    type: isMikyo ? 'shinkyo' : 'shinjaku',
    basePower,
    worldBurden,
    title: finalTitle,
    description,
    subText
  };
};

export const DiagnosisReport: React.FC<Props> = ({ scores, nikkanGogyo, timeBuffs = [] }) => {
  const statsData = calculateRPGStats(scores, nikkanGogyo, timeBuffs);
  
  const baseDiagnosis = generateDiagnosis(statsData, false);
  const currentDiagnosis = generateDiagnosis(statsData, true);

  const isClassChanged = baseDiagnosis.type !== currentDiagnosis.type;
  
  // バフ反映後のカレントをメインとして表示する
  const diagnosis = currentDiagnosis;

  const totalScore = diagnosis.basePower + diagnosis.worldBurden;
  const basePowerRatio = totalScore > 0 ? (diagnosis.basePower / totalScore) * 100 : 50;

  return (
    <div className="bg-slate-900/80 border border-indigo-500/30 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden mt-6 group">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

      <div className="relative z-10 flex flex-col items-center text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-bold tracking-widest border border-indigo-500/20 uppercase">
          <Activity size={14} />
          Personality Analysis
        </div>

        <h3 className="text-2xl md:text-3xl font-black text-white drop-shadow-md">
          {diagnosis.title}
        </h3>

        {/* クラスチェンジ（シフト）エフェクトの表示 */}
        {isClassChanged && (
          <div className="flex items-center gap-3 bg-indigo-500/20 border border-indigo-500/50 px-4 py-2 rounded-xl text-indigo-300 font-bold text-sm animate-pulse">
            <Zap size={16} className="text-yellow-400" />
            <span className="opacity-70 line-through">初期判定: {baseDiagnosis.type === 'shinkyo' ? '身強' : '身弱'}</span>
            <ArrowRight size={14} className="text-indigo-400" />
            <span className="text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]">現在: {currentDiagnosis.type === 'shinkyo' ? '身強' : '身弱'}に反転中！</span>
          </div>
        )}

        {/* ゲージUI */}
        <div className="w-full max-w-md bg-slate-800/80 rounded-2xl p-4 md:p-5 border border-slate-700/50 shadow-inner">
          <div className="flex justify-between text-xs font-bold mb-2 px-1">
            <span className="text-emerald-400">Base Power (HP+MP): {diagnosis.basePower}</span>
            <span className="text-rose-400">World Burden (ATK+DEX+DEF): {diagnosis.worldBurden}</span>
          </div>

          <div className="relative h-4 bg-slate-700/50 rounded-full overflow-hidden flex border border-slate-600/50">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-1000 ease-out"
              style={{ width: `${basePowerRatio}%` }}
            ></div>
            <div
              className="h-full bg-gradient-to-r from-rose-400 to-rose-500 transition-all duration-1000 ease-out flex-1"
            ></div>
          </div>

          <div className="mt-4 text-base font-black text-slate-200 tracking-wide bg-slate-900/50 py-2 rounded-xl border border-slate-700/50">
            判定: <span className={diagnosis.type === 'shinkyo' ? 'text-emerald-400' : 'text-rose-400'}>
              {diagnosis.type === 'shinkyo' ? 'あなたは「身強」です' : 'あなたは「身弱」です'}
            </span>
          </div>
        </div>

        <div className="w-16 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full my-2"></div>

        <div className="space-y-3">
          <p className="text-sm md:text-base text-slate-300 leading-relaxed max-w-2xl font-medium">
            {diagnosis.description}
          </p>
          <p className="text-xs md:text-sm text-slate-400 leading-relaxed max-w-2xl font-medium italic">
            {diagnosis.subText}
          </p>
        </div>
      </div>
    </div>
  );
};
