import { Router } from 'express';
import { simulatePromptInjection, simulateSpamAttack, simulateStolenKey } from '../controllers/attackControllers';

const router = Router();

router.post('/prompt-injection', simulatePromptInjection);
router.post('/spam', simulateSpamAttack);
router.post('/stolen-key', simulateStolenKey);

export default router;