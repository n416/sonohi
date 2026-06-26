import { useState, useRef, useEffect } from 'react';
import { X, Send, RefreshCw, Sparkles, Cpu, Download } from 'lucide-react';
import { type StatKey } from './RPGStatusRadar';

import { inferTrueTimePillar, extractTraumaYear } from '../utils/suijiEngine';

type Message = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  quickReplies?: string[];
};

export const AITimeInferenceChat = ({ 
  birthYear,
  birthMonth,
  birthDay,
  onComplete, 
  onCancel 
}: { 
  birthYear: number,
  birthMonth: number,
  birthDay: number,
  onComplete: (time: string) => void, 
  onCancel: () => void 
}) => {
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: 'assistant', 
      content: '生まれた時間が不明とのことですね。\n過去の出来事から、あなたの生まれ時間を特定しましょう。\n\nまず最初に、これまでの人生で一番「辛かった」時期、あるいは「大きな環境の変化があった」時期はいつ頃（何年、または何歳）でしたか？',
      quickReplies: ['2018年頃です', '25歳の時です', '直近（ここ1〜2年）です', '思い当たりません']
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isModelReady, setIsModelReady] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [identifiedTime, setIdentifiedTime] = useState<string | null>(null);
  const [chatPhase, setChatPhase] = useState<'ask_when' | 'ask_what'>('ask_when');
  const [whenAnswer, setWhenAnswer] = useState('');
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const progressItems = useRef<Record<string, { loaded: number, total: number }>>({});

  useEffect(() => {
    // ワーカースレッドの初期化
    workerRef.current = new Worker(new URL('../workers/aiWorker.ts', import.meta.url), { type: 'module' });

    workerRef.current.onmessage = (event) => {
      const data = event.data;
      if (data.type === 'progress') {
        const payload = data.data;
        
        if (payload.status === 'initiate') {
          progressItems.current[payload.file] = { loaded: 0, total: 0 };
        } else if (payload.status === 'progress') {
          progressItems.current[payload.file] = { loaded: payload.loaded, total: payload.total };
          
          let totalBytes = 0;
          let loadedBytes = 0;
          for (const key in progressItems.current) {
            totalBytes += progressItems.current[key].total || 0;
            loadedBytes += progressItems.current[key].loaded || 0;
          }
          if (totalBytes > 0) {
            setLoadingProgress((loadedBytes / totalBytes) * 100);
          }
        } else if (payload.status === 'done' && progressItems.current[payload.file]) {
          progressItems.current[payload.file].loaded = progressItems.current[payload.file].total;
        }
      } else if (data.type === 'ready') {
        setIsModelReady(true);
      } else if (data.type === 'result') {
        setIsLoading(false);
        const parameter = data.result;
        const score = data.score;
        
        // 類似度スコアが極端に低い（0.15未満など）場合は、具体的な事象が入力されていないと判断し聞き直す
        if (score < 0.15) {
          setMessages(prev => [
            ...prev,
            {
              role: 'assistant',
              content: 'すみません、それだけだと特定の五行に分類するのが少し難しいです...。\nもう少しだけ具体的に、その時「何が原因で辛かったか」や「どんな感情だったか」を教えていただけますか？\n（例えば：仕事のプレッシャー、人間関係の衝突、お金の失敗、など）',
              quickReplies: ['過労やプレッシャーで潰れそうだった', '感情が爆発して失敗した', '人間関係で激しく衝突した', '何もかも停滞して動けなかった']
            }
          ]);
          return;
        }

        const traumaYear = extractTraumaYear(whenAnswer || data.inputText || '', birthYear);
        const { time, explanation } = inferTrueTimePillar(
          birthYear, 
          birthMonth, 
          birthDay, 
          traumaYear, 
          parameter as StatKey, 
          data.inputText || ''
        );

        if (time) {
          setIdentifiedTime(time);

          setMessages(prev => [
            ...prev, 
            { 
              role: 'system', 
              content: explanation
            }
          ]);
          
          // 説明を読む時間として、完了通知を少し長め（7秒後）にする
          setTimeout(() => {
            onComplete(time);
          }, 7000);
        }
      } else if (data.type === 'error') {
        setIsLoading(false);
        setMessages(prev => [...prev, { role: 'assistant', content: `AIエラーが発生しました: ${data.error}` }]);
      }
    };

    // 初期化指示を送信
    workerRef.current.postMessage({ type: 'init' });

    return () => {
      workerRef.current?.terminate();
    };
  }, [onComplete]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim() || identifiedTime || !isModelReady) return;
    
    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    
    const currentInput = input;
    setInput('');

    if (chatPhase === 'ask_when') {
      // ユーザーが「時期」を答えた段階なので、推論には回さず深掘りの質問を返す
      setWhenAnswer(currentInput);
      setChatPhase('ask_what');
      
      setTimeout(() => {
        setMessages(prev => [
          ...prev, 
          { 
            role: 'assistant', 
            content: `なるほど、その時期ですね。\nそれでは、その時具体的にどのような「辛い出来事」や「環境の変化」がありましたか？\n（例：上司のパワハラでメンタルが限界だった、投資で大損した、など）`,
            quickReplies: ['上司のパワハラや過労で辛かった', '大きな失敗をして自信を失った', '人間関係（パートナー等）で揉めた']
          }
        ]);
      }, 600); // 少し自然な間をあける
      
      return;
    }

    // chatPhase === 'ask_what' の場合
    setIsLoading(true);
    
    // 過去の回答（時期）と今回の回答（内容）を結合してAIに推論させる
    const combinedText = whenAnswer ? `時期:${whenAnswer} 出来事:${currentInput}` : currentInput;

    // AIワーカーへ推論指示。後で説明文に使うために結合テキストもワーカー側から返してもらう
    workerRef.current?.postMessage({ type: 'classify', text: combinedText });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden h-[80vh] ring-1 ring-indigo-500/20 relative">
        
        {/* モデルロード中のプログレスバー表示 */}
        {!isModelReady && (
          <div className="absolute top-0 left-0 w-full h-1 bg-slate-800 z-20">
            <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${loadingProgress}%` }}></div>
          </div>
        )}

        <div className="bg-slate-800/80 p-4 border-b border-slate-700 flex justify-between items-center backdrop-blur-sm z-10">
          <div className="flex items-center gap-2 text-indigo-400">
            <Cpu size={20} className={isModelReady ? "animate-pulse" : ""} />
            <h3 className="font-bold tracking-wider">AI推時システム（ローカル推論）</h3>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 bg-gradient-to-b from-slate-900 to-slate-950">
          {!isModelReady && (
            <div className="flex justify-center my-4 animate-in fade-in duration-500">
              <div className="bg-indigo-900/30 border border-indigo-500/30 text-indigo-300 px-4 py-3 rounded-xl flex items-center gap-3 text-sm">
                <Download size={16} className="animate-bounce" />
                <span>AIモデルをローカルにロード中...（初回数十MB） {Math.round(loadingProgress)}%</span>
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'system' ? (
                <div className="w-full flex justify-center my-4 animate-in fade-in zoom-in duration-500">
                  <div className="bg-indigo-500/20 border border-indigo-400/50 text-indigo-200 px-6 py-4 rounded-xl flex items-center gap-3 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                    <Sparkles className="text-indigo-400 animate-spin-slow" size={20} />
                    <span className="font-bold tracking-widest whitespace-pre-wrap">{msg.content}</span>
                  </div>
                </div>
              ) : (
                <div className={`max-w-[80%] rounded-2xl p-4 whitespace-pre-wrap shadow-lg ${
                  msg.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-tr-none' 
                    : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
                }`}>
                  {msg.content}
                </div>
              )}
            </div>
          ))}
          {messages[messages.length - 1]?.role === 'assistant' && messages[messages.length - 1]?.quickReplies && !isLoading && !identifiedTime && isModelReady && (
            <div className="flex flex-wrap gap-2 mt-2 animate-in slide-in-from-bottom-2 fade-in duration-300">
              {messages[messages.length - 1].quickReplies!.map((reply, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInput(reply);
                    setTimeout(() => {
                      const btn = document.getElementById('send-message-btn');
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
          {isLoading && !identifiedTime && (
            <div className="flex justify-start">
              <div className="bg-slate-800 text-slate-400 rounded-2xl rounded-tl-none p-4 border border-slate-700 flex items-center gap-2">
                <RefreshCw className="animate-spin" size={16} /> 類似度スコアを計算中...
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-800/80 border-t border-slate-700 flex gap-2 backdrop-blur-sm relative">
          {!isModelReady && (
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-10 flex items-center justify-center text-indigo-300 text-sm font-bold">
              AIモデルの起動を待機しています...
            </div>
          )}
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="例：2018年の仕事でパワハラを受けて辛かった..."
            className="flex-1 bg-slate-950 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-600"
            disabled={isLoading || !!identifiedTime || !isModelReady}
          />
          <button 
            id="send-message-btn"
            onClick={sendMessage}
            disabled={isLoading || !input.trim() || !!identifiedTime || !isModelReady}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 rounded-xl flex items-center gap-2 transition-colors font-bold shadow-[0_0_10px_rgba(79,70,229,0.3)] hover:shadow-[0_0_15px_rgba(79,70,229,0.5)] z-0 relative"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

