import { createHash, randomUUID } from 'crypto';
import { Contract, Interface, JsonRpcProvider, Wallet, isAddress, parseUnits, formatUnits } from 'ethers';
import { Store } from '../store';
import { Payment, PaymentStore, PaymentStatus, assertPaymentStoreHealthy, transition } from './paymentStore';

const locks = new Set<string>();
const ACCOUNTING_SCALE = 18;
export interface MissionBudgetSnapshot {
  missionSpent: string;
  confirmedPayments: string;
  reservedPayments: string;
  available: string;
  availableAfterProposal: string;
}

// The single accounting rule is: legacy mission.spent + CONFIRMED payment records
// are settled spend; APPROVED/SUBMITTED/FROZEN payment records are reservations.
// Payment API confirmations never write back into mission.spent.
export function budgetSnapshot(missionId: string, mission: { budget: number; spent: number }, proposedAmount = '0'): MissionBudgetSnapshot {
  const missionSpent = parseUnits(String(mission.spent), ACCOUNTING_SCALE);
  const confirmedPayments = parseUnits(PaymentStore.confirmedForMission(missionId), ACCOUNTING_SCALE);
  const reservedPayments = parseUnits(PaymentStore.reservedForMission(missionId), ACCOUNTING_SCALE);
  const budget = parseUnits(String(mission.budget), ACCOUNTING_SCALE);
  const proposal = parseUnits(proposedAmount, ACCOUNTING_SCALE);
  const available = budget - missionSpent - confirmedPayments - reservedPayments;
  return {
    missionSpent: formatUnits(missionSpent, ACCOUNTING_SCALE),
    confirmedPayments: formatUnits(confirmedPayments, ACCOUNTING_SCALE),
    reservedPayments: formatUnits(reservedPayments, ACCOUNTING_SCALE),
    available: formatUnits(available, ACCOUNTING_SCALE),
    availableAfterProposal: formatUnits(available - proposal, ACCOUNTING_SCALE),
  };
}
function canonicalDetails(p: Pick<Payment, 'missionId' | 'recipient' | 'amount' | 'chainId' | 'expiresAt' | 'agentId'>) {
  let amount: string;
  try { amount = formatUnits(parseUnits(p.amount, 18), 18); } catch { throw Object.assign(new Error('Payment amount must be a decimal with at most 18 fractional digits.'), { status: 400 }); }
  return { missionId: p.missionId, recipient: p.recipient.toLowerCase(), amount, chainId: p.chainId, expiresAt: new Date(p.expiresAt).toISOString(), agentId: p.agentId || null };
}
export const detailsHash = (p: Pick<Payment, 'missionId' | 'recipient' | 'amount' | 'chainId' | 'expiresAt' | 'agentId'>) => createHash('sha256').update(JSON.stringify(canonicalDetails(p))).digest('hex');

export type PaymentRole = 'reader' | 'operator' | 'approver' | 'executor' | 'admin';
const roleEnv: Record<PaymentRole, string> = { reader: 'PAYMENT_READER_TOKEN', operator: 'PAYMENT_OPERATOR_TOKEN', approver: 'PAYMENT_APPROVER_TOKEN', executor: 'PAYMENT_EXECUTOR_TOKEN', admin: 'PAYMENT_ADMIN_TOKEN' };
export function requirePaymentAuth(header: string | undefined, allowed: PaymentRole[]): { actor: string; role: PaymentRole } {
  const supplied = header?.startsWith('Bearer ') ? header.slice(7) : '';
  if (!supplied) throw Object.assign(new Error('Authenticated payment authorization is required.'), { status: 401 });
  const { timingSafeEqual } = require('crypto') as typeof import('crypto');
  const roles: PaymentRole[] = ['reader', 'operator', 'approver', 'executor', 'admin'];
  for (const role of roles) {
    const configured = process.env[roleEnv[role]];
    const expectedBytes = configured ? Buffer.from(configured) : Buffer.alloc(0);
    const suppliedBytes = Buffer.from(supplied);
    if (configured && configured.length >= 32 && !configured.startsWith('replace-with-') && expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes)) {
      if (role !== 'admin' && !allowed.includes(role)) throw Object.assign(new Error(`The ${role} credential cannot perform this action.`), { status: 403 });
      return { actor: process.env[`${role.toUpperCase()}_ACTOR`] || role, role };
    }
  }
  throw Object.assign(new Error('Invalid payment credential.'), { status: 401 });
}

