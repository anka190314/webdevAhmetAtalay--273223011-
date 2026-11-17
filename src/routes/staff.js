import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { getServiceUserById } from '../services/authService.js';
import { addWorkstation, getLabUsage } from '../services/labService.js';
import {
  NotStaff,
  LabNotFound,
  DuplicateWorkstation,
  InvalidInput
} from '../services/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '../../public');

const router = express.Router();

function requireAuthApi(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
}

router.get('/staff', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.redirect('/login');
  }
  const user = getServiceUserById(req.session.userId);
  if (!user || user.role !== 'staff') {
    return res.status(403).send('Forbidden');
  }
  res.sendFile(path.join(publicDir, 'staff.html'));
});

router.post('/api/labs/:id/workstations', requireAuthApi, (req, res) => {
  try {
    const user = getServiceUserById(req.session.userId);
    const labId = parseInt(req.params.id, 10);
    const { name } = req.body;
    const workstation = addWorkstation(user, labId, name);
    res.status(201).json(workstation);
  } catch (err) {
    if (err instanceof NotStaff) {
      return res.status(403).json({ error: err.message });
    }
    if (err instanceof LabNotFound) {
      return res.status(404).json({ error: err.message });
    }
    if (err instanceof DuplicateWorkstation) {
      return res.status(409).json({ error: err.message });
    }
    if (err instanceof InvalidInput) {
      return res.status(422).json({ error: err.message });
    }
    throw err;
  }
});

router.get('/api/usage', requireAuthApi, (req, res) => {
  try {
    const user = getServiceUserById(req.session.userId);
    const week = req.query.week;
    const usage = getLabUsage(user, week);
    res.json(usage);
  } catch (err) {
    if (err instanceof NotStaff) {
      return res.status(403).json({ error: err.message });
    }
    if (err instanceof InvalidInput) {
      return res.status(422).json({ error: err.message });
    }
    throw err;
  }
});

export default router;
