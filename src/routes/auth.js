import express from 'express';
import { authenticateUser } from '../services/authService.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '../../public');

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/labs');
  }
  res.sendFile(path.join(publicDir, 'login.html'));
});

router.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  const user = await authenticateUser(email, password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  req.session.regenerate((err) => {
    if (err) {
      return res.status(500).json({ error: 'Session regeneration failed' });
    }
    req.session.userId = user.id;
    req.session.role = user.role;
    res.json({ success: true, user });
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

export default router;
