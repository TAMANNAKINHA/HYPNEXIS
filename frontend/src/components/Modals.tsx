import { AnimatePresence, motion } from 'framer-motion';
import { X, Check, Shield, ScrollText, Clock } from 'lucide-react';
import { useAegis, useOrchestrator } from '@/orchestrator';

interface Props {
  open: 'policies' | 'audit' | null;
  onClose: () => void;
}

export function Modals({ open, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-6"
        >
          <div
            className="absolute inset-0 bg-bg/80 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-gold/25 bg-bg-secondary shadow-soft-lg"
          >
            {open === 'policies' ? <PoliciesContent /> : <AuditContent />}
            <button
              onClick={onClose}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-ink-dim transition-colors hover:bg-white/5 hover:text-white"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PoliciesContent() {
  const { state } = useAegis();
  const { togglePolicy } = useOrchestrator();
  const policies = state?.policies || [];

  const handleToggle = async (policyId: string) => {
    try {
      await togglePolicy(policyId);
    } catch (error) {
      console.error('Failed to toggle policy:', error);
    }
  };

  return (
    <div className="flex max-h-[80vh] flex-col">
      <div className="flex items-center gap-2.5 border-b border-gold/15 px-6 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/10 ring-1 ring-gold/30">
          <Shield className="h-4 w-4 text-gold" strokeWidth={2} />
        </div>
        <div>
          <h3 className="text-[15px] font-semibold text-white">Policy Engine</h3>
          <p className="text-[11px] text-ink-faint">Governance rules enforced on every mission</p>
        </div>
      </div>
      <div className="flex-1 space-y-2.5 overflow-y-auto p-6">
        {policies.length === 0 && (
          <p className="text-[12px] text-ink-dim">No policies loaded yet. Check that the backend is running and connected.</p>
        )}
        {policies.map((policy) => (
          <div
            key={policy.id}
            className="rounded-xl border border-gold/10 bg-bg-card/50 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-white">{policy.name}</span>
                  {policy.enabled && (
                    <span className="flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[9px] font-medium text-success">
                      <Check className="h-2.5 w-2.5" strokeWidth={3} /> ENFORCED
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11.5px] leading-relaxed text-ink-dim">{policy.description}</p>
                <code className="mt-2 block rounded-md bg-bg/60 px-2.5 py-1.5 font-mono text-[10.5px] text-soft-gold-text">
                  {policy.rule}
                </code>
              </div>
              <button
                onClick={() => void handleToggle(policy.id)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  policy.enabled ? 'bg-success/40' : 'bg-white/10'
                }`}
              >
                <motion.div
                  className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-soft"
                  animate={{ left: policy.enabled ? '22px' : '2px' }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuditContent() {
  const { state } = useAegis();
  const auditEntries = state?.audit || [];
  const resultConfig = {
    success: { color: 'text-success', bg: 'bg-success/10', label: 'SUCCESS' },
    blocked: { color: 'text-error', bg: 'bg-error/10', label: 'BLOCKED' },
    warning: { color: 'text-warning', bg: 'bg-warning/10', label: 'WARNING' },
  };
  return (
    <div className="flex max-h-[80vh] flex-col">
      <div className="flex items-center gap-2.5 border-b border-gold/15 px-6 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/10 ring-1 ring-gold/30">
          <ScrollText className="h-4 w-4 text-gold" strokeWidth={2} />
        </div>
        <div>
          <h3 className="text-[15px] font-semibold text-white">Audit Trail</h3>
          <p className="text-[11px] text-ink-faint">Immutable on-chain activity log</p>
        </div>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-6">
        {auditEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ScrollText className="h-8 w-8 text-ink-faint" strokeWidth={1.5} />
            <p className="mt-3 text-[12px] text-ink-faint">No audit events recorded yet.</p>
          </div>
        ) : (
          auditEntries.map((entry) => {
            const c = resultConfig[entry.result] || resultConfig.success;
            return (
              <div
                key={entry.id}
                className="flex items-center gap-3 rounded-lg border border-gold/10 bg-bg-card/40 px-4 py-3"
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${c.bg}`}>
                  <Clock className={`h-3.5 w-3.5 ${c.color}`} strokeWidth={2} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-medium text-white">{entry.action}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${c.bg} ${c.color}`}>
                      {c.label}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] text-ink-faint">
                    <span>{entry.actor}</span>
                    <span>·</span>
                    <span>{new Date(entry.timestamp).toLocaleString('en-US', { hour12: false })}</span>
                  </div>
                </div>
                <code className="hidden shrink-0 font-mono text-[9.5px] text-ink-faint sm:block">
                  {entry.hash?.slice(0, 18)}…
                </code>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}