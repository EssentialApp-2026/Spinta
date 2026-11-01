// Prova del passaggio «creatore → Studio» (Spinta 3.1): il video creato passa dallo Studio in automatico, passo passo o per niente.
//   cd <repository Spinta> && python3 -m http.server 8765 --bind 127.0.0.1 &
//   node claude/prova-studio.js <video 9:16 WebM con audio basso> <copertina JPG> <cartella per le schermate> [video con audio a volume giusto]
// Il video del creatore è simulato (crResult con un video di prova): si prova lo Studio, non il montaggio del creatore.
// Serve Playwright (require('playwright')). Il Chromium di Playwright non legge H.264: per questo il video di prova è WebM.
const { chromium } = require('playwright');
const fs = require('fs');
const [VIDEO, COVER, OUT, FORTE] = process.argv.slice(2);
const BASE = 'http://127.0.0.1:8765/spinta.html';
const attendi = ms => new Promise(r => setTimeout(r, ms));
const esiti = [];
const ok = (nome, cond, info) => { esiti.push([nome, !!cond]); console.log((cond ? 'OK   ' : 'NO   ') + nome + (info !== undefined ? ' → ' + (typeof info === 'string' ? info : JSON.stringify(info)) : '')) };

const RIGHE = ['Uè guagliù, tre app e una sola va sul banco!', 'A: dividi il conto in pizzeria.', 'B: il timer per la moka.', 'C: la lista della spesa a voce.', 'Votate A, B o C nei commenti fino a mercoledì!'];

async function pagina(b) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'it-IT', serviceWorkers: 'block' });
  await ctx.route(/fonts\.googleapis|fonts\.gstatic|cdn\.jsdelivr|huggingface/, x => x.abort());
  await ctx.route(/api\.github\.com/, x => x.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await ctx.route(/\/prova-video\.webm$/, x => x.fulfill({ status: 200, contentType: 'video/webm', body: fs.readFileSync(VIDEO) }));
  if (FORTE) await ctx.route(/\/prova-video-forte\.webm$/, x => x.fulfill({ status: 200, contentType: 'video/webm', body: fs.readFileSync(FORTE) }));
  await ctx.route(/\/prova-copertina\.jpg$/, x => x.fulfill({ status: 200, contentType: 'image/jpeg', body: fs.readFileSync(COVER) }));
  const p = await ctx.newPage();
  p.errori = [];
  p.on('pageerror', e => p.errori.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) p.errori.push('console: ' + m.text()) });
  await p.goto(BASE); await attendi(700);
  await p.click('#hero h1');   // un tocco vero sulla pagina, come sul telefono quando si tocca «Crea il video»
  await p.evaluate(() => creaApri()); await p.waitForFunction(() => !!window.crOpenWith, null, { timeout: 15000 });
  return { ctx, p };
}

// finta uscita del creatore: video di prova, copertina, stato con le frasi e i loro tempi
async function creato(p, impost, file) {
  await p.evaluate(async ({ RIGHE, impost, file }) => {
    const blob = await (await fetch(file || 'prova-video.webm')).blob(), cover = await (await fetch('prova-copertina.jpg')).blob();
    crOpen(false);
    DB.creator = Object.assign(crSet(), impost); save();
    const s = crSet(), ser = curSeries();
    let t = 0.08; const items = RIGHE.map((text, i) => { const d = 2.2, w = text.split(/\s+/), h = Math.ceil(w.length / 2);
      const it = { i, text, s: t, e: t + d, pages: [{ s: t, e: t + d / 2, w: w.slice(0, h) }, { s: t + d / 2, e: t + d, w: w.slice(h) }], shot: null }; t += d + 0.12; return it });
    const st = { ser, ep: ser ? ser.ep : null, hook: crClean(RIGHE[0]), endTxt: 'Vota A, B o C nei commenti 👇', tipo: 'idee', app: '', X: 'A', total: 12, items };
    crResult({ blob, type: 'video/webm', cover }, st, RIGHE, s);
  }, { RIGHE, impost, file });
}
const prontoStudio = p => p.waitForFunction(() => typeof VA !== 'undefined' && VA && VA.score && document.querySelector('#s2').dataset.state !== 'locked', null, { timeout: 90000 });
const leggi = p => p.evaluate(() => {
  const c = id => { const e = document.getElementById(id); return e ? { on: e.checked, dis: e.disabled } : null };
  return {
    modale: document.getElementById('m-crea').classList.contains('on'), tab: document.querySelector('#nav button.on') && document.querySelector('#nav button.on').dataset.t,
    box: document.getElementById('st-auto').innerText, boxVis: document.getElementById('st-auto').style.display !== 'none',
    out: document.getElementById('v-out').innerText, cap: (document.getElementById('a-cap') || {}).value || '',
    hookBox: (document.getElementById('a-hookbox') || {}).style ? document.getElementById('a-hookbox').style.display : '?', hookFatto: !!document.getElementById('a-hookfatto'),
    hookEdit: (document.getElementById('a-hookedit') || {}).value || '', steps: document.getElementById('a-steps').innerText,
    opz: Object.fromEntries(['o-trim', 'o-pause', 'o-speed', 'o-crop', 'o-light', 'o-vol', 'o-hook', 'o-subs', 'o-part', 'o-end', 'o-bar'].map(k => [k, c(k)])),
    score: VA && VA.score ? VA.score.total : null, prima: VA ? VA.scoreBefore : null, transcript: VA ? VA.transcript : '', subs: VA && VA.subs ? VA.subs.length : 0, hasSubs: VA ? VA.hasSubs : null,
    pkg: DB.lastPkg, cover: (document.getElementById('v-out').innerText.match(/Copertina \(([^)]*)\)/) || [])[1] || ''
  }
});