export function validateProposal(body: any): { missionId: string; recipient: string; amount: string; chainId: number; expiresAt: string; requestId: string; key: string; agentId?: string } {
  const { missionId, recipient, amount, chainId, expiresAt, requestId } = body || {};
  const key = body?.idempotencyKey;
  if (typeof missionId !== 'string' || !missionId || missionId.length > 200 || !isAddress(recipient) || recipient.toLowerCase() === '0x0000000000000000000000000000000000000000') throw Object.assign(new Error('A mission ID and nonzero valid EVM recipient address are required.'), { status: 400 });
  if (typeof amount !== 'string' || !/^\d+(?:\.\d{1,18})?$/.test(amount) || !Number.isFinite(Number(amount)) || Number(amount) <= 0) throw Object.assign(new Error('Amount must be a positive decimal string with at most 18 fractional digits.'), { status: 400 });
  if (!Number.isSafeInteger(chainId) || chainId <= 0) throw Object.assign(new Error('A positive integer chainId is required.'), { status: 400 });
  const expiry = new Date(expiresAt);
  if (!expiresAt || Number.isNaN(expiry.getTime()) || expiry.getTime() <= Date.now()) throw Object.assign(new Error('A future payment expiry is required.'), { status: 400 });
  if (typeof key !== 'string' || key.length < 8 || key.length > 200 || typeof requestId !== 'string' || !requestId || requestId.length > 256) throw Object.assign(new Error('requestId (1–256 characters) and idempotencyKey (8–200 characters) are required.'), { status: 400 });
  if (typeof body.agentId !== 'string' || !body.agentId || body.agentId.length > 200) throw Object.assign(new Error('agentId is required and must be a string of at most 200 characters.'), { status: 400 });
  return { missionId, recipient, amount: String(amount), chainId, expiresAt: expiry.toISOString(), requestId, key, agentId: body.agentId };
}

function checkPolicy(p: { missionId: string; recipient: string; amount: string; chainId: number; expiresAt: string }) {
  const mission = Store.getMission(p.missionId);
  const violations: string[] = []; const warnings: string[] = [];
  if (!mission) violations.push('Mission not found');
  else {
    if (['frozen', 'nuked', 'cancelled', 'completed', 'failed'].includes(mission.status)) violations.push(`Mission is ${mission.status}`);
    if (new Date(mission.expiry).getTime() <= Date.now()) violations.push('Mission has expired');
    const budget = budgetSnapshot(p.missionId, mission, p.amount);
    if (parseUnits(budget.availableAfterProposal, ACCOUNTING_SCALE) < 0n) violations.push('Mission budget would be exceeded');
    if (mission.merchant && isAddress(mission.merchant) && mission.merchant.toLowerCase() !== p.recipient.toLowerCase()) warnings.push('Recipient differs from the mission merchant');
  }
  if (PaymentStore.isMissionFrozen(p.missionId)) violations.push('Mission is frozen by payment controls');
  if (!process.env.CONTRACT_ADDRESS || !process.env.RPC_URL) warnings.push('No real contract network is configured');
  if (process.env.RECIPIENT_ALLOWLIST) {
    const allow = process.env.RECIPIENT_ALLOWLIST.split(',').map(x => x.trim().toLowerCase());
    if (!allow.includes(p.recipient.toLowerCase())) violations.push('Recipient policy failed');
  } else if (getMode() === 'real') violations.push('Recipient allowlist is not configured');
  else warnings.push('Recipient allowlist is not configured');
  if (process.env.MISSION_RECIPIENTS_JSON) {
    try {
      const mapping = JSON.parse(process.env.MISSION_RECIPIENTS_JSON);
      const allowed = mapping[p.missionId];
      if (!Array.isArray(allowed) || !allowed.some((address: unknown) => typeof address === 'string' && address.toLowerCase() === p.recipient.toLowerCase())) violations.push('Recipient is not authorized for this mission');
    } catch { violations.push('MISSION_RECIPIENTS_JSON is invalid'); }
  } else if (getMode() === 'real') violations.push('Mission-specific recipient policy is not configured');
  else warnings.push('Mission-specific recipient policy is not configured');
  if (Number(p.chainId) !== Number(process.env.CHAIN_ID || 0)) violations.push('Payment chain does not match configured chain');
  return { mission, violations, warnings };
}

