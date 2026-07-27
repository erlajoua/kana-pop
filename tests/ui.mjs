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
await page.getByRole('button', { name: /Hiragana/i }).click();
await page.getByRole('button', { name: /Spammer la sélection/i }).click();
await page.locator('.kana-card').waitFor();
const hiraganaChar = await page.locator('.kana-card span').innerText();
if (kana.find(k => k.char === hiraganaChar)?.script !== 'hiragana') {
  errors.push(`Le parcours Hiragana a affiché ${hiraganaChar}`);
}
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
const secondChar = await page.locator('.kana-card span').innerText();
const secondAnswer = kana.find(k => k.char === secondChar)?.romaji;
await page.locator('.choices button').filter({ hasNotText: new RegExp(`^${secondAnswer}$`) }).first().click();
await page.keyboard.press('Enter');
await page.getByText('∞ 3', { exact: true }).waitFor({ timeout: 2000 });
await page.getByRole('button', { name: '×' }).click();
await page.getByRole('button', { name: /Retour au parcours/i }).click();
await page.locator('.stage').filter({ hasText: 'K & S' }).click();
await page.getByRole('button', { name: /Réviser 2 modules/i }).click();
await page.locator('.kana-card').waitFor();
await page.getByRole('button', { name: '×' }).click();
await page.getByRole('button', { name: /Retour au parcours/i }).click();
await page.getByRole('button', { name: /Katakana/i }).click();
await page.getByRole('button', { name: /Réviser 2 modules/i }).click();
const katakanaChar = await page.locator('.kana-card span').innerText();
if (kana.find(k => k.char === katakanaChar)?.script !== 'katakana') {
  errors.push(`Le parcours Katakana a affiché ${katakanaChar}`);
}
await page.getByRole('button', { name: '×' }).click();
await page.getByRole('button', { name: /Retour au parcours/i }).click();
await page.getByRole('button', { name: /Mixte/i }).click();
await page.getByRole('button', { name: /Écrire/i }).click();
await page.getByRole('button', { name: /Spammer la sélection/i }).click();
await page.locator('canvas').waitFor();
await page.getByText(/Hiragana ou katakana/i).waitFor();
const board = await page.locator('canvas').boundingBox();
await page.mouse.move(board.x + 70, board.y + 70);
await page.mouse.down();
await page.mouse.move(board.x + 180, board.y + 180);
await page.mouse.up();
await page.getByRole('button', { name: /Voir le modèle/i }).click();
const summary = await page.locator('.writing-summary').innerText();
if (!summary.toLowerCase().includes('hiragana') || !summary.toLowerCase().includes('katakana')) {
  errors.push('Le bilan dessin Mixte ne montre pas les deux écritures');
}
await page.getByRole('button', { name: /J’ai fait/ }).nth(1).click();
await page.getByText(/Tu as dessiné en katakana/i).waitFor();
await page.getByText('Ça repart…').waitFor();
console.log('✓ parcours séparés, modules combinés, touche Entrée et mode dessin canvas');
if (errors.length) console.log('errors=', errors);
await browser.close();
if (errors.length) process.exitCode = 1;
