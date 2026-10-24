import { motion } from 'framer-motion';
import {
  ShieldCheck,
  ScrollText,
  Gauge,
  FileCode2,
  Timer,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useAegis } from '@/orchestrator';
import type { ShieldId, ShieldState } from '@/types';

const SHIELD_ICONS: Record<ShieldId, LucideIcon> = {
  missionGuard: ShieldCheck,
  policyEngine: ScrollText,
  riskEngine: Gauge,
  smartContract: FileCode2,
  timeLock: Timer,
  circuitBreaker: Zap,
};

const SHIELD_ORDER: ShieldId[] = [
  'missionGuard',
  'policyEngine',
  'riskEngine',
  'smartContract',
  'timeLock',
  'circuitBreaker',
];

export function SecurityEngine() {
  const { state } = useAegis();
  const shields = state?.shields || {};
  const activeCount = Object.values(shields).filter((s) => s?.status === 'success').length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gold/15 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gold/10 ring-1 ring-gold/30">
            <ShieldCheck className="h-4 w-4 text-gold" strokeWidth={2} />
          </div>
          <div>
            <h2 className="text-[13px] font-semibold tracking-wide text-white">
              Security Engine
            </h2>
            <p className="text-[10px] text-ink-faint">Six-layer autonomous defense</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-gold/15 bg-bg-card/60 px-2.5 py-1">
          <span className="text-[10px] font-medium text-ink-dim">
            {activeCount}/6
          </span>
        </div>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
        {SHIELD_ORDER.map((id, i) => {
          const fallbackShield: ShieldState = {
            id,
            label: id,
            description: '',
            status: 'idle',
            lastCheck: '—',
          };
          return <ShieldCard key={id} shield={shields[id] || fallbackShield} index={i} />;
        })}
      </div>
    </div>
  );
}

function ShieldCard({ shield, index }: { shield: ShieldState; index: number }) {
  const Icon = SHIELD_ICONS[shield.id] || ShieldCheck;
  const statusConfig = {
    idle: {
      ring: 'border-gold/10',
      glow: '',
      iconBg: 'bg-white/[0.03]',
      iconColor: 'text-ink-faint',
      label: 'Idle',
      labelColor: 'text-ink-faint',
      dot: 'bg-ink-faint',
      animate: false,
    },
    processing: {
      ring: 'border-gold/40',
      glow: 'shadow-gold-sm',
      iconBg: 'bg-gold/10',
      iconColor: 'text-gold',
      label: 'Processing',
      labelColor: 'text-gold',
      dot: 'bg-gold animate-pulse',
      animate: true,
    },
    success: {
      ring: 'border-success/30',
      glow: 'shadow-[0_0_24px_rgba(16,185,129,0.15)]',
      iconBg: 'bg-success/10',
      iconColor: 'text-success',
      label: 'Active',
      labelColor: 'text-success',
      dot: 'bg-success',
      animate: false,
    },
    failure: {
      ring: 'border-error/40',
      glow: 'shadow-[0_0_24px_rgba(239,68,68,0.2)]',
      iconBg: 'bg-error/10',
      iconColor: 'text-error',
      label: 'Breached',
      labelColor: 'text-error',
      dot: 'bg-error animate-pulse',
      animate: true,
    },
  };
  const c = statusConfig[shield.status] || statusConfig.idle;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4 }}
      className={`relative overflow-hidden rounded-xl border bg-bg-card/50 p-3.5 transition-all ${c.ring} ${c.glow}`}
    >
      {c.animate && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-gold/5 to-transparent"
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
        />
      )}
      <div className="relative flex items-start gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${c.iconBg}`}>
          <Icon className={`h-4.5 w-4.5 ${c.iconColor}`} strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-white">{shield.label}</span>
            <div className="flex items-center gap-1.5">
              <div className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
              <span className={`text-[10px] font-medium ${c.labelColor}`}>{c.label}</span>
            </div>
          </div>
          <p className="mt-1 text-[10.5px] leading-relaxed text-ink-faint">
            {shield.description}
          </p>
          <div className="mt-2 flex items-center justify-between border-t border-white/[0.04] pt-2">
            <span className="text-[9px] text-ink-faint">Last check</span>
            <span className="font-mono text-[10px] text-ink-dim">{shield.lastCheck}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}