const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { Interface, parseUnits } = require('ethers');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-payments-'));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));
process.env.PAYMENT_DB_PATH = path.join(tmp, 'payments.json');
process.env.CHAIN_ID = '1337';
process.env.RECIPIENT_ALLOWLIST = '0x0000000000000000000000000000000000000001';
process.env.EXECUTION_MODE = 'demo';
process.env.CONTRACT_ADDRESS = '0x0000000000000000000000000000000000000009';
process.env.CONTRACT_EXECUTION_EVENT = 'PaymentExecuted';
process.env.CONTRACT_ABI = JSON.stringify([
  'function execute(address recipient,uint256 amount)',
  'event PaymentExecuted(address indexed recipient,uint256 amount)',
]);
const { transition } = require('../dist/services/paymentStore.js');
const { PaymentStore } = require('../dist/services/paymentStore.js');
const { Store } = require('../dist/store.js');
const { approvePayment, budgetSnapshot, createPayment, detailsHash, executePayment, reconcileReceipt, requirePaymentAuth, simulate, validateProposal } = require('../dist/services/paymentService.js');
const paymentController = require('../dist/controllers/paymentControllers.js');

const recipient = '0x0000000000000000000000000000000000000001';
function mission(budget = 100) {
  const id = `mission-${randomUUID()}`;
  Store.getState().missions.push({ id, name: id, missionId: id, merchant: 'Demo merchant', budget, spent: 0, expiry: new Date(Date.now() + 3_600_000).toISOString(), trustScore: 100, status: 'created', createdAt: Date.now() });
  return id;
}
function proposal(missionId, amount = '10', overrides = {}) {
  return validateProposal({ missionId, recipient, amount, chainId: 1337, expiresAt: new Date(Date.now() + 3_600_000).toISOString(), requestId: `request-${randomUUID()}`, idempotencyKey: `idempotency-${randomUUID()}`, agentId: `agent-${randomUUID()}`, ...overrides });
}
function mockResponse() { return { code: 200, body: undefined, status(n) { this.code = n; return this; }, json(value) { this.body = value; return this; } }; }
function paymentReceipt(payment, status, hash, blockNumber) {
  const iface = new Interface(JSON.parse(process.env.CONTRACT_ABI));
  const encoded = iface.encodeEventLog(iface.getEvent('PaymentExecuted'), [payment.recipient, parseUnits(payment.amount, 18)]);
  return { hash, blockNumber, status, gasUsed: 1n, logs: [{ address: process.env.CONTRACT_ADDRESS, topics: encoded.topics, data: encoded.data }] };
}
function configureReal(id) {
  process.env.EXECUTION_MODE = 'real';
  process.env.RPC_URL = 'http://127.0.0.1:8545';
  process.env.PRIVATE_KEY = `0x${'11'.repeat(32)}`; // deterministic test key; injected runtime never signs or sends.
  process.env.CHAIN_ID = '1337';
  process.env.CONTRACT_ADDRESS = '0x0000000000000000000000000000000000000009';
  process.env.CONTRACT_ABI = JSON.stringify(['function execute(address recipient,uint256 amount)', 'event PaymentExecuted(address indexed recipient,uint256 amount)']);
  process.env.CONTRACT_EXECUTE_METHOD = 'execute';
  process.env.CONTRACT_EXECUTION_EVENT = 'PaymentExecuted';
  process.env.PAYMENT_DECIMALS = '18';
  process.env.CONFIRMATIONS = '2';
  process.env.RECIPIENT_ALLOWLIST = recipient;
  process.env.MISSION_RECIPIENTS_JSON = JSON.stringify({ [id]: [recipient] });
}
function resetDemoMode() {
  process.env.EXECUTION_MODE = 'demo';
  delete process.env.MISSION_RECIPIENTS_JSON;
}
function mockRuntime({ receipt = null, sendError, waitError, chainError, code = '0x6000', delay = 0 } = {}) {
  const calls = { submit: 0, wait: [] };
  let lastReceipt = null;
  return {
    calls,
    chainId: async () => { if (chainError) throw chainError; if (delay) await new Promise(resolve => setTimeout(resolve, delay)); return 1337; },
    getCode: async () => code,
    submit: async () => {
      calls.submit++;
      if (sendError) throw sendError;
      const hash = `0x${String(calls.submit).padStart(64, '0')}`;
      lastReceipt = receipt ? { ...receipt, hash } : null;
      return { hash, wait: async confirmations => { calls.wait.push(confirmations); if (waitError) throw waitError; return lastReceipt; } };
    },
    getReceipt: async () => lastReceipt,
    blockNumber: async () => lastReceipt ? lastReceipt.blockNumber + 1 : 0,
  };
}

