/**
 * End-to-end + cross-component tests (Person 4).
 *
 * Real pieces: Express routes (missions + payments), PaymentStore on disk, ethers
 * adapter, a live Hardhat chain, MissionWallet + AgentPaymentGateway contracts.
 * Nothing is mocked. The only in-process shortcut is that the HTTP app is mounted
 * from the compiled routes so the test can change policy env vars between steps.
 *
 * Prereqs (scripts/e2e.sh does all of this):
 *   npm run build ; chain running ; npx hardhat run scripts/deploy-local.ts --network localhost
 * Run:  node --test --test-force-exit test/e2e/e2e.test.cjs
 */
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const { JsonRpcProvider, Contract, parseEther, formatEther } = require('ethers');

const ROOT = path.resolve(__dirname, '..', '..');
const DEPLOYMENT = path.join(ROOT, 'deployments', 'localhost.json');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-e2e-'));
const token = () => crypto.randomBytes(24).toString('hex'); // 48 chars (>= 32 required)
const T = { reader: token(), operator: token(), approver: token(), executor: token(), admin: token() };

if (!fs.existsSync(DEPLOYMENT)) {
  throw new Error(`Missing ${DEPLOYMENT}. Run: npx hardhat run scripts/deploy-local.ts --network localhost (or scripts/e2e.sh)`);
}
const dep = JSON.parse(fs.readFileSync(DEPLOYMENT, 'utf8'));
const [R1, R2] = dep.accounts.recipients;
const ATTACKER = dep.accounts.attacker;

// Environment must be set BEFORE the compiled modules are loaded (PaymentStore reads it at import).
Object.assign(process.env, {
  PAYMENT_DB_PATH: path.join(tmp, 'payments.json'),
  PAYMENT_READER_TOKEN: T.reader, PAYMENT_OPERATOR_TOKEN: T.operator, PAYMENT_APPROVER_TOKEN: T.approver,
  PAYMENT_EXECUTOR_TOKEN: T.executor, PAYMENT_ADMIN_TOKEN: T.admin,
  EXECUTION_MODE: 'real', RPC_URL: dep.rpcUrl, CHAIN_ID: String(dep.chainId),
  CONTRACT_ADDRESS: dep.gateway, CONTRACT_ABI: JSON.stringify(dep.adapterAbi),
  CONTRACT_EXECUTE_METHOD: 'execute', CONTRACT_EXECUTION_EVENT: 'PaymentExecuted',
  PRIVATE_KEY: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', // Hardhat #0, local only
  PAYMENT_DECIMALS: '18', CONFIRMATIONS: '1',
  RECIPIENT_ALLOWLIST: [R1, R2].join(','),
});
const GOOD_ENV = { RPC_URL: process.env.RPC_URL, CHAIN_ID: process.env.CHAIN_ID, CONTRACT_ADDRESS: process.env.CONTRACT_ADDRESS, RECIPIENT_ALLOWLIST: process.env.RECIPIENT_ALLOWLIST };

const express = require('express');
const missionRoutes = require('../../dist/routes/missionRoutes.js').default;
const paymentRoutes = require('../../dist/routes/paymentRoutes.js').default;

let server, base, provider, wallet;
const missions = {};

const WALLET_ABI = [
  'function getSpendingTracker() view returns (tuple(uint256 totalSpent,uint256 dailySpent,uint256 lastDailyReset))',
  'function getMissionConfig() view returns (tuple(string missionId,uint256 totalBudget,uint256 maxPerTx,uint256 maxDaily,uint256 expiry,address owner))',
];