(async () => {
  const b = await chromium.launch();

  // 1. scelta nel creatore: c'è, parte da «automatico» e si salva
  {
    const { ctx, p } = await pagina(b);
    await p.evaluate(() => { delete DB.creator; save(); crOpen(false) }); await attendi(300);
    const v0 = await p.evaluate(() => ({ val: document.getElementById('cr-studio').value, opz: [...document.querySelectorAll('#cr-studio-seg button')].map(o => o.dataset.v), on: document.querySelector('#cr-studio-seg button.on').dataset.v, d: document.getElementById('cr-studio-d').textContent }));
    ok('creatore: scelta presente, predefinita «auto»', v0.val === 'auto' && v0.on === 'auto' && v0.opz.join() === 'auto,manuale,no' && /da solo/.test(v0.d), v0);
    await p.click('#cr-studio-seg button[data-v="manuale"]'); await attendi(150);
    const v1 = await p.evaluate(() => ({ db: DB.creator.studio, on: document.querySelector('#cr-studio-seg button.on').dataset.v }));
    ok('creatore: la scelta si salva', v1.db === 'manuale' && v1.on === 'manuale', v1);
    await p.evaluate(() => { crClose(); crOpen(false) }); await attendi(200);
    ok('creatore: riaperto, ricorda la scelta', await p.evaluate(() => document.querySelector('#cr-studio-seg button.on').dataset.v) === 'manuale');
    await p.locator('#cr-studio-seg').scrollIntoViewIfNeeded(); await attendi(200);
    await p.screenshot({ path: OUT + '/1-creatore-scelta.png' });
    ok('pagina senza errori (1)', !p.errori.length, p.errori.join(' | '));
    await ctx.close();
  }

  // 2. automatico, video del creatore con i sottotitoli: niente da ricodificare, lo Studio controlla e prepara la pubblicazione
  {
    const { ctx, p } = await pagina(b);
    await p.evaluate(() => { const s = { id: 'serie1', name: "'O Bancariello", tag: '#obancariello', ep: 7 }; DB.series = [s]; DB.serSel = 'serie1'; save() });
    await creato(p, { studio: 'auto', subs: true, bar: true });
    await attendi(150);
    ok('auto: il creatore dice che passa allo Studio', /Video creato/.test(await p.evaluate(() => document.getElementById('cr-out').innerText)));
    await prontoStudio(p);
    await p.waitForFunction(() => /Pronto:/.test(document.getElementById('st-auto').innerText), null, { timeout: 60000 });
    await attendi(1200);
    const r = await leggi(p);
    ok('auto: creatore chiuso, Studio aperto', !r.modale && r.tab === 'studio', { modale: r.modale, tab: r.tab });
    ok('auto: cinque passi fatti', (r.box.match(/✅/g) || []).length === 5 && !/⚠️|⏳/.test(r.box), r.box.replace(/\n+/g, ' | '));
    ok('auto: copione del creatore, niente trascrizione', r.transcript.startsWith('Uè guagliù') && r.subs === 10 && r.hasSubs === true, { subs: r.subs, hasSubs: r.hasSubs });
    ok('auto: hook non riscritto', r.hookFatto && r.hookBox === 'none' && !r.hookEdit && r.opz['o-hook'] && !r.opz['o-hook'].on, { hookBox: r.hookBox, hookEdit: r.hookEdit, o: r.opz['o-hook'] });
    ok('auto: niente doppioni né correzioni che toccano tempi e colori', ['o-trim', 'o-pause', 'o-speed', 'o-light', 'o-subs', 'o-part', 'o-end', 'o-bar'].every(k => !r.opz[k] || !r.opz[k].on), r.opz);
    ok('auto: caption del creatore', /Votate A, B o C/.test(r.cap) && /#obancariello/.test(r.cap), r.cap);
    ok('auto: video pronto da pubblicare', /Video pronto/.test(r.out) && /L'ho pubblicato/.test(r.out), r.out.slice(0, 160).replace(/\n/g, ' | '));
    console.log('     audio', JSON.stringify(await p.evaluate(() => ({ loud: VA.audio && Math.round(VA.audio.loud * 10) / 10, sug: VA.sug }))));
    ok('auto: copertina del creatore', r.cover === "dal creatore, con l'hook", r.cover);
    ok('auto: pacchetto con punteggio e hook del creatore', r.pkg && r.pkg.made === 'creatore' && r.pkg.title.startsWith('Uè guagliù') && typeof r.pkg.score === 'number' && r.pkg.f.hookW > 0 && r.pkg.f.end === true && r.pkg.series && r.pkg.series.ep === 7,
      r.pkg && { made: r.pkg.made, title: r.pkg.title, hk: r.pkg.hk, score: r.pkg.score, f: r.pkg.f });
    console.log('     punteggio', r.prima, '→', r.score);
    await p.evaluate(() => window.scrollTo(0, 0)); await attendi(300);
    await p.screenshot({ path: OUT + '/2-auto-studio.png' });
    await p.evaluate(() => { stpOpen(3, true); document.getElementById('s3').scrollIntoView() }); await attendi(400);
    await p.screenshot({ path: OUT + '/3-auto-passo3.png' });
    await p.evaluate(() => document.getElementById('v-out').scrollIntoView()); await attendi(300);
    await p.screenshot({ path: OUT + '/4-auto-pubblica.png' });
    // pubblicazione: registra il video con il punteggio dello Studio e passa alla puntata dopo
    await p.click('#v-out .pub-btn'); await attendi(300);
    const pub = await p.evaluate(() => ({ pend: DB.pending[DB.pending.length - 1], ep: DB.series[0].ep }));
    ok('auto: «L\'ho pubblicato» registra il video', pub.pend && pub.pend.score === r.pkg.score && pub.ep === 8 && pub.pend.hk === r.pkg.hk, pub.pend && { score: pub.pend.score, hk: pub.pend.hk, ep: pub.ep });
    ok('pagina senza errori (2)', !p.errori.length, p.errori.join(' | '));
    await ctx.close();
  }

  // 2b. automatico con l'audio già a volume giusto (come i video veri del creatore): niente da ricodificare, il file resta quello del creatore
  if (FORTE) {
    const { ctx, p } = await pagina(b);
    await creato(p, { studio: 'auto', subs: true, bar: true }, 'prova-video-forte.webm');
    await prontoStudio(p);
    await p.waitForFunction(() => /Pronto:|⚠️/.test(document.getElementById('st-auto').innerText), null, { timeout: 60000 });
    await attendi(800);
    const r = await leggi(p), loud = await p.evaluate(() => VA.audio && Math.round(VA.audio.loud * 10) / 10);
    const stesso = await p.evaluate(() => window._spintaFile && vFile && window._spintaFile.size === vFile.size);
    ok('auto, audio giusto: nessuna ricodifica, file del creatore', /senza ricodificarlo/.test(r.box) && /nessuna modifica/.test(r.out) && stesso, { loud, stesso, out: r.out.slice(0, 80).replace(/\n/g, ' | ') });
    await p.evaluate(() => window.scrollTo(0, 0)); await attendi(300);
    await p.screenshot({ path: OUT + '/2b-auto-senza-ricodifica.png' });
    ok('pagina senza errori (2b)', !p.errori.length, p.errori.join(' | '));
    await ctx.close();
  }

  // 3. automatico, video del creatore SENZA sottotitoli: lo Studio li aggiunge dai tempi del copione e ricodifica
  {
    const { ctx, p } = await pagina(b);
    await creato(p, { studio: 'auto', subs: false, bar: true });
    await prontoStudio(p);
    await p.waitForFunction(() => /Pronto:|⚠️/.test(document.getElementById('st-auto').innerText), null, { timeout: 120000 });
    await attendi(800);
    const r = await leggi(p);
    ok('auto senza sottotitoli: aggiunti dallo Studio', r.opz['o-subs'] && r.opz['o-subs'].on && /sottotitoli/.test(r.out) && /Pronto:/.test(r.box), { subs: r.opz['o-subs'], box: r.box.replace(/\n+/g, ' | ') });
    const dur = await p.evaluate(() => new Promise(res => { const v = document.querySelector('#v-out video'); if (!v) return res(null); const f = () => res(v.duration); if (v.readyState >= 1) f(); else v.addEventListener('loadedmetadata', f, { once: true }); setTimeout(() => res(v.duration), 5000) }));
    ok('auto senza sottotitoli: video finale intero', dur && dur > 10.5 && dur < 13.5, dur);
    await p.evaluate(() => document.getElementById('v-out').scrollIntoView()); await attendi(300);
    await p.screenshot({ path: OUT + '/5-auto-sottotitoli.png' });
    ok('pagina senza errori (3)', !p.errori.length, p.errori.join(' | '));
    await ctx.close();
  }

  // 4. passo passo: tutto pronto nei passi, ma niente esportazione da sola
  {
    const { ctx, p } = await pagina(b);
    await creato(p, { studio: 'manuale', subs: true, bar: true });
    await prontoStudio(p); await attendi(2500);
    const r = await leggi(p);
    ok('manuale: Studio pronto, si ferma ai passi', r.boxVis && /lo controlli tu/.test(r.box) && !/Video pronto/.test(r.out) && !r.modale, { box: r.box.slice(0, 60), out: r.out.slice(0, 60) });
    ok('manuale: caption e copione già pronti', /Votate A, B o C/.test(r.cap) && r.transcript.startsWith('Uè') && /Copione del creatore/.test(r.steps));
    // conferma l'argomento a mano: rifà la caption ma non scrive l'hook una seconda volta
    await p.evaluate(() => { stpOpen(3, true); document.getElementById('a-topic').value = 'app gratis'; regenPkg(false) }); await attendi(300);
    const r2 = await leggi(p);
    ok('manuale: argomento confermato, hook non doppiato', !r2.opz['o-hook'].on && !r2.hookEdit, r2.opz['o-hook']);
    await p.evaluate(() => window.scrollTo(0, 0)); await attendi(300);
    await p.screenshot({ path: OUT + '/6-manuale.png' });
    await p.evaluate(() => exportVideo());
    const fatto = await p.waitForFunction(() => /Video pronto/.test(document.getElementById('v-out').innerText), null, { timeout: 60000 }).then(() => true, () => false);
    ok('manuale: «Crea il video finale» funziona', fatto);
    ok('pagina senza errori (4)', !p.errori.length, p.errori.join(' | '));
    await ctx.close();
  }

  // 5. nessuno: il video resta nel creatore, pronto da pubblicare, con i pulsanti per passarlo allo Studio
  {
    const { ctx, p } = await pagina(b);
    await creato(p, { studio: 'no', subs: true, bar: true }); await attendi(1500);
    const r = await p.evaluate(() => ({ modale: document.getElementById('m-crea').classList.contains('on'), cr: document.getElementById('cr-out').innerText, studio: !!vFile }));
    ok('nessuno: resta nel creatore, Studio non toccato', r.modale && /Video pronto/.test(r.cr) && /Migliora nello Studio/.test(r.cr) && /Passo passo/.test(r.cr) && !r.studio, { modale: r.modale, studio: r.studio });
    await p.locator('#cr-out').scrollIntoViewIfNeeded(); await attendi(200);
    await p.screenshot({ path: OUT + '/7-nessuno.png' });
    await p.click('#cr-out button:has-text("Migliora nello Studio")');
    await prontoStudio(p);
    await p.waitForFunction(() => /Pronto:/.test(document.getElementById('st-auto').innerText), null, { timeout: 60000 });
    ok('nessuno → «Migliora nello Studio» fa il giro automatico', true);
    ok('pagina senza errori (5)', !p.errori.length, p.errori.join(' | '));
    await ctx.close();
  }

  // 6. controllo della caption
  {
    const { ctx, p } = await pagina(b);
    const c = await p.evaluate(() => {
      const r1 = capSistema('Parte 3 · Gennarino cambia piazza\n\n#a #b #c #d #e #f #g');
      const r2 = capSistema('Votate nei commenti 👇\n\n#obancariello #napoli');
      const r3 = capSistema('Gennarino al mercato');
      return { r1, r2, r3, max: RULES.hashtag.max };
    });
    ok('caption: hashtag entro il massimo e invito aggiunto', (c.r1.match(/#/g) || []).length === c.max && /\?|comment|ditemelo|dimmi|scrivete/i.test(c.r1) && c.r1.indexOf('#') > c.r1.search(/comment|\?/i), c.r1);
    ok('caption: quella già buona non cambia', c.r2 === 'Votate nei commenti 👇\n\n#obancariello #napoli', c.r2);
    ok('caption: senza hashtag li aggiunge', /#/.test(c.r3) && /\?|comment|ditemelo|dimmi|scrivete/i.test(c.r3), c.r3);
    ok('pagina senza errori (6)', !p.errori.length, p.errori.join(' | '));
    await ctx.close();
  }

  await b.close();
  const no = esiti.filter(x => !x[1]);
  console.log(`\n${esiti.length - no.length}/${esiti.length} controlli superati${no.length ? ' · NON superati: ' + no.map(x => x[0]).join('; ') : ''}`);
  process.exit(no.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2) });
