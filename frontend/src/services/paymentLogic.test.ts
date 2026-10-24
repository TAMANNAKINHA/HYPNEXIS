import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ApiError, agentsFromPayments, allowedActions, buildMissionPrompt, expiryInMinutes, filterPayments, formatErrors, friendlyError,
  isEvmAddress, isValidAmount, latestReason, newId, sessionState, shortHash,
} from './paymentLogic.ts';
import type { Payment, PaymentStatus } from '../paymentTypes.ts';

const ADDR = '0x1111111111111111111111111111111111111111';
const pay = (over: Partial<Payment> = {}): Payment => ({
  id: 'p1', requestId: 'r1', idempotencyKey: 'k1-12345', missionId: 'm1', recipient: ADDR, amount: '1.5', chainId: 1337,
  expiresAt: '2030-01-01T00:00:00.000Z', status: 'PENDING', createdAt: '2026-10-20T10:00:00.000Z',
  updatedAt: '2026-10-20T10:00:00.000Z', actor: 'op', events: [], ...over,
});

test('isEvmAddress accepts a normal address', () => assert.equal(isEvmAddress(ADDR), true));
test('isEvmAddress rejects the zero address', () => assert.equal(isEvmAddress(`0x${'0'.repeat(40)}`), false));
test('isEvmAddress rejects short, unprefixed and non-hex values', () => {
  assert.equal(isEvmAddress('0x123'), false);
  assert.equal(isEvmAddress(ADDR.slice(2)), false);
  assert.equal(isEvmAddress(`0x${'g'.repeat(40)}`), false);
});

test('isValidAmount accepts positive decimals', () => {
  assert.equal(isValidAmount('2'), true);
  assert.equal(isValidAmount('0.000000000000000001'), true);
  assert.equal(isValidAmount('12.50'), true);
});
test('isValidAmount rejects zero, negative, text, too many decimals', () => {
  for (const bad of ['0', '0.0', '-1', 'abc', '', '1e5', '1.0000000000000000001', '1,5']) assert.equal(isValidAmount(bad), false, bad);
});

test('formatErrors returns nothing for a good form', () => {
  assert.deepEqual(formatErrors({ missionId: 'm1', agentId: 'a1', recipient: ADDR, amount: '1', chainId: '1337' }), []);
});
test('formatErrors reports every bad field', () => {
  const errs = formatErrors({ missionId: '', agentId: ' ', recipient: 'x', amount: '0', chainId: '0' });
  assert.equal(errs.length, 5);
});

test('buildMissionPrompt formats the budget in Indian grouping', () => {
  assert.equal(buildMissionPrompt('AWS', 45000), 'Pay AWS up to ₹45,000');
  assert.equal(buildMissionPrompt('GitHub', 1800.4), 'Pay GitHub up to ₹1,800');
});
test('buildMissionPrompt always contains a currency marker the backend can parse', () => {
  assert.match(buildMissionPrompt('OpenAI', 500), /₹\d/);
});

test('allowedActions matches the backend transition table', () => {
  const expected: Record<PaymentStatus, string[]> = {
    PENDING: ['approve', 'reject', 'freeze'], APPROVED: ['execute', 'reject', 'freeze'], FROZEN: ['unfreeze', 'reject'],
    SUBMITTED: ['reconcile'], CONFIRMED: [], REJECTED: [], EXPIRED: [], FAILED: [],
  };
  for (const [status, actions] of Object.entries(expected)) assert.deepEqual(allowedActions(status as PaymentStatus), actions, status);
});
test('a submitted payment can never be rejected or frozen from the UI', () => {
  const a = allowedActions('SUBMITTED');
  assert.ok(!a.includes('reject') && !a.includes('freeze'));
});

