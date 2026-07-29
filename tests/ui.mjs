import { chromium } from 'playwright';
import { kana } from '../src/kana.js';
import { words } from '../src/words.js';

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', error => errors.push(error.stack || error.message));
page.on('console', message => {
  if (message.type() === 'error') errors.push(message.text());
});

// Lit la carte affichée : sens de la question, choix proposés et bonne réponse.
async function readCard() {
  const prompt = await page.locator('.prompt').innerText();
  const face = await page.locator('.kana-card span').innerText();
  const choices = await page.locator('.choices button').allTextContents();
  const reverse = /Quel kana/.test(prompt);
  const word = words.find(w => w.char === face);
  const answer = word
    ? /Que veut dire/.test(prompt) ? word.fr : word.romaji
    : reverse ? choices.find(c => kana.find(k => k.char === c)?.romaji === face)
      : kana.find(k => k.char === face)?.romaji;
  return { prompt, face, choices, reverse, word, answer, shownKana: reverse ? choices : [face] };
}
const clickChoice = (choices, text) => page.locator('.choices button').nth(choices.indexOf(text)).click();
// La face de la carte (kana, combinaison ou mot) doit tenir dans les 230px.
async function checkCardFits(label) {
  const over = await page.evaluate(() => {
    const card = document.querySelector('.kana-card').getBoundingClientRect();
    const span = document.querySelector('.kana-card span').getBoundingClientRect();
    const small = document.querySelector('.kana-card small').getBoundingClientRect();
    return Math.round(Math.max(
      span.bottom - card.bottom, card.top - span.top,
      span.right - card.right, card.left - span.left,
      small.bottom - card.bottom
    ));
  });
  if (over > 0) errors.push(`${label} : la face déborde de la carte de ${over}px`);
}
async function answerCard({ right = true } = {}) {
  const card = await readCard();
  const target = right ? card.answer : card.choices.find(c => c !== card.answer);
  await clickChoice(card.choices, target);
  return card;
}

await page.goto(process.env.APP_URL || 'http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.evaluate(() => {
  const saved = JSON.parse(localStorage.getItem('kana-pop-v1') || '{}');
  localStorage.setItem('kana-pop-v1', JSON.stringify({ ...saved, sound: false }));
});
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('button', { name: /Hiragana/i }).click();
await page.getByRole('button', { name: /Spammer la sélection/i }).click();
await page.locator('.kana-card').waitFor();

const first = await readCard();
if (!first.shownKana.every(c => kana.find(k => k.char === c)?.script === 'hiragana')) {
  errors.push(`Le parcours Hiragana a affiché ${first.shownKana.join(', ')}`);
}
const allowedVowels = new Set(first.reverse ? ['あ', 'い', 'う', 'え', 'お'] : ['a', 'i', 'u', 'e', 'o']);
if (!first.choices.every(choice => allowedVowels.has(choice))) {
  errors.push(`Le module Voyelles contient des choix hors module : ${first.choices.join(', ')}`);
}
if (new Set(first.choices).size !== 4) {
  errors.push(`Les quatre choix Voyelles doivent être distincts : ${first.choices.join(', ')}`);
}

await clickChoice(first.choices, first.answer);
await page.getByText('Ça repart…').waitFor();
await page.getByText('∞ 2', { exact: true }).waitFor({ timeout: 2000 });
await page.locator('.kana-card').waitFor();
await answerCard({ right: false });
await page.keyboard.press('Enter');
await page.getByText('∞ 3', { exact: true }).waitFor({ timeout: 2000 });

// Les deux sens de question doivent apparaître sur une série un peu longue.
const seenDirections = new Set();
for (let i = 3; i < 16; i++) {
  await page.locator('.kana-card').waitFor();
  await checkCardFits('quiz');
  const card = await answerCard();
  seenDirections.add(card.reverse ? 'kana' : 'romaji');
  await page.getByText(`∞ ${i + 1}`, { exact: true }).waitFor({ timeout: 2000 });
}
if (seenDirections.size !== 2) {
  errors.push(`Les questions restent dans un seul sens : ${[...seenDirections].join(', ')}`);
}

await page.getByRole('button', { name: '×' }).click();
await page.getByRole('button', { name: /Retour au parcours/i }).click();
await page.locator('.stage').filter({ hasText: 'K & S' }).click();
await page.getByRole('button', { name: /Réviser 2 modules/i }).click();
await page.locator('.kana-card').waitFor();
await page.getByRole('button', { name: '×' }).click();
await page.getByRole('button', { name: /Retour au parcours/i }).click();
await page.getByRole('button', { name: /Katakana/i }).click();
await page.getByRole('button', { name: /Réviser 2 modules/i }).click();
await page.locator('.kana-card').waitFor();
const katakanaCard = await readCard();
if (!katakanaCard.shownKana.every(c => kana.find(k => k.char === c)?.script === 'katakana')) {
  errors.push(`Le parcours Katakana a affiché ${katakanaCard.shownKana.join(', ')}`);
}
await page.getByRole('button', { name: '×' }).click();
await page.getByRole('button', { name: /Retour au parcours/i }).click();

