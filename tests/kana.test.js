import assert from 'node:assert/strict';
import { kana, stages, getStageKana } from '../src/kana.js';
assert.equal(kana.length, 208, 'Le catalogue doit contenir 208 unités');
assert.equal(new Set(kana.map(k => k.id)).size, 208, 'Chaque unité doit avoir un identifiant unique');
assert.equal(kana.filter(k => k.script === 'hiragana').length, 104);
assert.equal(kana.filter(k => k.script === 'katakana').length, 104);
assert.equal(stages.reduce((n,s) => n + getStageKana(s.id).length, 0), 208);
for (const k of kana) assert.ok(k.char && k.romaji && k.pair);
console.log('✓ 208 kana valides, uniques et répartis dans 7 étapes');