function payment(status = 'PENDING') {
  return { status, events: [], updatedAt: new Date().toISOString() };
}

test('payment lifecycle records actor, timestamp, and reason at every valid transition', () => {
  const p = payment();
  transition(p, 'APPROVED', 'approver-1', 'details hash matched');
  transition(p, 'SUBMITTED', 'operator-1', '0xabc accepted by RPC');
  transition(p, 'CONFIRMED', 'chain-watcher', 'confirmed in block 42');
  assert.equal(p.status, 'CONFIRMED');
  assert.deepEqual(p.events.map(e => e.to), ['APPROVED', 'SUBMITTED', 'CONFIRMED']);
  assert.ok(p.events.every(e => e.actor && Number.isFinite(Date.parse(e.at))));
  assert.equal(p.events[2].reason, 'confirmed in block 42');
});

test('submitted payments cannot be rejected or approved payments submitted twice', () => {
  const submitted = payment('SUBMITTED');
  assert.throws(() => transition(submitted, 'REJECTED', 'operator'), /Invalid payment transition/);
  const approved = payment('APPROVED');
  transition(approved, 'SUBMITTED', 'operator');
  assert.throws(() => transition(approved, 'SUBMITTED', 'operator'), /Invalid payment transition/);
});

test('expired and rejected payments cannot be revived', () => {
  const expired = payment(); transition(expired, 'EXPIRED', 'system', 'expired');
  assert.throws(() => transition(expired, 'APPROVED', 'operator'), /Invalid payment transition/);
  const rejected = payment(); transition(rejected, 'REJECTED', 'approver', 'denied');
  assert.throws(() => transition(rejected, 'APPROVED', 'operator'), /Invalid payment transition/);
});

test('rejects invalid proposal values and missing authentication', () => {
  assert.throws(() => validateProposal({}), /valid EVM recipient/);
  assert.throws(() => validateProposal({ missionId: 'm', recipient, amount: '1e6', chainId: 1337, expiresAt: new Date(Date.now() + 1_000).toISOString(), requestId: 'r', idempotencyKey: 'abcdefgh', agentId: 'a' }), /decimal string/);
  assert.throws(() => requirePaymentAuth(undefined, ['reader']), { status: 401 });
});

test('separate payment roles prevent readers and operators from approving or executing', () => {
  process.env.PAYMENT_READER_TOKEN = 'r'.repeat(32);
  process.env.PAYMENT_OPERATOR_TOKEN = 'o'.repeat(32);
  process.env.PAYMENT_APPROVER_TOKEN = 'p'.repeat(32);
  process.env.PAYMENT_EXECUTOR_TOKEN = 'e'.repeat(32);
  process.env.PAYMENT_ADMIN_TOKEN = 'a'.repeat(32);
  assert.throws(() => requirePaymentAuth(`Bearer ${process.env.PAYMENT_READER_TOKEN}`, ['approver']), { status: 403 });
  assert.throws(() => requirePaymentAuth(`Bearer ${process.env.PAYMENT_OPERATOR_TOKEN}`, ['executor']), { status: 403 });
  assert.equal(requirePaymentAuth(`Bearer ${process.env.PAYMENT_APPROVER_TOKEN}`, ['approver']).role, 'approver');
  assert.equal(requirePaymentAuth(`Bearer ${process.env.PAYMENT_ADMIN_TOKEN}`, ['executor']).role, 'admin');
  const placeholder = 'replace-with-reader-secret';
  assert.throws(() => requirePaymentAuth(`Bearer ${placeholder}`, ['reader']), { status: 401 });
});

