import { useCallback, useEffect, useState } from 'react';
import { paymentsApi, friendlyError, hasAccessToken, USE_MOCK } from './paymentsApi';
import { agentsFromPayments } from './paymentLogic';
import type { AgentSummary, Payment } from '../paymentTypes';

/** Loads payments and agents. No auto-polling: the backend allows only 100 requests per 15 minutes. */
export function usePaymentsData(tokenVersion: number) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!hasAccessToken() && !USE_MOCK) {
      setPayments([]); setAgents([]); setLoading(false);
      setError('Enter your access token above to load payments.');
      return;
    }
    setLoading(true);
    try {
      const p = await paymentsApi.listPayments();
      // The real backend has no agent-list route yet, so agents are derived from the payments (only demo mode calls listAgents).
      const a = USE_MOCK ? await paymentsApi.listAgents() : agentsFromPayments(p);
      setPayments([...p].sort((x, y) => Date.parse(y.createdAt) - Date.parse(x.createdAt)));
      setAgents(a);
      setError(null);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void refresh(); }, [refresh, tokenVersion]);

  return { payments, agents, loading, error, refresh };
}
