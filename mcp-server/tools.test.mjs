import { test, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const serverPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'server.js');

const tmpDb = `/tmp/mcp_test_${Date.now()}_${Math.random()}.db`;
process.env.DB_PATH = tmpDb;

const { initDb, db } = await import('../src/db/database.js');
const { generateToken } = await import('../src/services/tokenService.js');
const { getWorkstationSlots, createBooking } = await import('../src/services/bookingService.js');
const { getLabUsage } = await import('../src/services/labService.js');

await initDb();

const student1 = db.prepare('SELECT id FROM users WHERE role = ?').get('student');
const student2Id = db.prepare('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)')
  .run('student2@example.com', 'x', 'student').lastInsertRowid;
const token1 = await generateToken(student1.id);
const token2 = await generateToken(student2Id);
const staff = db.prepare('SELECT * FROM users WHERE role = ?').get('staff');
const staffToken = await generateToken(staff.id);
const ws = db.prepare('SELECT id, name, lab_id FROM workstations LIMIT 1').get();
const date = '2030-01-01'; // a Tuesday, always in the future

const count = () => db.prepare('SELECT COUNT(*) AS c FROM bookings').get().c;

function startServer(token) {
  const env = { ...process.env, DB_PATH: tmpDb, MCP_TOKEN: token };
  if (token === undefined) delete env.MCP_TOKEN;
  const child = spawn(process.execPath, [serverPath], { env, stdio: ['pipe', 'pipe', 'pipe'] });
  const waiting = new Map();
  const badLines = [];
  readline.createInterface({ input: child.stdout }).on('line', (line) => {
    let msg;
    try { msg = JSON.parse(line); } catch { badLines.push(line); return; }
    const done = waiting.get(msg.id);
    if (done) { waiting.delete(msg.id); done(msg); }
  });
  child.stderr.resume();
  let nextId = 1;
  function request(method, params) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { waiting.delete(id); reject(new Error(`No answer to ${method} within 5 s`)); }, 5000);
      waiting.set(id, (msg) => { clearTimeout(timer); resolve(msg); });
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  }
  const callTool = async (name, args) => (await request('tools/call', { name, arguments: args })).result;
  return { child, badLines, request, callTool };
}

async function withServer(token, fn) {
  const server = startServer(token);
  try {
    await server.request('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '0' } });
    await fn(server);
    assert.deepStrictEqual(server.badLines, [], 'stdout carries only protocol messages');
  } finally {
    server.child.kill();
  }
}

after(() => {
  for (const f of [tmpDb, `${tmpDb}-wal`, `${tmpDb}-shm`]) {
    try { fs.unlinkSync(f); } catch {}
  }
});

test('AC-26 a tool call with a missing or unknown token returns an error result and changes nothing', async () => {
  const before = count();
  for (const token of [undefined, 'not-a-real-token']) {
    await withServer(token, async (server) => {
      const result = await server.callTool('book_slot', { workstation_id: ws.id, date: '2030-01-02', slot: 5 });
      assert.strictEqual(result.isError, true);
      assert.strictEqual(result.content[0].text, 'Missing or unknown MCP token');
    });
  }
  assert.strictEqual(count(), before);
});

test('AC-25 book_slot with a valid token books a free slot for the token owner', async () => {
  await withServer(token1, async (server) => {
    const result = await server.callTool('book_slot', { workstation_id: ws.id, date, slot: 0 });
    assert.notStrictEqual(result.isError, true);
  });
  const row = db.prepare('SELECT user_id FROM bookings WHERE workstation_id = ? AND date = ? AND slot = ?').get(ws.id, date, 0);
  assert.ok(row);
  assert.strictEqual(row.user_id, student1.id);
});

test('AC-18 book_slot refuses a booked slot with "This slot is already booked"', async () => {
  const before = count();
  await withServer(token2, async (server) => {
    const result = await server.callTool('book_slot', { workstation_id: ws.id, date, slot: 0 });
    assert.strictEqual(result.isError, true);
    assert.strictEqual(result.content[0].text, 'This slot is already booked');
  });
  assert.strictEqual(count(), before);
});

test('AC-23 free_workstations lists the same free workstations as the booking screen', async () => {
  const expected = getWorkstationSlots(ws.lab_id, date, student1.id);
  await withServer(token1, async (server) => {
    const result = await server.callTool('free_workstations', { lab_id: ws.lab_id, date });
    assert.notStrictEqual(result.isError, true);
    const slots = JSON.parse(result.content[0].text);
    assert.strictEqual(slots.length, 6);
    for (let slot = 0; slot < 6; slot++) {
      const free = expected.filter((w) => w.slots[slot].status === 'free').map((w) => w.name).sort();
      assert.deepStrictEqual([...slots[slot].free].sort(), free);
    }
  });
});

test("AC-24 my_bookings lists only the token owner's upcoming bookings", async () => {
  createBooking(student2Id, ws.id, date, 3);
  await withServer(token1, async (server) => {
    const result = await server.callTool('my_bookings', {});
    assert.notStrictEqual(result.isError, true);
    const bookings = JSON.parse(result.content[0].text);
    assert.deepStrictEqual(bookings.map((b) => [b.date, b.slot]), [[date, 0]]);
  });
});

test("AC-28 lab_usage with staff token returns lab usage and with student token returns error", async () => {
  const expected = getLabUsage(staff, '2030-01-01');
  await withServer(staffToken, async (server) => {
    const result = await server.callTool('lab_usage', { week: '2030-01-01' });
    assert.notStrictEqual(result.isError, true);
    const usage = JSON.parse(result.content[0].text);
    assert.deepStrictEqual(usage, JSON.parse(JSON.stringify(expected)));
  });
  await withServer(token1, async (server) => {
    const result = await server.callTool('lab_usage', { week: '2030-01-01' });
    assert.strictEqual(result.isError, true);
  });
});