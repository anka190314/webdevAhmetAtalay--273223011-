import express from 'express';
import session from 'express-session';
import crypto from 'crypto';
import authRouter from './routes/auth.js';
import labsRouter from './routes/labs.js';

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

// Root redirect
app.get('/', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/labs');
  }
  res.redirect('/login');
});

export default app;