test('HTTP handlers reject unauthenticated creation, unauthorized approval, and malformed input', async () => {
  const unauth = mockResponse();
  await paymentController.create({ header: () => undefined, body: {} }, unauth);
  assert.equal(unauth.code, 401);
  const wrongRole = mockResponse();
  await paymentController.approve({ header: () => `Bearer ${process.env.PAYMENT_OPERATOR_TOKEN}`, params: { id: 'missing' }, body: {} }, wrongRole);
  assert.equal(wrongRole.code, 403);
  const invalid = mockResponse();
  await paymentController.create({ header: () => `Bearer ${process.env.PAYMENT_OPERATOR_TOKEN}`, body: {} }, invalid);
  assert.equal(invalid.code, 400);
});

test('each payment endpoint rejects a valid token with the wrong role', async () => {
  const cases = [
    ['create', 'reader'], ['simulatePayment', 'executor'], ['list', 'operator'], ['listAgents', 'operator'], ['get', 'operator'],
    ['approve', 'operator'], ['reject', 'operator'], ['freeze', 'operator'], ['unfreeze', 'operator'],
    ['freezeMission', 'operator'], ['unfreezeMission', 'operator'], ['execute', 'approver'],
    ['reconcile', 'approver'], ['killAgent', 'executor'], ['agentStatus', 'operator'],
  ];
  const tokens = { reader: 'r'.repeat(32), operator: 'o'.repeat(32), approver: 'p'.repeat(32), executor: 'e'.repeat(32), admin: 'a'.repeat(32) };
  for (const [name, role] of cases) {
    const response = mockResponse();
    await paymentController[name]({ header: () => `Bearer ${tokens[role]}`, params: { id: 'missing', missionId: 'missing', agentId: 'missing' }, body: {} }, response);
    assert.equal(response.code, 403, `${name} accepted an unauthorized ${role} token`);
  }
});

test('insufficient budget is rejected before creating an executable payment', async () => {
  const id = mission(20);
  await assert.rejects(createPayment(proposal(id, '20.01'), 'operator'), /budget would be exceeded/);
});

test('concurrent identical idempotency requests create only one payment', async () => {
  const id = mission(100); const input = proposal(id, '10');
  const results = await Promise.all([createPayment(input, 'operator'), createPayment(input, 'operator')]);
  assert.equal(PaymentStore.all().filter(p => p.idempotencyKey === input.key).length, 1);
  assert.equal(results.filter(r => r.duplicate).length, 1);
  const persisted = spawnSync(process.execPath, ['-e', "const {PaymentStore}=require('./dist/services/paymentStore'); const p=PaymentStore.byIdempotency(process.argv[1]); process.stdout.write(p?.id || 'missing')", input.key], { cwd: process.cwd(), env: process.env, encoding: 'utf8' });
  assert.equal(persisted.status, 0);
  assert.equal(persisted.stdout, results[0].payment.id);
  const retryAfterLostResponse = await createPayment(input, 'operator');
  assert.equal(retryAfterLostResponse.duplicate, true);
  assert.equal(retryAfterLostResponse.payment.id, results[0].payment.id);
});

test('two approvals competing for one budget serialize and cannot overspend', async () => {
  const id = mission(100);
  const a = (await createPayment(proposal(id, '60'), 'operator')).payment;
  const b = (await createPayment(proposal(id, '60'), 'operator')).payment;
  const outcomes = await Promise.allSettled([approvePayment(a, 'approver', detailsHash(a)), approvePayment(b, 'approver', detailsHash(b))]);
  assert.equal(outcomes.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter(x => x.status === 'rejected').length, 1);
  assert.equal(Number(PaymentStore.reservedForMission(id)), 60);
});

