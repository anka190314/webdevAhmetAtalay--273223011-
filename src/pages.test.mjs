import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const pages = fs.readdirSync(publicDir).filter((f) => f.endsWith('.html'));

test('AC-12 every page fits a 375-pixel-wide phone screen: it sets the viewport and no fixed width is wider than 375px', () => {
  assert.ok(pages.includes('lab.html'));
  for (const page of pages) {
    const html = fs.readFileSync(path.join(publicDir, page), 'utf8');
    assert.match(html, /<meta name="viewport" content="width=device-width/, `${page} sets the viewport`);
    for (const m of html.matchAll(/(?<![-\w])(min-width|width)\s*:\s*(\d+)px/g)) {
      assert.ok(Number(m[2]) <= 375, `${page}: ${m[0]} is wider than a 375-pixel screen`);
    }
  }
});

test('every page links /assets/app.css', () => {
  for (const page of pages) {
    const html = fs.readFileSync(path.join(publicDir, page), 'utf8');
    assert.match(html, /<link rel="stylesheet" href="\/assets\/app\.css">/, `${page} links /assets/app.css`);
  }
});

test('no hex colour in public/*.html', () => {
  for (const page of pages) {
    const html = fs.readFileSync(path.join(publicDir, page), 'utf8');
    const hexMatches = html.match(/#[0-9a-fA-F]{3,6}/g);
    assert.strictEqual(hexMatches, null, `${page} contains hex colours: ${hexMatches}`);
  }
});

test('app.css has :focus-visible rule with outline and min-height: 44px', () => {
  const cssPath = path.join(publicDir, 'assets', 'app.css');
  const css = fs.readFileSync(cssPath, 'utf8');
  assert.match(css, /:focus-visible\s*\{[^}]*outline\s*:/);
  assert.match(css, /min-height\s*:\s*44px/);
});

test('lab.html: a readable error with Retry, a reserved status line, and the suggestion labelled as one', () => {
  const html = fs.readFileSync(path.join(publicDir, 'lab.html'), 'utf8');
  for (const sentence of [
    'Could not load the slots. Check your connection and try again.',
    'Could not reach the server. Check your connection and try again.',
    'Search is not available right now. Please choose the day and time yourself.',
    'Nothing is booked until you press Book.',
  ]) {
    assert.ok(html.includes(sentence), sentence);
  }
  assert.ok(html.includes("retryBtn.textContent = 'Retry'"), 'a Retry button');
  assert.match(html, /id="loading" role="status"/);
  assert.match(html, /#loading \{ min-height/);
  assert.ok(!html.includes('err.message ||'), 'the browser message is never the fallback');
});

test('lab.html: after a failed load the old grid is removed, so no Book button points at another date', () => {
  const html = fs.readFileSync(path.join(publicDir, 'lab.html'), 'utf8');
  assert.match(html, /innerHTML = '';\s*if \(isBrowserError\(err\)\)/);
});
