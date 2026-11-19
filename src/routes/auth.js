import express from 'express';
import { authenticateUser, findOrCreateGoogleUser } from '../services/authService.js';
import { exchangeCodeForTokens, verifyIdToken } from '../services/googleAuth.js';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

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

router.get('/api/auth/google', (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.PUBLIC_BASE_URL) {
    return res.status(503).send('Google Sign-In is not configured.');
  }

  const state = crypto.randomBytes(32).toString('hex');
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

  req.session.googleState = state;
  req.session.googleVerifier = codeVerifier;

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', `${process.env.PUBLIC_BASE_URL}/api/auth/google/callback`);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid email');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  res.redirect(authUrl.toString());
});

router.get('/api/auth/google/callback', async (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.PUBLIC_BASE_URL) {
    return res.status(503).send('Google Sign-In is not configured.');
  }

  const { code, state } = req.query;
  const sessionState = req.session.googleState;
  const codeVerifier = req.session.googleVerifier;

  delete req.session.googleState;
  delete req.session.googleVerifier;

  if (!code || !sessionState || !state || sessionState.length !== state.length || !crypto.timingSafeEqual(Buffer.from(sessionState), Buffer.from(state))) {
    return res.redirect('/login?error=google');
  }

  try {
    const tokens = await exchangeCodeForTokens({
      code,
      codeVerifier,
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      redirectUri: `${process.env.PUBLIC_BASE_URL}/api/auth/google/callback`
    });

    if (!tokens || !tokens.id_token) {
      return res.redirect('/login?error=google');
    }

    const { sub, email, emailVerified } = verifyIdToken({
      idToken: tokens.id_token,
      clientId: process.env.GOOGLE_CLIENT_ID
    });

    const user = await findOrCreateGoogleUser({ sub, email, emailVerified });

    req.session.regenerate((err) => {
      if (err) {
        return res.redirect('/login?error=google');
      }
      req.session.userId = user.id;
      req.session.role = user.role;
      res.redirect('/labs');
    });
  } catch (err) {
    console.error('Google sign-in failed:', err.message);
    return res.redirect('/login?error=google');
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

export default router;
