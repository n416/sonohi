import { useState, useEffect, useRef } from 'react';
import { Sparkles, Send, X, Loader2 } from 'lucide-react';
import { inferTrueTimePillar, extractTraumaYear, getYearlyBuffScore } from '../utils/suijiEngine';
import { calculateCalibrationYears, getNextPatchState, shouldAcceptNewState, type CalibrationYears } from '../utils/calibrationEngine';
import { calculateMeishiki } from '../utils/meishiki';
import { calculateRPGStats } from '../utils/rpgEngine';
import { type StatKey } from './RPGStatusRadar';

interface ProfileChatProps {
  currentYear: number;
  currentMonth: number;
  currentDay: number;
  currentTime: string;
  isOnboarding: boolean;
  onUpdateProfile: (year: number, month: number, day: number, time: string, patches: string[]) => void;
  onOpenTimeInference?: () => void; // 削除予定だが互換性のため残す
  onClose: () => void;
}

type Message = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  quickReplies?: string[];
};

type ChatPhase = 'idle' | 'ask_date' | 'ask_time' | 'inference_when' | 'inference_what' | 'calibration';

const formatTimeLabel = (timeStr: string) => {
  const timeMap: Record<string, string> = {
    "子": "23:00〜01:00",
    "丑": "01:00〜03:00",
    "寅": "03:00〜05:00",
    "卯": "05:00〜07:00",
    "辰": "07:00〜09:00",
    "巳": "09:00〜11:00",
    "午": "11:00〜13:00",
    "未": "13:00〜15:00",
    "申": "15:00〜17:00",
    "酉": "17:00〜19:00",
    "戌": "19:00〜21:00",
    "亥": "21:00〜23:00"
  };
  const timeKey = timeStr.replace('の刻', '');
  if (timeMap[timeKey]) {
    return `${timeKey}（${timeMap[timeKey]}）`;
  }
  return timeStr;
};

