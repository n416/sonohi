import { useState, useEffect, useRef } from 'react';
import { Sparkles, Send, X, Loader2 } from 'lucide-react';
import { inferTrueTimePillar, extractTraumaYear } from '../utils/suijiEngine';
import { type StatKey } from './RPGStatusRadar';

interface ProfileChatProps {
  currentYear: number;
  currentMonth: number;
  currentDay: number;
  currentTime: string;
  isOnboarding: boolean;
  onUpdateProfile: (year: number, month: number, day: number, time: string) => void;
  onOpenTimeInference?: () => void; // 削除予定だが互換性のため残す
  onClose: () => void;
}

type Message = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  quickReplies?: string[];
};

type ChatPhase = 'idle' | 'ask_date' | 'ask_time' | 'inference_when' | 'inference_what';

export const ProfileChat = ({
  currentYear, currentMonth, currentDay, currentTime,
  isOnboarding, onUpdateProfile, onClose
}: ProfileChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState<ChatPhase>('idle');
  const [whenAnswer, setWhenAnswer] = useState('');
  
  const [tempDate, setTempDate] = useState<{y: number, m: number, d: number} | null>(null);

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

    workerRef.current.postMessage({ type: 'init' });

    return () => {
      workerRef.current?.terminate();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isOnboarding) {
      setPhase('ask_date');
      setMessages([
        { 
          role: 'assistant', 
          content: 'こんにちは！四柱推命RPGの世界へようこそ。\nまずはあなたの生年月日を教えてください。\n（例：1995年10月5日、1990/01/01 など）',
          quickReplies: ['1990年1月1日', '2000/04/01']
        }
      ]);
    } else {
      setPhase('idle');
      setMessages([
        { 
          role: 'assistant', 
          content: `現在の設定は以下の通りです。\n・生年月日: ****年${currentMonth}月${currentDay}日\n・出生時間: ${currentTime}\n\n「生年月日の変更」「時間の変更」のどちらを行いますか？\n（自然な言葉で話しかけていただければAIが解析します）`,
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
        onUpdateProfile(data.year, data.month, data.day, currentTime);
        setPhase('idle');
        addAssistantMessage(`生年月日を「****年${data.month}月${data.day}日」に変更しました！他に何かありますか？`, ['閉じる']);
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
        let responseText = `「${data.time}の刻」として設定しました！`;
        
        if (isOnboarding) {
          responseText += "\n初期化が完了しました！右上の「閉じる」ボタンでステータス画面へお進みください。";
          onUpdateProfile(tempDate!.y, tempDate!.m, tempDate!.d, data.time);
        } else {
          responseText += "\n他に何か変更しますか？";
          const y = tempDate ? tempDate.y : currentYear;
          const m = tempDate ? tempDate.m : currentMonth;
          const d = tempDate ? tempDate.d : currentDay;
          onUpdateProfile(y, m, d, data.time);
        }
        setPhase('idle');
        addAssistantMessage(responseText, isOnboarding ? ['閉じる'] : ['閉じる', '生年月日を変更', '時間を変更']);
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

    let responseText = `AIによる推論が完了しました！\n\n${explanation}\n\nこの結果から、あなたの生まれ時間は「${time}の刻」である可能性が高いと判断しました！時間として設定しました。`;
    
    onUpdateProfile(y, m, d, time);
    
    if (isOnboarding) {
       responseText += "\n\n初期化が完了しました！右上の「完了して閉じる」ボタンでステータス画面へお進みください。";
    } else {
       responseText += "\n\n他に何か変更しますか？";
    }
    
    setPhase('idle');
    addAssistantMessage(responseText, isOnboarding ? [] : ['閉じる', '生年月日を変更', '時間を変更']);
  };

  const sendMessage = () => {
    if (!input.trim() || isProcessing) return;
    
    const text = input.trim();

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
                <Loader2 size={12} className="animate-spin text-indigo-400" />
                AIモデルを初期化中... {loadingStatus && <span className="opacity-50 max-w-[150px] truncate">{loadingStatus}</span>}
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
                  onClick={() => {
                    setInput(reply);
                    setTimeout(() => {
                      const btn = document.getElementById('system-send-btn');
                      if (btn) btn.click();
                    }, 0);
                  }}
                  className="bg-slate-800 hover:bg-indigo-600 border border-slate-700 hover:border-indigo-500 text-slate-300 hover:text-white text-sm px-4 py-2 rounded-full transition-colors shadow-sm"
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
              phase === 'ask_date' ? "例：1990年5月15日" : 
              phase === 'ask_time' ? "例：夕方の16時くらい" : 
              phase === 'inference_when' ? "例：2018年、あるいは25歳の時" :
              phase === 'inference_what' ? "例：人間関係でトラブルがあった" :
              "生年月日や時間を入力"
            }
            className="flex-1 bg-slate-950 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-600 text-sm md:text-base disabled:opacity-50"
            disabled={isProcessing}
          />
          <button 
            id="system-send-btn"
            onClick={sendMessage}
            disabled={!input.trim() || isProcessing}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 rounded-xl flex items-center gap-2 transition-colors font-bold shadow-[0_0_10px_rgba(79,70,229,0.3)] hover:shadow-[0_0_15px_rgba(79,70,229,0.5)]"
          >
            {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
};
