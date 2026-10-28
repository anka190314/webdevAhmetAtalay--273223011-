import express from 'express';
import { getLabsWithWorkstations } from '../services/labService.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '../../public');

const router = express.Router();

function requireAuthPage(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  res.redirect('/login');
}

function requireAuthApi(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
}

router.get('/labs', requireAuthPage, (req, res) => {
  res.sendFile(path.join(publicDir, 'labs.html'));
});

router.get('/api/labs', requireAuthApi, (req, res) => {
  const labs = getLabsWithWorkstations();
  res.json(labs);
});

export default router;