// Module Mots : uniquement des mots lisibles avec les modules cochés.
await page.getByRole('button', { name: /Hiragana/i }).click();
await page.locator('.mode-picker button').filter({ hasText: 'Mots' }).click();
await page.locator('.mode-hint').waitFor();
await page.getByRole('button', { name: /Réviser 2 modules/i }).click();
await page.locator('.kana-card.word').waitFor();
const allowedSounds = new Set(['a', 'i', 'u', 'e', 'o', 'ka', 'ki', 'ku', 'ke', 'ko', 'sa', 'shi', 'su', 'se', 'so']);
for (let i = 0; i < 8; i++) {
  await page.locator('.kana-card').waitFor();
  const first = await readCard();
  await checkCardFits(`mot ${first.face}`);
  if (!first.word) { errors.push(`Mot inconnu affiché : ${first.face}`); break; }
  if (!first.word.sounds.every(s => allowedSounds.has(s))) {
    errors.push(`${first.word.char} utilise des kana hors des modules choisis`);
  }
  // Étape 1 : toujours la lecture japonaise.
  if (!/Comment se lit/.test(first.prompt)) {
    errors.push(`Étape 1 de ${first.word.char} : « ${first.prompt} » au lieu de la lecture`);
  }
  await clickChoice(first.choices, first.answer);
  await page.getByText('Ça repart…').waitFor();

  // Comparaison exacte : « kaki » est un morceau de « kaki (fruit) », une
  // recherche de sous-chaîne accuserait à tort le rappel de fuiter la réponse.
  const recap = await page.locator('.feedback span').first().innerText();
  const expectedRecap = `${first.word.char} • ${first.word.romaji}`;
  if (recap.trim() !== expectedRecap) {
    errors.push(`Étape 1 (${first.word.char}) : rappel « ${recap} », attendu « ${expectedRecap} »`);
  }

  // Étape 2 : toujours le sens français, sur le même mot.
  await page.waitForFunction(
    previous => document.querySelector('.prompt')?.textContent !== previous,
    first.prompt, { timeout: 3000 }
  );
  const second = await readCard();
  await checkCardFits(`mot ${second.face}`);
  if (!/Que veut dire/.test(second.prompt)) {
    errors.push(`Étape 2 de ${first.word.char} : « ${second.prompt} » au lieu du sens`);
  }
  if (second.word?.char !== first.word.char) {
    errors.push(`L'étape 2 porte sur ${second.word?.char} au lieu de ${first.word.char}`);
  }
  await clickChoice(second.choices, second.answer);
  await page.getByText('Ça repart…').waitFor();
  const full = await page.locator('.feedback span').first().innerText();
  if (!full.includes(first.word.fr) || !full.includes(first.word.romaji) || !full.includes(first.word.char)) {
    errors.push(`Le bilan final du mot ${first.word.char} est incomplet : ${full}`);
  }
  await page.getByText(`∞ ${i + 2}`, { exact: true }).waitFor({ timeout: 3000 });
}

console.log('✓ parcours séparés, questions dans les deux sens, module Mots et mode dessin canvas');

await page.getByRole('button', { name: '×' }).click();
await page.getByRole('button', { name: /Retour au parcours/i }).click();
await page.getByRole('button', { name: /Mixte/i }).click();
await page.getByRole('button', { name: /Écrire/i }).click();
await page.getByRole('button', { name: /Spammer la sélection/i }).click();
await page.locator('canvas').waitFor();
await page.getByText(/Hiragana ou katakana/i).waitFor();
const drawRomaji = await page.locator('.draw-prompt button b').innerText();
const katakanaToDraw = kana.find(k => k.script === 'katakana' && k.romaji === drawRomaji).char;
await page.locator('canvas').evaluate((canvas, char) => {
  const ctx = canvas.getContext('2d');
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.width / ratio;
  const height = canvas.height / ratio;
  ctx.fillStyle = '#202137';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = "900 220px 'Noto Sans JP', 'Hiragino Sans', sans-serif";
  ctx.fillText(char, width / 2, height / 2);
}, katakanaToDraw);
await page.getByRole('button', { name: /Vérifier mon dessin/i }).click();
await page.getByText(new RegExp(`Détecté : ${katakanaToDraw} en katakana`)).waitFor();
const summary = await page.locator('.writing-summary').innerText();
if (!summary.toLowerCase().includes('hiragana') || !summary.toLowerCase().includes('katakana')) {
  errors.push('Le bilan dessin Mixte ne montre pas les deux écritures');
}
await page.getByText(/Tu as dessiné en katakana/i).waitFor();
await page.getByText('Ça repart…').waitFor();
if (errors.length) console.log('errors=', errors);
await browser.close();
if (errors.length) process.exitCode = 1;
