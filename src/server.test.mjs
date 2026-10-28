import { test } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import app from './app.js';

test('AC-13 A visitor who opens /labs without signing in lands on /login instead', async (t) => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const res = await fetch(`http://localhost:${port}/labs`, {
      redirect: 'manual'
    });
    assert.strictEqual(res.status, 302);
    assert.strictEqual(res.headers.get('location'), '/login');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('A request to /api/labs without a session gets 401 JSON', async (t) => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const res = await fetch(`http://localhost:${port}/api/labs`);
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.error, 'Unauthorized');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
