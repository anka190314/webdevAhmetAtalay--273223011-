import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { getLabsWithWorkstations } from '../services/labService.js';
import { getWorkstationSlots, createBooking, cancelBooking, getLab } from '../services/bookingService.js';
import { createSearch } from '../services/search.js';
import {
  InvalidBooking,
  BookingConflict,
  NotOwner,
  BookingNotFound,
  LabNotFound,
  WorkstationNotFound
} from '../services/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '../../public');

const router = express.Router();
const search = createSearch();

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

router.get('/labs/:id', requireAuthPage, async (req, res) => {
  try {
    await getLab(req.params.id);
    res.sendFile(path.join(publicDir, 'lab.html'));
  } catch (err) {
    if (err instanceof LabNotFound) {
      return res.status(404).send('Lab not found');
    }
    throw err;
  }
});

router.get('/api/labs', requireAuthApi, async (req, res) => {
  const labs = await getLabsWithWorkstations();
  res.json(labs);
});

router.get('/api/labs/:id/slots', requireAuthApi, async (req, res) => {
  try {
    const labId = parseInt(req.params.id, 10);
    const date = req.query.date;
    const slots = await getWorkstationSlots(labId, date, req.session.userId);
    res.json(slots);
  } catch (err) {
    if (err instanceof InvalidBooking) {
      return res.status(422).json({ error: err.message });
    }
    if (err instanceof LabNotFound) {
      return res.status(404).json({ error: err.message });
    }
    throw err;
  }
});

router.post('/api/bookings', requireAuthApi, async (req, res) => {
  try {
    const { workstationId, date, slot } = req.body;
    const booking = await createBooking(req.session.userId, workstationId, date, slot);
    res.status(201).json(booking);
  } catch (err) {
    if (err instanceof InvalidBooking) {
      return res.status(422).json({ error: err.message });
    }
    if (err instanceof BookingConflict) {
      return res.status(409).json({ error: 'This slot is already booked' });
    }
    if (err instanceof WorkstationNotFound || err instanceof LabNotFound) {
      return res.status(404).json({ error: err.message });
    }
    throw err;
  }
});

router.delete('/api/bookings/:id', requireAuthApi, async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id, 10);
    await cancelBooking(req.session.userId, bookingId);
    res.status(204).send();
  } catch (err) {
    if (err instanceof BookingNotFound) {
      return res.status(404).json({ error: err.message });
    }
    if (err instanceof NotOwner) {
      return res.status(403).json({ error: err.message });
    }
    throw err;
  }
});

router.post('/api/search', requireAuthApi, async (req, res) => {
  const { sentence } = req.body || {};
  if (!sentence || typeof sentence !== 'string' || !sentence.trim()) {
    return res.status(422).json({ error: 'Sentence is required' });
  }
  const result = await search(sentence);
  res.json(result);
});

export default router;
