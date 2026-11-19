import express from 'express';
import session from 'express-session';
import crypto from 'crypto';
import authRouter from './routes/auth.js';
import labsRouter from './routes/labs.js';
import staffRouter from './routes/staff.js';
import healthRouter from './routes/health.js';

let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  if (process.env.NODE_ENV === 'production') {
    console.error('SESSION_SECRET environment variable is required in production');
    process.exit(1);
  } else {
    sessionSecret = crypto.randomBytes(32).toString('hex');
    console.warn('WARNING: SESSION_SECRET is not set. Using a generated random secret for development.');
  }
}

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  }
}));

app.use(authRouter);
app.use(labsRouter);
app.use(staffRouter);
app.use(healthRouter);

// Root redirect
app.get('/', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/labs');
  }
  res.redirect('/login');
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler (four arguments)
app.use((err, req, res, next) => {
  console.error(err);
  if ((err instanceof SyntaxError && err.status === 400) || err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'The request body is not valid JSON.' });
  }
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

export default app;
