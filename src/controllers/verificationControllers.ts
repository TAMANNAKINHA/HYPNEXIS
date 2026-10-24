import { Request, Response } from 'express';
import { verificationService } from '../services/verificationService';
import { Store } from '../store';
import { finalizeMissionExecution } from './missionControllers';

export const verifyOtp = async (req: Request, res: Response) => {
  try {
    const { missionId, otp } = req.body;

    if (!missionId || !otp) {
      return res.status(400).json({ success: false, error: 'Mission ID and OTP are required.' });
    }

    // Validate the OTP with the service
    const isValid = verificationService.validateOTP(missionId, otp);

    if (!isValid) {
      Store.addLog(`❌ OTP Verification Failed: Incorrect code entered for mission ${missionId}`, 'error');
      return res.status(400).json({ success: false, error: 'Invalid OTP code. Please check your Gmail inbox.' });
    }

    Store.addLog(`✓ OTP Verified successfully. Resuming execution gauntlet...`, 'success');

    // Update mission status
    const mission = Store.getMission(missionId);
    if (mission) {
      mission.status = 'executing';
      Store.updateMission(mission);
    }

    // Inform the frontend to close the prompt
    verificationService.emitVerificationUpdate(missionId, {
      level: 'resolved',
      message: 'OTP Verified. Resuming execution...',
    });

    // Resume Phase 2 of the gauntlet (Time Lock -> Circuit Breaker -> Blockchain)
    const result = await finalizeMissionExecution(missionId);

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    return res.status(200).json({
      success: true,
      message: 'OTP verified; demo execution completed without broadcasting a transaction.',
      simulated: result.simulated,
      broadcasted: result.broadcasted,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const rejectVerification = async (req: Request, res: Response) => {
  try {
    const { missionId } = req.body;
    const mission = Store.getMission(missionId);

    if (mission) {
      Store.refundMission(missionId);
      mission.status = 'cancelled' as any;
      Store.updateMission(mission);
      Store.addLog('Mission cancelled by user during verification prompt.', 'warning');
      Store.addAudit('Verification Rejected', 'operator', 'simulation', 'warning');
    }

    verificationService.emitVerificationUpdate(missionId, {
      level: 'rejected',
      message: 'Mission rejected and cancelled.',
    });

    return res.status(200).json({ success: true, message: 'Mission cancelled.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const verifyApprove = async (req: Request, res: Response) => {
  try {
    const { missionId } = req.body;
    const mission = Store.getMission(missionId);

    if (!mission) {
      return res.status(404).json({ success: false, error: 'Mission not found or inactive.' });
    }

    if (mission.status !== 'awaiting_review') {
      return res.status(400).json({
        success: false,
        error: `Mission is not awaiting manual review (current status: ${mission.status}).`,
      });
    }

    Store.addLog(`✅ Manual review approved for mission ${mission.name}. Resuming execution...`, 'success');

    verificationService.emitVerificationUpdate(missionId, {
      level: 'resolved',
      message: 'Manual review approved. Resuming execution...',
    });

    const result = await finalizeMissionExecution(missionId);

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    return res.status(200).json({
      success: true,
      message: 'Manual review approved; demo execution completed without broadcasting a transaction.',
      simulated: result.simulated,
      broadcasted: result.broadcasted,
    });
  } catch (error: any) {
    console.error('Approve error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