export async function createPayment(input: ReturnType<typeof validateProposal>, actor: string) {
  assertPaymentStoreHealthy();
  const prior = PaymentStore.byIdempotency(input.key);
  if (prior) {
    if (detailsHash(prior) !== detailsHash({ missionId: input.missionId, recipient: input.recipient, amount: input.amount, chainId: input.chainId, expiresAt: input.expiresAt, agentId: input.agentId })) throw Object.assign(new Error('idempotencyKey is already bound to different payment details.'), { status: 409 });
    return { payment: prior, duplicate: true, warnings: [] };
  }
  const requestPrior = PaymentStore.byRequest(input.requestId);
  if (requestPrior) {
    if (detailsHash(requestPrior) !== detailsHash({ missionId: input.missionId, recipient: input.recipient, amount: input.amount, chainId: input.chainId, expiresAt: input.expiresAt, agentId: input.agentId })) throw Object.assign(new Error('requestId is already bound to different payment details.'), { status: 409 });
    return { payment: requestPrior, duplicate: true };
  }
  const { violations } = checkPolicy(input);
  if (violations.length) throw Object.assign(new Error(violations.join('; ')), { status: 422, violations });
  if (input.agentId && PaymentStore.isAgentDisabled(input.agentId)) throw Object.assign(new Error('Agent is disabled.'), { status: 403 });
  // The event loop performs validation and insertion without yielding; this is an atomic single-process reservation.
  const p: Payment = { id: randomUUID(), requestId: input.requestId, idempotencyKey: input.key, missionId: input.missionId,
    recipient: input.recipient, amount: input.amount, chainId: input.chainId, expiresAt: input.expiresAt, status: 'PENDING',
    actor, agentId: input.agentId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), events: [{ from: null, to: 'PENDING', actor, at: new Date().toISOString() }] };
  const similar = PaymentStore.all().some(old => old.missionId === p.missionId && old.recipient.toLowerCase() === p.recipient.toLowerCase() && old.amount === p.amount && Date.now() - Date.parse(old.createdAt) < 24 * 60 * 60 * 1000);
  await PaymentStore.add(p);
  return { payment: p, duplicate: false, warnings: similar ? ['A recent payment has the same mission, recipient, and amount; verify this is intentional.'] : [] };
}

export async function simulate(input: ReturnType<typeof validateProposal>) {
  const { mission, violations, warnings } = checkPolicy(input);
  const feeRate = process.env.SIMULATED_FEE_RATE;
  const fee = feeRate ? Number(input.amount) * Number(feeRate) : null;
  if (!feeRate) warnings.push('Fee estimate unavailable; no chain simulation was run');
  const budget = mission ? budgetSnapshot(input.missionId, mission, input.amount) : undefined;
  return { simulationId: `preview-${randomUUID()}`, preview: true, canProceed: violations.length === 0, estimatedFee: fee === null ? null : String(fee),
    remainingBudgetAfterPayment: budget ? formatUnits(parseUnits(budget.availableAfterProposal, ACCOUNTING_SCALE) > 0n ? parseUnits(budget.availableAfterProposal, ACCOUNTING_SCALE) : 0n, ACCOUNTING_SCALE) : null,
    warnings, violations, broadcasted: false };
}

export async function approvePayment(payment: Payment, actor: string, suppliedHash: string) {
  assertPaymentStoreHealthy();
  if (payment.status !== 'PENDING') throw Object.assign(new Error('Only pending payments can be approved; unfreeze a frozen payment first.'), { status: 409 });
  if (Date.parse(payment.expiresAt) <= Date.now()) { transition(payment, 'EXPIRED', actor, 'Approval window expired'); await PaymentStore.save(payment); throw Object.assign(new Error('Payment expired.'), { status: 410 }); }
  if (!suppliedHash || suppliedHash !== detailsHash(payment)) throw Object.assign(new Error('Approval details do not match the current payment.'), { status: 409 });
  const { violations, mission } = checkPolicy(payment);
  if (!mission || violations.length) throw Object.assign(new Error(violations.join('; ') || 'Mission unavailable'), { status: 422, violations });
  if (payment.agentId && PaymentStore.isAgentDisabled(payment.agentId)) throw Object.assign(new Error('Agent is disabled.'), { status: 403 });
  transition(payment, 'APPROVED', actor, 'Exact payment details approved');
  payment.approval = { actor, at: new Date().toISOString(), detailsHash: detailsHash(payment) };
  await PaymentStore.save(payment);
  return payment;
}

