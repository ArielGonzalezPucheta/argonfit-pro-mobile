
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { aiService } from '../services/ai';
import { storage } from '../services/storage';
import { AppState, Routine } from '../types';
import { Button, Card, Badge } from './UI';

export const ChatAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', content: string, routineData?: any }[]>([
    { role: 'ai', content: 'Hola. Soy Argon Coach. Puedo responder tus dudas o crear rutinas personalizadas. ¿En qué te ayudo?' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const toggleChat = () => setIsOpen(!isOpen);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setIsTyping(true);

    const state = storage.load();
    const response = await aiService.chatWithCoach(userMsg, state);

    setIsTyping(false);
    setMessages(prev => [...prev, {
      role: 'ai',
      content: response.text,
      routineData: response.routine
    }]);
  };

  const saveRoutine = (routineData: any) => {
    const state = storage.load();
    const newRoutine: Routine = {
      id: Math.random().toString(36).substr(2, 9),
      imageUrl: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&q=80&w=800', // Default image
      ...routineData,
      exercises: routineData.exercises.map((ex: any) => ({
        exerciseId: Math.random().toString(36).substr(2, 9),
        ...ex
      }))
    };

    const newState = { ...state, routines: [...state.routines, newRoutine] };
    storage.save(newState);
    setMessages(prev => [...prev, { role: 'ai', content: `¡Rutina "${newRoutine.name}" guardada con éxito en tu biblioteca!` }]);
  };

  return (
    <>
      {/* Floating Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={toggleChat}
        className="fixed bottom-6 right-6 w-14 h-14 bg-emerald-500 rounded-full shadow-[0_0_30px_rgba(16,185,129,0.4)] flex items-center justify-center z-50 text-black"
      >
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
        )}
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-6 w-[90vw] md:w-[400px] h-[600px] max-h-[80vh] bg-[#151B18]/95 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl flex flex-col z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 border-b border-white/5 bg-white/5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                <svg className="w-5 h-5 text-black" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" /></svg>
              </div>
              <div>
                <h3 className="font-black italic text-white uppercase tracking-wider">Argon Coach</h3>
                <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> En línea
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth" ref={scrollRef}>
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed ${msg.role === 'user'
                      ? 'bg-emerald-500 text-black font-medium rounded-tr-sm'
                      : 'bg-white/10 text-zinc-200 rounded-tl-sm'
                    }`}>
                    {msg.content}
                  </div>

                  {/* Routine Preview Card */}
                  {msg.routineData && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-3 w-full max-w-[85%] bg-zinc-900 border border-emerald-500/30 rounded-2xl p-4 space-y-3"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <Badge className="mb-1">RUTINA SUGERIDA</Badge>
                          <h4 className="font-bold text-white text-lg">{msg.routineData.name}</h4>
                        </div>
                        <span className="text-xs text-zinc-500 font-mono">{msg.routineData.duration} min</span>
                      </div>
                      <p className="text-xs text-zinc-400 italic line-clamp-2">{msg.routineData.description}</p>
                      <div className="space-y-1">
                        {msg.routineData.exercises.slice(0, 3).map((ex: any, i: number) => (
                          <div key={i} className="flex justify-between text-xs text-zinc-300 border-b border-white/5 py-1 last:border-0">
                            <span>{ex.name}</span>
                            <span className="text-zinc-500">{ex.suggestedSets}x{ex.suggestedReps}</span>
                          </div>
                        ))}
                        {msg.routineData.exercises.length > 3 && <p className="text-[10px] text-zinc-600 pt-1">y {msg.routineData.exercises.length - 3} más...</p>}
                      </div>
                      <Button onClick={() => saveRoutine(msg.routineData)} className="w-full h-10 text-sm mt-2">
                        Guardar en Mis Rutinas
                      </Button>
                    </motion.div>
                  )}
                </div>
              ))}
              {isTyping && (
                <div className="flex items-center gap-1 p-2">
                  <span className="w-2 h-2 bg-zinc-600 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                  <span className="w-2 h-2 bg-zinc-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <span className="w-2 h-2 bg-zinc-600 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-white/5 bg-black/20 backdrop-blur-lg">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Pide una rutina o haz una pregunta..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/50 transition-all placeholder:text-zinc-600"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isTyping}
                  className="bg-emerald-500 text-black w-12 rounded-xl flex items-center justify-center hover:bg-emerald-400 disabled:opacity-50 transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