test('filterPayments filters by status', () => {
  const list = [pay({ id: 'a', status: 'PENDING' }), pay({ id: 'b', status: 'FROZEN' })];
  assert.deepEqual(filterPayments(list, { status: 'FROZEN' }).map((p) => p.id), ['b']);
});
test('filterPayments filters by mission and date', () => {
  const list = [pay({ id: 'a', missionId: 'm1', createdAt: '2026-10-01T00:00:00.000Z' }), pay({ id: 'b', missionId: 'm2', createdAt: '2026-10-22T00:00:00.000Z' })];
  assert.deepEqual(filterPayments(list, { missionId: 'm2' }).map((p) => p.id), ['b']);
  assert.deepEqual(filterPayments(list, { from: '2026-10-15' }).map((p) => p.id), ['b']);
});
test('filterPayments with no filters returns everything', () => assert.equal(filterPayments([pay(), pay()], {}).length, 2));

test('latestReason prefers failureReason, then the last event reason', () => {
  assert.equal(latestReason(pay({ failureReason: 'Recipient not allowed' })), 'Recipient not allowed');
  assert.equal(latestReason(pay({ events: [{ from: null, to: 'PENDING', actor: 'a', at: 'x' }, { from: 'PENDING', to: 'FROZEN', actor: 'a', at: 'y', reason: 'checking' }] })), 'checking');
  assert.equal(latestReason(pay()), '');
});

test('shortHash shortens long hashes and leaves short text alone', () => {
  assert.equal(shortHash(`0x${'a'.repeat(64)}`), `0xaaaaaaaa…aaaaaa`);
  assert.equal(shortHash('short'), 'short');
});

test('sessionState covers each lifecycle state', () => {
  const now = Date.parse('2026-10-24T00:00:00Z');
  const future = '2026-11-01T00:00:00Z';
  assert.equal(sessionState({ status: 'executing', expiry: future }, now), 'Active');
  assert.equal(sessionState({ status: 'executing', expiry: '2026-10-01T00:00:00Z' }, now), 'Expired');
  assert.equal(sessionState({ status: 'frozen', expiry: future }, now), 'Frozen');
  assert.equal(sessionState({ status: 'nuked', expiry: future }, now), 'Revoked');
  assert.equal(sessionState({ status: 'cancelled', expiry: future }, now), 'Cancelled');
  assert.equal(sessionState({ status: 'completed', expiry: future }, now), 'Completed');
  assert.equal(sessionState({ status: 'awaiting_otp', expiry: future }, now), 'Pending');
});
test('a revoked session stays revoked even if it has expired', () => {
  assert.equal(sessionState({ status: 'nuked', expiry: '2020-01-01T00:00:00Z' }, Date.now()), 'Revoked');
});

test('expiryInMinutes returns a future ISO time', () => {
  assert.equal(expiryInMinutes(60, 0), '1970-01-01T01:00:00.000Z');
});
test('newId is prefixed and unique', () => {
  const a = newId('req'); const b = newId('req');
  assert.ok(a.startsWith('req-'));
  assert.notEqual(a, b);
  assert.ok(a.length >= 12);
});

test('friendlyError maps backend statuses to readable messages', () => {
  assert.match(friendlyError(new ApiError('x', 0)), /Cannot reach the backend/);
  assert.match(friendlyError(new ApiError('x', 401)), /token/i);
  assert.match(friendlyError(new ApiError('x', 403)), /not allowed/i);
  assert.match(friendlyError(new ApiError('x', 410)), /expired/i);
  assert.match(friendlyError(new ApiError('x', 429)), /Too many requests/);
  assert.match(friendlyError(new ApiError('Mission budget would be exceeded', 422)), /budget/);
});
test('friendlyError handles browser network errors and unknown values', () => {
  assert.match(friendlyError(new TypeError('Failed to fetch')), /Cannot reach the backend/);
  assert.match(friendlyError(new TypeError('Load failed')), /Cannot reach the backend/);
  assert.match(friendlyError('weird'), /Something went wrong/);
});

test('agentsFromPayments lists each agent once with its payment count and unknown status', () => {
  const mk = (agentId?: string) => ({ agentId } as unknown as Payment);
  const agents = agentsFromPayments([mk('b'), mk('a'), mk('b'), mk(undefined)]);
  assert.deepEqual(agents, [
    { agentId: 'a', backendStatus: 'unknown', paymentCount: 1 },
    { agentId: 'b', backendStatus: 'unknown', paymentCount: 2 },
  ]);
  assert.deepEqual(agentsFromPayments([]), []);
});
