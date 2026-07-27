const basicRows = [
  [['あ','ア','a'],['い','イ','i'],['う','ウ','u'],['え','エ','e'],['お','オ','o']],
  [['か','カ','ka'],['き','キ','ki'],['く','ク','ku'],['け','ケ','ke'],['こ','コ','ko']],
  [['さ','サ','sa'],['し','シ','shi'],['す','ス','su'],['せ','セ','se'],['そ','ソ','so']],
  [['た','タ','ta'],['ち','チ','chi'],['つ','ツ','tsu'],['て','テ','te'],['と','ト','to']],
  [['な','ナ','na'],['に','ニ','ni'],['ぬ','ヌ','nu'],['ね','ネ','ne'],['の','ノ','no']],
  [['は','ハ','ha'],['ひ','ヒ','hi'],['ふ','フ','fu'],['へ','ヘ','he'],['ほ','ホ','ho']],
  [['ま','マ','ma'],['み','ミ','mi'],['む','ム','mu'],['め','メ','me'],['も','モ','mo']],
  [['や','ヤ','ya'],['ゆ','ユ','yu'],['よ','ヨ','yo']],
  [['ら','ラ','ra'],['り','リ','ri'],['る','ル','ru'],['れ','レ','re'],['ろ','ロ','ro']],
  [['わ','ワ','wa'],['を','ヲ','wo'],['ん','ン','n']]
];

const voiced = [
  ['が','ガ','ga'],['ぎ','ギ','gi'],['ぐ','グ','gu'],['げ','ゲ','ge'],['ご','ゴ','go'],
  ['ざ','ザ','za'],['じ','ジ','ji'],['ず','ズ','zu'],['ぜ','ゼ','ze'],['ぞ','ゾ','zo'],
  ['だ','ダ','da'],['ぢ','ヂ','ji'],['づ','ヅ','zu'],['で','デ','de'],['ど','ド','do'],
  ['ば','バ','ba'],['び','ビ','bi'],['ぶ','ブ','bu'],['べ','ベ','be'],['ぼ','ボ','bo'],
  ['ぱ','パ','pa'],['ぴ','ピ','pi'],['ぷ','プ','pu'],['ぺ','ペ','pe'],['ぽ','ポ','po']
];

const combos = [
  ['きゃ','キャ','kya'],['きゅ','キュ','kyu'],['きょ','キョ','kyo'],
  ['しゃ','シャ','sha'],['しゅ','シュ','shu'],['しょ','ショ','sho'],
  ['ちゃ','チャ','cha'],['ちゅ','チュ','chu'],['ちょ','チョ','cho'],
  ['にゃ','ニャ','nya'],['にゅ','ニュ','nyu'],['にょ','ニョ','nyo'],
  ['ひゃ','ヒャ','hya'],['ひゅ','ヒュ','hyu'],['ひょ','ヒョ','hyo'],
  ['みゃ','ミャ','mya'],['みゅ','ミュ','myu'],['みょ','ミョ','myo'],
  ['りゃ','リャ','rya'],['りゅ','リュ','ryu'],['りょ','リョ','ryo'],
  ['ぎゃ','ギャ','gya'],['ぎゅ','ギュ','gyu'],['ぎょ','ギョ','gyo'],
  ['じゃ','ジャ','ja'],['じゅ','ジュ','ju'],['じょ','ジョ','jo'],
  ['びゃ','ビャ','bya'],['びゅ','ビュ','byu'],['びょ','ビョ','byo'],
  ['ぴゃ','ピャ','pya'],['ぴゅ','ピュ','pyu'],['ぴょ','ピョ','pyo']
];

const make = (items, group, start) => items.flatMap(([h, k, romaji], i) => [
  { id: `h-${h}`, char: h, pair: k, romaji, script: 'hiragana', group, order: start + i },
  { id: `k-${k}`, char: k, pair: h, romaji, script: 'katakana', group, order: start + i }
]);

const basics = basicRows.flat();
export const kana = [
  ...make(basics, 'base', 0),
  ...make(voiced, 'voiced', basics.length),
  ...make(combos, 'combo', basics.length + voiced.length)
];

export const stages = [
  { id: 'voyelles', label: 'Voyelles', emoji: '🌱', filter: k => k.group === 'base' && k.order < 5 },
  { id: 'k-s', label: 'K & S', emoji: '🍙', filter: k => k.group === 'base' && k.order >= 5 && k.order < 15 },
  { id: 't-n', label: 'T & N', emoji: '🎋', filter: k => k.group === 'base' && k.order >= 15 && k.order < 25 },
  { id: 'h-m', label: 'H & M', emoji: '🌸', filter: k => k.group === 'base' && k.order >= 25 && k.order < 35 },
  { id: 'y-r-w', label: 'Y, R, W & N', emoji: '🗻', filter: k => k.group === 'base' && k.order >= 35 },
  { id: 'voiced', label: 'Sons voisés', emoji: '⚡', filter: k => k.group === 'voiced' },
  { id: 'combo', label: 'Combinaisons', emoji: '🚀', filter: k => k.group === 'combo' }
];

export const getStageKana = (stageId, script = 'both') => {
  const stage = stages.find(s => s.id === stageId) || stages[0];
  return kana.filter(k => stage.filter(k) && (script === 'both' || k.script === script));
};