test('budget accounting assigns settled spend and reservations consistently across every state', async () => {
  const id = mission(100); Store.getMission(id).spent = 6;
  const pending = (await createPayment(proposal(id, '8'), 'operator')).payment;
  let snapshot = budgetSnapshot(id, Store.getMission(id));
  assert.equal(snapshot.missionSpent, '6.0');
  assert.equal(snapshot.confirmedPayments, '0.0');
  assert.equal(snapshot.reservedPayments, '0.0'); // PENDING is not yet authorized for execution.
  assert.equal(snapshot.available, '94.0');

  await approvePayment(pending, 'approver', detailsHash(pending));
  assert.equal(budgetSnapshot(id, Store.getMission(id)).reservedPayments, '8.0');
  transition(pending, 'SUBMITTED', 'executor'); await PaymentStore.save(pending);
  assert.equal(budgetSnapshot(id, Store.getMission(id)).reservedPayments, '8.0');
  await reconcileReceipt(pending, paymentReceipt(pending, 1, '0xsettled', 10), 1, 1, 'executor');
  snapshot = budgetSnapshot(id, Store.getMission(id));
  assert.equal(snapshot.confirmedPayments, '8.0');
  assert.equal(snapshot.reservedPayments, '0.0');
  assert.equal(snapshot.available, '86.0'); // mission.spent counted once; confirmed payment counted once.

  const frozen = (await createPayment(proposal(id, '4'), 'operator')).payment;
  transition(frozen, 'FROZEN', 'approver'); await PaymentStore.save(frozen);
  assert.equal(budgetSnapshot(id, Store.getMission(id)).reservedPayments, '4.0');
  transition(frozen, 'PENDING', 'approver', 'unfrozen'); await PaymentStore.save(frozen);
  assert.equal(budgetSnapshot(id, Store.getMission(id)).reservedPayments, '0.0');
  transition(frozen, 'EXPIRED', 'system', 'expired'); await PaymentStore.save(frozen);
  assert.equal(budgetSnapshot(id, Store.getMission(id)).available, '86.0');

  const failed = (await createPayment(proposal(id, '5'), 'operator')).payment;
  await approvePayment(failed, 'approver', detailsHash(failed));
  assert.equal(budgetSnapshot(id, Store.getMission(id)).reservedPayments, '5.0');
  transition(failed, 'FAILED', 'system', 'definite pre-submit failure'); await PaymentStore.save(failed);
  assert.equal(budgetSnapshot(id, Store.getMission(id)).reservedPayments, '0.0');

  const rejected = (await createPayment(proposal(id, '2'), 'operator')).payment;
  transition(rejected, 'REJECTED', 'approver', 'denied'); await PaymentStore.save(rejected);
  assert.equal(budgetSnapshot(id, Store.getMission(id)).reservedPayments, '0.0');
});

test('legitimate similar payments are allowed with a warning', async () => {
  const id = mission(100);
  await createPayment(proposal(id, '10'), 'operator');
  const second = await createPayment(proposal(id, '10'), 'operator');
  assert.equal(second.duplicate, false);
  assert.match(second.warnings[0], /same mission, recipient, and amount/);
});

test('approval expires, cannot be reused, and is bound to recipient and amount', async () => {
  const id = mission(100);
  const altered = (await createPayment(proposal(id, '10'), 'operator')).payment;
  const originalHash = detailsHash(altered); altered.recipient = '0x0000000000000000000000000000000000000002';
  await assert.rejects(approvePayment(altered, 'approver', originalHash), /details/);

  const expired = (await createPayment(proposal(id, '5'), 'operator')).payment;
  expired.expiresAt = new Date(Date.now() - 1_000).toISOString();
  await assert.rejects(approvePayment(expired, 'approver', detailsHash(expired)), /expired/);
  assert.equal(expired.status, 'EXPIRED');

  const approved = (await createPayment(proposal(id, '5'), 'operator')).payment;
  const hash = detailsHash(approved);
  await approvePayment(approved, 'approver', hash);
  await assert.rejects(approvePayment(approved, 'approver', hash), /Only pending payments/);
});

