import { Fragment, useMemo, useState } from 'react';
import { RefreshCw, Snowflake } from 'lucide-react';
import { useAegis } from '@/orchestrator';
import { paymentsApi, friendlyError } from '../services/paymentsApi';
import { allowedActions, filterPayments, latestReason } from '../services/paymentLogic';
import { ALL_PAYMENT_STATUSES, type Payment, type PaymentAction, type PaymentStatus } from '../paymentTypes';
import { ConfirmDialog, ErrorBanner, Panel, Spinner, StatusBadge, inputCls, labelCls, shortHash } from './PaymentsUi';

type Pending = { payment: Payment; action: PaymentAction } | { missionFreeze: string; unfreeze: boolean };

const LABEL: Record<PaymentAction, string> = {
  approve: 'Approve', reject: 'Reject', freeze: 'Freeze', unfreeze: 'Unfreeze', execute: 'Execute', reconcile: 'Check chain',
};
const COLOR: Record<PaymentAction, string> = {
  approve: 'bg-success/20 text-success hover:bg-success/30', reject: 'bg-error/20 text-error hover:bg-error/30',
  freeze: 'bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30', unfreeze: 'bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30',
  execute: 'bg-gold/20 text-gold-soft hover:bg-gold/30', reconcile: 'bg-white/10 text-ink-dim hover:bg-white/20',
};

interface Props { payments: Payment[]; loading: boolean; loadError: string | null; onChanged: () => Promise<void> }

