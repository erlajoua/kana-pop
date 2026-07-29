import assert from 'node:assert/strict';
import { getStageKana, stages } from '../src/kana.js';
import { words, tokenize, getWordsForKana } from '../src/words.js';

assert.ok(words.length >= 60, 'Le lexique doit contenir au moins 60 mots');
assert.equal(new Set(words.map(w => w.id)).size, words.length, 'Chaque mot doit avoir un identifiant unique');
for (const w of words) {
  assert.ok(w.char && w.romaji && w.fr, `Mot incomplet : ${w.id}`);
  assert.ok(w.sounds.length, `Mot non découpé : ${w.char}`);
  assert.equal(w.katakana.length >= w.char.length, true, `Conversion katakana ratée : ${w.char}`);
}

assert.deepEqual(tokenize('きょう').map(u => u.romaji), ['kyo', 'u'], 'きょ doit compter pour une seule unité');
assert.equal(tokenize('abc'), null, 'Un texte non kana ne se découpe pas');

const vowels = getWordsForKana(getStageKana('voyelles'));
assert.ok(vowels.length >= 4, 'Le module Voyelles doit débloquer au moins 4 mots');
for (const w of vowels) {
  assert.ok(w.sounds.every(s => ['a', 'i', 'u', 'e', 'o'].includes(s)), `${w.char} sort du module Voyelles`);
}

const everything = getWordsForKana(stages.flatMap(s => getStageKana(s.id)));
assert.equal(everything.length, words.length, 'Tous les mots doivent être lisibles une fois les kana connus');

// La progression débloque toujours plus de mots.
const cumulative = stages.map((_, i) =>
  getWordsForKana(stages.slice(0, i + 1).flatMap(s => getStageKana(s.id))).length
);
for (let i = 1; i < cumulative.length; i++) {
  assert.ok(cumulative[i] >= cumulative[i - 1], 'Le nombre de mots ne doit jamais diminuer');
}

console.log(`✓ ${words.length} mots découpés en kana, ${vowels.length} lisibles dès les voyelles`);
