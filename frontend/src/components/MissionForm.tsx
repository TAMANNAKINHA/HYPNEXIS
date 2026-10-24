import { useState } from 'react';
import { useAegis } from '@/orchestrator';
import { MISSION_MERCHANTS, buildMissionPrompt } from '../services/paymentLogic';

export function MissionForm({ onCreate, disabled }: { onCreate: (text: string) => Promise<void> | void; disabled?: boolean }) {
  const { state } = useAegis();
  const [merchant, setMerchant] = useState<string>(MISSION_MERCHANTS[0]);
  const [budget, setBudget] = useState('');
  const amount = Number(budget);
  const valid = Number.isFinite(amount) && amount > 0;
  const cap = state?.profile?.perMissionCap;

  return (
    <div className="mx-5 mb-3 rounded-xl border border-gold/15 bg-white/[0.02] p-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">New mission (form)</div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex-1 text-[11px] text-ink-faint">Merchant
          <select value={merchant} onChange={(e) => setMerchant(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gold/20 bg-bg px-2 py-1.5 text-[12px] text-white">
            {MISSION_MERCHANTS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <label className="flex-1 text-[11px] text-ink-faint">Spending limit (₹)
          <input value={budget} onChange={(e) => setBudget(e.target.value)} inputMode="numeric" placeholder="45000"
            className="mt-1 w-full rounded-lg border border-gold/20 bg-bg px-2 py-1.5 text-[12px] text-white" />
        </label>
        <button onClick={() => { void onCreate(buildMissionPrompt(merchant, amount)); setBudget(''); }} disabled={!valid || disabled}
          className="rounded-lg bg-gold px-3 py-2 text-[12px] font-semibold text-bg disabled:opacity-40">Create</button>
      </div>
      <p className="mt-2 text-[10px] text-ink-faint">
        The backend checks the limit against policy{cap ? ` (per-mission cap ${`₹${cap.toLocaleString('en-IN')}`})` : ''} and may refuse it.
      </p>
    </div>
  );
}
