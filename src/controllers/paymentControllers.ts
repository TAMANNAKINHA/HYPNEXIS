import { Request, Response } from 'express';
import { approvePayment, createPayment, detailsHash, executePayment, getMode, reconcileReceipt, requirePaymentAuth, simulate, unfreezePayment, validateProposal } from '../services/paymentService';
import { JsonRpcProvider } from 'ethers';
import { PaymentStore, assertPaymentStoreHealthy, transition } from '../services/paymentStore';
import { Store } from '../store';

function actor(req: Request, roles: Parameters<typeof requirePaymentAuth>[1] = ['reader']) { return requirePaymentAuth(req.header('authorization'), roles).actor; }
function fail(res: Response, e: any) { return res.status(e.status || 500).json({ success: false, message: e.message || 'Payment operation failed', ...(e.violations ? { violations: e.violations } : {}) }); }

export const create = async (req: Request, res: Response) => { try {
  const who = actor(req, ['operator']); const proposal = validateProposal(req.body);
  const result = await createPayment(proposal, who);
  return res.status(result.duplicate ? 200 : 201).json({ success: true, ...result, detailsHash: detailsHash(result.payment) });
} catch (e: any) { return fail(res, e); } };

export const simulatePayment = async (req: Request, res: Response) => { try { actor(req, ['reader', 'operator']); return res.json({ success: true, ...await simulate(validateProposal(req.body)) }); } catch (e: any) { return fail(res, e); } };
export const list = (req: Request, res: Response) => { try { actor(req); return res.json({ success: true, payments: PaymentStore.all() }); } catch (e: any) { return fail(res, e); } };
export const get = (req: Request, res: Response) => { try { actor(req); const p = PaymentStore.get(req.params.id); return p ? res.json({ success: true, payment: p, detailsHash: detailsHash(p) }) : res.status(404).json({ success: false, message: 'Payment not found' }); } catch (e: any) { return fail(res, e); } };
export const listAgents = (req: Request, res: Response) => { try {
  actor(req, ['reader', 'admin']);
  const ids = [...new Set(PaymentStore.all().map(payment => payment.agentId).filter((id): id is string => Boolean(id)))];
  return res.json({ success: true, agents: ids.map(agentId => ({ agentId, backendStatus: PaymentStore.isAgentDisabled(agentId) ? 'disabled' : 'active', paymentCount: PaymentStore.all().filter(payment => payment.agentId === agentId).length })) });
} catch (e: any) { return fail(res, e); } };

export const approve = async (req: Request, res: Response) => { try {
  const who = actor(req, ['approver']); const p = PaymentStore.get(req.params.id); if (!p) return res.status(404).json({ success: false, message: 'Payment not found' });
  await approvePayment(p, who, req.body?.detailsHash); return res.json({ success: true, payment: p });
} catch (e: any) { return fail(res, e); } };

