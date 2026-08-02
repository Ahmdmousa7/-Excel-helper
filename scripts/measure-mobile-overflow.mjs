#!/usr/bin/env node
/**
 * Count elements overflowing a 375px viewport. Used to set the ratchet in
 * e2e/responsive.spec.ts honestly rather than by guesswork.
 */
import { chromium } from '@playwright/test';
const url = process.env.URL ?? 'http://127.0.0.1:4173/-Excel-helper/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 375, height: 812 } });
await p.addInitScript(() => {
  localStorage.setItem('gemini_api_key', 'probe');
  localStorage.setItem('groq_api_key', '');
});
await p.goto(url, { waitUntil: 'domcontentloaded' });
await p.locator('aside').first().waitFor({ state: 'attached', timeout: 30000 });
await p.waitForTimeout(2500);
const bad = await p.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  return Array.from(document.querySelectorAll('body *'))
    .filter((el) => { const r = el.getBoundingClientRect(); return r.width && r.height && r.right > vw + 8; })
    .map((el) => `${el.tagName}.${String(el.className).slice(0, 34)} right=${Math.round(el.getBoundingClientRect().right)}`);
});
console.log(`offenders at 375px: ${bad.length}`);
bad.slice(0, 8).forEach((x) => console.log('  ' + x));
await b.close();
