import { chromium } from 'playwright';
import { kana } from '../src/kana.js';

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', error => errors.push(error.stack || error.message));
page.on('console', message => {
  if (message.type() === 'error') errors.push(message.text());
});
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.evaluate(() => {
  const saved = JSON.parse(localStorage.getItem('kana-pop-v1') || '{}');
  localStorage.setItem('kana-pop-v1', JSON.stringify({ ...saved, sound: false }));
});
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('button', { name: /Spammer sans limite/i }).click();
await page.locator('.kana-card').waitFor();
const vowelChoices = await page.locator('.choices button').allTextContents();
const allowedVowels = new Set(['a', 'i', 'u', 'e', 'o']);
if (!vowelChoices.every(choice => allowedVowels.has(choice))) {
  errors.push(`Le module Voyelles contient des choix hors module : ${vowelChoices.join(', ')}`);
}
if (new Set(vowelChoices).size !== 4) {
  errors.push(`Les quatre choix Voyelles doivent être distincts : ${vowelChoices.join(', ')}`);
}
const firstChar = await page.locator('.kana-card span').innerText();
const rightAnswer = kana.find(k => k.char === firstChar)?.romaji;
await page.locator('.choices button').filter({ hasText: new RegExp(`^${rightAnswer}$`) }).click();
await page.getByText('Ça repart…').waitFor();
await page.getByText('∞ 2', { exact: true }).waitFor({ timeout: 2000 });
await page.locator('.kana-card').waitFor();
await page.getByRole('button', { name: '×' }).click();
await page.getByRole('button', { name: /Retour au parcours/i }).click();
await page.locator('.stage').filter({ hasText: 'Voyelles' }).click();
await page.locator('.kana-card').waitFor();
console.log('✓ boutons principal et Voyelles, réponse et question suivante');
if (errors.length) console.log('errors=', errors);
await browser.close();
if (errors.length) process.exitCode = 1;
