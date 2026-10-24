import { Router } from 'express';
import * as payments from '../controllers/paymentControllers';

const router = Router();
router.post('/simulate', payments.simulatePayment);
router.post('/', payments.create);
router.get('/', payments.list);
router.get('/:id', payments.get);
router.post('/:id/approve', payments.approve);
router.post('/:id/reject', payments.reject);
router.post('/:id/freeze', payments.freeze);
router.post('/:id/unfreeze', payments.unfreeze);
router.post('/:id/execute', payments.execute);
router.post('/:id/reconcile', payments.reconcile);
router.post('/missions/:missionId/freeze', payments.freezeMission);
router.post('/missions/:missionId/unfreeze', payments.unfreezeMission);
router.post('/agents/:agentId/kill', payments.killAgent);
router.get('/agents/:agentId/status', payments.agentStatus);
export default router;
