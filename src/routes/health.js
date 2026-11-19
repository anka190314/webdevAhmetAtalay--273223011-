import { Router } from 'express';
import { checkHealth } from '../services/healthService.js';

const router = Router();

router.get('/health', async (req, res) => {
  const result = await checkHealth();
  if (result.status === 'ok') {
    res.status(200).json(result);
  } else {
    res.status(503).json(result);
  }
});

export default router;
