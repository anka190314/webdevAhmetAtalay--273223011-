export async function exchangeCodeForTokens({
  code,
  codeVerifier,
  clientId,
  clientSecret,
  redirectUri,
  fetchFn = fetch
}) {
  const params = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    code_verifier: codeVerifier
  });

  const res = await fetchFn('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }

  return await res.json();
}

export function verifyIdToken({ idToken, clientId, now = Date.now }) {
  const parts = idToken.split('.');
  if (parts.length < 2) {
    throw new Error('Invalid JWT format');
  }

  let payload;
  try {
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
    payload = JSON.parse(payloadJson);
  } catch (err) {
    throw new Error('Failed to parse JWT payload');
  }

  if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') {
    throw new Error(`Invalid issuer: ${payload.iss}`);
  }

  if (payload.aud !== clientId) {
    throw new Error(`Invalid audience: ${payload.aud}`);
  }

  if (typeof payload.exp !== 'number') {
    throw new Error('Invalid expiration');
  }

  const currentTimeSec = Math.floor(now() / 1000);
  if (payload.exp <= currentTimeSec) {
    throw new Error('Token expired');
  }

  return {
    sub: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified
  };
}
