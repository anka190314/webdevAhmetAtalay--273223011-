import { test } from 'node:test';
import assert from 'node:assert';
import { exchangeCodeForTokens, verifyIdToken } from './googleAuth.js';

// Helper to create a base64url encoded JWT payload
function createTestJwt(payload, header = { alg: 'RS256', typ: 'JWT' }) {
  const encHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encHeader}.${encPayload}.fake-signature`;
}

test('exchangeCodeForTokens success', async () => {
  const mockFetch = async (url, options) => {
    assert.strictEqual(url, 'https://oauth2.googleapis.com/token');
    assert.strictEqual(options.method, 'POST');
    return {
      ok: true,
      json: async () => ({ id_token: 'fake.id.token', access_token: 'fake-access' })
    };
  };

  const result = await exchangeCodeForTokens({
    code: 'test-code',
    codeVerifier: 'test-verifier',
    clientId: 'client-123',
    clientSecret: 'secret-123',
    redirectUri: 'http://localhost/callback',
    fetchFn: mockFetch
  });

  assert.strictEqual(result.id_token, 'fake.id.token');
});

test('exchangeCodeForTokens failure on non-ok response', async () => {
  const mockFetch = async () => ({
    ok: false,
    text: async () => 'Bad Request'
  });

  await assert.rejects(async () => {
    await exchangeCodeForTokens({
      code: 'bad-code',
      codeVerifier: 'verifier',
      clientId: 'id',
      clientSecret: 'secret',
      redirectUri: 'uri',
      fetchFn: mockFetch
    });
  }, /Token exchange failed/);
});

test('verifyIdToken success', () => {
  const now = 1000000000000; // ms
  const payload = {
    iss: 'https://accounts.google.com',
    aud: 'client-123',
    exp: Math.floor(now / 1000) + 3600,
    sub: 'sub-456',
    email: 'user@example.com',
    email_verified: true
  };
  const token = createTestJwt(payload);

  const result = verifyIdToken({
    idToken: token,
    clientId: 'client-123',
    now: () => now
  });

  assert.deepStrictEqual(result, {
    sub: 'sub-456',
    email: 'user@example.com',
    emailVerified: true
  });
});

test('verifyIdToken with alternate valid iss (accounts.google.com)', () => {
  const now = 1000000000000;
  const payload = {
    iss: 'accounts.google.com',
    aud: 'client-123',
    exp: Math.floor(now / 1000) + 3600,
    sub: 'sub-456',
    email: 'user@example.com',
    email_verified: false
  };
  const token = createTestJwt(payload);

  const result = verifyIdToken({
    idToken: token,
    clientId: 'client-123',
    now: () => now
  });

  assert.strictEqual(result.emailVerified, false);
});

test('verifyIdToken rejects invalid issuer', () => {
  const token = createTestJwt({
    iss: 'https://evil.com',
    aud: 'client-123',
    exp: Math.floor(Date.now() / 1000) + 3600
  });

  assert.throws(() => {
    verifyIdToken({ idToken: token, clientId: 'client-123' });
  }, /Invalid issuer/);
});

test('verifyIdToken rejects mismatched audience', () => {
  const token = createTestJwt({
    iss: 'https://accounts.google.com',
    aud: 'wrong-client',
    exp: Math.floor(Date.now() / 1000) + 3600
  });

  assert.throws(() => {
    verifyIdToken({ idToken: token, clientId: 'client-123' });
  }, /Invalid audience/);
});

test('verifyIdToken rejects expired token', () => {
  const now = 1000000000000;
  const token = createTestJwt({
    iss: 'https://accounts.google.com',
    aud: 'client-123',
    exp: Math.floor(now / 1000) - 10
  });

  assert.throws(() => {
    verifyIdToken({ idToken: token, clientId: 'client-123', now: () => now });
  }, /Token expired/);
});

test('verifyIdToken rejects missing or non-number exp', () => {
  const tokenMissingExp = createTestJwt({
    iss: 'https://accounts.google.com',
    aud: 'client-123',
    exp: undefined
  });

  assert.throws(() => {
    verifyIdToken({ idToken: tokenMissingExp, clientId: 'client-123' });
  }, /Invalid expiration/);

  const tokenStringExp = createTestJwt({
    iss: 'https://accounts.google.com',
    aud: 'client-123',
    exp: '1700000000'
  });

  assert.throws(() => {
    verifyIdToken({ idToken: tokenStringExp, clientId: 'client-123' });
  }, /Invalid expiration/);
});


test('verifyIdToken refuses a token that is not a JWT or whose payload is not JSON', () => {
  assert.throws(() => verifyIdToken({ idToken: 'not-a-jwt', clientId: 'client-123' }), /Invalid JWT format/);
  const notJson = Buffer.from('not json').toString('base64url');
  assert.throws(() => verifyIdToken({ idToken: `header.${notJson}.signature`, clientId: 'client-123' }), /Failed to parse JWT payload/);
});