async function api(method, route, who, body) {
  const res = await fetch(`${base}${route}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(who ? { Authorization: `Bearer ${T[who]}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

let seq = 0;
const future = (ms = 3_600_000) => new Date(Date.now() + ms).toISOString();
function proposal(missionId, recipient, amount, agentId, extra = {}) {
  seq += 1;
  return { missionId, recipient, amount, chainId: dep.chainId, expiresAt: future(), requestId: `e2e-req-${seq}-${crypto.randomUUID()}`, idempotencyKey: `e2e-idem-${seq}-${crypto.randomUUID()}`, agentId, ...extra };
}
async function createAndApprove(missionId, recipient, amount, agentId, extra) {
  const created = await api('POST', '/api/payments', 'operator', proposal(missionId, recipient, amount, agentId, extra));
  if (created.status !== 201) return { created };
  const approved = await api('POST', `/api/payments/${created.body.payment.id}/approve`, 'approver', { detailsHash: created.body.detailsHash });
  return { created, approved, id: created.body.payment.id, hash: created.body.detailsHash };
}
async function pay(missionId, recipient, amount, agentId) {
  const step = await createAndApprove(missionId, recipient, amount, agentId);
  if (!step.approved || step.approved.status !== 200) return { ...step, executed: null };
  const executed = await api('POST', `/api/payments/${step.id}/execute`, 'executor');
  return { ...step, executed };
}
const balance = a => provider.getBalance(a);
const stored = () => (fs.existsSync(process.env.PAYMENT_DB_PATH) ? JSON.parse(fs.readFileSync(process.env.PAYMENT_DB_PATH, 'utf8')) : { payments: [] });

before(async () => {
  try {
    // Probe first: ethers retries forever against a dead RPC, which would hang the test run.
    const probe = await fetch(dep.rpcUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }), signal: AbortSignal.timeout(3000) });
    assert.ok((await probe.json()).result, 'RPC did not answer eth_chainId');
    provider = new JsonRpcProvider(dep.rpcUrl);
    const net = await provider.getNetwork();
    assert.equal(Number(net.chainId), dep.chainId, 'RPC chain id differs from deployments/localhost.json');
    assert.notEqual(await provider.getCode(dep.gateway), '0x', 'gateway has no code - redeploy with scripts/deploy-local.ts (chain was restarted?)');
  } catch (e) {
    throw new Error(`Local chain not reachable/deployed at ${dep.rpcUrl}: ${e.message}. Start it with scripts/chain.sh start and redeploy.`);
  }
  wallet = new Contract(dep.missionWallet, WALLET_ABI, provider);

  const app = express();
  app.use(express.json({ limit: '32kb' }));
  app.use('/api/missions', missionRoutes);
  app.use('/api/payments', paymentRoutes);
  server = http.createServer(app);
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;

  // Mission creation goes through the real API; the backend caps this at 3 per 24h per process.
  for (const key of ['A', 'B', 'C']) {
    const r = await api('POST', '/api/missions/create', null, { text: `Buy OpenAI API credits for ₹5,000 (${key})` });
    assert.equal(r.status, 200, `mission ${key} create failed: ${JSON.stringify(r.body)}`);
    missions[key] = r.body.mission;
  }
  // Real mode needs a per-mission recipient policy; IDs are only known after creation.
  process.env.MISSION_RECIPIENTS_JSON = JSON.stringify(Object.fromEntries(Object.values(missions).map(m => [m.id, [R1, R2]])));
});

