import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { kana, stages, getStageKana } from './kana.js';
import './styles.css';

const STORE = 'kana-pop-v1';
const defaults = { xp: 0, streak: 0, lastDay: '', seen: {}, mastered: {}, script: 'both', sound: true };
const load = () => { try { return { ...defaults, ...JSON.parse(localStorage.getItem(STORE)) }; } catch { return defaults; } };
const shuffle = a => [...a].sort(() => Math.random() - .5);
const day = () => new Date().toISOString().slice(0, 10);

function speak(text) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ja-JP'; u.rate = .75;
  speechSynthesis.speak(u);
}

function App() {
  const [data, setData] = useState(load);
  const [view, setView] = useState('home');
  const [stage, setStage] = useState('voyelles');
  const [session, setSession] = useState(null);
  const [toast, setToast] = useState('');
  useEffect(() => localStorage.setItem(STORE, JSON.stringify(data)), [data]);
  useEffect(() => { if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js'); }, []);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(''), 1800); return () => clearTimeout(t); } }, [toast]);

  const mastered = Object.keys(data.mastered).length;
  const totalForScript = data.script === 'both' ? kana.length : kana.length / 2;
  const pct = Math.round(mastered / totalForScript * 100);

  function start(stageId, mode = 'quiz') {
    const pool = getStageKana(stageId, data.script);
    const weak = pool.filter(k => !data.mastered[k.id]);
    const cards = shuffle(weak.length >= 4 ? weak : pool);
    setStage(stageId);
    setSession({ mode: 'infinite', pool, cards, index: 0, score: 0, answered: false, selected: null, misses: {} });
    setView('play');
  }

  function answer(choice) {
    if (session.answered) return;
    const card = session.cards[session.index];
    const ok = choice === card.romaji;
    if (data.sound) speak(card.char);
    setSession(s => ({
      ...s, answered: true, selected: choice, score: s.score + (ok ? 1 : 0),
      misses: ok ? s.misses : { ...s.misses, [card.id]: (s.misses[card.id] || 0) + 1 }
    }));
    setData(d => ({
      ...d, xp: d.xp + (ok ? 10 : 2),
      seen: { ...d.seen, [card.id]: (d.seen[card.id] || 0) + 1 },
      mastered: ok && (d.seen[card.id] || 0) >= 1 ? { ...d.mastered, [card.id]: true } : d.mastered
    }));
  }

  function next() {
    if (session.index + 1 >= session.cards.length) {
      setSession(s => {
        const retry = s.pool.filter(k => s.misses[k.id]);
        const weak = s.pool.filter(k => !data.mastered[k.id]);
        const refill = shuffle([...retry, ...weak, ...shuffle(s.pool)]).slice(0, Math.max(10, Math.min(20, s.pool.length)));
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
  const choices = useMemo(() => {
    if (!current) return [];
    const relevantRomaji = [...new Set(
      session.pool
        .filter(k => k.romaji !== current.romaji)
        .map(k => k.romaji)
    )];
    return shuffle([current.romaji, ...shuffle(relevantRomaji).slice(0, 3)]);
  }, [current, session?.pool]);

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
          <button className="primary big" onClick={() => start(stages.find(s => getStageKana(s.id, data.script).some(k => !data.mastered[k.id]))?.id || 'voyelles')}>Spammer sans limite <b>∞</b></button>
          <div className="mascot" aria-hidden="true"><div className="face">あ</div><i>やった!</i></div>
        </section>
        <section className="progress-card">
          <div className="ring" style={{'--p': `${pct * 3.6}deg`}}><div><b>{mastered}</b><small>/ {totalForScript}</small></div></div>
          <div><h2>Ta collection</h2><p>{pct ? `${pct}% des kana maîtrisés. Continue !` : 'Chaque bonne réponse fait grandir ta collection.'}</p></div>
          <button className="icon-btn" onClick={() => setView('grid')} aria-label="Voir la collection">⌁</button>
        </section>
        <div className="section-title"><div><span>PARCOURS</span><h2>Choisis ton niveau</h2></div><button onClick={() => setView('grid')}>Voir les 208</button></div>
        <section className="path">
          {stages.map((s, i) => {
            const ks = getStageKana(s.id, data.script), done = ks.filter(k => data.mastered[k.id]).length;
            return <button className="stage" key={s.id} onClick={() => start(s.id)}>
              <div className="stage-icon">{s.emoji}</div><div className="stage-copy"><small>ÉTAPE {i + 1}</small><h3>{s.label}</h3><span>{done}/{ks.length} maîtrisés</span></div>
              <div className="mini-ring">{Math.round(done / ks.length * 100)}%</div>
            </button>;
          })}
        </section>
      </>}

      {view === 'grid' && <Grid data={data} setData={setData} back={() => setView('home')} />}

      {view === 'play' && current && <section className="play">
        <div className="play-top"><button className="close" onClick={finishSession}>×</button><div className="bar"><i style={{width:`${((session.index % 10) + 1) * 10}%`}}/></div><span>∞ {session.index + 1}</span></div>
        <div className="prompt">Quel son fait ce kana ?</div>
        <button className="kana-card" onClick={() => speak(current.char)}><span>{current.char}</span><small>🔊 Écouter</small></button>
        <div className="choices">
          {choices.map(c => <button key={c} className={session.answered ? c === current.romaji ? 'right' : c === session.selected ? 'wrong' : '' : ''} onClick={() => answer(c)}>{c}</button>)}
        </div>
        <div className={`feedback ${session.answered ? 'show' : ''}`}>
          {session.answered && <><div><b>{session.selected === current.romaji ? 'Bravo ! 🎉' : `C'était « ${current.romaji} »`}</b><span>{current.char} • {current.pair} • {current.romaji}</span></div><button onClick={next}>Encore →</button></>}
        </div>
      </section>}

      {view === 'result' && <section className="result">
        <div className="confetti">🎉</div><span>PAUSE BIEN MÉRITÉE</span><h1>{session.score}/{session.index + 1}</h1>
        <h2>{session.score >= 8 ? 'すごい！ Incroyable !' : session.score >= 5 ? 'Bien joué !' : 'Chaque essai compte !'}</h2>
        <p>{session.index + 1} kana révisés • le module n'est jamais terminé</p>
        <button className="primary big" onClick={() => start(stage)}>Continuer à spammer ∞</button>
        <button className="text-btn" onClick={() => setView('home')}>Retour au parcours</button>
      </section>}
    </main>
    {view === 'home' && <nav><button className="active">⌂<span>Parcours</span></button><button onClick={() => setView('grid')}>あ<span>Kana</span></button><button onClick={() => { setToast('Objectif : une session par jour 🔥'); }}>◎<span>Objectif</span></button></nav>}
    {toast && <div className="toast">{toast}</div>}
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
