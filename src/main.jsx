import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { kana, stages, getStageKana } from './kana.js';
import { getWordsForKana } from './words.js';
import { recognizeKana } from './recognizer.js';
import './styles.css';

const STORE = 'kana-pop-v1';
const defaults = { xp: 0, streak: 0, lastDay: '', seen: {}, mastered: {}, script: 'both', sound: true };
const load = () => { try { return { ...defaults, ...JSON.parse(localStorage.getItem(STORE)) }; } catch { return defaults; } };
const shuffle = a => [...a].sort(() => Math.random() - .5);
// Chaque carte tire son sens de question : kana ↔ son, et mot → lecture, → sens ou ← français.
const wordAsks = ['reading', 'reading', 'meaning', 'word'];
const decorate = (cards, mode) => mode === 'words'
  ? cards.map(w => ({ ...w, ask: wordAsks[Math.floor(Math.random() * wordAsks.length)] }))
  : cards.map(k => ({ ...k, dir: Math.random() < .5 ? 'toKana' : 'toRomaji' }));
const day = () => new Date().toISOString().slice(0, 10);

function speak(text) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const voices = speechSynthesis.getVoices();
  const japaneseVoices = voices.filter(v => v.lang?.toLowerCase().startsWith('ja'));
  const naturalVoice = japaneseVoices.find(v =>
    /enhanced|premium|kyoko|nanami|haruka|google|microsoft/i.test(v.name)
  ) || japaneseVoices.find(v => v.localService) || japaneseVoices[0];
  const u = new SpeechSynthesisUtterance(`${text}。`);
  u.lang = 'ja-JP';
  u.rate = .62;
  u.pitch = 1.04;
  u.volume = 1;
  if (naturalVoice) u.voice = naturalVoice;
  speechSynthesis.speak(u);
}