export const ProfileChat = ({
  currentYear, currentMonth, currentDay, currentTime,
  isOnboarding, onUpdateProfile, onClose
}: ProfileChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState<ChatPhase>('idle');
  const [whenAnswer, setWhenAnswer] = useState('');
  
  const [tempDate, setTempDate] = useState<{y: number, m: number, d: number} | null>(null);
  const savedTimeRef = useRef<string>('');

  // キャリブレーション用ステート
  const [calibPatches, setCalibPatches] = useState<string[]>([]);
  const [calibTemp, setCalibTemp] = useState<number>(1.0);
  const [calibBestScore, setCalibBestScore] = useState<number>(-1);
  const [calibYears, setCalibYears] = useState<CalibrationYears | null>(null);
  const [calibStep, setCalibStep] = useState<number>(0);
  const [calibAnswers, setCalibAnswers] = useState<Record<string, { year: number, answer: boolean }>>({});

  const scrollRef = useRef<HTMLDivElement>(null);
  
  // AI Worker State
  const workerRef = useRef<Worker | null>(null);
  const [isWorkerReady, setIsWorkerReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string>('');

  useEffect(() => {
    workerRef.current = new Worker(new URL('../workers/aiWorker.ts', import.meta.url), {
      type: 'module'
    });
    workerRef.current.postMessage({ type: 'init' });

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!workerRef.current) return;
    workerRef.current.onmessage = (event) => {
      const { type, data, intent } = event.data;

      if (type === 'ready') {
        setIsWorkerReady(true);
        setLoadingStatus('');
      } else if (type === 'progress') {
        setLoadingStatus(data.file || 'AIモデルをロード中...');
      } else if (type === 'profile_extracted') {
        handleAIResponse(intent, data);
      } else if (type === 'result') {
        handleClassificationResult(event.data.result, event.data.score, event.data.inputText);
      }
    };
  });

  useEffect(() => {
    if (isOnboarding) {
      setPhase('ask_date');
      setMessages([
        { 
          role: 'assistant', 
          content: 'こんにちは！四柱推命RPGの世界へようこそ。\nまずはあなたの生年月日を教えてください。\n（例：1995年10月5日、1990/01/01 など）',
        }
      ]);
    } else {
      setPhase('idle');
      setMessages([
        { 
          role: 'assistant', 
          content: `現在の設定は以下の通りです。\n・生年月日: ****年${currentMonth}月${currentDay}日\n・出生時間: ${formatTimeLabel(currentTime)}\n\n「生年月日を変更」「時間を変更」のどれを行いますか？`,
          quickReplies: ['生年月日を変更したい', '時間を変更したい']
        }
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnboarding]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isProcessing]);

  const addAssistantMessage = (content: string, quickReplies?: string[]) => {
    setMessages(prev => [...prev, { role: 'assistant', content, quickReplies }]);
  };

  const handleAIResponse = (intent: string, data: {year?: number, month?: number, day?: number, time?: string}) => {
    setIsProcessing(false);
    
    if (data.year && data.month && data.day) {
      setTempDate({ y: data.year, m: data.month, d: data.day });
      
      if (isOnboarding) {
        setPhase('ask_time');
        addAssistantMessage(`ありがとうございます！「****年${data.month}月${data.day}日」ですね。\n\n最後に、生まれた時間はわかりますか？\n（例：14時30分、わからない場合は「不明」で構いません）`, ['14時ごろです', '不明です', 'AIに推測してほしい']);
      } else {
        startCalibration(data.year, data.month, data.day, currentTime);
      }
      return;
    }

    if (phase === 'idle') {
      if (intent === 'DATE') {
        setPhase('ask_date');
        addAssistantMessage("新しい生年月日を教えてください！（例：1990年5月15日）");
        return;
      }
      if (intent === 'TIME') {
        setPhase('ask_time');
        addAssistantMessage("新しい出生時間を教えてください！（例：14時、または不明）");
        return;
      }
    }
    
    if (phase === 'ask_time' || intent === 'TIME' || intent === 'UNKNOWN' || intent === 'INFERENCE') {
      const isUnknown = intent === 'UNKNOWN';
      const isSuiji = intent === 'INFERENCE';
      const hasDate = !!tempDate || !!currentYear;

      if (isSuiji || (isUnknown && hasDate)) {
         const responseText = isSuiji 
           ? "承知しました！AIによる推測（推時）を起動します..."
           : "時間を「不明」として一時設定しました。それでは、AI推測機能（推時）を起動して時間を特定してみましょう...";
           
         addAssistantMessage(responseText);
           
         setTimeout(() => {
           setPhase('inference_when');
           addAssistantMessage("まず最初に、これまでの人生で一番「辛かった」時期、あるいは「大きな環境の変化があった」時期はいつ頃（何年、または何歳）でしたか？", ['2018年頃です', '25歳の時です', '直近（ここ1〜2年）です', '思い当たりません']);
         }, 1000);
         return;
      } else if (data.time) {
        savedTimeRef.current = data.time;
        const y = tempDate ? tempDate.y : currentYear;
        const m = tempDate ? tempDate.m : currentMonth;
        const d = tempDate ? tempDate.d : currentDay;
        
        let responseText = `時間を「${formatTimeLabel(data.time)}」として設定しました！`;
        addAssistantMessage(responseText);
        
        setTimeout(() => {
          startCalibration(y, m, d, data.time!);
        }, 500);
        return;
      } else {
         if (phase === 'ask_time') {
           addAssistantMessage("すみません、時間をうまく抽出できませんでした。「14時」や「夕方」、あるいは「不明」のように教えてください。");
           return;
         }
      }
    }

    if (phase === 'ask_date') {
      addAssistantMessage("すみません、うまく日付を抽出できませんでした...\n「1990年5月15日」や「1995/10/05」のように生年月日を教えていただけますか？");
      return;
    }

    addAssistantMessage("すみません、AIが意図をうまく解析できませんでした。「生年月日を変更したい」「時間を変更したい」などの指示か、直接「1990年1月1日」のように入力してください！");
  };

  const handleClassificationResult = (parameter: string, score: number, inputText: string) => {
    setIsProcessing(false);
    
    if (score < 0.15) {
      addAssistantMessage('すみません、それだけだと特定の五行に分類するのが少し難しいです...。\nもう少しだけ具体的に、その時「何が原因で辛かったか」や「どんな感情だったか」を教えていただけますか？', ['過労やプレッシャーで潰れそうだった', '感情が爆発して失敗した', '人間関係で激しく衝突した', '何もかも停滞して動けなかった']);
      return;
    }

    const y = tempDate ? tempDate.y : currentYear;
    const m = tempDate ? tempDate.m : currentMonth;
    const d = tempDate ? tempDate.d : currentDay;

    const traumaYear = extractTraumaYear(whenAnswer || inputText || '', y);
    const { time, explanation } = inferTrueTimePillar(y, m, d, traumaYear, parameter as StatKey, inputText || '');
    savedTimeRef.current = time;

    let responseText = `AIによる推論が完了しました！\n\n${explanation}\n\nこの結果から、あなたの生まれ時間は「${formatTimeLabel(time)}」である可能性が高いと判断しました！時間として設定します。`;
    addAssistantMessage(responseText);
    
    setTimeout(() => {
      startCalibration(y, m, d, time);
    }, 2000);
  };

  const CALIB_QUESTIONS = [
    { key: 'ATK', text: (age: number) => age <= 22 ? `${age}歳の頃、部活や勉強、進路などで大きな勝負に出たり、新しいことに挑戦しませんでしたか？` : `${age}歳の頃、仕事やプライベートで何か大きな勝負に出たり、独立・転職など新しい挑戦をしませんでしたか？` },
    { key: 'DEF', text: (age: number) => age <= 22 ? `${age}歳の頃は、周りに合わせて自分を押し殺したり、じっと耐え忍ぶような時期ではありませんでしたか？` : `${age}歳の頃は、自分の意見を押し殺してじっと耐え忍ぶような、我慢の時期ではありませんでしたか？` },
    { key: 'HP', text: (age: number) => age <= 22 ? `${age}歳の頃、勉強や部活、人間関係で心身のエネルギーがすり減って、燃え尽きそうになった経験がありませんでしたか？` : `${age}歳の頃、心身のエネルギーがすり減って、燃え尽きそうになった経験がありませんでしたか？` },
    { key: 'CHU', text: (age: number) => age <= 22 ? `${age}歳の頃、親しい友人との突然の別れや、学校など環境の予期せぬ激変がありませんでしたか？` : `${age}歳の頃、親しい人との突然の別れや、予期せぬ環境の激変がありませんでしたか？` }
  ];

  const startCalibration = (y: number, m: number, d: number, t: string) => {
    setPhase('calibration');
    setCalibStep(0);
    setCalibPatches([]);
    setCalibTemp(1.0);
    setCalibBestScore(-1);
    setCalibAnswers({});
    
    const years = calculateCalibrationYears(y, m, d, t, []);
    setCalibYears(years);
  
    addAssistantMessage("最後に、AIの精度を高めるため「パッチキャリブレーション」を行います。過去の出来事について4つ質問させてください。");
    
    setTimeout(() => {
      askCalibrationQuestion(0, years, {});
    }, 1000);
  };

  const askCalibrationQuestion = (step: number, years: CalibrationYears, answers: typeof calibAnswers) => {
    const q = CALIB_QUESTIONS[step];
    
    let targetYear = 0;
    if (q.key === 'ATK') targetYear = years.atkYear;
    if (q.key === 'DEF') targetYear = years.defYear;
    if (q.key === 'HP') targetYear = years.hpYear;
    if (q.key === 'CHU') targetYear = years.chuYear;
  
    if (targetYear === 0) {
      handleCalibrationAnswer(true, step, years, answers, true);
      return;
    }
  
    const birthYear = tempDate ? tempDate.y : currentYear;
    const age = targetYear - birthYear;
  
    if (answers[q.key] && answers[q.key].year === targetYear) {
      handleCalibrationAnswer(answers[q.key].answer, step, years, answers, true);
      return;
    }
  
    setCalibStep(step);
    addAssistantMessage(q.text(age), ['Yes', 'No']);
  };

  const handleCalibrationAnswer = (isYes: boolean, step: number, years: CalibrationYears, currentAnswers: typeof calibAnswers, isAutoSkip: boolean) => {
    const q = CALIB_QUESTIONS[step];
    let targetYear = 0;
    if (q.key === 'ATK') targetYear = years.atkYear;
    if (q.key === 'DEF') targetYear = years.defYear;
    if (q.key === 'HP') targetYear = years.hpYear;
    if (q.key === 'CHU') targetYear = years.chuYear;
  
    const newAnswers = { ...currentAnswers };
    if (targetYear !== 0) {
      newAnswers[q.key] = { year: targetYear, answer: isYes };
    }
    setCalibAnswers(newAnswers);
  
    if (step < 3) {
      if (!isAutoSkip) {
        setTimeout(() => askCalibrationQuestion(step + 1, years, newAnswers), 500);
      } else {
        askCalibrationQuestion(step + 1, years, newAnswers);
      }
    } else {
      evaluateCalibrationRound(newAnswers);
    }
  };

  const completeCalibration = () => {
    const y = tempDate ? tempDate.y : currentYear;
    const m = tempDate ? tempDate.m : currentMonth;
    const d = tempDate ? tempDate.d : currentDay;
    const t = savedTimeRef.current;
    
    let calcDay = d;
    if (calibPatches.includes('PATCH_YASHIJI') && t === '子') {
      const dateObj = new Date(y, m - 1, d);
      dateObj.setDate(dateObj.getDate() + 1);
      calcDay = dateObj.getDate();
    }
    const meishiki = calculateMeishiki(y, m, calcDay, t);
    const yearlyBuff = getYearlyBuffScore(currentYear);
    
    if (calibPatches.includes('PATCH_KUBOU')) {
      Object.keys(yearlyBuff).forEach(k => {
        yearlyBuff[k as keyof typeof yearlyBuff] *= 0.5;
      });
    }

    const buffedScore = {
      wood: meishiki.gogyoScore.wood + yearlyBuff.wood,
      fire: meishiki.gogyoScore.fire + yearlyBuff.fire,
      earth: meishiki.gogyoScore.earth + yearlyBuff.earth,
      metal: meishiki.gogyoScore.metal + yearlyBuff.metal,
      water: meishiki.gogyoScore.water + yearlyBuff.water,
    };

    const stats = calculateRPGStats(buffedScore, meishiki.nikkanGogyo, []);
    
    const topStats = stats
      .filter(s => ['ATK', 'DEF', 'HP'].includes(s.key))
      .sort((a, b) => b.currentValue - a.currentValue)
      .slice(0, 2);

    const getFeedbackText = (key: string, targetYear: number, birthYear: number) => {
      const age = targetYear - birthYear;
      if (key === 'ATK') return age <= 22 ? `${age}歳の頃の「部活や進路での大きな挑戦」` : `${age}歳の頃の「仕事やプライベートでの大きな勝負」`;
      if (key === 'DEF') return age <= 22 ? `${age}歳の頃の「周りに合わせて自分を押し殺した忍耐」` : `${age}歳の頃の「自分の意見を押し殺してじっと耐え忍んだ経験」`;
      if (key === 'HP') return age <= 22 ? `${age}歳の頃の「人間関係や勉強で燃え尽きそうになった経験」` : `${age}歳の頃の「エネルギーがすり減って燃え尽きそうになった経験」`;
      return '';
    };

    let feedback = `キャリブレーションが完了しました！AIがあなたの運勢の波を完全に同調させました。\n\n`;
    
    if (calibYears) {
      feedback += `ちなみに、現在のあなたのステータス傾向から過去の特異点を振り返ると、\n`;
      topStats.forEach(stat => {
        let yTarget = 0;
        if (stat.key === 'ATK') yTarget = calibYears.atkYear;
        if (stat.key === 'DEF') yTarget = calibYears.defYear;
        if (stat.key === 'HP') yTarget = calibYears.hpYear;
        
        if (yTarget > 0) {
          feedback += `・${getFeedbackText(stat.key, yTarget, y)}\n`;
        }
      });
      feedback += `\nこれらの経験が、現在のあなたの強み（${topStats.map(s => s.subject).join('、')}）を形成する重要なベースになっています。\n\n`;
    }
    
    feedback += `右上の「完了して閉じる」ボタンでステータス画面へお進みください。`;

    addAssistantMessage(feedback, ['閉じる']);
    onUpdateProfile(y, m, d, savedTimeRef.current, calibPatches);
  };

  const evaluateCalibrationRound = (finalAnswers: typeof calibAnswers) => {
    let score = 0;
    Object.values(finalAnswers).forEach(a => {
      if (a.answer) score++;
    });
  
    if (score === 4) {
      completeCalibration();
      return;
    }

    let currentTemp = calibTemp;
    let currentBestScore = calibBestScore;
    let currentPatches = calibPatches;
    let newYears: CalibrationYears | null = null;
    const currentAnswers = finalAnswers;
  
    if (shouldAcceptNewState(currentBestScore, score, currentTemp)) {
      currentBestScore = score;
      setCalibBestScore(score);
    }

    const y = tempDate ? tempDate.y : currentYear;
    const m = tempDate ? tempDate.m : currentMonth;
    const d = tempDate ? tempDate.d : currentDay;

    let needNewQuestion = false;
    let loopCount = 0;

    // 新しい質問（未回答の年）が発生する状態を引くまで裏で焼きなましを進行させる
    while (currentTemp >= 0.1 && score < 4 && loopCount < 50) {
      loopCount++;
      const nextPatches = getNextPatchState(currentPatches);
      const nextYears = calculateCalibrationYears(y, m, d, savedTimeRef.current, nextPatches);
      
      const targetYears = {
        ATK: nextYears.atkYear,
        DEF: nextYears.defYear,
        HP: nextYears.hpYear,
        CHU: nextYears.chuYear
      };

      let hasNewQuestion = false;
      let nextScore = 0;
      
      for (const key of ['ATK', 'DEF', 'HP', 'CHU'] as const) {
        // ts-ignore は使わず、型安全にアクセス
        const k = key as keyof typeof targetYears;
        if (targetYears[k] === 0) {
          nextScore++; 
        } else if (currentAnswers[k] && currentAnswers[k].year === targetYears[k]) {
          if (currentAnswers[k].answer) nextScore++;
        } else {
          hasNewQuestion = true;
        }
      }

      if (hasNewQuestion) {
        needNewQuestion = true;
        currentPatches = nextPatches;
        currentTemp = currentTemp * 0.8;
        newYears = nextYears;
        break;
      } else {
        score = nextScore;
        if (shouldAcceptNewState(currentBestScore, score, currentTemp)) {
          currentBestScore = score;
          setCalibBestScore(score);
        }
        currentPatches = nextPatches;
        currentTemp = currentTemp * 0.8;
      }
    }

    setCalibPatches(currentPatches);
    setCalibTemp(currentTemp);

    if (score === 4 || currentTemp < 0.1 || !needNewQuestion || !newYears) {
      completeCalibration();
      return;
    }
  
    setCalibYears(newYears);
    addAssistantMessage("なるほど...少し視点を変えて、再計算してみます。");
    setTimeout(() => {
      askCalibrationQuestion(0, newYears, currentAnswers);
    }, 1000);
  };

  const sendMessage = (overrideText?: string) => {
    // イベントオブジェクトが渡された場合は無視する
    const textStr = typeof overrideText === 'string' ? overrideText : input;
    const text = textStr.trim();
    if (!text || isProcessing) return;

    if (text === '閉じる') {
      onClose();
      return;
    }

    if (phase === 'inference_when') {
      const toHalfWidth = (str: string) => str.replace(/[！-～]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)).replace(/　/g, ' ');
      const normalizedText = toHalfWidth(text);
      
      const isNone = normalizedText.includes('ない') || normalizedText.includes('思い当たら') || normalizedText.includes('不明') || normalizedText.includes('わからない');
      const yearMatch = normalizedText.match(/(19\d{2}|20\d{2})年?/);
      const ageMatch = normalizedText.match(/(\d{1,3})[歳才]/);

      setMessages(prev => [...prev, { role: 'user', content: text }]);
      setInput('');

      if (isNone && !yearMatch && !ageMatch) {
        setTimeout(() => {
          addAssistantMessage("なるほど、特に「辛かった時期」は思い当たらないのですね。\n\nでは逆に、人生で一番『大きな達成感があった』『就職や結婚などの大きな節目だった』など、ポジティブな環境の変化があったのはいつ頃（何年、または何歳）でしたか？", ['2020年頃です', '25歳の時です', '直近です']);
        }, 500);
        return;
      }

      if (!yearMatch && !ageMatch) {
        setTimeout(() => {
          addAssistantMessage("すみません、四柱推命の天候バフ（年運）を計算して時間を逆算するため、具体的な『西暦（例：2018年）』や『年齢（例：25歳）』が含まれている必要があります。もう一度教えていただけますか？\n（特にない場合は、直近の「2023年」など仮の年でも構いません）");
        }, 500);
        return;
      }

      setWhenAnswer(text);
      setPhase('inference_what');
      setTimeout(() => {
        const extractedStr = yearMatch ? `${yearMatch[1]}年` : `${ageMatch![1]}歳の時`;
        addAssistantMessage(`なるほど、「${extractedStr}」ですね。カレンダーエンジンから当時の天候バフを取得しました。\n\nそれでは、その時期に具体的に「何が原因で辛かったか」や「どんな感情だったか」を教えていただけますか？\n（例えば：仕事のプレッシャー、人間関係の衝突、お金の失敗、など）`, ['過労やプレッシャーで潰れそうだった', '感情が爆発して失敗した', '人間関係で激しく衝突した', '何もかも停滞して動けなかった']);
      }, 500);
      return;
    }

    if (phase === 'inference_what') {
      setMessages(prev => [...prev, { role: 'user', content: text }]);
      setInput('');
      if (workerRef.current && isWorkerReady) {
        setIsProcessing(true);
        workerRef.current.postMessage({ type: 'classify', text });
      }
      return;
    }
    
    if (phase === 'calibration') {
      const isYes = text.toLowerCase() === 'yes' || text === 'はい';
      const isNo = text.toLowerCase() === 'no' || text === 'いいえ';
      
      if (!isYes && !isNo) {
        setMessages(prev => [...prev, { role: 'user', content: text }]);
        setInput('');
        addAssistantMessage("「Yes」か「No」でお答えください。", ['Yes', 'No']);
        return;
      }
      
      setMessages(prev => [...prev, { role: 'user', content: text }]);
      setInput('');
      handleCalibrationAnswer(isYes, calibStep, calibYears!, calibAnswers, false);
      return;
    }

    // 強制モード切り替え（クイックリプライ等からの即時処理）
    if (text === '生年月日を変更' || text === '生年月日を変更したい') {
      setPhase('ask_date');
      setMessages(prev => [...prev, { role: 'user', content: text }, { role: 'assistant', content: "新しい生年月日を教えてください！（例：1990年5月15日）" }]);
      setInput('');
      return;
    }
    if (text === '時間を変更' || text === '時間を変更したい') {
      setPhase('ask_time');
      setMessages(prev => [...prev, { role: 'user', content: text }, { role: 'assistant', content: "新しい出生時間を教えてください！（例：14時、または不明）" }]);
      setInput('');
      return;
    }

    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setInput('');
    
    if (workerRef.current && isWorkerReady) {
      setIsProcessing(true);
      workerRef.current.postMessage({ type: 'extract_profile', text });
    } else {
      setIsProcessing(true);
      setTimeout(() => {
        setIsProcessing(false);
        addAssistantMessage("現在AIモデルを初期化中です。もう少し待ってから再度送信してください！");
      }, 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden h-[85vh] ring-1 ring-indigo-500/20 relative animate-in zoom-in-95 duration-300">
        
        <div className="bg-slate-800/80 p-4 border-b border-slate-700 flex justify-between items-center backdrop-blur-sm z-10">
          <div className="flex items-center gap-2 text-indigo-400">
            <Sparkles size={20} className="animate-pulse" />
            <h3 className="font-bold tracking-wider text-sm md:text-base flex items-center gap-2">
              プロフィール管理 <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30">AI解析</span>
            </h3>
          </div>
          {!isOnboarding && (
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-2 rounded-full hover:bg-slate-700">
              <X size={20} />
            </button>
          )}
          {isOnboarding && tempDate && phase === 'idle' && (
             <button onClick={onClose} className="text-indigo-300 hover:text-white transition-colors text-xs font-bold bg-indigo-900/50 hover:bg-indigo-600 px-4 py-1.5 rounded-full border border-indigo-500/50">
               完了して閉じる
             </button>
          )}
        </div>
        
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-gradient-to-b from-slate-900 to-slate-950">
          {!isWorkerReady && (
            <div className="flex justify-center mb-4">
              <div className="bg-slate-800/50 border border-slate-700/50 text-slate-400 text-xs px-3 py-1.5 rounded-full flex items-center gap-2">
                <Loader2 size={12} className="animate-spin text-indigo-400 shrink-0" />
                <span className="whitespace-nowrap">AIモデルを初期化中...</span>
                {loadingStatus && (
                  <span className="opacity-50 w-32 inline-block truncate align-bottom">
                    {loadingStatus}
                  </span>
                )}
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] md:max-w-[80%] rounded-2xl p-4 whitespace-pre-wrap shadow-lg text-sm md:text-base leading-relaxed ${
                msg.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-tr-none' 
                  : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          
          {isProcessing && (
            <div className="flex justify-start animate-in fade-in duration-300">
              <div className="bg-slate-800 text-slate-400 rounded-2xl rounded-tl-none border border-slate-700 p-4 shadow-lg flex items-center gap-3">
                <Loader2 size={16} className="animate-spin text-indigo-400" />
                <span className="text-sm">AIが推論中...</span>
              </div>
            </div>
          )}

          {messages[messages.length - 1]?.role === 'assistant' && messages[messages.length - 1]?.quickReplies && !isProcessing && (
            <div className="flex flex-wrap gap-2 mt-2 animate-in slide-in-from-bottom-2 fade-in duration-300">
              {messages[messages.length - 1].quickReplies!.map((reply, i) => (
                <button
                  key={i}
                  disabled={!isWorkerReady || isProcessing}
                  onClick={() => sendMessage(reply)}
                  className="bg-slate-800 hover:bg-indigo-600 border border-slate-700 hover:border-indigo-500 text-slate-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-800 disabled:hover:border-slate-700 disabled:hover:text-slate-300 text-sm px-4 py-2 rounded-full transition-colors shadow-sm"
                >
                  {reply}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-800/80 border-t border-slate-700 flex gap-2 backdrop-blur-sm relative">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder={
              !isWorkerReady ? "AIモデルを準備中..." :
              phase === 'ask_date' ? "例：1990年5月15日" : 
              phase === 'ask_time' ? "例：夕方の16時くらい" : 
              phase === 'inference_when' ? "例：2018年、あるいは25歳の時" :
              phase === 'inference_what' ? "例：人間関係でトラブルがあった" :
              phase === 'calibration' ? "Yes または No" :
              "生年月日や時間を入力"
            }
            className="flex-1 bg-slate-950 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-600 text-sm md:text-base disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!isWorkerReady || isProcessing}
          />
          <button 
            id="system-send-btn"
            onClick={() => sendMessage()}
            disabled={!input.trim() || !isWorkerReady || isProcessing}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 rounded-xl flex items-center gap-2 transition-colors font-bold shadow-[0_0_10px_rgba(79,70,229,0.3)] hover:shadow-[0_0_15px_rgba(79,70,229,0.5)]"
          >
            {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
};
