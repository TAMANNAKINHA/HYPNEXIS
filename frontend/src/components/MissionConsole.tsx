import { useState, useRef, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Send, Sparkles } from 'lucide-react';
import { useAegis, useOrchestrator } from '@/orchestrator';
import type { ChatMessage } from '@/types';
import { MissionForm } from './MissionForm';

const SUGGESTED_PROMPTS = [
  'Buy AWS Server for ₹45,000',
  'Renew GitHub Subscription at ₹1,800',
  'Book IndiGo Flight for ₹22,000',
  'Provision AWS Database Cluster max ₹65,000',
];

export function MissionConsole() {
  const { state, dispatch } = useAegis();
  const { createMission } = useOrchestrator();
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Stabilise chatMessages reference to avoid warning
  const chatMessages = useMemo(() => state?.chat || [], [state?.chat]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [chatMessages]);

  const addChat = (role: 'user' | 'aegis', text: string) => {
    dispatch({
      type: 'ADD_CHAT',
      payload: {
        role,
        text,
        timestamp: Date.now(),
      },
    });
  };

  const handleSend = async (text: string) => {
    if (!text.trim() || isProcessing) return;
  
    setIsProcessing(true);
    addChat('user', text);
    setInput('');
  
    try {
      addChat('aegis', '🔄 Analyzing intent and provisioning Mission Wallet...');
      await createMission(text);
    } catch (error) {
      console.error('Failed to process mission:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create mission.';
      addChat('aegis', `❌ Error: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 border-b border-gold/15 px-5 py-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gold/10 ring-1 ring-gold/30">
          <Sparkles className="h-4 w-4 text-gold" strokeWidth={2} />
        </div>
        <div>
          <h2 className="text-[13px] font-semibold tracking-wide text-white">
            AI Mission Console
          </h2>
          <p className="text-[10px] text-ink-faint">Natural language mission control</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        <AnimatePresence initial={false}>
          {chatMessages.map((msg: ChatMessage) => (
            <ChatBubble key={msg.id} message={msg} />
          ))}
        </AnimatePresence>
      </div>

      <MissionForm onCreate={handleSend} disabled={isProcessing} />

      <div className="flex flex-wrap gap-2 px-5 pb-3">
        {SUGGESTED_PROMPTS.map((p) => (
          <button
            key={p}
            onClick={() => void handleSend(p)}
            disabled={isProcessing}
            className="rounded-full border border-gold/20 bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-ink-dim transition-all hover:border-gold/40 hover:text-white hover:shadow-gold-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {p}
          </button>
        ))}
      </div>

      <div className="px-5 pb-5">
        <div className="group relative flex items-end gap-2 rounded-2xl border border-gold/20 bg-bg-card/60 p-2.5 transition-all focus-within:border-gold/40 focus-within:shadow-gold-sm">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend(input);
              }
            }}
            rows={1}
            placeholder={isProcessing ? "Processing..." : "Issue a mission instruction…"}
            disabled={isProcessing}
            className="flex-1 resize-none bg-transparent px-2 py-1.5 text-[13px] text-white placeholder:text-ink-faint focus:outline-none disabled:opacity-50"
            style={{ maxHeight: 100 }}
          />
          <button
            onClick={() => void handleSend(input)}
            disabled={!input.trim() || isProcessing}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold text-bg transition-all hover:shadow-gold disabled:opacity-30 disabled:hover:shadow-none"
          >
            <Send className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
        {!isUser && (
          <div className="mb-1.5 flex items-center gap-1.5">
            <div className="flex h-4 w-4 items-center justify-center rounded bg-gold/15">
              <Sparkles className="h-2.5 w-2.5 text-gold" strokeWidth={2.5} />
            </div>
            <span className="text-[10px] font-medium tracking-wide text-gold/80">AEGIS</span>
          </div>
        )}
        <div
          className={`rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
            isUser
              ? 'bg-gold text-bg font-medium rounded-br-md'
              : 'bg-white/[0.04] text-ink-dim border border-gold/10 rounded-bl-md'
          }`}
        >
          {message.text}
        </div>
      </div>
    </motion.div>
  );
}