function App() {
  const [data, setData] = useState(load);
  const [view, setView] = useState('home');
  const [stage, setStage] = useState(['voyelles']);
  const [selectedStages, setSelectedStages] = useState(['voyelles']);
  const [trainingMode, setTrainingMode] = useState('quiz');
  const [session, setSession] = useState(null);
  const [toast, setToast] = useState('');
  useEffect(() => localStorage.setItem(STORE, JSON.stringify(data)), [data]);
  useEffect(() => { if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js'); }, []);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(''), 1800); return () => clearTimeout(t); } }, [toast]);

  const activeKana = kana.filter(k => data.script === 'both' || k.script === data.script);
  const mastered = activeKana.filter(k => data.mastered[k.id]).length;
  const totalForScript = data.script === 'both' ? kana.length : kana.length / 2;
  const pct = Math.round(mastered / totalForScript * 100);
  const scriptName = data.script === 'hiragana' ? 'Hiragana' : data.script === 'katakana' ? 'Katakana' : 'Mixte';
  const wordCount = useMemo(
    () => getWordsForKana(selectedStages.flatMap(id => getStageKana(id, data.script))).length,
    [selectedStages, data.script]
  );

  function start(stageIds = selectedStages) {
    const ids = Array.isArray(stageIds) ? stageIds : [stageIds];
    const stageKana = ids.flatMap(id => getStageKana(id, data.script));
    const pool = trainingMode === 'words' ? getWordsForKana(stageKana) : stageKana;
    if (!pool.length) { setToast('Aucun mot ne tient avec ces kana : ajoute un module 🌱'); return; }
    const weak = pool.filter(k => !data.mastered[k.id]);
    const cards = decorate(shuffle(weak.length >= 4 ? weak : pool), trainingMode);
    setStage(ids);
    setSession({ mode: trainingMode, pool, cards, index: 0, score: 0, answered: false, selected: null, misses: {} });
    setView('play');
  }

  function answer(choice, meta = {}) {
    if (session.answered) return;
    const card = session.cards[session.index];
    const ok = choice === expected;
    setSession(s => ({
      ...s, answered: true, selected: choice, score: s.score + (ok ? 1 : 0),
      drawnScript: meta.drawnScript || null,
      misses: ok ? s.misses : { ...s.misses, [card.id]: (s.misses[card.id] || 0) + 1 }
    }));
    setData(d => ({
      ...d, xp: d.xp + (ok ? 10 : 2),
      seen: { ...d.seen, [card.id]: (d.seen[card.id] || 0) + 1 },
      mastered: ok && (d.seen[card.id] || 0) >= 1 ? { ...d.mastered, [card.id]: true } : d.mastered
    }));
    if (data.sound) setTimeout(() => speak(card.char), 0);
  }

  function gradeDrawing(ok, drawnScript = null) {
    if (!current || session.answered) return;
    answer(ok ? current.romaji : '__drawing_retry__', { drawnScript });
  }

  function next() {
    if (session.index + 1 >= session.cards.length) {
      setSession(s => {
        const retry = s.pool.filter(k => s.misses[k.id]);
        const weak = s.pool.filter(k => !data.mastered[k.id]);
        const refill = decorate(shuffle([...retry, ...weak, ...shuffle(s.pool)]).slice(0, Math.max(10, Math.min(20, s.pool.length))), s.mode);
        return { ...s, cards: [...s.cards, ...refill], index: s.index + 1, answered: false, selected: null };
      });
    } else setSession(s => ({ ...s, index: s.index + 1, answered: false, selected: null }));
  }

  function finishSession() {
    const today = day();
    if (session?.index >= 4) setData(d => ({ ...d, streak: d.lastDay === today ? d.streak : d.streak + 1, lastDay: today }));
    setView('result');
  }

  const current = session?.cards[session.index];
  const challengeMode = session?.mode === 'mixed'
    ? (session.index % 2 === 0 ? 'quiz' : 'draw')
    : session?.mode;
  const isWordSession = session?.mode === 'words';
  const direction = isWordSession
    ? current?.ask === 'meaning' ? 'toMeaning' : current?.ask === 'word' ? 'toWord' : 'toRomaji'
    : challengeMode === 'draw' || current?.dir !== 'toKana' ? 'toRomaji' : 'toKana';
  const expected = !current ? null
    : direction === 'toKana' || direction === 'toWord' ? current.char
      : direction === 'toMeaning' ? current.fr : current.romaji;
  const isCorrect = Boolean(session?.answered && current && session.selected === expected);
  const promptText = isWordSession
    ? direction === 'toMeaning' ? 'Que veut dire ce mot ?' : direction === 'toWord' ? "Comment s'écrit ce mot ?" : 'Comment se lit ce mot ?'
    : direction === 'toKana' ? 'Quel kana fait ce son ?' : 'Quel son fait ce kana ?';
  const cardFace = !current ? ''
    : direction === 'toKana' ? current.romaji : direction === 'toWord' ? current.fr : current.char;
  // La carte fait 230px : on réduit la police selon la longueur de la face.
  const faceSize = direction === 'toWord'
    ? cardFace.length > 12 ? 'xs' : cardFace.length > 6 ? 'sm' : ''
    : cardFace.length > 4 ? 'xs' : cardFace.length > 2 ? 'sm' : cardFace.length > 1 ? 'md' : '';
  const cardClass = `${isWordSession ? 'word' : ''} ${direction === 'toWord' ? 'fr' : direction === 'toKana' ? 'romaji' : ''} ${faceSize}`;
  useEffect(() => {
    if (!isCorrect) return;
    const timer = setTimeout(next, 700);
    return () => clearTimeout(timer);
  }, [isCorrect, session?.index]);
  useEffect(() => {
    if (view !== 'play' || !session?.answered) return;
    const handleEnter = event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', handleEnter);
    return () => window.removeEventListener('keydown', handleEnter);
  }, [view, session?.answered, session?.index]);

  function toggleStage(stageId) {
    setSelectedStages(current =>
      current.includes(stageId)
        ? current.length === 1 ? current : current.filter(id => id !== stageId)
        : [...current, stageId]
    );
  }

  const choices = useMemo(() => {
    if (!current) return [];
    const field = direction === 'toKana' || direction === 'toWord' ? 'char' : direction === 'toMeaning' ? 'fr' : 'romaji';
    const others = session.pool.filter(k => k.romaji !== current.romaji && k[field] !== expected);
    const distractors = [...new Set(others.map(k => k[field]))];
    return shuffle([expected, ...shuffle(distractors).slice(0, 3)]);
  }, [current, session?.pool, direction]);

  return <div className="app">
    <header>
      <button className="brand" onClick={() => setView('home')} aria-label="Accueil"><span>か</span> Kana Pop</button>
      <div className="stats"><span title="Série">🔥 {data.streak}</span><span title="Points">✨ {data.xp}</span></div>
    </header>

    <main>
      {view === 'home' && <>
        <section className="hero">
          <div className="eyebrow">日本語 • 5 MIN PAR JOUR</div>
          <h1>Les kana,<br/><em>ça va popper.</em></h1>
          <p>Reconnais, écoute, répète. Des sessions ultra-courtes pour mémoriser sans t'ennuyer.</p>
          <div className="script-picker" aria-label="Alphabet à apprendre">
            <button className={data.script === 'hiragana' ? 'active' : ''} onClick={() => setData(d => ({ ...d, script: 'hiragana' }))}><b>あ</b><span>Hiragana</span></button>
            <button className={data.script === 'katakana' ? 'active' : ''} onClick={() => setData(d => ({ ...d, script: 'katakana' }))}><b>ア</b><span>Katakana</span></button>
            <button className={data.script === 'both' ? 'active' : ''} onClick={() => setData(d => ({ ...d, script: 'both' }))}><b>あア</b><span>Mixte</span></button>
          </div>
          <div className="mode-picker" aria-label="Type d'exercice">
            <button className={trainingMode === 'quiz' ? 'active' : ''} onClick={() => setTrainingMode('quiz')}><b>👀</b><span>Reconnaître</span></button>
            <button className={trainingMode === 'draw' ? 'active' : ''} onClick={() => setTrainingMode('draw')}><b>✍️</b><span>Écrire</span></button>
            <button className={trainingMode === 'mixed' ? 'active' : ''} onClick={() => setTrainingMode('mixed')}><b>⚡</b><span>Les deux</span></button>
            <button className={trainingMode === 'words' ? 'active' : ''} onClick={() => setTrainingMode('words')}><b>📖</b><span>Mots</span></button>
          </div>
          {trainingMode === 'words' && <p className="mode-hint">{wordCount ? `${wordCount} mots lisibles avec les modules sélectionnés.` : 'Sélectionne plus de modules pour débloquer des mots.'}</p>}
          <button className="primary big" onClick={() => start()}>Spammer la sélection <b>∞</b></button>
        </section>
        <section className="progress-card">
          <div className="ring" style={{'--p': `${pct * 3.6}deg`}}><div><b>{mastered}</b><small>/ {totalForScript}</small></div></div>
          <div><h2>Collection {scriptName}</h2><p>{pct ? `${pct}% du parcours maîtrisé. Continue !` : 'Chaque bonne réponse fait grandir ta collection.'}</p></div>
          <button className="icon-btn" onClick={() => setView('grid')} aria-label="Voir la collection">⌁</button>
        </section>
        <div className="section-title"><div><span>PARCOURS {scriptName.toUpperCase()}</span><h2>Choisis ton niveau</h2></div><button onClick={() => setView('grid')}>Voir les kana</button></div>
        <section className="path">
          {stages.map((s, i) => {
            const ks = getStageKana(s.id, data.script), done = ks.filter(k => data.mastered[k.id]).length;
            const selected = selectedStages.includes(s.id);
            return <button className={`stage ${selected ? 'selected' : ''}`} key={s.id} onClick={() => toggleStage(s.id)} aria-pressed={selected}>
              <div className="stage-icon">{s.emoji}</div><div className="stage-copy"><small>ÉTAPE {i + 1}</small><h3>{s.label}</h3><span>{done}/{ks.length} maîtrisés</span></div>
              <div className="stage-check">{selected ? '✓' : '+'}</div>
            </button>;
          })}
          <button className="primary selection-cta" onClick={() => start()}>{selectedStages.length === 1 ? 'Réviser ce module' : `Réviser ${selectedStages.length} modules`} <b>∞</b></button>
        </section>
      </>}

      {view === 'grid' && <Grid data={data} setData={setData} back={() => setView('home')} />}

      {view === 'play' && current && <section className="play">
        <div className="play-top"><button className="close" onClick={finishSession}>×</button><div className="bar"><i style={{width:`${((session.index % 10) + 1) * 10}%`}}/></div><span>∞ {session.index + 1}</span></div>
        {challengeMode === 'draw'
          ? <DrawChallenge key={`${current.id}-${session.index}`} card={current} answered={session.answered} allowEither={data.script === 'both'} onGrade={gradeDrawing} />
          : <>
            <div className="prompt">{promptText}</div>
            <button className={`kana-card ${cardClass}`} onClick={() => direction !== 'toWord' && speak(current.char)}><span>{cardFace}</span><small>{direction === 'toWord' ? '✏️ Retrouve l’écriture' : '🔊 Écouter'}</small></button>
            <div className={`choices ${direction === 'toKana' ? 'kana-choices' : ''} ${direction === 'toWord' ? 'word-choices' : ''} ${direction === 'toMeaning' ? 'text-choices' : ''}`}>
              {choices.map(c => <button key={c} className={session.answered ? c === expected ? 'right' : c === session.selected ? 'wrong' : '' : ''} onClick={() => answer(c)}>{c}</button>)}
            </div>
          </>}
        <div className={`feedback ${session.answered ? 'show' : ''}`}>
          {session.answered && <><div><b>{isCorrect ? 'Bravo ! 🎉' : `C'était « ${expected} »`}</b><span>{isWordSession
            ? `${current.char} • ${current.romaji} • ${current.fr}`
            : <>{session.drawnScript ? `Tu as dessiné en ${session.drawnScript} • ` : ''}{current.script === 'hiragana' ? `Hiragana ${current.char} • Katakana ${current.pair}` : `Katakana ${current.char} • Hiragana ${current.pair}`} • {current.romaji}</>}</span></div>{isCorrect ? <span className="auto-next">Ça repart…</span> : <button onClick={next}>Encore →</button>}</>}
        </div>
      </section>}

      {view === 'result' && <section className="result">
        <div className="confetti">🎉</div><span>PAUSE BIEN MÉRITÉE</span><h1>{session.score}/{session.index + 1}</h1>
        <h2>{session.score >= 8 ? 'すごい！ Incroyable !' : session.score >= 5 ? 'Bien joué !' : 'Chaque essai compte !'}</h2>
        <p>{session.index + 1} {session.mode === 'words' ? 'mots lus' : 'kana révisés'} • le module n'est jamais terminé</p>
        <button className="primary big" onClick={() => start(stage)}>Continuer à spammer ∞</button>
        <button className="text-btn" onClick={() => setView('home')}>Retour au parcours</button>
      </section>}
    </main>
    {view === 'home' && <nav><button className="active">⌂<span>Parcours</span></button><button onClick={() => setView('grid')}>あ<span>Kana</span></button><button onClick={() => { setToast('Objectif : une session par jour 🔥'); }}>◎<span>Objectif</span></button></nav>}
    {toast && <div className="toast">{toast}</div>}
  </div>;
}

function DrawChallenge({ card, answered, allowEither, onGrade }) {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [recognition, setRecognition] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#202137';
  }, []);

  const point = event => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  function begin(event) {
    if (revealed || answered) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const ctx = canvasRef.current.getContext('2d');
    const p = point(event);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    setDrawing(true);
  }
  function move(event) {
    if (!drawing || revealed || answered) return;
    const p = point(event);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
  function clear() {
    const canvas = canvasRef.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setRecognition(null);
    setRevealed(false);
  }
  async function analyze() {
    if (recognizing || answered) return;
    setRecognizing(true);
    const candidates = [
      { char: hiragana, script: 'hiragana' },
      { char: katakana, script: 'katakana' }
    ];
    const result = await recognizeKana(canvasRef.current, candidates);
    setRecognition(result);
    setRecognizing(false);
    if (result.status !== 'recognized') return;
    setRevealed(true);
    const accepted = allowEither || result.script === card.script;
    setTimeout(() => onGrade(accepted, result.script), 350);
  }

  const scriptLabel = card.script === 'hiragana' ? 'hiragana' : 'katakana';
  const hiragana = card.script === 'hiragana' ? card.char : card.pair;
  const katakana = card.script === 'katakana' ? card.char : card.pair;

  return <div className="draw-challenge">
    <div className="draw-prompt"><span>{allowEither ? <><strong>Hiragana ou katakana</strong> acceptés</> : <>Dessine en <strong>{scriptLabel}</strong></>}</span><button onClick={() => speak(card.char)}>🔊 Son : <b>{card.romaji}</b></button></div>
    <div className="draw-board">
      <canvas ref={canvasRef} onPointerDown={begin} onPointerMove={move} onPointerUp={() => setDrawing(false)} onPointerCancel={() => setDrawing(false)} />
      <div className="guide-lines" aria-hidden="true" />
      {revealed && <div className="draw-answer">{recognition?.char || card.char}</div>}
    </div>
    {recognition?.status === 'empty' && <div className="recognition-message retry">Dessine quelque chose avant de vérifier.</div>}
    {recognition?.status === 'uncertain' && <div className="recognition-message retry">Je ne reconnais pas encore ce tracé. Efface et réessaie.</div>}
    {recognition?.status === 'recognized' && <div className={`recognition-message ${allowEither || recognition.script === card.script ? 'success' : 'failure'}`}>
      Détecté : <b>{recognition.char}</b> en {recognition.script} <small>{recognition.confidence}% de confiance</small>
    </div>}
    {revealed && <div className="writing-summary">
      <div className={allowEither || card.script === 'hiragana' ? 'expected' : ''}><small>{allowEither ? 'CHOIX VALIDE' : 'À DESSINER'} • hiragana</small><b>{hiragana}</b></div>
      <span>↔</span>
      <div className={allowEither || card.script === 'katakana' ? 'expected' : ''}><small>{allowEither ? 'CHOIX VALIDE' : 'À DESSINER'} • katakana</small><b>{katakana}</b></div>
    </div>}
    {!revealed && <div className="draw-actions"><button onClick={clear}>Effacer</button><button className="reveal" onClick={analyze} disabled={recognizing}>{recognizing ? 'Analyse…' : 'Vérifier mon dessin'}</button></div>}
  </div>;
}

function Grid({ data, setData, back }) {
  const [filter, setFilter] = useState(data.script === 'both' ? 'hiragana' : data.script);
  const list = kana.filter(k => k.script === filter);
  return <section className="grid-view">
    <div className="page-head"><button className="close" onClick={back}>←</button><div><small>TA COLLECTION</small><h1>Les 208 kana</h1></div></div>
    <p>92 kana de base + 50 variantes voisées + 66 combinaisons. Appuie sur une carte pour l'écouter.</p>
    <div className="tabs"><button className={filter === 'hiragana' ? 'active':''} onClick={() => setFilter('hiragana')}>Hiragana</button><button className={filter === 'katakana' ? 'active':''} onClick={() => setFilter('katakana')}>Katakana</button></div>
    <div className="kana-grid">{list.map(k => <button key={k.id} className={data.mastered[k.id] ? 'learned':''} onClick={() => speak(k.char)}><b>{k.char}</b><span>{k.romaji}</span>{data.mastered[k.id] && <i>✓</i>}</button>)}</div>
    <div className="settings"><h2>Réglages</h2><label>Je veux apprendre <select value={data.script} onChange={e => setData(d => ({...d, script:e.target.value}))}><option value="both">Les deux alphabets</option><option value="hiragana">Hiragana seulement</option><option value="katakana">Katakana seulement</option></select></label><label><span>Prononciation automatique</span><input type="checkbox" checked={data.sound} onChange={e => setData(d => ({...d, sound:e.target.checked}))}/></label></div>
  </section>;
}

createRoot(document.getElementById('root')).render(<App />);
