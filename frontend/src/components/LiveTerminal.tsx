import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { TerminalSquare } from 'lucide-react';
import { useAegis } from '@/orchestrator';
import type { LogSeverity } from '@/types';

const SEVERITY_STYLES: Record<LogSeverity, { color: string; prefix: string }> = {
  info: { color: 'text-ink-dim', prefix: '›' },
  success: { color: 'text-success', prefix: '✓' },
  warning: { color: 'text-warning', prefix: '!' },
  error: { color: 'text-error', prefix: '✕' },
  gold: { color: 'text-soft-gold-text', prefix: '◆' },
};

export function LiveTerminal() {
  const { state } = useAegis();
  const scrollRef = useRef<HTMLDivElement>(null);
  const logs = state?.logs || [];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-gold/15 bg-bg/80 backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-gold/10 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <TerminalSquare className="h-3.5 w-3.5 text-gold" strokeWidth={2} />
          <span className="font-mono text-[11px] font-medium text-white">aegis://live-terminal</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
          <span className="font-mono text-[10px] text-ink-faint">LIVE</span>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 space-y-1 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed">
        <AnimatePresence initial={false}>
          {logs.length === 0 && (
            <div className="text-ink-faint">Awaiting mission activity…</div>
          )}
          {logs.map((log) => {
            const s = SEVERITY_STYLES[log.severity] || SEVERITY_STYLES.info;
            return (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-start gap-2"
              >
                <span className="text-ink-faint shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                </span>
                <span className={`shrink-0 ${s.color}`}>{s.prefix}</span>
                <span className={s.color}>{log.message}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}