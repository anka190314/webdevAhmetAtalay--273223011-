import { test } from 'node:test';
import assert from 'node:assert';
import { calendarLink } from './calendarService.js';

test('AC-9 calendarLink builds correct URL with host, action, text, dates and ctz', () => {
  const link = calendarLink({
    labName: '2140',
    workstationName: 'WS1',
    date: '2026-12-01',
    slot: 1
  });

  const parsed = new URL(link);
  assert.strictEqual(parsed.hostname, 'calendar.google.com');
  assert.strictEqual(parsed.pathname, '/calendar/render');
  assert.strictEqual(parsed.searchParams.get('action'), 'TEMPLATE');
  assert.strictEqual(parsed.searchParams.get('text'), 'Lab 2140, workstation WS1');
  assert.strictEqual(parsed.searchParams.get('dates'), '20261201T100000/20261201T120000');
  assert.strictEqual(parsed.searchParams.get('ctz'), 'Europe/Sofia');
});

test('AC-9 calendarLink ensures the last slot ends at 20:00', () => {
  const linkLastSlot = calendarLink({
    labName: '2140',
    workstationName: 'WS1',
    date: '2026-12-01',
    slot: 5
  });
  const parsedLast = new URL(linkLastSlot);
  assert.strictEqual(parsedLast.searchParams.get('dates'), '20261201T180000/20261201T200000');
});