export async function unfreezePayment(payment: Payment, actor: string) {
  assertPaymentStoreHealthy();
  if (payment.status !== 'FROZEN') throw Object.assign(new Error('Only frozen payments can be unfrozen.'), { status: 409 });
  if (PaymentStore.isMissionFrozen(payment.missionId)) throw Object.assign(new Error('Unfreeze the mission before unfreezing this payment.'), { status: 409 });
  if (Date.parse(payment.expiresAt) <= Date.now()) transition(payment, 'EXPIRED', actor, 'Expired while frozen');
  else transition(payment, 'PENDING', actor, 'Payment unfrozen; approval required again');
  await PaymentStore.save(payment);
  return payment;
}

export function verifiesPaymentEvent(payment: Payment, receipt: any): boolean {
  try {
    const { CONTRACT_ABI, CONTRACT_ADDRESS, CONTRACT_EXECUTION_EVENT } = process.env;
    if (!CONTRACT_ABI || !CONTRACT_ADDRESS || !CONTRACT_EXECUTION_EVENT) return false;
    const iface = new Interface(JSON.parse(CONTRACT_ABI));
    const fragment = iface.getEvent(CONTRACT_EXECUTION_EVENT);
    if (!fragment || fragment.inputs.length !== 2 || fragment.inputs[0].type !== 'address' || fragment.inputs[1].type !== 'uint256') return false;
    const amount = parseUnits(payment.amount, Number(process.env.PAYMENT_DECIMALS || 18));
    return (receipt.logs || []).some((log: any) => {
      if (String(log.address).toLowerCase() !== CONTRACT_ADDRESS.toLowerCase()) return false;
      let parsed;
      try { parsed = iface.parseLog(log); } catch { return false; }
      return parsed?.name === CONTRACT_EXECUTION_EVENT && String(parsed.args[0]).toLowerCase() === payment.recipient.toLowerCase() && BigInt(parsed.args[1]) === amount;
    });
  } catch { return false; }
}

export async function reconcileReceipt(payment: Payment, receipt: any | null, confirmations: number, required: number, actor: string) {
  if (payment.status !== 'SUBMITTED') throw Object.assign(new Error('Only submitted payments can be reconciled.'), { status: 409 });
  if (!receipt) return { status: 'pending' as const, payment };
  if (!Number.isSafeInteger(required) || required < 1) throw Object.assign(new Error('Required confirmations must be a positive integer.'), { status: 400 });
  if (confirmations < required) return { status: 'confirming' as const, confirmations, requiredConfirmations: required, payment };
  if (payment.txHash && String(receipt.hash).toLowerCase() !== payment.txHash.toLowerCase()) {
    payment.failureReason = 'Receipt hash does not match the submitted transaction; reservation retained';
    await PaymentStore.save(payment);
    return { status: 'unverified' as const, payment };
  }
  payment.receipt = { hash: receipt.hash, blockNumber: receipt.blockNumber, status: receipt.status, gasUsed: receipt.gasUsed?.toString() };
  if (receipt.status === 1) {
    if (!verifiesPaymentEvent(payment, receipt)) {
      payment.failureReason = 'Successful receipt lacks the configured matching payment event; reservation retained';
      await PaymentStore.save(payment);
      return { status: 'unverified' as const, payment };
    }
    transition(payment, 'CONFIRMED', actor, `Confirmed in block ${receipt.blockNumber}`);
    await PaymentStore.save(payment);
    return { status: 'confirmed' as const, payment };
  }
  if (receipt.status === 0) {
    transition(payment, 'FAILED', actor, 'Chain receipt reports a reverted transaction');
    await PaymentStore.save(payment);
    return { status: 'failed' as const, payment };
  }
  payment.failureReason = 'Receipt status unavailable; reservation retained pending reconciliation';
  await PaymentStore.save(payment);
  return { status: 'pending' as const, payment };
}

export interface PaymentChainTransaction { hash: string; wait(confirmations: number): Promise<any | null> }
export interface PaymentExecutionRuntime {
  chainId(): Promise<number>;
  getCode(address: string): Promise<string>;
  submit(contractAddress: string, method: string, recipient: string, amount: bigint): Promise<PaymentChainTransaction>;
  getReceipt(hash: string): Promise<any | null>;
  blockNumber(): Promise<number>;
}

