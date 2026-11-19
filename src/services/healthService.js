async function defaultPing() {
  const { ping } = await import('../db/database.js');
  return ping();
}

export async function checkHealth(pingFn = defaultPing, timeoutMs = 2000) {
  try {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Health check timeout')), timeoutMs);
    });
    await Promise.race([Promise.resolve().then(() => pingFn()), timeoutPromise]);
    return { status: 'ok', db: 'ok' };
  } catch (err) {
    return { status: 'error', db: 'down' };
  }
}
