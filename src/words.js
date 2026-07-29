import { kana } from './kana.js';

const hiragana = kana.filter(k => k.script === 'hiragana');
const byChar = new Map(hiragana.map(k => [k.char, k]));
const maxUnit = Math.max(...hiragana.map(k => k.char.length));

// Découpe un mot en unités kana (きょ compte pour une seule unité).
export function tokenize(word) {
  const units = [];
  for (let i = 0; i < word.length;) {
    let unit = null;
    for (let size = Math.min(maxUnit, word.length - i); size > 0; size--) {
      const slice = word.slice(i, i + size);
      if (byChar.has(slice)) { unit = byChar.get(slice); i += size; break; }
    }
    if (!unit) return null;
    units.push(unit);
  }
  return units;
}

const raw = [
  ['あい', 'ai', 'amour'],
  ['いえ', 'ie', 'maison'],
  ['うえ', 'ue', 'au-dessus'],
  ['あお', 'ao', 'bleu'],
  ['あおい', 'aoi', 'bleu (adjectif)'],
  ['あか', 'aka', 'rouge'],
  ['あき', 'aki', 'automne'],
  ['あさ', 'asa', 'le matin'],
  ['いし', 'ishi', 'pierre'],
  ['うし', 'ushi', 'vache'],
  ['えき', 'eki', 'gare'],
  ['かお', 'kao', 'visage'],
  ['かさ', 'kasa', 'parapluie'],
  ['かき', 'kaki', 'kaki (fruit)'],
  ['きく', 'kiku', 'écouter'],
  ['こえ', 'koe', 'voix'],
  ['さけ', 'sake', 'saké'],
  ['すし', 'sushi', 'sushi'],
  ['そこ', 'soko', 'là-bas'],
  ['いけ', 'ike', 'étang'],
  ['いぬ', 'inu', 'chien'],
  ['ねこ', 'neko', 'chat'],
  ['なつ', 'natsu', 'été'],
  ['たこ', 'tako', 'poulpe'],
  ['うた', 'uta', 'chanson'],
  ['くつ', 'kutsu', 'chaussures'],
  ['なに', 'nani', 'quoi'],
  ['にく', 'niku', 'viande'],
  ['ちかてつ', 'chikatetsu', 'métro'],
  ['そと', 'soto', 'dehors'],
  ['したく', 'shitaku', 'préparatifs'],
  ['はな', 'hana', 'fleur'],
  ['はし', 'hashi', 'baguettes'],
  ['ほし', 'hoshi', 'étoile'],
  ['ひと', 'hito', 'personne'],
  ['まち', 'machi', 'ville'],
  ['みみ', 'mimi', 'oreilles'],
  ['あめ', 'ame', 'pluie'],
  ['うみ', 'umi', 'mer'],
  ['ふね', 'fune', 'bateau'],
  ['くも', 'kumo', 'nuage'],
  ['はち', 'hachi', 'huit'],
  ['ちいさい', 'chiisai', 'petit'],
  ['やま', 'yama', 'montagne'],
  ['ゆき', 'yuki', 'neige'],
  ['よる', 'yoru', 'la nuit'],
  ['とり', 'tori', 'oiseau'],
  ['さくら', 'sakura', 'cerisier'],
  ['くるま', 'kuruma', 'voiture'],
  ['しろ', 'shiro', 'blanc'],
  ['くろ', 'kuro', 'noir'],
  ['ほん', 'hon', 'livre'],
  ['にほん', 'nihon', 'Japon'],
  ['みかん', 'mikan', 'mandarine'],
  ['ゆめ', 'yume', 'rêve'],
  ['てんき', 'tenki', 'la météo'],
  ['やさい', 'yasai', 'légumes'],
  ['みず', 'mizu', 'eau'],
  ['たまご', 'tamago', 'œuf'],
  ['かばん', 'kaban', 'sac'],
  ['でんわ', 'denwa', 'téléphone'],
  ['ともだち', 'tomodachi', 'ami'],
  ['はなび', 'hanabi', 'feu d’artifice'],
  ['かぞく', 'kazoku', 'famille'],
  ['げんき', 'genki', 'en forme'],
  ['だいがく', 'daigaku', 'université'],
  ['ぎんこう', 'ginkou', 'banque'],
  ['ぜんぶ', 'zenbu', 'tout'],
  ['おちゃ', 'ocha', 'thé'],
  ['きょう', 'kyou', 'aujourd’hui'],
  ['しゃしん', 'shashin', 'photo'],
  ['りょこう', 'ryokou', 'voyage'],
  ['きゅうり', 'kyuuri', 'concombre'],
  ['しゅみ', 'shumi', 'passe-temps'],
  ['じてんしゃ', 'jitensha', 'vélo'],
  ['びょういん', 'byouin', 'hôpital'],
  ['じゅぎょう', 'jugyou', 'cours']
];

export const words = raw.map(([char, romaji, fr]) => {
  const units = tokenize(char);
  if (!units) throw new Error(`Mot non découpable : ${char}`);
  return {
    id: `w-${char}`,
    char,
    katakana: units.map(u => u.pair).join(''),
    romaji,
    fr,
    sounds: units.map(u => u.romaji)
  };
});

// Mots dont chaque syllabe est couverte par les kana fournis.
export const getWordsForKana = kanaList => {
  const known = new Set(kanaList.map(k => k.romaji));
  return words.filter(w => w.sounds.every(sound => known.has(sound)));
};