test('frozen payments and frozen missions cannot be executed or approved through', async () => {
  const id = mission(100);
  const frozen = (await createPayment(proposal(id, '5'), 'operator')).payment;
  transition(frozen, 'FROZEN', 'approver', 'manual freeze');
  await PaymentStore.save(frozen);
  await assert.rejects(approvePayment(frozen, 'approver', detailsHash(frozen)), /pending payments/);
  const frozenMissionId = mission(100);
  const blocked = (await createPayment(proposal(frozenMissionId, '5'), 'operator')).payment;
  await PaymentStore.freezeMission(frozenMissionId);
  await assert.rejects(approvePayment(blocked, 'approver', detailsHash(blocked)), /frozen/);
});

test('kill switch prevents new payment intake and execution, and records submitted payments', async () => {
  const id = mission(100); const input = proposal(id, '5');
  const p = (await createPayment(input, 'operator')).payment;
  await approvePayment(p, 'approver', detailsHash(p));
  transition(p, 'SUBMITTED', 'executor', 'test in-flight'); p.txHash = '0xabc'; await PaymentStore.save(p);
  const beforeKill = (await createPayment(proposal(id, '2', { agentId: input.agentId }), 'operator')).payment;
  await approvePayment(beforeKill, 'approver', detailsHash(beforeKill));
  await PaymentStore.setAgentDisabled(input.agentId, { actor: 'admin', at: new Date().toISOString(), result: 'backend-disabled' });
  await assert.rejects(createPayment(proposal(id, '2', { agentId: input.agentId }), 'operator'), /Agent is disabled/);
  process.env.EXECUTION_MODE = 'real';
  await assert.rejects(executePayment(beforeKill, 'executor'), /Agent is disabled/);
  process.env.EXECUTION_MODE = 'demo';
  assert.equal(PaymentStore.all().filter(row => row.agentId === input.agentId && row.status === 'SUBMITTED').length, 1);
});

test('kill-switch response distinguishes backend disablement from unperformed on-chain revocation', async () => {
  const agentId = `kill-${randomUUID()}`; const res = mockResponse();
  await paymentController.killAgent({ header: () => `Bearer ${process.env.PAYMENT_ADMIN_TOKEN}`, params: { agentId } }, res);
  assert.equal(res.body.backendStatus, 'disabled');
  assert.equal(res.body.onChainRevocation.status, 'not_performed');
});

test('simulator is labeled as a preview and returns no broadcast', async () => {
  const result = await simulate(proposal(mission(100), '5'));
  assert.equal(result.preview, true);
  assert.equal(result.broadcasted, false);
  assert.equal(result.canProceed, true);
  assert.equal('transactionHash' in result, false);
});

test('pending and ambiguous submissions retain reservations until a definitive receipt', async () => {
  const id = mission(100); const p = (await createPayment(proposal(id, '7'), 'operator')).payment;
  await approvePayment(p, 'approver', detailsHash(p));
  transition(p, 'SUBMITTED', 'executor', 'submission uncertain'); await PaymentStore.save(p);
  assert.equal(Number(PaymentStore.reservedForMission(id)), 7);
  const pending = await reconcileReceipt(p, null, 0, 2, 'executor');
  assert.equal(pending.status, 'pending');
  const confirming = await reconcileReceipt(p, paymentReceipt(p, 1, '0xabc', 10), 1, 2, 'executor');
  assert.equal(confirming.status, 'confirming');
  assert.equal(Number(PaymentStore.reservedForMission(id)), 7);
  const unverified = await reconcileReceipt(p, { hash: '0xdef', blockNumber: 11, status: 1, gasUsed: 1n, logs: [] }, 2, 2, 'executor');
  assert.equal(unverified.status, 'unverified');
  assert.equal(p.status, 'SUBMITTED');
  assert.equal(Number(PaymentStore.reservedForMission(id)), 7);
});

