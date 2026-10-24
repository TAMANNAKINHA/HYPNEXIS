import { Router } from 'express';
import { 
  createMission, 
  executeMission, 
  cancelMission, 
  freezeWallet, 
  unfreezeWallet, 
  nukeWallet, 
  rotateSessionKey,
  getPolicies,
  resetDemo,
  listMissions,
  getMission,
  getWalletStatus,
} from '../controllers/missionControllers';

import { verifyOtp, rejectVerification, verifyApprove } from '../controllers/verificationControllers';

const router = Router();

router.get('/', listMissions);
router.get('/policies', getPolicies);
router.get('/:missionId/wallet/status', getWalletStatus);
router.get('/:missionId', getMission);

router.post('/create', createMission);
router.post('/execute', executeMission);
router.post('/cancel', cancelMission);
router.post('/freeze', freezeWallet);
router.post('/unfreeze', unfreezeWallet);
router.post('/nuke', nukeWallet);
router.post('/rotate-key', rotateSessionKey);
router.post('/reset', resetDemo);

// Verification routes
router.post('/verify/otp', verifyOtp);
router.post('/verify/reject', rejectVerification);
router.post('/verify/approve', verifyApprove);

export default router;