export function PaymentHistory({ payments, loading, loadError, onChanged }: Props) {
  const { state } = useAegis();
  const [status, setStatus] = useState<PaymentStatus | ''>('');
  const [missionId, setMissionId] = useState('');
  const [from, setFrom] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => filterPayments(payments, { status, missionId, from }), [payments, status, missionId, from]);
  const close = () => { setPending(null); setReason(''); setError(null); };

  const confirm = async () => {
    if (!pending || busy) return;
    setBusy(true); setError(null);
    try {
      if ('missionFreeze' in pending) {
        if (pending.unfreeze) await paymentsApi.unfreezeMission(pending.missionFreeze);
        else await paymentsApi.freezeMission(pending.missionFreeze);
      } else {
        const { payment, action } = pending;
        if (action === 'approve') await paymentsApi.approve(payment.id);
        if (action === 'reject') await paymentsApi.reject(payment.id, reason.trim());
        if (action === 'freeze') await paymentsApi.freeze(payment.id, reason.trim() || undefined);
        if (action === 'unfreeze') await paymentsApi.unfreeze(payment.id);
        if (action === 'execute') await paymentsApi.execute(payment.id);
        if (action === 'reconcile') await paymentsApi.reconcile(payment.id);
      }
      await onChanged();
      close();
    } catch (e) {
      setError(friendlyError(e));
      await onChanged(); // the payment may have changed while the dialog was open
    } finally {
      setBusy(false);
    }
  };

  const mf = pending && 'missionFreeze' in pending ? pending : null;
  const pa = pending && !('missionFreeze' in pending) ? pending : null;
  const action = pa ? pa.action : null;
  const title = mf ? (mf.unfreeze ? 'Unfreeze whole mission?' : 'Freeze whole mission?') : pa ? `${LABEL[pa.action]} this payment?` : '';

  return (
    <Panel title="Payment Queue & History" subtitle="Live from the backend. Statuses come from the server, never guessed by this page.">
      <ErrorBanner message={loadError} />
      <div className="mb-4 grid gap-3 md:grid-cols-5">
        <div>
          <label className={labelCls} htmlFor="f-status">Status</label>
          <select id="f-status" className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as PaymentStatus | '')}>
            <option value="">All</option>
            {ALL_PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="f-mission">Mission wallet</label>
          <select id="f-mission" className={inputCls} value={missionId} onChange={(e) => setMissionId(e.target.value)}>
            <option value="">All</option>
            {state.missions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="f-from">From date</label>
          <input id="f-from" type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-end gap-2 md:col-span-2">
          <button onClick={() => void onChanged()} className="flex items-center gap-2 rounded-lg border border-gold/30 px-3 py-2 text-[12px] text-ink-dim hover:text-white">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <button onClick={() => { setStatus(''); setMissionId(''); setFrom(''); }} disabled={!status && !missionId && !from}
            className="rounded-lg border border-gold/30 px-3 py-2 text-[12px] text-ink-dim hover:text-white disabled:cursor-not-allowed disabled:opacity-40">
            Clear filters
          </button>
          <button onClick={() => missionId && setPending({ missionFreeze: missionId, unfreeze: false })} disabled={!missionId}
            title={missionId ? '' : 'Pick a mission wallet first'}
            className="flex items-center gap-2 rounded-lg border border-cyan-400/40 px-3 py-2 text-[12px] text-cyan-300 hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-40">
            <Snowflake className="h-4 w-4" /> Freeze mission
          </button>
          <button onClick={() => missionId && setPending({ missionFreeze: missionId, unfreeze: true })} disabled={!missionId}
            className="rounded-lg border border-cyan-400/40 px-3 py-2 text-[12px] text-cyan-300 hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-40">
            Unfreeze mission
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-[13px] text-ink-faint"><Spinner /> Loading payments…</div>
      ) : rows.length === 0 ? (
        <p className="text-[13px] text-ink-faint">No payments match these filters.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-[12px]">
            <thead className="text-[10px] uppercase tracking-wide text-ink-faint">
              <tr>
                <th className="py-2 pr-3">Status</th><th className="pr-3">Amount</th><th className="pr-3">Recipient</th>
                <th className="pr-3">Created</th><th className="pr-3">Tx hash</th><th className="pr-3">Reason</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <Fragment key={p.id}>
                  <tr className="border-t border-gold/10 align-top">
                    <td className="py-3 pr-3">
                      <button onClick={() => setOpen(open === p.id ? null : p.id)} className="text-left" title="Show history">
                        <StatusBadge status={p.status} />
                      </button>
                    </td>
                    <td className="pr-3 text-white">{p.amount}</td>
                    <td className="pr-3 font-mono text-ink-dim">{shortHash(p.recipient)}</td>
                    <td className="pr-3 text-ink-dim">{new Date(p.createdAt).toLocaleString()}</td>
                    <td className="pr-3 font-mono text-ink-dim">{p.txHash ? shortHash(p.txHash) : <span className="text-ink-faint">—</span>}</td>
                    <td className="pr-3 text-ink-dim">{latestReason(p) || '—'}</td>
                    <td>
                      <div className="flex flex-wrap gap-1.5">
                        {allowedActions(p.status).map((a) => (
                          <button key={a} onClick={() => setPending({ payment: p, action: a })} className={`rounded px-2 py-1 ${COLOR[a]}`}>{LABEL[a]}</button>
                        ))}
                        {p.status === 'SUBMITTED' && <span className="text-[11px] text-warning">Already submitted — cannot be reliably cancelled</span>}
                      </div>
                    </td>
                  </tr>
                  {open === p.id && (
                    <tr className="bg-bg-card/40">
                      <td colSpan={7} className="px-3 py-3">
                        <div className="mb-1 text-[10px] uppercase tracking-wide text-ink-faint">Audit trail</div>
                        <ul className="space-y-1 text-[11px] text-ink-dim">
                          {p.events.map((ev, i) => (
                            <li key={i}>{new Date(ev.at).toLocaleString()} — {ev.from ?? 'new'} → {ev.to} by {ev.actor}{ev.reason ? ` (${ev.reason})` : ''}</li>
                          ))}
                        </ul>
                        <div className="mt-2 text-[11px] text-ink-faint">Expires {new Date(p.expiresAt).toLocaleString()} · chain {p.chainId} · agent {p.agentId ?? '—'}</div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pending && (
        <ConfirmDialog title={title} confirmLabel={mf ? (mf.unfreeze ? 'Unfreeze' : 'Freeze mission') : LABEL[pa!.action]}
          danger={mf ? !mf.unfreeze : action === 'reject' || action === 'freeze'} busy={busy}
          disabled={action === 'reject' && reason.trim().length < 3} error={error} onConfirm={confirm} onCancel={close}>
          {mf ? (
            <p>{mf.unfreeze ? 'Frozen payments return to PENDING and need approval again.' : 'Pending and approved payments for this mission will be frozen. Payments already submitted to the blockchain may still complete.'}</p>
          ) : pa ? (
            <>
              <p>{pa.payment.amount} to <span className="font-mono">{shortHash(pa.payment.recipient)}</span></p>
              {pa.action === 'approve' && <p>Approval is bound to these exact details. The backend validates again before sending, so approval does not guarantee execution.</p>}
              {pa.action === 'execute' && <p>The backend rechecks budget and policy first. In demo mode execution is disabled and this will be refused.</p>}
              {(pa.action === 'reject' || pa.action === 'freeze') && (
                <div>
                  <label className={labelCls} htmlFor="act-reason">Reason{pa.action === 'reject' ? ' (required)' : ' (optional)'}</label>
                  <input id="act-reason" className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} />
                </div>
              )}
            </>
          ) : null}
        </ConfirmDialog>
      )}
    </Panel>
  );
}
