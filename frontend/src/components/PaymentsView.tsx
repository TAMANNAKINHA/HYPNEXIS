import { useState } from 'react';
import { usePaymentsData } from '../services/usePaymentsData';
import { USE_MOCK, getAccessToken, hasAccessToken, setAccessToken } from '../services/paymentsApi';
import { KillSwitchPanel } from './KillSwitchPanel';
import { SimulatorPanel } from './SimulatorPanel';
import { PaymentHistory } from './PaymentHistory';
import { AgentPermissions } from './AgentPermissions';
import { inputCls, labelCls } from './PaymentsUi';

export function PaymentsView() {
  const [tokenVersion, setTokenVersion] = useState(0);
  const [draft, setDraft] = useState('');
  const { payments, agents, loading, error, refresh } = usePaymentsData(tokenVersion);

  const save = () => { setAccessToken(draft.trim()); setDraft(''); setTokenVersion((v) => v + 1); };
  const clear = () => { setAccessToken(''); setTokenVersion((v) => v + 1); };

  return (
    <div className="space-y-4">
      {USE_MOCK && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-[12px] text-warning">
          Demo data: this page is using mock payments, not the real backend. Remove VITE_USE_MOCK=true from .env to connect.
        </div>
      )}
      {!USE_MOCK && (
        <div className="rounded-2xl border border-gold/15 bg-bg-secondary/60 p-4">
          <label className={labelCls} htmlFor="token">Payment access token</label>
          <div className="flex flex-wrap items-center gap-2">
            <input id="token" type="password" autoComplete="off" className={`${inputCls} max-w-md`} value={draft}
              onChange={(e) => setDraft(e.target.value)} placeholder={hasAccessToken() ? '•••••••• (token set for this tab)' : 'Paste a token from the backend .env'} />
            <button onClick={save} disabled={!draft.trim()} className="rounded-lg bg-gold/90 px-4 py-2 text-[13px] font-semibold text-bg hover:bg-gold disabled:opacity-50">Save</button>
            {getAccessToken() && <button onClick={clear} className="rounded-lg border border-gold/30 px-3 py-2 text-[12px] text-ink-dim hover:text-white">Clear</button>}
          </div>
          <p className="mt-2 text-[11px] text-ink-faint">
            Demo access only: the token stays in this browser tab and is cleared when the tab closes. Each action needs the matching role token
            (reader, operator, approver, executor or admin); if an action is refused, save the token for that role and try again. A real deployment needs a proper login.
          </p>
        </div>
      )}
      <KillSwitchPanel agents={agents} onChanged={refresh} />
      <AgentPermissions agents={agents} />
      <SimulatorPanel agents={agents} onSubmitted={refresh} />
      <PaymentHistory payments={payments} loading={loading} loadError={error} onChanged={refresh} />
    </div>
  );
}