function ethersExecutionRuntime(rpcUrl: string, privateKey: string, abi: any[], method: string): PaymentExecutionRuntime {
  const provider = new JsonRpcProvider(rpcUrl);
  const signer = new Wallet(privateKey, provider);
  return {
    chainId: async () => Number((await provider.getNetwork()).chainId),
    getCode: address => provider.getCode(address),
    submit: async (contractAddress, _method, recipient, amount) => {
      const contract = new Contract(contractAddress, abi, signer);
      const response = await contract[method](recipient, amount);
      return { hash: response.hash, wait: confirmations => response.wait(confirmations) };
    },
    getReceipt: hash => provider.getTransactionReceipt(hash),
    blockNumber: () => provider.getBlockNumber(),
  };
}

export async function executePayment(payment: Payment, actor: string, injectedRuntime?: PaymentExecutionRuntime) {
  assertPaymentStoreHealthy();
  if (getMode() !== 'real') throw Object.assign(new Error('Execution is disabled in demo mode. Set EXECUTION_MODE=real with a compatible configured contract to submit payments.'), { status: 409 });
  if (payment.status === 'SUBMITTED' && payment.txHash) return payment;
  if (payment.status !== 'APPROVED') throw Object.assign(new Error('Payment must be approved before execution.'), { status: 409 });
  if (!payment.approval || payment.approval.usedAt || payment.approval.detailsHash !== detailsHash(payment)) throw Object.assign(new Error('A valid, unused approval bound to the current payment details is required.'), { status: 409 });
  if (payment.agentId && PaymentStore.isAgentDisabled(payment.agentId)) throw Object.assign(new Error('Agent is disabled.'), { status: 403 });
  if (payment.expiresAt && Date.parse(payment.expiresAt) <= Date.now()) { transition(payment, 'EXPIRED', actor, 'Approval/payment expired'); await PaymentStore.save(payment); throw Object.assign(new Error('Payment expired.'), { status: 410 }); }
  const { violations, mission } = checkPolicy(payment);
  if (violations.length || !mission) throw Object.assign(new Error(violations.join('; ') || 'Mission unavailable'), { status: 422 });
  const walletLockKey = `${payment.chainId}:${(process.env.CONTRACT_ADDRESS || payment.missionId).toLowerCase()}`;
  if (locks.has(walletLockKey)) throw Object.assign(new Error('Another payment is executing for this configured mission wallet.'), { status: 409 });
  locks.add(walletLockKey);
  let runtime: PaymentExecutionRuntime | undefined;
  try {
    // Recheck budget directly before signing; approval reserves the amount in persistent payment state.
    if (parseUnits(budgetSnapshot(payment.missionId, mission).available, ACCOUNTING_SCALE) < 0n) throw Object.assign(new Error('Available mission budget changed; execution is blocked.'), { status: 422 });
    const { RPC_URL, PRIVATE_KEY, CONTRACT_ADDRESS, CONTRACT_ABI, CONTRACT_EXECUTION_EVENT, CHAIN_ID } = process.env;
    if (!RPC_URL || !PRIVATE_KEY || !CONTRACT_ADDRESS || !CONTRACT_ABI || !CONTRACT_EXECUTION_EVENT || !CHAIN_ID) throw Object.assign(new Error('Real execution is unavailable: RPC_URL, PRIVATE_KEY, CONTRACT_ADDRESS, CONTRACT_ABI, CONTRACT_EXECUTION_EVENT and CHAIN_ID are required.'), { status: 503 });
    if (Number(CHAIN_ID) !== payment.chainId) throw Object.assign(new Error('Configured chain changed since payment approval.'), { status: 409 });
    const abi = JSON.parse(CONTRACT_ABI);
    const contractInterface = new Interface(abi);
    const method = process.env.CONTRACT_EXECUTE_METHOD || 'execute';
    const fragment = contractInterface.getFunction(method);
    if (!fragment || fragment.inputs.length !== 2 || fragment.inputs[0].type !== 'address' || fragment.inputs[1].type !== 'uint256' || ['view', 'pure'].includes(fragment.stateMutability)) throw Object.assign(new Error(`Contract ABI must expose a state-changing ${method}(address,uint256).`), { status: 503 });
    const eventFragment = contractInterface.getEvent(CONTRACT_EXECUTION_EVENT);
    if (!eventFragment || eventFragment.inputs.length !== 2 || eventFragment.inputs[0].type !== 'address' || eventFragment.inputs[1].type !== 'uint256') throw Object.assign(new Error(`Contract ABI must expose ${CONTRACT_EXECUTION_EVENT}(address,uint256).`), { status: 503 });
    const decimals = Number(process.env.PAYMENT_DECIMALS || 18);
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) throw Object.assign(new Error('PAYMENT_DECIMALS must be an integer from 0 to 18.'), { status: 503 });
    const chainAmount = parseUnits(payment.amount, decimals);
    const confirmations = Number(process.env.CONFIRMATIONS || 1);
    if (!Number.isSafeInteger(confirmations) || confirmations < 1) throw Object.assign(new Error('CONFIRMATIONS must be a positive integer.'), { status: 503 });
    runtime = injectedRuntime || ethersExecutionRuntime(RPC_URL, PRIVATE_KEY, abi, method);
    if (await runtime.chainId() !== payment.chainId) throw Object.assign(new Error('RPC chain ID does not match payment.'), { status: 503 });
    if (!isAddress(CONTRACT_ADDRESS) || await runtime.getCode(CONTRACT_ADDRESS) === '0x') throw Object.assign(new Error('CONTRACT_ADDRESS has no deployed contract code on the configured chain.'), { status: 503 });
    // Reserve first. If send() times out before returning a hash, the outcome is ambiguous
    // and this reservation stays active until an operator reconciles the chain.
    transition(payment, 'SUBMITTED', actor, 'Submission started; awaiting transaction hash and chain confirmation');
    payment.approval.usedAt = new Date().toISOString();
    await PaymentStore.save(payment);
    // A kill-switch request during the durable pre-submit write blocks the send.
    if (payment.agentId && PaymentStore.isAgentDisabled(payment.agentId)) {
      transition(payment, 'FAILED', actor, 'Agent disabled before transaction submission');
      payment.approval.usedAt = undefined;
      await PaymentStore.save(payment);
      throw Object.assign(new Error('Agent was disabled before transaction submission.'), { status: 403 });
    }
    const tx = await runtime.submit(CONTRACT_ADDRESS, method, payment.recipient, chainAmount);
    if (!tx?.hash || !/^0x[0-9a-fA-F]{64}$/.test(tx.hash)) throw new Error('RPC returned no valid transaction hash; submission outcome is ambiguous.');
    payment.txHash = tx.hash;
    payment.events.push({ from: 'SUBMITTED', to: 'SUBMITTED', actor, at: new Date().toISOString(), reason: 'Transaction hash returned by RPC; awaiting chain confirmation' });
    await PaymentStore.save(payment);
    const receipt = await tx.wait(confirmations);
    if (!receipt) throw new Error('Transaction is still pending; retain reservation and reconcile by transaction hash.');
    await reconcileReceipt(payment, receipt, confirmations, confirmations, actor);
    return payment;
  } catch (e: any) {
    // A reverted wait may throw even though its receipt is definitive. Check the receipt
    // and confirmation depth before releasing the reservation; otherwise retain SUBMITTED.
    if ((payment.status as PaymentStatus) === 'SUBMITTED' && payment.txHash && runtime) {
      try {
        assertPaymentStoreHealthy();
        const receipt = await runtime.getReceipt(payment.txHash);
        if (receipt) {
          const required = Number(process.env.CONFIRMATIONS || 1);
          const confirmations = (await runtime.blockNumber()) - receipt.blockNumber + 1;
          const outcome = await reconcileReceipt(payment, receipt, confirmations, required, actor);
          if (outcome.status === 'confirmed' || outcome.status === 'failed') return payment;
        }
      } catch { /* RPC remains ambiguous; keep the reservation below. */ }
    }
    if ((payment.status as PaymentStatus) === 'SUBMITTED') { payment.failureReason = e?.message || 'Submission/confirmation outcome is ambiguous; reservation retained for reconciliation'; await PaymentStore.save(payment); }
    throw e;
  } finally { locks.delete(walletLockKey); }
}

export function getMode() { return process.env.EXECUTION_MODE === 'real' ? 'real' : 'demo'; }
