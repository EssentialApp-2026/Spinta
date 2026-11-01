// Prova vera dall'inizio alla fine: il creatore monta una puntata del piano (voce Mako dalla libreria) e lo Studio automatico la prepara.
//   cd <repository Spinta> && python3 -m http.server 8765 --bind 127.0.0.1 &
//   node claude/prova-puntata.js <cartella per le schermate> [indice della puntata nel piano, 0 = la prima]
// Il piano è quello della settimana in corso (la domenica quello della settimana che comincia domani), come sul telefono.
// Il Chromium di Playwright non legge né scrive H.264: il creatore monta in VP9/Opus (SPINTA_MB_CODECS, solo per le prove)
// e le clip MP4 della libreria qui non si vedono (sul telefono sì). Il resto è identico al telefono.
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2], IDX = +(process.argv[3] || 0);
const BASE = 'http://127.0.0.1:8765/spinta.html';
const attendi = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'it-IT', serviceWorkers: 'block' });
  await ctx.route(/fonts\.googleapis|fonts\.gstatic|cdn\.jsdelivr|huggingface/, x => x.abort());
  await ctx.route(/api\.github\.com/, x => x.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  const p = await ctx.newPage(), errori = [];
  p.on('pageerror', e => errori.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errori.push('console: ' + m.text().slice(0, 300)) });
  await p.goto(BASE); await attendi(800);
  await p.click('#hero h1');   // tocco vero sulla pagina
  // come sul telefono di Sam: la serie è impostata (PARTE N, hashtag della serie)
  await p.evaluate(() => { window.SPINTA_MB_CODECS = { v: 'vp9', a: 'opus' }; DB.series = [{ id: 'serie1', name: "'O Bancariello", tag: '#obancariello', ep: 12 }]; DB.serSel = 'serie1'; save() });
  await p.evaluate(i => creaCon({ week: i }), IDX);
  await p.waitForFunction(() => { const m = document.getElementById('m-crea'), t = document.getElementById('cr-txt'); return m && m.classList.contains('on') && t && t.value.trim().length > 20 }, null, { timeout: 30000 });
  await attendi(800);
  const copione = await p.evaluate(() => document.getElementById('cr-txt').value);
  console.log('PUNTATA', IDX, '\n' + copione + '\n');
  await p.click('#cr-studio-seg button[data-v="auto"]');
  const t0 = Date.now();
  await p.click('#cr-go');
  let ultimo = '';
  for (;;) {
    await attendi(5000);
    const s = await p.evaluate(() => ({ cr: (document.getElementById('cr-out') || {}).innerText || '', box: document.getElementById('st-auto').innerText, prog: document.getElementById('v-prog').innerText, out: document.getElementById('v-out').innerText }));
    const riga = (s.box ? s.box.split('\n').filter(x => /⏳|⚠️/.test(x) || /Pronto:/.test(x)).join(' ') || s.box.split('\n').slice(-2).join(' ') : s.prog || s.cr.split('\n')[0]).slice(0, 140);
    if (riga !== ultimo) { console.log(`${Math.round((Date.now() - t0) / 1000)} s · ${riga}`); ultimo = riga }
    if (/Pronto:/.test(s.box) || /Non sono riuscito|❌/.test(s.cr + s.out) || Date.now() - t0 > 9 * 60e3) break;
  }
  await attendi(1500);
  const r = await p.evaluate(() => ({
    voci: CR.vociInfo, tipo: CR.file && CR.file.type, mb: CR.file && (CR.file.size / 1048576).toFixed(1),
    made: VA && VA.made ? { righe: (VA.made.righe || []).length, hook: VA.made.hook, end: VA.made.end, subs: VA.made.subs, part: VA.made.part, bar: VA.made.bar, topic: VA.made.topic } : null,
    box: document.getElementById('st-auto').innerText,
    score: VA && VA.score ? { prima: VA.scoreBefore, dopo: VA.score.total, daMigliorare: VA.score.items.filter(i => i.pts < i.max * 0.8).map(i => `${i.k} ${i.pts}/${i.max}: ${i.msg}`) } : null,
    audio: VA && VA.audio ? { loud: Math.round(VA.audio.loud * 10) / 10, lead: VA.audio.lead, trail: Math.round(VA.audio.trail * 10) / 10, pause: VA.audio.pauses.length } : null,
    opz: (() => { const o = readOpts(); return Object.keys(o).filter(k => o[k] === true) })(),
    cap: (document.getElementById('a-cap') || {}).value, capCreatore: VA && VA.made ? VA.made.cap : '', pkg: DB.lastPkg && { title: DB.lastPkg.title, hk: DB.lastPkg.hk, score: DB.lastPkg.score, made: DB.lastPkg.made, len: DB.lastPkg.len, f: DB.lastPkg.f },
    out: document.getElementById('v-out').innerText.slice(0, 200)
  }));
  console.log(JSON.stringify(r, null, 1));
  // fotogrammi del video finale: si vede l'hook una volta sola, i sottotitoli una volta sola, il finale
  const fot = await p.evaluate(async () => {
    const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.src = window._resURL; document.body.appendChild(v);
    await new Promise(r => { v.onloadedmetadata = r; setTimeout(r, 8000) });
    const d = v.duration, ts = [0.6, 1.8, d * 0.3, d * 0.55, d * 0.8, d - 1.2], out = [];
    const c = document.createElement('canvas'); c.width = 270; c.height = 480; const x = c.getContext('2d');
    for (const t of ts) { await new Promise(r => { v.onseeked = r; v.currentTime = Math.max(0, Math.min(d - 0.05, t)); setTimeout(r, 4000) }); x.drawImage(v, 0, 0, 270, 480); out.push([t, c.toDataURL('image/jpeg', 0.85)]) }
    v.remove(); return { d, out }
  });
  console.log('durata del video finale', fot.d && fot.d.toFixed(2));
  fot.out.forEach(([t, u], i) => fs.writeFileSync(`${OUT}/fotogramma-${i + 1}-${t.toFixed(1)}s.jpg`, Buffer.from(u.split(',')[1], 'base64')));
  await p.evaluate(() => window.scrollTo(0, 0)); await attendi(300);
  await p.screenshot({ path: OUT + '/studio-automatico.png' });
  console.log('ERRORI PAGINA:', errori.length ? errori.join(' | ') : 'nessuno');
  await b.close();
})().catch(e => { console.error(e); process.exit(2) });
