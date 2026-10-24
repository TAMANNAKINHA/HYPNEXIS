import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, paymentsApi, setAccessToken, getAccessToken, hasAccessToken, USE_MOCK } from './paymentsApi.ts';
import type { PaymentProposal } from '../paymentTypes.ts';

type Call = { url: string; method: string; headers: Record<string, string>; body: unknown };
let calls: Call[] = [];
let queue: { status: number; body: unknown }[] = [];

beforeEach(() => {
  calls = []; queue = []; setAccessToken('');
  globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url: String(url), method: init.method ?? 'GET', headers: (init.headers ?? {}) as Record<string, string>,
      body: init.body ? JSON.parse(String(init.body)) : undefined });
    const next = queue.shift() ?? { status: 200, body: { success: true } };
    return new Response(JSON.stringify(next.body), { status: next.status });
  }) as typeof fetch;
});

const proposal: PaymentProposal = {
  missionId: 'm1', recipient: '0x1111111111111111111111111111111111111111', amount: '1', chainId: 1337,
  expiresAt: '2030-01-01T00:00:00.000Z', requestId: 'req-1', idempotencyKey: 'idem-12345', agentId: 'agent-1',
};

test('the tests run against the real client, not the mock', () => assert.equal(USE_MOCK, false));

test('the access token is stored and cleared', () => {
  assert.equal(hasAccessToken(), false);
  setAccessToken('secret-token');
  assert.equal(getAccessToken(), 'secret-token');
  assert.equal(hasAccessToken(), true);
  setAccessToken('');
  assert.equal(hasAccessToken(), false);
});

test('requests carry the bearer token when one is set', async () => {
  setAccessToken('tok-123');
  queue.push({ status: 200, body: { success: true, payments: [] } });
  await paymentsApi.listPayments();
  assert.equal(calls[0].headers.Authorization, 'Bearer tok-123');
  assert.match(calls[0].url, /\/api\/payments$/);
});

test('requests carry no Authorization header without a token', async () => {
  queue.push({ status: 200, body: { success: true, payments: [] } });
  await paymentsApi.listPayments();
  assert.equal(calls[0].headers.Authorization, undefined);
});

test('listPayments unwraps the payments array', async () => {
  queue.push({ status: 200, body: { success: true, payments: [{ id: 'p1' }] } });
  const list = await paymentsApi.listPayments();
  assert.equal(list.length, 1);
});

test('simulate posts the full proposal to the simulate endpoint', async () => {
  queue.push({ status: 200, body: { success: true, simulationId: 's1', preview: true, canProceed: true, estimatedFee: null,
    remainingBudgetAfterPayment: '9', warnings: [], violations: [], broadcasted: false } });
  const r = await paymentsApi.simulate(proposal);
  assert.match(calls[0].url, /\/api\/payments\/simulate$/);
  assert.equal(calls[0].method, 'POST');
  assert.deepEqual(calls[0].body, proposal);
  assert.equal(r.broadcasted, false);
});

test('createPayment reuses the same idempotency key it was given', async () => {
  queue.push({ status: 201, body: { success: true, payment: { id: 'p1' }, duplicate: false } });
  await paymentsApi.createPayment(proposal);
  assert.equal((calls[0].body as PaymentProposal).idempotencyKey, 'idem-12345');
  assert.equal((calls[0].body as PaymentProposal).requestId, 'req-1');
});

test('approve fetches the current detailsHash and sends it back', async () => {
  queue.push({ status: 200, body: { success: true, payment: { id: 'p1' }, detailsHash: 'abc123' } });
  queue.push({ status: 200, body: { success: true, payment: { id: 'p1', status: 'APPROVED' } } });
  const p = await paymentsApi.approve('p1');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].method, 'GET');
  assert.match(calls[1].url, /\/api\/payments\/p1\/approve$/);
  assert.deepEqual(calls[1].body, { detailsHash: 'abc123' });
  assert.equal(p.status, 'APPROVED');
});

test('reject sends the reason', async () => {
  queue.push({ status: 200, body: { success: true, payment: { id: 'p1', status: 'REJECTED' } } });
  await paymentsApi.reject('p1', 'wrong vendor');
  assert.deepEqual(calls[0].body, { reason: 'wrong vendor' });
});

test('freezeMission and unfreezeMission use the payment-control routes', async () => {
  await paymentsApi.freezeMission('mission/1');
  await paymentsApi.unfreezeMission('mission/1');
  assert.match(calls[0].url, /\/api\/payments\/missions\/mission%2F1\/freeze$/);
  assert.match(calls[1].url, /\/api\/payments\/missions\/mission%2F1\/unfreeze$/);
});

test('listAgents unwraps the agents array', async () => {
  queue.push({ status: 200, body: { success: true, agents: [{ agentId: 'a1', backendStatus: 'active', paymentCount: 2 }] } });
  const agents = await paymentsApi.listAgents();
  assert.equal(agents[0].agentId, 'a1');
  assert.match(calls[0].url, /\/api\/payments\/agents$/);
});

test('killAgent posts to the kill route and returns the on-chain status', async () => {
  queue.push({ status: 200, body: { success: true, agentId: 'a 1', backendStatus: 'disabled',
    onChainRevocation: { status: 'not_performed', reason: 'No adapter' }, inFlight: [] } });
  const r = await paymentsApi.killAgent('a 1');
  assert.match(calls[0].url, /\/api\/payments\/agents\/a%201\/kill$/);
  assert.equal(r.onChainRevocation.status, 'not_performed');
});

test('error responses become ApiError with status, message and violations', async () => {
  queue.push({ status: 422, body: { success: false, message: 'Mission budget would be exceeded', violations: ['Mission budget would be exceeded'] } });
  await assert.rejects(paymentsApi.createPayment(proposal), (e: unknown) => {
    assert.ok(e instanceof ApiError);
    assert.equal(e.status, 422);
    assert.deepEqual(e.violations, ['Mission budget would be exceeded']);
    return true;
  });
});

test('a 401 response is reported as an ApiError with status 401', async () => {
  queue.push({ status: 401, body: { success: false, message: 'Authenticated payment authorization is required.' } });
  await assert.rejects(paymentsApi.listPayments(), (e: unknown) => e instanceof ApiError && e.status === 401);
});

test('a network failure becomes ApiError status 0', async () => {
  globalThis.fetch = (async () => { throw new TypeError('Failed to fetch'); }) as typeof fetch;
  await assert.rejects(paymentsApi.listPayments(), (e: unknown) => e instanceof ApiError && e.status === 0);
});

test('execute surfaces the backend refusal message in demo mode', async () => {
  queue.push({ status: 409, body: { success: false, message: 'Execution is disabled in demo mode.' } });
  await assert.rejects(paymentsApi.execute('p1'), /Execution is disabled in demo mode/);
});