test('receipt hash mismatch never confirms or releases the reservation', async () => {
  const id = mission(100); const p = (await createPayment(proposal(id, '3'), 'operator')).payment;
  await approvePayment(p, 'approver', detailsHash(p)); transition(p, 'SUBMITTED', 'executor'); p.txHash = `0x${'d'.repeat(64)}`; await PaymentStore.save(p);
  const result = await reconcileReceipt(p, paymentReceipt(p, 1, `0x${'e'.repeat(64)}`, 12), 2, 2, 'executor');
  assert.equal(result.status, 'unverified');
  assert.equal(p.status, 'SUBMITTED');
  assert.equal(Number(PaymentStore.reservedForMission(id)), 3);
});

test('successful, reverted, and unknown receipt statuses release or retain reservations correctly', async () => {
  const id = mission(100);
  const confirmed = (await createPayment(proposal(id, '8'), 'operator')).payment;
  await approvePayment(confirmed, 'approver', detailsHash(confirmed)); transition(confirmed, 'SUBMITTED', 'executor');
  await reconcileReceipt(confirmed, paymentReceipt(confirmed, 1, '0x1', 1), 2, 2, 'executor');
  assert.equal(confirmed.status, 'CONFIRMED');
  assert.equal(Number(PaymentStore.confirmedForMission(id)), 8);
  assert.equal(Number(PaymentStore.reservedForMission(id)), 0);

  const failed = (await createPayment(proposal(id, '9'), 'operator')).payment;
  await approvePayment(failed, 'approver', detailsHash(failed)); transition(failed, 'SUBMITTED', 'executor');
  await reconcileReceipt(failed, paymentReceipt(failed, 0, '0x2', 2), 2, 2, 'executor');
  assert.equal(failed.status, 'FAILED');
  assert.equal(Number(PaymentStore.reservedForMission(id)), 0);

  const unknown = (await createPayment(proposal(id, '3'), 'operator')).payment;
  await approvePayment(unknown, 'approver', detailsHash(unknown)); transition(unknown, 'SUBMITTED', 'executor');
  await reconcileReceipt(unknown, paymentReceipt(unknown, null, '0x3', 3), 2, 2, 'executor');
  assert.equal(unknown.status, 'SUBMITTED');
  assert.equal(Number(PaymentStore.reservedForMission(id)), 3);
});

test('real mode fails closed without a compatible configured chain and fabricates no hash', async () => {
  const id = mission(100); const p = (await createPayment(proposal(id, '3'), 'operator')).payment;
  await approvePayment(p, 'approver', detailsHash(p));
  process.env.EXECUTION_MODE = 'real';
  process.env.MISSION_RECIPIENTS_JSON = JSON.stringify({ [id]: [recipient] });
  delete process.env.RPC_URL; delete process.env.PRIVATE_KEY; delete process.env.CONTRACT_ADDRESS; delete process.env.CONTRACT_ABI;
  await assert.rejects(executePayment(p, 'executor'), /required/);
  assert.equal(p.txHash, undefined);
  assert.equal(p.receipt, undefined);
  assert.equal(p.status, 'APPROVED');
  process.env.EXECUTION_MODE = 'demo';
  delete process.env.MISSION_RECIPIENTS_JSON;
});

test('real API execution remains disabled even with a generic ABI configured', async () => {
  const id = mission(100); const p = (await createPayment(proposal(id, '3'), 'operator')).payment;
  await approvePayment(p, 'approver', detailsHash(p)); configureReal(id);
  await assert.rejects(executePayment(p, 'executor'), /no compatible IMissionWallet\/UserOperation adapter/);
  assert.equal(p.status, 'APPROVED');
  assert.equal(p.txHash, undefined);
  resetDemoMode();
});