after(async () => {
  await new Promise(r => (server ? server.close(r) : r()));
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('E2E-1 happy path: mission -> simulate -> create -> approve -> execute -> confirm', () => {
  const agent = 'agent-happy';
  let result, before1, beforeWallet, trackerBefore;

  test('mission is created through the API with a budget and an ID', () => {
    assert.ok(missions.A.id && missions.A.missionId?.startsWith('MID-'));
    assert.equal(missions.A.budget, 5000);
    assert.equal(missions.A.status, 'created');
  });

  test('simulation is a preview: nothing is broadcast and no payment record is created', async () => {
    const countBefore = stored().payments.length;
    const sim = await api('POST', '/api/payments/simulate', 'reader', proposal(missions.A.id, R1, '0.05', agent));
    assert.equal(sim.status, 200);
    assert.equal(sim.body.preview, true);
    assert.equal(sim.body.broadcasted, false);
    assert.equal(sim.body.canProceed, true);
    assert.equal(stored().payments.length, countBefore);
  });

  test('payment executes on the local chain and ends CONFIRMED', async () => {
    before1 = await balance(R1); beforeWallet = await balance(dep.missionWallet); trackerBefore = await wallet.getSpendingTracker();
    result = await pay(missions.A.id, R1, '0.05', agent);
    assert.equal(result.created.status, 201);
    assert.equal(result.created.body.payment.status, 'PENDING');
    assert.equal(result.approved.status, 200);
    assert.equal(result.approved.body.payment.status, 'APPROVED');
    assert.equal(result.executed.status, 200, JSON.stringify(result.executed.body));
    assert.equal(result.executed.body.payment.status, 'CONFIRMED');
    assert.match(result.executed.body.transactionHash, /^0x[0-9a-fA-F]{64}$/);
  });

  test('I-01: the reported tx hash is a real, successful transaction to the gateway', async () => {
    const receipt = await provider.getTransactionReceipt(result.executed.body.transactionHash);
    assert.ok(receipt, 'chain has no receipt for the reported hash');
    assert.equal(receipt.status, 1);
    assert.equal(receipt.to.toLowerCase(), dep.gateway.toLowerCase());
    assert.equal(result.executed.body.payment.receipt.blockNumber, receipt.blockNumber);
  });

  test('funds moved exactly once and on-chain accounting matches the payment', async () => {
    assert.equal((await balance(R1)) - before1, parseEther('0.05'));
    assert.equal(beforeWallet - (await balance(dep.missionWallet)), parseEther('0.05'));
    const t = await wallet.getSpendingTracker();
    assert.equal(t.totalSpent - trackerBefore.totalSpent, parseEther('0.05'));
  });

  test('I-02 / F-03: API, list endpoint and on-disk store report the same status and hash', async () => {
    const id = result.id;
    const one = await api('GET', `/api/payments/${id}`, 'reader');
    const list = await api('GET', '/api/payments', 'reader');
    const fromList = list.body.payments.find(p => p.id === id);
    const onDisk = stored().payments.find(p => p.id === id);
    for (const view of [one.body.payment, fromList, onDisk]) {
      assert.equal(view.status, 'CONFIRMED');
      assert.equal(view.txHash, result.executed.body.transactionHash);
    }
  });

  test('H-01: audit trail records every transition with actor and time, in order', () => {
    const p = stored().payments.find(x => x.id === result.id);
    const path_ = p.events.map(e => e.to).filter((s, i, a) => i === 0 || a[i - 1] !== s);
    assert.deepEqual(path_, ['PENDING', 'APPROVED', 'SUBMITTED', 'CONFIRMED']);
    assert.ok(p.events.every(e => e.actor && Number.isFinite(Date.parse(e.at))));
    assert.ok(p.approval?.usedAt, 'approval must be marked used after execution');
  });

  test('D-01: retrying the same creation request is idempotent (no second payment)', async () => {
    const body = proposal(missions.A.id, R2, '0.01', agent);
    const first = await api('POST', '/api/payments', 'operator', body);
    const second = await api('POST', '/api/payments', 'operator', body);
    assert.equal(first.status, 201);
    assert.equal(second.status, 200);
    assert.equal(second.body.duplicate, true);
    assert.equal(second.body.payment.id, first.body.payment.id);
    const conflict = await api('POST', '/api/payments', 'operator', { ...body, amount: '0.02' });
    assert.equal(conflict.status, 409);
    await api('POST', `/api/payments/${first.body.payment.id}/reject`, 'approver', { reason: 'test cleanup' });
  });

  test('re-executing a confirmed payment is refused and moves no funds (replay)', async () => {
    const bal = await balance(R1);
    const again = await api('POST', `/api/payments/${result.id}/execute`, 'executor');
    assert.ok(again.status >= 400, `replay unexpectedly accepted: ${again.status}`);
    assert.equal(await balance(R1), bal);
  });
});

describe('E2E-2 policy and budget failures never reach the chain', () => {
  test('B-02: amount above the mission budget is rejected at creation', async () => {
    const r = await api('POST', '/api/payments', 'operator', proposal(missions.A.id, R1, '5000.5', 'agent-budget'));
    assert.equal(r.status, 422);
    assert.match(r.body.message, /budget/i);
  });

  test('recipient outside the backend allowlist is rejected', async () => {
    const r = await api('POST', '/api/payments', 'operator', proposal(missions.A.id, ATTACKER, '0.01', 'agent-recip'));
    assert.equal(r.status, 422);
  });

  test('payment for a chain the backend is not configured for is rejected', async () => {
    const r = await api('POST', '/api/payments', 'operator', proposal(missions.A.id, R1, '0.01', 'agent-chain', { chainId: 1 }));
    assert.equal(r.status, 422);
    assert.match(r.body.message, /chain/i);
  });

  test('A-03: approval with details that differ from the stored payment is rejected', async () => {
    const created = await api('POST', '/api/payments', 'operator', proposal(missions.A.id, R1, '0.01', 'agent-tamper'));
    const bad = await api('POST', `/api/payments/${created.body.payment.id}/approve`, 'approver', { detailsHash: 'f'.repeat(64) });
    assert.equal(bad.status, 409);
    assert.equal((await api('GET', `/api/payments/${created.body.payment.id}`, 'reader')).body.payment.status, 'PENDING');
    await api('POST', `/api/payments/${created.body.payment.id}/reject`, 'approver', { reason: 'cleanup' });
  });

  test('A-01: an approval that expired before execution is refused and the payment becomes EXPIRED', async () => {
    const created = await api('POST', '/api/payments', 'operator', proposal(missions.A.id, R1, '0.01', 'agent-expire', { expiresAt: future(2500) }));
    const approved = await api('POST', `/api/payments/${created.body.payment.id}/approve`, 'approver', { detailsHash: created.body.detailsHash });
    assert.equal(approved.status, 200);
    await new Promise(r => setTimeout(r, 2800));
    const bal = await balance(R1);
    const exec = await api('POST', `/api/payments/${created.body.payment.id}/execute`, 'executor');
    assert.equal(exec.status, 410);
    assert.equal((await api('GET', `/api/payments/${created.body.payment.id}`, 'reader')).body.payment.status, 'EXPIRED');
    assert.equal(await balance(R1), bal);
  });

  test('authentication and role separation hold end to end', async () => {
    assert.equal((await api('GET', '/api/payments', null)).status, 401);
    const created = await api('POST', '/api/payments', 'operator', proposal(missions.A.id, R1, '0.01', 'agent-auth'));
    assert.equal((await api('POST', `/api/payments/${created.body.payment.id}/approve`, 'operator', { detailsHash: created.body.detailsHash })).status, 403);
    assert.equal((await api('POST', `/api/payments/${created.body.payment.id}/execute`, 'operator')).status, 403);
    assert.equal((await api('POST', '/api/payments/agents/x/kill', 'executor')).status, 403);
    await api('POST', `/api/payments/${created.body.payment.id}/reject`, 'approver', { reason: 'cleanup' });
  });
});

describe('E2E-3 kill switch, freezes and cross-component failures', () => {
  test('K-01: a killed agent cannot create or execute payments; the API says on-chain revocation was NOT done', async () => {
    const agent = 'agent-to-kill';
    const ready = await createAndApprove(missions.A.id, R1, '0.01', agent);
    assert.equal(ready.approved.status, 200);
    const kill = await api('POST', `/api/payments/agents/${agent}/kill`, 'admin');
    assert.equal(kill.status, 200);
    assert.equal(kill.body.backendStatus, 'disabled');
    assert.equal(kill.body.onChainRevocation.status, 'not_performed');
    const bal = await balance(R1);
    assert.equal((await api('POST', `/api/payments/${ready.id}/execute`, 'executor')).status, 403);
    assert.equal((await api('POST', '/api/payments', 'operator', proposal(missions.A.id, R1, '0.01', agent))).status, 403);
    assert.equal(await balance(R1), bal);
    assert.equal((await api('GET', `/api/payments/agents/${agent}/status`, 'reader')).body.backendStatus, 'disabled');
  });

  test('H-02: freezing a mission freezes its approved payments, blocks new ones, and unfreeze requires re-approval', async () => {
    const m = missions.B.id;
    const ready = await createAndApprove(m, R1, '0.01', 'agent-freeze');
    assert.equal(ready.approved.status, 200);
    assert.equal((await api('POST', `/api/payments/missions/${m}/freeze`, 'approver')).status, 200);
    assert.equal((await api('GET', `/api/payments/${ready.id}`, 'reader')).body.payment.status, 'FROZEN');
    const bal = await balance(R1);
    assert.ok((await api('POST', `/api/payments/${ready.id}/execute`, 'executor')).status >= 400);
    assert.equal((await api('POST', '/api/payments', 'operator', proposal(m, R1, '0.01', 'agent-freeze'))).status, 422);
    assert.equal(await balance(R1), bal);
    assert.equal((await api('POST', `/api/payments/missions/${m}/unfreeze`, 'approver')).status, 200);
    assert.equal((await api('GET', `/api/payments/${ready.id}`, 'reader')).body.payment.status, 'PENDING');
    await api('POST', `/api/payments/${ready.id}/reject`, 'approver', { reason: 'cleanup' });
  });

  test('wrong configured chain: execution is blocked before anything is signed', async () => {
    const ready = await createAndApprove(missions.B.id, R1, '0.01', 'agent-wrongchain');
    process.env.CHAIN_ID = '9999';
    try {
      const bal = await balance(R1);
      const exec = await api('POST', `/api/payments/${ready.id}/execute`, 'executor');
      assert.ok(exec.status >= 400);
      assert.equal(await balance(R1), bal);
    } finally { process.env.CHAIN_ID = GOOD_ENV.CHAIN_ID; }
    const p = (await api('GET', `/api/payments/${ready.id}`, 'reader')).body.payment;
    assert.equal(p.status, 'APPROVED', 'payment must stay approved/unsent, not flip to CONFIRMED or FAILED');
    await api('POST', `/api/payments/${ready.id}/reject`, 'approver', { reason: 'cleanup' });
  });

  test('configured contract address without code: execution fails closed and the payment is not marked submitted', async () => {
    const ready = await createAndApprove(missions.B.id, R1, '0.01', 'agent-nocode');
    process.env.CONTRACT_ADDRESS = R2; // an EOA: no contract code
    try {
      const exec = await api('POST', `/api/payments/${ready.id}/execute`, 'executor');
      assert.equal(exec.status, 503);
    } finally { process.env.CONTRACT_ADDRESS = GOOD_ENV.CONTRACT_ADDRESS; }
    assert.equal((await api('GET', `/api/payments/${ready.id}`, 'reader')).body.payment.status, 'APPROVED');
    await api('POST', `/api/payments/${ready.id}/reject`, 'approver', { reason: 'cleanup' });
  });

  test('B-01: concurrent execution of two payments for one wallet never double-spends', async () => {
    const a = await createAndApprove(missions.B.id, R1, '0.02', 'agent-conc-a');
    const b = await createAndApprove(missions.B.id, R2, '0.02', 'agent-conc-b');
    const total = (await balance(R1)) + (await balance(R2));
    const [ra, rb] = await Promise.all([
      api('POST', `/api/payments/${a.id}/execute`, 'executor'),
      api('POST', `/api/payments/${b.id}/execute`, 'executor'),
    ]);
    const ok = [ra, rb].filter(r => r.status === 200).length;
    assert.ok(ok >= 1, 'at least one concurrent execution must succeed');
    assert.equal((await balance(R1)) + (await balance(R2)) - total, parseEther('0.02') * BigInt(ok), 'funds moved must equal confirmed payments only');
    for (const [r, id] of [[ra, a.id], [rb, b.id]]) {
      const p = (await api('GET', `/api/payments/${id}`, 'reader')).body.payment;
      assert.equal(p.status, r.status === 200 ? 'CONFIRMED' : 'APPROVED');
    }
  });
});

describe('E2E-4 hijacked agent: losses stay within on-chain limits (>= 5 attack scripts)', () => {
  const hijacked = 'agent-hijacked';
  const cfg = {};
  before(async () => {
    const c = await wallet.getMissionConfig();
    cfg.maxPerTx = c.maxPerTx; cfg.maxDaily = c.maxDaily; cfg.totalBudget = c.totalBudget;
  });

  test('ATTACK-1 per-transaction overspend is reverted by the contract; no funds move', async () => {
    const bal = await balance(R1); const t0 = await wallet.getSpendingTracker();
    const r = await pay(missions.C.id, R1, formatEther(cfg.maxPerTx + 1n), hijacked);
    assert.ok(r.executed.status >= 400, 'over-limit execution must not report success');
    assert.equal(await balance(R1), bal);
    assert.equal((await wallet.getSpendingTracker()).totalSpent, t0.totalSpent);
    const p = (await api('GET', `/api/payments/${r.id}`, 'reader')).body.payment;
    assert.notEqual(p.status, 'CONFIRMED');
    // Finding INT-002 is recorded in KNOWN_BUGS.md if this stays SUBMITTED (reservation held) rather than FAILED.
    assert.ok(['SUBMITTED', 'FAILED'].includes(p.status), `unexpected status ${p.status}`);
  });

  test('ATTACK-2 drain loop: repeated max-size payments stop at the daily limit', async () => {
    const startBal = await balance(R1) + await balance(R2);
    const attempts = 8; let succeeded = 0;
    for (let i = 0; i < attempts; i += 1) {
      const r = await pay(missions.C.id, i % 2 ? R2 : R1, formatEther(cfg.maxPerTx), hijacked);
      if (r.executed?.status === 200) succeeded += 1;
    }
    const lost = (await balance(R1)) + (await balance(R2)) - startBal;
    const t = await wallet.getSpendingTracker();
    assert.ok(succeeded < attempts, 'the drain loop must be stopped by a limit');
    assert.ok(t.dailySpent <= cfg.maxDaily, `daily spend ${t.dailySpent} exceeded limit ${cfg.maxDaily}`);
    assert.equal(lost, cfg.maxPerTx * BigInt(succeeded), 'loss must equal confirmed payments only');
    assert.ok(lost <= cfg.maxDaily, 'attack loss exceeded the daily limit');
    assert.ok(t.totalSpent <= cfg.totalBudget);
  });

  test('ATTACK-3 non-allowlisted attacker address: blocked by the backend (layer 1)', async () => {
    const bal = await balance(ATTACKER);
    const r = await api('POST', '/api/payments', 'operator', proposal(missions.C.id, ATTACKER, '0.01', hijacked));
    assert.equal(r.status, 422);
    assert.equal(await balance(ATTACKER), bal);
  });

  test('ATTACK-4 same attacker address with the backend policy bypassed: blocked by the contract (layer 2)', async () => {
    const saved = { a: process.env.RECIPIENT_ALLOWLIST, m: process.env.MISSION_RECIPIENTS_JSON };
    process.env.RECIPIENT_ALLOWLIST = [R1, R2, ATTACKER].join(',');
    process.env.MISSION_RECIPIENTS_JSON = JSON.stringify({ [missions.C.id]: [R1, R2, ATTACKER] });
    try {
      const bal = await balance(ATTACKER);
      const r = await pay(missions.C.id, ATTACKER, '0.01', hijacked);
      assert.ok(r.executed.status >= 400, 'contract must refuse a recipient that is not on its allowlist');
      assert.equal(await balance(ATTACKER), bal);
    } finally { process.env.RECIPIENT_ALLOWLIST = saved.a; process.env.MISSION_RECIPIENTS_JSON = saved.m; }
  });

  test('ATTACK-5 replay of an executed payment cannot be executed again', async () => {
    const first = await pay(missions.A.id, R1, '0.001', 'agent-replay');
    // The daily limit may already be used up by ATTACK-2; the replay property is then covered by E2E-1.
    if (first.executed.status !== 200) return;
    const bal = await balance(R1);
    const replay = await api('POST', `/api/payments/${first.id}/execute`, 'executor');
    assert.ok(replay.status >= 400);
    assert.equal(await balance(R1), bal);
  });

  test('ATTACK-6 tampered approval: changing the amount after approval invalidates it', async () => {
    const created = await api('POST', '/api/payments', 'operator', proposal(missions.C.id, R1, '0.01', hijacked));
    const approved = await api('POST', `/api/payments/${created.body.payment.id}/approve`, 'approver', { detailsHash: created.body.detailsHash });
    assert.equal(approved.status, 200);
    // Attacker with file access edits the stored amount.
    const db = JSON.parse(fs.readFileSync(process.env.PAYMENT_DB_PATH, 'utf8'));
    assert.ok(db.payments.find(p => p.id === created.body.payment.id), 'payment must be persisted');
    // In-process store is the source of truth; mutate the live record the same way a compromised service would.
    const { PaymentStore } = require('../../dist/services/paymentStore.js');
    PaymentStore.get(created.body.payment.id).amount = '0.09';
    const bal = await balance(R1);
    const exec = await api('POST', `/api/payments/${created.body.payment.id}/execute`, 'executor');
    assert.ok(exec.status >= 400, 'execution must refuse a payment whose details no longer match the approval');
    assert.equal(await balance(R1), bal);
  });

  test('ATTACK-7 disabled agent keeps trying: every attempt is refused and nothing moves', async () => {
    await api('POST', `/api/payments/agents/${hijacked}/kill`, 'admin');
    const bal = await balance(R1);
    for (let i = 0; i < 3; i += 1) {
      const r = await api('POST', '/api/payments', 'operator', proposal(missions.C.id, R1, '0.01', hijacked));
      assert.equal(r.status, 403);
    }
    assert.equal(await balance(R1), bal);
  });

  test('total loss across the whole run never exceeds the on-chain daily limit', async () => {
    const t = await wallet.getSpendingTracker();
    assert.ok(t.dailySpent <= cfg.maxDaily);
  });
});
