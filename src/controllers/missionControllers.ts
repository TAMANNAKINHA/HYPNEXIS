import { Request, Response } from 'express';
import { Store } from '../store';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { Mission, ShieldId } from '../types';

import { MissionGuard } from '../guards/missionGuard';
import { PolicyEngine } from '../guards/policyEngine';
import { RiskEngine } from '../guards/riskEngine';
import { CircuitBreaker } from '../guards/circuitBreaker';
import { BlockchainService } from '../services/blockchainService';

import { verificationEngine } from '../services/verificationEngine';
import { verificationService } from '../services/verificationService';
import { parseIntent } from '../services/aiParser';
import { POLICY_LIBRARY } from '../constants/policyProfiles';

function generateMissionId(): string {
  const chars = '0123456789ABCDEF';
  let s = 'MID-';
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * 16)];
  return s;
}

function generateSessionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

function calculateDynamicRiskScore(mission: Mission, consecutiveFailures: number, isSpam: boolean): number {
  let score = 15;

  const activePolicy = Store.getCurrentPolicy(mission.id) || Store.getDefaultPolicy();
  const defaultBudget = activePolicy?.defaultBudget || 50000;

  const budgetRatio = mission.budget / defaultBudget;
  if (budgetRatio > 1.0) {
    score += Math.min(35, budgetRatio * 20);
  } else {
    score += budgetRatio * 10;
  }

  if (isSpam) {
    score += 30;
  }

  score += Math.min(20, consecutiveFailures * 10);

  const currentHour = new Date().getHours();
  const isAfterHours = currentHour < 6 || currentHour > 22;
  if (isAfterHours) {
    score += 10;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export const getPolicies = (req: Request, res: Response) => {
  try {
    return res.status(200).json({ success: true, policies: POLICY_LIBRARY });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createMission = async (req: Request, res: Response) => {
  try {
    const state = Store.getState();

    if (state.walletStatus === 'frozen') {
      Store.addLog('🚨 ACCESS DENIED: System is in strict lockdown. AI prompts rejected.', 'error');
      return res.status(403).json({
        success: false,
        message: 'System is currently FROZEN. All AI prompts and transactions are locked down.',
      });
    }

    // ✅ DAILY LIMIT: max 3 missions total (any status) created in the past 24 hours
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    const missionsToday = (Store.getAllMissions() || []).filter(
      m => (now - m.createdAt) < twentyFourHours
    );
    if (missionsToday.length >= 3) {
      Store.addLog('❌ Daily mission limit reached (max 3 total wallets per 24 hours).', 'error');
      return res.status(429).json({
        success: false,
        message: 'You have reached the maximum of 3 mission wallets per day. Please wait for 24 hours to create new missions.',
      });
    }

    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Missing or invalid user prompt. Please provide a mission instruction.',
      });
    }

    const parsed = await parseIntent(text);
    const { name, merchant, budget, category } = parsed;

    if (budget === null || budget === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Could not extract a valid budget from your request. Please specify an amount, e.g. "₹45,000".',
      });
    }

    // Sanity budget range
    if (budget < 10 || budget > 10_000_000) {
      return res.status(400).json({
        success: false,
        message: `Budget ₹${budget} is out of allowed range (₹10 – ₹1,00,00,000).`,
      });
    }

    if (state.profile && budget > state.profile.perMissionCap) {
      return res.status(400).json({
        success: false,
        message: `Budget ₹${budget} exceeds per-mission cap of ₹${state.profile.perMissionCap}`,
      });
    }

    const mission: Mission = {
      id: uuidv4(),
      name,
      missionId: generateMissionId(),
      merchant,
      budget,
      spent: 0,
      expiry: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      trustScore: 100,
      status: 'created',
      createdAt: Date.now(),
      userPrompt: text,
      sessionKey: generateSessionKey(),
      category,
      policyId: undefined,
    };

    Store.updateMission(mission);

    await BlockchainService.deployMissionWallet(mission.merchant, mission.budget);

    if (Store.getState().trustScore !== undefined) {
      Store.getState().trustScore = 100;
      Store.updateTrust(0);
    }

    if (process.env.USE_REAL_CONTRACT === 'true') {
      try {
        const { address, txHash } = await BlockchainService.deployRealMissionWallet(
          mission.name,
          mission.missionId,
          mission.category || 'general',
          mission.budget,
          mission.merchant,
          60,
          86400
        );
        mission.walletAddress = address;
        mission.contractTxHash = txHash;
        mission.explorerUrl = BlockchainService.getExplorerUrl(address);
        Store.updateMission(mission);
      } catch (err) {
        console.error('Real contract deployment failed:', err);
      }
    }

    Store.addLog(`Mission Created → ${name}`, 'gold');
    Store.addLog(`Mission Wallet Generated · ${mission.missionId}`, 'gold');
    Store.addLog(`Session Key: ${mission.sessionKey.slice(0, 16)}... (stored securely)`, 'info');
    Store.addAudit(`Create Mission: ${name}`, 'operator', '0x...', 'success');
    Store.addChat('aegis', `Mission Wallet provisioned for "${name}". Budget locked at ₹${budget}. Standing by for execution.`);

    return res.status(200).json({ success: true, mission });
  } catch (error: any) {
    console.error('Create mission error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const executeMission = async (req: Request, res: Response) => {
  try {
    const { missionId } = req.body;
    if (!missionId) return res.status(400).json({ success: false, message: 'missionId required' });

    const state = Store.getState();
    const mission = Store.getMission(missionId);
    if (!mission) return res.status(404).json({ success: false, message: 'Mission not found' });

    // Expiry check
    if (new Date(mission.expiry).getTime() < Date.now()) {
      Store.addLog('⏰ Mission has expired and cannot be executed.', 'error');
      return res.status(400).json({ success: false, message: 'Mission has expired.' });
    }

    if (state.walletStatus === 'frozen' || mission.status === 'frozen') {
      Store.addLog('🚨 ACCESS DENIED: Cannot execute. System is in strict lockdown.', 'error');
      return res.status(403).json({ success: false, message: 'Cannot execute: System is in strict lockdown mode.' });
    }

    if (state.profile) {
      const { dailySpent, dailyOutflowCeiling } = state.profile;
      if (dailySpent + mission.budget > dailyOutflowCeiling) {
        Store.addLog('Daily outflow ceiling exceeded', 'error');
        Store.addChat('aegis', 'Mission blocked – daily spending limit reached.');
        return res.status(400).json({ success: false, message: 'Daily limit exceeded' });
      }
    }

    mission.status = 'validating' as any;
    Store.updateMission(mission);
    Store.addLog('Executing mission — running security gauntlet…', 'gold');

    for (const id of ['missionGuard', 'policyEngine', 'riskEngine', 'smartContract', 'timeLock', 'circuitBreaker'] as ShieldId[]) {
      Store.updateShield(id, 'idle');
    }
    Store.resetFailures();

    const phase1Shields: ShieldId[] = ['missionGuard', 'policyEngine', 'riskEngine'];

    for (const shieldId of phase1Shields) {
      Store.updateShield(shieldId, 'processing');
      const shieldLabel = state.shields?.[shieldId]?.label || shieldId;
      Store.addLog(`${shieldLabel} scanning…`, 'gold');

      let passed = true;
      let failMessage = '';

      switch (shieldId) {
        case 'missionGuard': {
          passed = await MissionGuard.verify(mission.userPrompt || '', mission.name);
          failMessage = passed ? '' : 'Intent misaligned or prompt injection detected.';
          break;
        }
        case 'policyEngine': {
          const activePolicy = Store.getCurrentPolicy(mission.id) || Store.getDefaultPolicy();
          passed = await PolicyEngine.verify(
            mission.budget,
            activePolicy.defaultBudget,
            mission.merchant,
            activePolicy.allowedVendors || []
          );
          failMessage = passed ? '' : 'Policy limits exceeded or merchant not allowed.';
          break;
        }
        case 'riskEngine': {
          passed = await RiskEngine.verify(false);
          const dynamicScore = calculateDynamicRiskScore(mission, state.consecutiveFailures || 0, false);
          mission.riskScore = dynamicScore;
          Store.addLog(`[Risk Engine] Computed Risk Score: ${dynamicScore}% based on magnitude, velocity & context.`, 'info');
          failMessage = passed ? '' : 'Risk anomaly detected.';
          break;
        }
      }

      if (!passed) {
        Store.updateShield(shieldId, 'failure');
        Store.addLog(`${shieldLabel} FAILED: ${failMessage}`, 'error');
        Store.incrementFailure();
        mission.status = 'failed';
        Store.updateMission(mission);
        Store.updateTrust(-15);
        Store.addAudit(`Execute: ${mission.name}`, 'aegis', '0x...', 'blocked');
        Store.addChat('aegis', `Execution blocked. ${failMessage}`);
        return res.status(400).json({ success: false, message: failMessage });
      } else {
        Store.updateShield(shieldId, 'success');
        Store.addLog(`${shieldLabel} passed`, 'success');
      }
    }

    Store.addLog('Evaluating Verification Level...', 'info');

    const activePolicy = Store.getCurrentPolicy(mission.id) || Store.getDefaultPolicy();
    const riskScore = mission.riskScore || 0;

    const { level, reason } = verificationEngine.verify(mission, activePolicy, riskScore);

    if (level === 1) {
      const otp = verificationService.generateOTP();
      mission.status = 'awaiting_otp' as any;
      (mission as any).expectedOtp = otp;
      (mission as any).otpExpiresAt = Date.now() + 30_000;   // 30s expiry
      (mission as any).otpAttempts = 0;
      Store.updateMission(mission);
      verificationService.sendOtpEmail(otp);
      verificationService.emitVerificationUpdate(mission.id, {
        level: 'otp',
        message: 'OTP has been sent to the CFO via Email. Please enter it below.',
        otp,
      });
      Store.addLog('Mission paused: Awaiting OTP verification', 'warning');
      Store.addChat('aegis', 'High-value transaction detected. Email OTP sent to the CFO.');
      return res.status(200).json({ success: true, status: 'awaiting_otp', message: 'Awaiting OTP' });
    }

    if (level === 3) {
      mission.status = 'awaiting_review' as any;
      Store.updateMission(mission);
      verificationService.emitVerificationUpdate(mission.id, {
        level: 'manual',
        message: `Manual review required: ${reason}`,
      });
      Store.addLog(`Mission paused: Manual review required (${reason})`, 'warning');
      return res.status(200).json({ success: true, status: 'awaiting_review', message: 'Awaiting Manual Review' });
    }

    if (level === 2) {
      verificationService.initiateBrowserCall("CFO");
      verificationService.emitVerificationUpdate(mission.id, {
        level: 'phone',
        message: '📞 Alerting CFO via browser interface...',
      });
      Store.addLog('Level 2 Verification: Browser notification initiated to CFO', 'info');
    }

    const result = await finalizeMissionExecution(mission.id);
    return res.status(200).json(result);

  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export async function finalizeMissionExecution(missionId: string) {
  const state = Store.getState();
  let mission = Store.getMission(missionId);

  if (!mission || mission.id !== missionId) {
    return { success: false, error: 'Mission not found or inactive' };
  }

  mission.status = 'executing';
  Store.updateMission(mission);

  const phase2Shields: ShieldId[] = ['smartContract', 'timeLock', 'circuitBreaker'];

  for (const shieldId of phase2Shields) {
    Store.updateShield(shieldId, 'processing');
    const shieldLabel = state.shields?.[shieldId]?.label || shieldId;
    Store.addLog(`${shieldLabel} scanning…`, 'gold');

    let passed = true;
    let failMessage = '';

    switch (shieldId) {
      case 'smartContract': {
        await new Promise(r => setTimeout(r, 600));
        passed = true;
        break;
      }
      case 'timeLock': {
        const timelockSeconds = 60;
        const timelockMs = timelockSeconds * 1000;

        Store.addLog(`Time Lock engaged for ${timelockSeconds} seconds. Payment can be aborted or frozen.`, 'warning');

        let elapsed = 0;

        while (elapsed < timelockMs) {
          await new Promise(r => setTimeout(r, 1000));
          const currentState = Store.getState();
          const currentMission = Store.getMission(missionId);

          if (!currentMission || currentMission.status === 'nuked' || currentMission.status === 'cancelled') {
            Store.addLog('🛑 ESCROW DESTROYED: Mission was aborted or nuked. Transaction killed.', 'error');
            return { success: false, error: 'Mission aborted or nuked during time-lock.' };
          }

          if (currentMission.status === 'frozen') {
            Store.addLog('⚠️ STRICT LOCKDOWN: Wallet frozen. Transaction held securely in escrow. Timer paused.', 'warning');

            let isNuked = false;

            while (Store.getMission(missionId)?.status === 'frozen') {
              await new Promise(r => setTimeout(r, 1000));
              const innerMission = Store.getMission(missionId);
              if (!innerMission || innerMission.status === 'nuked') {
                isNuked = true;
                break;
              }
            }

            if (isNuked || Store.getMission(missionId)?.status === 'nuked') {
              Store.addLog('🛑 ESCROW DESTROYED: Wallet was nuked during freeze isolation.', 'error');
              return { success: false, error: 'Wallet was nuked during freeze isolation.' };
            }

            Store.addLog('❄️ Wallet unfrozen. Resuming time lock...', 'info');
          } else {
            elapsed += 1000;
          }
        }

        passed = true;
        break;
      }
      case 'circuitBreaker': {
        const isTripped = await CircuitBreaker.checkAndTrigger(mission.id);
        passed = !isTripped;
        failMessage = passed ? '' : 'Circuit breaker tripped due to excessive failures.';
        break;
      }
    }

    if (!passed) {
      Store.updateShield(shieldId, 'failure');
      Store.addLog(`${shieldLabel} FAILED: ${failMessage}`, 'error');
      Store.incrementFailure();
      mission.status = 'failed';
      Store.updateMission(mission);
      Store.updateTrust(-15);
      Store.addAudit(`Execute: ${mission.name}`, 'aegis', '0x...', 'blocked');
      return { success: false, error: failMessage };
    } else {
      Store.updateShield(shieldId, 'success');
      Store.addLog(`${shieldLabel} passed`, 'success');
      Store.resetFailures();
    }
  }

  const finalMissionState = Store.getMission(missionId);
  if (!finalMissionState) {
    return { success: false, error: 'Mission missing before final blockchain execution.' };
  }

  Store.addLog(`Signing transaction with active session key: ${finalMissionState.sessionKey.slice(0, 16)}...`, 'info');

  const { success, txHash } = await BlockchainService.executeOnChain(finalMissionState.merchant, finalMissionState.budget, finalMissionState.sessionKey);

  if (success) {
    finalMissionState.spent = finalMissionState.budget;
    finalMissionState.status = 'completed';
    Store.updateMission(finalMissionState);

    if (typeof (Store as any).updateProfileStats === 'function') {
      (Store as any).updateProfileStats(finalMissionState.budget);
    }

    Store.addLog('Transaction confirmed on-chain', 'success');
    Store.addLog(`Mission Complete · ${finalMissionState.name}`, 'success');
    Store.addAudit(`Execute: ${finalMissionState.name}`, 'aegis', txHash || '0x...', 'success');
  } else {
    finalMissionState.status = 'failed';
    Store.updateMission(finalMissionState);
    Store.addLog('Transaction failed on-chain', 'error');
    Store.addAudit(`Execute: ${finalMissionState.name}`, 'aegis', '0x...', 'blocked');
  }

  return { success, txHash };
}

export const resetDemo = (req: Request, res: Response) => {
  Store.resetDemoState();
  Store.addLog('🔄 Demo reset – all wallets and state cleared.', 'info');
  return res.status(200).json({ success: true, message: 'Demo reset complete.' });
};


export const cancelMission = (req: Request, res: Response) => {
  const { missionId } = req.body;
  const mission = Store.getMission(missionId);
  if (!mission) return res.status(404).json({ success: false, message: 'Mission not found' });
  if (['completed', 'failed', 'nuked', 'cancelled'].includes(mission.status)) {
    return res.status(400).json({ success: false, message: 'Mission already terminal.' });
  }

  Store.refundMission(missionId);
  mission.status = 'cancelled' as any;
  Store.updateMission(mission);
  Store.addLog('🛑 Mission CANCELLED by operator', 'warning');
  Store.addAudit('Cancel mission', 'operator', '0x_cancel', 'warning');
  for (const id of ['missionGuard', 'policyEngine', 'riskEngine', 'smartContract', 'timeLock', 'circuitBreaker'] as ShieldId[]) {
    Store.updateShield(id, 'idle');
  }
  return res.status(200).json({ success: true });
};

export const freezeWallet = (req: Request, res: Response) => {
  const { missionId } = req.body;
  const mission = Store.getMission(missionId);
  if (!mission) return res.status(404).json({ success: false, message: 'Mission not found' });
  if (['completed', 'failed', 'nuked', 'cancelled'].includes(mission.status)) {
    return res.status(400).json({ success: false, message: 'Cannot freeze a terminal mission.' });
  }

  Store.freezeWallet(missionId);
  Store.addLog('Wallet FROZEN — all activity halted', 'warning');
  Store.addAudit('Freeze wallet', 'operator', '0x...', 'warning');
  return res.status(200).json({ success: true });
};

export const unfreezeWallet = (req: Request, res: Response) => {
  const { missionId } = req.body;
  const mission = Store.getMission(missionId);
  if (!mission) return res.status(404).json({ success: false, message: 'Mission not found' });
  if (mission.status !== 'frozen') {
    return res.status(400).json({ success: false, message: 'Mission is not frozen.' });
  }

  Store.unfreezeWallet(missionId);
  Store.addLog('❄️ Wallet unfrozen via manual override. Resuming normal operations.', 'info');
  Store.addAudit('Unfreeze wallet', 'operator', '0x...', 'success');
  return res.status(200).json({ success: true });
};

export const nukeWallet = (req: Request, res: Response) => {
  const { missionId } = req.body;
  const mission = Store.getMission(missionId);
  if (!mission) return res.status(404).json({ success: false, message: 'Mission not found' });
  if (['completed', 'failed', 'nuked', 'cancelled'].includes(mission.status)) {
    return res.status(400).json({ success: false, message: 'Cannot nuke a terminal mission.' });
  }

  Store.addLog('🔥 NUKE INITIATED — dissolving wallet and killing active transactions…', 'error');

  Store.nukeWallet(missionId);
  for (const id of ['missionGuard', 'policyEngine', 'riskEngine', 'smartContract', 'timeLock', 'circuitBreaker'] as ShieldId[]) {
    Store.updateShield(id, 'idle');
  }
  Store.getState().trustScore = 50;
  Store.updateTrust(0);
  Store.addLog('☠️ Wallet NUKED — all keys destroyed. System purged.', 'error');
  Store.addAudit('Nuke wallet', 'operator', '0x_nuke', 'blocked');

  return res.status(200).json({ success: true });
};

export const rotateSessionKey = (req: Request, res: Response) => {
  const { missionId } = req.body;
  const mission = Store.getMission(missionId);
  if (!mission) return res.status(400).json({ success: false, message: 'No active mission' });

  const newKey = generateSessionKey();
  mission.sessionKey = newKey;
  Store.updateMission(mission);

  Store.addLog(`Session key rotated to: ${newKey.slice(0, 16)}...`, 'gold');
  Store.addAudit('Rotate session key', 'operator', `key_${newKey.slice(0, 8)}`, 'success');
  return res.status(200).json({ success: true });
};