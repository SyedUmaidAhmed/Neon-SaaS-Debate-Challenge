import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { DebateConfig, DebateState, Message } from '../types';
import { NeonButton } from '../components/NeonButton';
import { streamRealtimeAnalysis, generateAgentSpeech, compileArticle, getAI, generateAgentTurn } from '../services/geminiService';
import { trackEvent } from '../lib/posthog';
import { db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

interface DebateRoomProps {
  deductSession: () => void;
  user?: any;
  sessionsLeft?: number;
}

export function DebateRoom({ deductSession, user, sessionsLeft }: DebateRoomProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const config = location.state?.config as DebateConfig;

  // Render fail-safe if accessed directly without config
  if (!config || !config.topic) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
        <h2 className="text-xl font-bold uppercase text-glass-pink">System Offline</h2>
        <p className="text-text-dim text-sm max-w-md">No debate configuration detected. Please return to the configurator and initialize the simulation.</p>
        <NeonButton onClick={() => navigate('/')} color="blue">Return to Configurator</NeonButton>
      </div>
    );
  }

  const [state, setState] = useState<DebateState>({
    config,
    status: 'idle',
    currentRound: 1,
    currentSpeakerId: null,
    history: [],
    article: { body: '', summaryPoints: [] }
  });
  
  const debateIdRef = useRef(uuidv4());
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [thinkingAgentId, setThinkingAgentId] = useState<string | null>(null);
  
  // Streaming state specifically for synchronized text
  const [streamingSpeakerId, setStreamingSpeakerId] = useState<string | null>(null);
  const [typedText, setTypedText] = useState<string>('');

  const [streamingAnalysis, setStreamingAnalysis] = useState<string>('');
  const deductedRef = useRef(false);
  const createdAtRef = useRef(Date.now());

  const scrollRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Firestore DB persistence
  useEffect(() => {
    if (!user || state.status === 'idle') return;
    const saveState = async () => {
      try {
        const docRef = doc(db, 'debates', debateIdRef.current);
        await setDoc(docRef, {
          userId: user.uid,
          topic: state.config.topic,
          status: state.status,
          createdAt: createdAtRef.current,
          history: state.history,
          article: state.article
        }, { merge: true });
      } catch (e) {
        console.error("Failed to save debate to DB:", e);
      }
    };
    saveState();
  }, [state.history, state.article, state.status, user]);

  // PCM Playback setup for Agent Voice TTS
  const playPCM = async (base64: string, onProgress: (progress: number) => void): Promise<void> => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContextClass();
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') await ctx.resume();
    
    const binaryStr = atob(base64);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryStr.charCodeAt(i);
    
    const pcm16 = new Int16Array(bytes.buffer, 0, Math.floor(len / 2));
    const audioBuffer = ctx.createBuffer(1, pcm16.length, 24000);
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < pcm16.length; i++) channelData[i] = pcm16[i] / 32768.0;
    
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    
    return new Promise(resolve => {
      const duration = audioBuffer.duration;
      const startTime = ctx.currentTime;
      
      const updateProgress = () => {
        const elapsedTime = ctx.currentTime - startTime;
        if (elapsedTime < duration) {
          onProgress(elapsedTime / duration);
          requestAnimationFrame(updateProgress);
        } else {
          onProgress(1); // Ensure it reaches 100%
          resolve(undefined); // Safety fallback
        }
      };
      
      source.onended = () => resolve(undefined);
      source.start(0);
      requestAnimationFrame(updateProgress);
    });
  };

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Auto-scroll logic
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [state.history, typedText, thinkingAgentId]);

  // Debate Engine logic
  const processingRef = useRef(false);

  useEffect(() => {
    const processDebate = async () => {
      if (state.status !== 'running') return;
      if (processingRef.current) return; 
      if (isSynthesizing) return;

      const messagesThisRound = state.history.filter(msg => {
        const idx = state.history.indexOf(msg);
        return idx >= (state.currentRound - 1) * 2 && idx < state.currentRound * 2;
      });

      if (messagesThisRound.length === 0) {
        handleTurn(config.agent1.id, config.agent1, config.agent2);
      } else if (messagesThisRound.length === 1) {
        handleTurn(config.agent2.id, config.agent2, config.agent1);
      } else if (messagesThisRound.length === 2 && mountedRef.current) {
        // End of round: synthesize article
        setIsSynthesizing(true);
        setState(s => ({ ...s, status: 'paused' })); 
        
        try {
          const article = await compileArticle(config.topic, state.history, [config.agent1, config.agent2]);
          if (mountedRef.current) {
            setState(s => ({ 
              ...s, 
              article: {
                body: article.body,
                summaryPoints: s.article.summaryPoints 
              }
            }));
          }
        } catch (e) {
          console.error("Synthesizing failed", e);
        } finally {
          if (mountedRef.current) {
            setIsSynthesizing(false);
            if (state.currentRound >= config.rounds) {
              setState(s => ({ ...s, status: 'completed' }));
              trackEvent('debate_completed', { topic: config.topic, rounds: config.rounds });
            } else {
              setTimeout(() => {
                if (mountedRef.current) {
                   setState(s => ({ ...s, currentRound: s.currentRound + 1, status: 'running' }));
                }
              }, 3000);
            }
          }
        }
      }
    };

    const handleTurn = async (nextSpeaker: string, nextSpeakerConfig: any, opponentConfig: any) => {
      processingRef.current = true;
      setState(s => ({ ...s, currentSpeakerId: nextSpeaker }));
      setThinkingAgentId(nextSpeaker);
      setTypedText('');
      
      try {
        const ai = getAI();
        const historyText = state.history.map(msg => {
          const speaker = [config.agent1, config.agent2].find(a => a.id === msg.agentId)?.name || 'Unknown';
          return `${speaker}: ${msg.content}`;
        }).join('\n');

        const prompt = `Topic: ${config.topic}
You are ${nextSpeakerConfig.name}. Your persona is: ${nextSpeakerConfig.persona}
Opponent: ${opponentConfig.name}
History:\n${historyText}

Respond directly to the last point, or start if you are first. Keep it EXTREMELY short and conversational, like a podcast debate. Max 2-3 short sentences. No pleasantries. Talk fast.`;

        const fullText = await generateAgentTurn(prompt);
        
        if (!mountedRef.current) return;
        
        const voiceName = nextSpeaker === config.agent1.id ? 'Kore' : 'Puck';
        let base64Audio = null;
        try {
          base64Audio = await generateAgentSpeech(fullText, voiceName);
        } catch (e) {
          console.warn("TTS Playback issue", e);
        }

        if (!mountedRef.current) return;
        
        setThinkingAgentId(null);
        setStreamingSpeakerId(nextSpeaker);

        const analysisPromise = (async () => {
          try {
            const analysisStream = streamRealtimeAnalysis(config.topic, fullText, nextSpeakerConfig.name);
            let currentAnalysis = '';
            for await (const ch of analysisStream) {
              if (!mountedRef.current) break;
              currentAnalysis += ch;
              setStreamingAnalysis(currentAnalysis);
            }
            if (mountedRef.current && currentAnalysis.trim()) {
              setState(s => ({
                ...s,
                article: {
                  ...s.article,
                  summaryPoints: [...s.article.summaryPoints, currentAnalysis]
                }
              }));
              setStreamingAnalysis('');
            }
          } catch (e) {
            console.error("Analyst stream error", e);
          }
        })();

        if (base64Audio) {
           // We have audio! Typewrite text in sync with audio playback
           const words = fullText.split(' ');
           
           const playAudioPromise = playPCM(base64Audio, (progress) => {
              if (!mountedRef.current) return;
              // Safely reveal chunks based on audio progress
              const numWordsToShow = Math.floor(progress * words.length);
              setTypedText(words.slice(0, numWordsToShow).join(' '));
           });

           await Promise.all([playAudioPromise, analysisPromise]);
           // Ensure final text is fully visible
           if (mountedRef.current) setTypedText(fullText);
        } else {
           // Fallback if audio fails due to TTS quota. Fall back to typewriter string iteration!
           console.warn("TTS Quota unavailable. Falling back to rapid text iteration.");
           const words = fullText.split(' ');
           
           const typePromise = (async () => {
             for (let i = 1; i <= words.length; i++) {
                if (!mountedRef.current) break;
                setTypedText(words.slice(0, i).join(' '));
                await new Promise(r => setTimeout(r, 200)); // Simulating 200ms spoken word duration
             }
           })();

           await Promise.all([typePromise, analysisPromise]);
           if (mountedRef.current) setTypedText(fullText);
        }

        if (!mountedRef.current) return;

        // Turn complete, commit to history
        const newMessage: Message = {
          id: `r${state.currentRound}-${uuidv4()}`,
          agentId: nextSpeaker,
          content: fullText,
          timestamp: Date.now()
        };

        setStreamingSpeakerId(null);
        setTypedText('');
        processingRef.current = false;

        setState(s => ({
          ...s,
          history: [...s.history, newMessage],
          currentSpeakerId: null
        }));

      } catch (e: any) {
        console.error("Error generating turn", e);
        if (mountedRef.current) {
          processingRef.current = false;
          setState(s => ({ ...s, status: 'paused', currentSpeakerId: null }));
          setThinkingAgentId(null);
          setStreamingSpeakerId(null);
          
          if (e?.message?.includes('429') || e?.status === 429 || e?.message?.includes('quota')) {
            alert("Gemini API Quota Exceeded. You have run out of Gemini API credits or hit a rate limit. Please check your API usage or try again later.");
          } else {
            alert("Error communicating with AI: " + (e?.message || "Unknown error"));
          }
        }
      }
    };

    processDebate();

  }, [state.status, state.currentRound, state.history.length]);

  const handleStart = () => {
    if (!deductedRef.current) {
      if (!user && (sessionsLeft || 0) <= 0) {
        alert("You have reached your 3 session limit! Please return and sign in with Google.");
        navigate('/');
        return;
      }
      deductSession();
      deductedRef.current = true;
    }

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContextClass();
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
    
    setState(s => ({ ...s, status: 'running' }));
    trackEvent('debate_started', { topic: config.topic });
  };
  
  const handlePause = () => setState(s => ({ ...s, status: 'paused' }));

  const exportPDF = () => {
    import('jspdf').then(module => {
      const { jsPDF } = module;
      const doc = new jsPDF();
      
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 14;
      let y = 20;

      // Title
      doc.setFontSize(22);
      doc.text("Debate Transcript & Synthesis", margin, y);
      y += 10;
      doc.setFontSize(14);
      doc.text(`Topic: ${config.topic}`, margin, y);
      y += 15;

      // Synthesis Section
      if (state.article.body) {
        doc.setFontSize(16);
        doc.text("Journalistic Synthesis", margin, y);
        y += 10;
        doc.setFontSize(11);
        const textLines = doc.splitTextToSize(state.article.body, pageWidth - margin * 2);
        for (const line of textLines) {
           if (y > 280) { doc.addPage(); y = 20; }
           doc.text(line, margin, y);
           y += 5;
        }
        y += 10;
      }

      // Key Insights
      if (state.article.summaryPoints.length > 0) {
        if (y > 260) { doc.addPage(); y = 20; }
        doc.setFontSize(14);
        doc.text("Key Insights", margin, y);
        y += 10;
        doc.setFontSize(11);
        state.article.summaryPoints.forEach(pt => {
           const splitPt = doc.splitTextToSize(`• ${pt}`, pageWidth - margin * 2);
           for (const line of splitPt) {
             if (y > 280) { doc.addPage(); y = 20; }
             doc.text(line, margin, y);
             y += 5;
           }
           y += 2;
        });
        y += 10;
      }

      // Transcript
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFontSize(16);
      doc.text("Full Transcript", margin, y);
      y += 10;

      doc.setFontSize(11);
      state.history.forEach((msg, idx) => {
        if (y > 270) { doc.addPage(); y = 20; }
        
        const isAgent1 = msg.agentId === config.agent1.id;
        const agentName = isAgent1 ? config.agent1.name : config.agent2.name;
        doc.setFont("helvetica", "bold");
        doc.text(`${agentName}:`, margin, y);
        y += 6;
        
        doc.setFont("helvetica", "normal");
        const msgText = doc.splitTextToSize(msg.content, pageWidth - margin * 2);
        for (const line of msgText) {
          if (y > 280) { doc.addPage(); y = 20; }
          doc.text(line, margin, y);
          y += 5;
        }
        y += 5;
      });

      doc.save(`Debate_Export.pdf`);
    });
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-4 w-full min-h-0">
      
      {/* Left Column = Main */}
      <main className="flex-1 flex flex-col gap-4 min-h-0">
        
        {/* Arena Header */}
        <section className="glass-panel glass-panel-light flex items-center justify-around p-5 shrink-0">
           {/* Agent 1 Profile */}
           <div className="flex flex-col items-center gap-2 w-40">
             <div className="w-[50px] h-[50px] rounded-full border-2 border-glass-blue bg-[#1a2230] flex items-center justify-center font-bold text-xs uppercase shadow-[0_0_10px_rgba(0,243,255,0.2)] relative">
               A1
               {(thinkingAgentId === config.agent1.id || streamingSpeakerId === config.agent1.id) && (
                 <div className="absolute inset-0 rounded-full border-2 border-glass-blue animate-ping opacity-50"></div>
               )}
             </div>
             <div className="text-[14px] font-semibold text-center leading-tight">{config.agent1.name}</div>
             <div className="text-[10px] text-glass-blue uppercase font-bold">Voice: Kore</div>
           </div>

           {/* VS / Timer section */}
           <div className="flex items-center gap-6">
             <div className="font-mono text-[24px] font-extrabold text-glass-pink">VS</div>
             <div className="w-20 h-20 border-[3px] border-white/10 border-t-glass-green rounded-full flex flex-col items-center justify-center">
               <span className="text-[10px] uppercase text-text-dim">Round 0{Math.min(state.currentRound, config.rounds)}</span>
               <span className="text-[20px] font-mono text-glass-green animate-pulse">
                 {state.status === 'running' ? '• REC' : state.status.toUpperCase()}
               </span>
             </div>
             <div className="flex flex-col gap-2">
                {state.status === 'idle' && <NeonButton color="green" onClick={handleStart}>Engage</NeonButton>}
                {state.status === 'completed' && (
                  <>
                    <NeonButton color="blue" onClick={() => navigate('/')}>New Debate</NeonButton>
                    <NeonButton color="pink" onClick={exportPDF}>Export PDF</NeonButton>
                  </>
                )}
                {state.status === 'running' && <NeonButton color="pink" onClick={handlePause}>Halt Debate</NeonButton>}
                {state.status === 'paused' && (
                  <>
                    <NeonButton color="green" onClick={handleStart}>Resume</NeonButton>
                    <NeonButton color="blue" onClick={exportPDF}>Export PDF</NeonButton>
                  </>
                )}
             </div>
           </div>

           {/* Agent 2 Profile */}
           <div className="flex flex-col items-center gap-2 w-40">
             <div className="w-[50px] h-[50px] rounded-full border-2 border-glass-pink bg-[#1a2230] flex items-center justify-center font-bold text-xs uppercase shadow-[0_0_10px_rgba(255,0,234,0.2)] relative">
               A2
               {(thinkingAgentId === config.agent2.id || streamingSpeakerId === config.agent2.id) && (
                 <div className="absolute inset-0 rounded-full border-2 border-glass-pink animate-ping opacity-50"></div>
               )}
             </div>
             <div className="text-[14px] font-semibold text-center leading-tight">{config.agent2.name}</div>
             <div className="text-[10px] text-glass-pink uppercase font-bold">Voice: Puck</div>
           </div>
        </section>

        {/* Debate Log */}
        <section className="glass-panel glass-panel-light flex-1 flex flex-col overflow-hidden">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 scroll-smooth">
             {state.history.map(msg => {
               const isAgent1 = msg.agentId === config.agent1.id;
               const agent = isAgent1 ? config.agent1 : config.agent2;
               
               return (
                 <div key={msg.id} className={`flex flex-col gap-1 w-full max-w-[80%] ${isAgent1 ? 'items-start mr-auto agent-a' : 'items-end ml-auto agent-b'}`}>
                    <span className="text-[10px] font-bold uppercase mb-1 text-text-dim px-2">
                      {agent.name}
                    </span>
                    <div className={`bubble-base p-4 px-5 text-[16px] leading-[1.5] shadow-lg ${isAgent1 ? 'border-l-[3px] border-glass-blue' : 'border-r-[3px] border-glass-pink text-right'}`}>
                      {msg.content}
                    </div>
                 </div>
               );
             })}

             {/* Thinking Indicator */}
             {thinkingAgentId && (() => {
               const isAgent1 = thinkingAgentId === config.agent1.id;
               const agent = isAgent1 ? config.agent1 : config.agent2;
               return (
                 <div className={`flex flex-col gap-1 w-full max-w-[80%] ${isAgent1 ? 'items-start mr-auto agent-a' : 'items-end ml-auto agent-b'}`}>
                    <span className="text-[10px] font-bold uppercase mb-1 text-text-dim px-2">
                      {agent.name} <span className="animate-pulse">is calculating...</span>
                    </span>
                    <div className={`bubble-base p-4 px-5 flex items-center gap-2 ${isAgent1 ? 'border-l-[3px] border-glass-blue text-glass-blue' : 'border-r-[3px] border-glass-pink text-glass-pink flex-row-reverse'}`}>
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                        <span className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                        <span className="w-2 h-2 bg-current rounded-full animate-bounce"></span>
                      </div>
                      <span className="text-sm opacity-50 ml-2">Parsing Context...</span>
                    </div>
                 </div>
               );
             })()}

             {/* Speaking/Typing Indicator */}
             {streamingSpeakerId && (() => {
               const isAgent1 = streamingSpeakerId === config.agent1.id;
               const agent = isAgent1 ? config.agent1 : config.agent2;
               return (
                 <div className={`flex flex-col gap-1 w-full max-w-[80%] ${isAgent1 ? 'items-start mr-auto agent-a' : 'items-end ml-auto agent-b'}`}>
                    <span className="text-[10px] font-bold uppercase mb-1 text-text-dim px-2">
                      {agent.name} <span className="text-white">🎙️</span>
                    </span>
                    <div className={`bubble-base p-4 px-5 text-[16px] leading-[1.5] shadow-[0_0_15px_rgba(255,255,255,0.05)] ${isAgent1 ? 'border-l-[3px] border-glass-blue' : 'border-r-[3px] border-glass-pink text-right'}`}>
                      <span className="text-text-main">{typedText}</span>
                      <span className={`inline-block w-2 h-4 align-middle ml-1 ${isAgent1 ? 'bg-glass-blue' : 'bg-glass-pink'} animate-pulse`}></span>
                    </div>
                 </div>
               );
             })()}
          </div>
        </section>

      </main>

      {/* Right Column = Sidebar */}
      <aside className="glass-panel w-full lg:w-[340px] shrink-0 p-6 flex flex-col gap-6 overflow-y-auto">
         
         <div className="article-preview flex-1 flex flex-col min-h-0 shrink-0">
           <div className="text-[11px] uppercase tracking-[2px] text-glass-blue border-b border-white/10 pb-2 mb-4 shrink-0 flex justify-between">
             <span>Real-time Synthesis</span>
             {isSynthesizing && <span className="text-glass-green animate-pulse">● REC</span>}
           </div>
           
           {!state.article.body && !isSynthesizing && (
             <div className="flex items-center justify-center flex-1 text-text-dim text-xs uppercase tracking-widest text-center px-4 leading-relaxed font-mono">
               Awaiting transcript data to compile analytics...
             </div>
           )}

           {isSynthesizing && !state.article.body && (
             <div className="flex flex-col items-center justify-center flex-1 text-glass-green text-xs tracking-widest uppercase font-mono gap-2">
               <span className="animate-flicker">Synthesizing...</span>
             </div>
           )}
           
           {state.article.body && (
             <div className="overflow-y-auto min-h-0 pr-2">
               <h2 className="font-serif text-[20px] italic mb-3 text-white">{config.topic} Analysis</h2>
               <div className="text-[14px] text-text-dim leading-[1.6] space-y-4">
                 {state.article.body.split('\n').map((paragraph, i) => (
                   <p key={i}>{paragraph}</p>
                 ))}
               </div>
             </div>
           )}
         </div>

         {(state.article.summaryPoints.length > 0 || streamingAnalysis) && (
           <div className="key-insights shrink-0">
             <div className="text-[11px] uppercase tracking-[2px] text-glass-blue border-b border-white/10 pb-2 mb-4 pt-2">
               Live Insights
             </div>
             <ul className="flex flex-col gap-2">
               {state.article.summaryPoints.map((pt, i) => (
                 <li key={i} className="flex items-start gap-2.5 text-[12px] bg-white/5 p-2.5 rounded-lg border border-white/5">
                   <span className="text-glass-green font-bold text-sm mt-[-2px]">⚡</span>
                   <span className="text-text-dim leading-snug">{pt}</span>
                 </li>
               ))}
               {streamingAnalysis && (
                 <li className="flex items-start gap-2.5 text-[12px] bg-white/5 p-2.5 rounded-lg border border-glass-blue/30 shadow-[0_0_15px_rgba(0,243,255,0.1)]">
                   <span className="text-glass-blue font-bold text-sm mt-[-2px] animate-pulse">⚡</span>
                   <span className="text-text-dim leading-snug flex-1">
                     {streamingAnalysis} <span className="inline-block w-1 h-3 bg-glass-blue animate-pulse align-middle ml-1"></span>
                   </span>
                 </li>
               )}
             </ul>
           </div>
         )}
         
      </aside>

    </div>
  );
}