export const reject = async (req: Request, res: Response) => { try { const who = actor(req, ['approver']); const p = PaymentStore.get(req.params.id); if (!p) return res.status(404).json({ success: false, message: 'Payment not found' }); transition(p, 'REJECTED', who, String(req.body?.reason || 'Rejected by approver')); await PaymentStore.save(p); return res.json({ success: true, payment: p }); } catch (e: any) { return fail(res, e); } };
export const freeze = async (req: Request, res: Response) => { try { const who = actor(req, ['approver']); const p = PaymentStore.get(req.params.id); if (!p) return res.status(404).json({ success: false, message: 'Payment not found' }); transition(p, 'FROZEN', who, String(req.body?.reason || 'Frozen by approver')); await PaymentStore.save(p); return res.json({ success: true, payment: p }); } catch (e: any) { return fail(res, e); } };
export const unfreeze = async (req: Request, res: Response) => { try { const who = actor(req, ['approver']); const p = PaymentStore.get(req.params.id); if (!p) return res.status(404).json({ success: false, message: 'Payment not found' }); await unfreezePayment(p, who); return res.json({ success: true, payment: p }); } catch (e: any) { return fail(res, e); } };
export const freezeMission = async (req: Request, res: Response) => { try { const who = actor(req, ['approver']); const id = req.params.missionId; if (!Store.getMission(id)) return res.status(404).json({ success: false, message: 'Mission not found' }); await PaymentStore.freezeMission(id); for (const p of PaymentStore.activeForMission(id)) if (p.status === 'PENDING' || p.status === 'APPROVED') { transition(p, 'FROZEN', who, 'Mission frozen'); await PaymentStore.save(p); } return res.json({ success: true, missionId: id, frozen: true }); } catch (e: any) { return fail(res, e); } };
export const unfreezeMission = async (req: Request, res: Response) => { try { const who = actor(req, ['approver']); const id = req.params.missionId; if (!Store.getMission(id)) return res.status(404).json({ success: false, message: 'Mission not found' }); await PaymentStore.unfreezeMission(id); for (const p of PaymentStore.activeForMission(id)) if (p.status === 'FROZEN') { if (Date.parse(p.expiresAt) <= Date.now()) transition(p, 'EXPIRED', who, 'Expired while mission was frozen'); else transition(p, 'PENDING', who, 'Mission unfrozen; approval required again'); await PaymentStore.save(p); } return res.json({ success: true, missionId: id, frozen: false }); } catch (e: any) { return fail(res, e); } };
export const execute = async (req: Request, res: Response) => { try { const who = actor(req, ['executor']); const p = PaymentStore.get(req.params.id); if (!p) return res.status(404).json({ success: false, message: 'Payment not found' }); const result = await executePayment(p, who); return res.json({ success: true, mode: getMode(), payment: result, transactionHash: result.txHash, receipt: result.receipt, confirmationStatus: result.status }); } catch (e: any) { return fail(res, e); } };
export const reconcile = async (req: Request, res: Response) => { try {
  const who = actor(req, ['executor']); const p = PaymentStore.get(req.params.id); if (!p) return res.status(404).json({ success: false, message: 'Payment not found' });
  if (p.status !== 'SUBMITTED' || !p.txHash) return res.status(409).json({ success: false, payment: p, message: 'No transaction hash is available for automatic chain reconciliation; reservation remains held.' });
  if (!process.env.RPC_URL || !process.env.CHAIN_ID) return res.status(503).json({ success: false, message: 'RPC_URL and CHAIN_ID are required for reconciliation.' });
  const provider = new JsonRpcProvider(process.env.RPC_URL); const net = await provider.getNetwork();
  if (Number(net.chainId) !== p.chainId || Number(net.chainId) !== Number(process.env.CHAIN_ID)) return res.status(503).json({ success: false, message: 'RPC, payment, and configured chain IDs must match.' });
  const receipt = await provider.getTransactionReceipt(p.txHash);
  if (!receipt) return res.json({ success: true, payment: p, confirmationStatus: 'pending', reservationHeld: true });
  if (receipt.hash.toLowerCase() !== p.txHash.toLowerCase()) return res.status(502).json({ success: false, message: 'RPC receipt hash does not match the submitted transaction hash.' });
  const required = Number(process.env.CONFIRMATIONS || 1);
  if (!Number.isSafeInteger(required) || required < 1) return res.status(503).json({ success: false, message: 'CONFIRMATIONS must be a positive integer.' });
  const confirmations = (await provider.getBlockNumber()) - receipt.blockNumber + 1;
  const outcome = await reconcileReceipt(p, receipt, confirmations, required, who);
  return res.json({ success: true, payment: p, confirmationStatus: outcome.status, confirmations, requiredConfirmations: required, reservationHeld: !['confirmed', 'failed'].includes(outcome.status) });
} catch (e: any) { return fail(res, e); } };

export const killAgent = async (req: Request, res: Response) => { try {
  assertPaymentStoreHealthy();
  const who = actor(req, ['admin']); const agentId = req.params.agentId; if (!agentId) return res.status(400).json({ success: false, message: 'agentId is required' });
  const previous = PaymentStore.isAgentDisabled(agentId); if (previous) return res.json({ success: true, agentId, backendStatus: 'disabled', onChainRevocation: { status: 'not_performed', reason: 'No compatible revocation adapter is configured.' }, inFlight: PaymentStore.all().filter(p => p.agentId === agentId && p.status === 'SUBMITTED').map(p => ({ paymentId: p.id, transactionHash: p.txHash, status: p.status })) });
  // Backend acceptance is stopped immediately. On-chain revocation is explicitly not attempted.
  const record = { actor: who, at: new Date().toISOString(), result: 'backend-disabled; on-chain revocation not performed' };
  await PaymentStore.setAgentDisabled(agentId, record);
  const inFlight = PaymentStore.all().filter(p => p.agentId === agentId && p.status === 'SUBMITTED').map(p => ({ paymentId: p.id, transactionHash: p.txHash, status: p.status }));
  Store.addAudit('Disable agent', who, 'backend', 'success');
  return res.json({ success: true, agentId, backendStatus: 'disabled', onChainRevocation: { status: 'not_performed', reason: 'No compatible revocation adapter is configured.' }, inFlight });
} catch (e: any) { return fail(res, e); } };
export const agentStatus = (req: Request, res: Response) => { try { actor(req, ['reader', 'admin']); const disabled = PaymentStore.isAgentDisabled(req.params.agentId); return res.json({ success: true, agentId: req.params.agentId, backendStatus: disabled ? 'disabled' : 'active', onChainRevocation: { status: 'unknown_or_not_configured' }, revocationRecord: disabled || null }); } catch (e: any) { return fail(res, e); } };

