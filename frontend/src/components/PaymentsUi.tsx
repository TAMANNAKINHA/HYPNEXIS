import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import type { AgentStatus, PaymentStatus } from '../paymentTypes';

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-warning/15 text-warning ring-warning/30',
  APPROVED: 'bg-gold/15 text-gold-soft ring-gold/30',
  SUBMITTED: 'bg-blue-500/15 text-blue-300 ring-blue-400/30',
  CONFIRMED: 'bg-success/15 text-success ring-success/30',
  FAILED: 'bg-error/15 text-error ring-error/30',
  REJECTED: 'bg-error/15 text-error ring-error/30',
  FROZEN: 'bg-cyan-500/15 text-cyan-300 ring-cyan-400/30',
  EXPIRED: 'bg-white/10 text-ink-dim ring-white/20',
  ACTIVE: 'bg-success/15 text-success ring-success/30',
  REVOCATION_PENDING: 'bg-warning/15 text-warning ring-warning/30',
  DISABLED: 'bg-error/15 text-error ring-error/30',
  ERROR: 'bg-error/15 text-error ring-error/30',
  UNKNOWN: 'bg-white/10 text-ink-dim ring-white/20',
};

export function StatusBadge({ status }: { status: PaymentStatus | AgentStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${STATUS_STYLE[status]}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

export function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-gold/15 bg-bg-secondary/60 p-5 backdrop-blur-xl">
      <h2 className="text-[15px] font-bold tracking-wide text-white">{title}</h2>
      {subtitle && <p className="mt-0.5 text-[12px] text-ink-faint">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="mb-3 rounded-lg border border-error/40 bg-error/10 px-3 py-2 text-[12px] text-error">
      {message}
    </div>
  );
}

export function Spinner() {
  return <Loader2 className="h-4 w-4 animate-spin" />;
}

export function ConfirmDialog(props: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  disabled?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { title, children, confirmLabel, danger, busy, disabled, error, onConfirm, onCancel } = props;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl border border-gold/30 bg-bg-card p-6 shadow-soft-lg">
        <h3 className="text-[16px] font-bold text-white">{title}</h3>
        <div className="mt-3 space-y-3 text-[13px] text-ink-dim">{children}</div>
        <ErrorBanner message={error ?? null} />
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} disabled={busy}
            className="rounded-lg px-4 py-2 text-[13px] text-ink-dim hover:text-white disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={busy || disabled}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${
              danger ? 'bg-error hover:bg-error/80' : 'bg-gold/90 text-bg hover:bg-gold'}`}>
            {busy && <Spinner />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export const inputCls =
  'w-full rounded-lg border border-gold/20 bg-bg px-3 py-2 text-[13px] text-white placeholder:text-ink-faint focus:border-gold/60 focus:outline-none';
export const labelCls = 'mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-faint';
export { shortHash } from '../services/paymentLogic';