test('mocked RPC execution confirms only after hash, required confirmations, and matching event', async () => {
  const id = mission(100); const p = (await createPayment(proposal(id, '2'), 'operator')).payment;
  await approvePayment(p, 'approver', detailsHash(p)); configureReal(id);
  const hash = `0x${'a'.repeat(64)}`;
  const runtime = mockRuntime({ receipt: paymentReceipt(p, 1, hash, 20) });
  await executePayment(p, 'executor', runtime);
  assert.equal(runtime.calls.submit, 1);
  assert.deepEqual(runtime.calls.wait, [2]);
  assert.equal(p.txHash, hashForExecution(runtime.calls.submit));
  assert.equal(p.status, 'CONFIRMED');
  resetDemoMode();
});

function hashForExecution() { return `0x${String(1).padStart(64, '0')}`; }

test('RPC preflight failure leaves an approved reservation; reverted receipt releases it', async () => {
  const preflightMission = mission(100); const preflight = (await createPayment(proposal(preflightMission, '3'), 'operator')).payment;
  await approvePayment(preflight, 'approver', detailsHash(preflight)); configureReal(preflightMission);
  const preflightRuntime = mockRuntime({ chainError: new Error('RPC unavailable') });
  await assert.rejects(executePayment(preflight, 'executor', preflightRuntime), /RPC unavailable/);
  assert.equal(preflight.status, 'APPROVED');
  assert.equal(Number(PaymentStore.reservedForMission(preflightMission)), 3);
  assert.equal(preflightRuntime.calls.submit, 0);
  resetDemoMode();

  const failedMission = mission(100); const failed = (await createPayment(proposal(failedMission, '4'), 'operator')).payment;
  await approvePayment(failed, 'approver', detailsHash(failed)); configureReal(failedMission);
  const runtime = mockRuntime({ receipt: paymentReceipt(failed, 0, `0x${'b'.repeat(64)}`, 30), waitError: new Error('execution reverted') });
  await executePayment(failed, 'executor', runtime);
  assert.equal(failed.status, 'FAILED');
  assert.equal(Number(PaymentStore.reservedForMission(failedMission)), 0);
  resetDemoMode();
});

test('ambiguous send and confirmation timeouts keep SUBMITTED reservations', async () => {
  const sendMission = mission(100); const send = (await createPayment(proposal(sendMission, '5'), 'operator')).payment;
  await approvePayment(send, 'approver', detailsHash(send)); configureReal(sendMission);
  await assert.rejects(executePayment(send, 'executor', mockRuntime({ sendError: new Error('socket timeout after broadcast may have started') })), /socket timeout/);
  assert.equal(send.status, 'SUBMITTED');
  assert.equal(send.txHash, undefined);
  assert.equal(Number(PaymentStore.reservedForMission(sendMission)), 5);
  resetDemoMode();

  const waitMission = mission(100); const wait = (await createPayment(proposal(waitMission, '6'), 'operator')).payment;
  await approvePayment(wait, 'approver', detailsHash(wait)); configureReal(waitMission);
  const runtime = mockRuntime({ waitError: new Error('confirmation timeout') });
  await assert.rejects(executePayment(wait, 'executor', runtime), /confirmation timeout/);
  assert.equal(wait.status, 'SUBMITTED');
  assert.match(wait.txHash, /^0x[0-9a-f]{64}$/);
  assert.equal(Number(PaymentStore.reservedForMission(waitMission)), 6);
  resetDemoMode();
});

test('concurrent execution requests serialize per configured wallet', async () => {
  const id = mission(100); const p = (await createPayment(proposal(id, '2'), 'operator')).payment;
  await approvePayment(p, 'approver', detailsHash(p)); configureReal(id);
  const hash = `0x${'c'.repeat(64)}`;
  const runtime = mockRuntime({ receipt: paymentReceipt(p, 1, hash, 40), delay: 20 });
  const first = executePayment(p, 'executor', runtime);
  await assert.rejects(executePayment(p, 'executor', runtime), /Another payment is executing/);
  await first;
  assert.equal(runtime.calls.submit, 1);
  assert.equal(p.status, 'CONFIRMED');
  await assert.rejects(executePayment(p, 'executor', runtime), /Payment must be approved/);
  assert.equal(runtime.calls.submit, 1);
  resetDemoMode();
});
