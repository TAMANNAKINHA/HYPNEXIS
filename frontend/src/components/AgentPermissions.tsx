import { useAegis } from '@/orchestrator';
import { sessionState, type SessionState } from '../services/paymentLogic';
import type { AgentSummary } from '../paymentTypes';
import { Panel } from './PaymentsUi';

const TONE: Record<SessionState, string> = {
  Active: 'text-success', Pending: 'text-warning', Completed: 'text-gold-soft',
  Expired: 'text-ink-faint', Frozen: 'text-cyan-300', Revoked: 'text-error', Cancelled: 'text-ink-faint',
};

export function AgentPermissions({ agents }: { agents: AgentSummary[] }) {
  const { state } = useAegis();
  const formatINR = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  return (
    <Panel title="Agent Permissions & Sessions" subtitle="What each mission session may spend, and whether it is still valid.">
      {state.missions.length === 0 ? (
        <p className="text-[13px] text-ink-faint">No mission sessions yet. Create one on the Missions tab.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[12px]">
            <thead className="text-[10px] uppercase tracking-wide text-ink-faint">
              <tr><th className="py-2 pr-3">Mission</th><th className="pr-3">Allowed merchant</th><th className="pr-3">Budget</th><th className="pr-3">Spent</th><th className="pr-3">Expires</th><th>Session</th></tr>
            </thead>
            <tbody>
              {state.missions.map((m) => {
                const s = sessionState(m);
                return (
                  <tr key={m.id} className="border-t border-gold/10">
                    <td className="py-2 pr-3 text-white">{m.name}</td>
                    <td className="pr-3 text-ink-dim">{m.merchant}</td>
                    <td className="pr-3 text-ink-dim">{formatINR(m.budget)}</td>
                    <td className="pr-3 text-ink-dim">{formatINR(m.spent)}</td>
                    <td className="pr-3 text-ink-dim">{new Date(m.expiry).toLocaleString()}</td>
                    <td className={`font-semibold ${TONE[s]}`}>{s}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-[11px] text-ink-faint">
        Agents known to the payment backend: {agents.length ? agents.map((a) => `${a.agentId} (${a.backendStatus})`).join(', ') : 'none yet'}.
        Session keys are kept on the backend and are not shown here.
      </p>
    </Panel>
  );
}
