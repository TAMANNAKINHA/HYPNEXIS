import { useMemo, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { paymentsApi, friendlyError } from '../services/paymentsApi';
import type { AgentStatusResult, AgentSummary, KillResult } from '../paymentTypes';
import { ConfirmDialog, ErrorBanner, Panel, StatusBadge, shortHash } from './PaymentsUi';

export function KillSwitchPanel({ agents, onChanged }: { agents: AgentSummary[]; onChanged: () => Promise<void> }) {
  const [target, setTarget] = useState<AgentSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, KillResult | AgentStatusResult>>({});
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const [draftId, setDraftId] = useState('');

  // Agents from payments, plus any agent ID typed in by hand (the backend has no agent-list route yet).
  const allAgents: AgentSummary[] = useMemo(() => {
    const known = new Set(agents.map((a) => a.agentId));
    const added = extraIds.filter((id) => !known.has(id)).map((agentId) => ({ agentId, backendStatus: 'unknown' as const, paymentCount: 0 }));
    return [...agents, ...added];
  }, [agents, extraIds]);

  const addAgent = () => {
    const id = draftId.trim();
    if (id && !extraIds.includes(id)) setExtraIds((ids) => [...ids, id]);
    setDraftId('');
  };

  const close = () => { setTarget(null); setError(null); };

  const confirm = async () => {
    if (!target || busy) return;
    setBusy(true); setError(null);
    try {
      const res = await paymentsApi.killAgent(target.agentId);
      setResults((r) => ({ ...r, [target.agentId]: res }));
      await onChanged(); // always re-read the real status from the backend
      close();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const check = async (agentId: string) => {
    setError(null);
    try {
      const res = await paymentsApi.agentStatus(agentId);
      setResults((r) => ({ ...r, [agentId]: res }));
    } catch (e) {
      setError(friendlyError(e));
    }
  };

  return (
    <Panel title="AI Agent Kill Switch" subtitle="Stops the backend from accepting or submitting new payments for an agent.">
      <ErrorBanner message={target ? null : error} />
      {allAgents.length === 0 && <p className="text-[13px] text-ink-faint">No agents yet. Agents appear here after their first payment request, or add an agent ID below.</p>}
      <div className="space-y-3">
        {allAgents.map((a) => {
          const res = results[a.agentId] as KillResult | AgentStatusResult | undefined;
          const status = res?.backendStatus ?? a.backendStatus; // a checked or killed result is newer than the list
          const disabled = status === 'disabled';
          const inFlight = res && 'inFlight' in res ? res.inFlight : [];
          return (
            <div key={a.agentId} className="rounded-xl border border-gold/10 bg-bg-card/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[14px] font-semibold text-white">{a.agentId}</div>
                  <div className="text-[11px] text-ink-faint">{a.paymentCount} payment request(s) on record</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={status === 'unknown' ? 'UNKNOWN' : disabled ? 'DISABLED' : 'ACTIVE'} />
                  <button onClick={() => void check(a.agentId)}
                    className="rounded-lg border border-gold/30 px-3 py-2 text-[12px] text-ink-dim hover:text-white">
                    Check status
                  </button>
                  <button onClick={() => setTarget(a)} disabled={disabled}
                    className="flex items-center gap-2 rounded-lg bg-error px-4 py-2 text-[12px] font-bold text-white hover:bg-error/80 disabled:cursor-not-allowed disabled:opacity-40">
                    <ShieldAlert className="h-4 w-4" /> Emergency disable
                  </button>
                </div>
              </div>
              {disabled && (
                <p className="mt-3 text-[12px] text-ink-dim">Backend intake is stopped for this agent. New payment requests are rejected.</p>
              )}
              {res && (
                <p className="mt-2 text-[12px] text-warning">
                  On-chain revocation: {res.onChainRevocation.status.replace(/_/g, ' ')}
                  {res.onChainRevocation.reason ? ` — ${res.onChainRevocation.reason}` : ''}. The agent’s on-chain permissions are not changed by this button unless this says otherwise.
                </p>
              )}
              {inFlight.length > 0 && (
                <p className="mt-2 text-[12px] text-warning">
                  {inFlight.length} transaction(s) were already submitted and may still complete:{' '}
                  {inFlight.map((t) => (t.transactionHash ? shortHash(t.transactionHash) : t.paymentId)).join(', ')}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input value={draftId} onChange={(e) => setDraftId(e.target.value)} placeholder="Agent ID, e.g. agent-1"
          onKeyDown={(e) => { if (e.key === 'Enter') addAgent(); }}
          className="w-full max-w-xs rounded-lg border border-gold/20 bg-bg px-3 py-2 text-[12px] text-white sm:w-auto" />
        <button onClick={addAgent} disabled={!draftId.trim()}
          className="rounded-lg border border-gold/30 px-3 py-2 text-[12px] text-ink-dim hover:text-white disabled:opacity-40">Add agent</button>
      </div>

      {target && (
        <ConfirmDialog title={`Disable agent “${target.agentId}”?`} confirmLabel="Disable agent" danger busy={busy}
          error={error} onConfirm={confirm} onCancel={close}>
          <p>The backend will stop accepting and approving new payments from this agent.</p>
          <p className="text-warning">
            Transactions already submitted may still complete, and a confirmed transaction cannot be undone.
            This does not revoke the agent on-chain unless the result says so.
          </p>
        </ConfirmDialog>
      )}
    </Panel>
  );
}
