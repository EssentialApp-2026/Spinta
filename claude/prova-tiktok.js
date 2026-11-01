// Prova di Spinta 3 con TikTok finto: accesso, scambio del codice, lettura dei dati, rinnovo del token, errori, schermate.
//   cd <repository Spinta> && python3 -m http.server 8765 --bind 127.0.0.1 &
//   node claude/prova-tiktok.js /cartella/per/le/schermate
// Serve Playwright (require('playwright')). TikTok è simulato con page.route: nessuna chiamata vera.
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2], BASE = 'http://127.0.0.1:8765/spinta.html';
const CK = 'sbawprova123456789', CS = 'segreto-di-prova-1234567890abcdef';
const ora = Math.floor(Date.now() / 1000);
let rnd = 7; const r = () => { rnd = (rnd * 16807) % 2147483647; return rnd / 2147483647 };
const VIDEO = [];
for (let i = 0; i < 32; i++) {
  const giorni = i === 0 ? 0.3 : i === 1 ? 1.2 : i * 2.1 + 0.5;
  const h = [11, 13, 18, 19, 20, 21, 12, 9][i % 8];
  const d = new Date((ora - giorni * 86400) * 1000); d.setHours(h, (i * 7) % 60, 0, 0);
  const v = Math.round(Math.exp(7.4 + (r() - .5) * 2.2) * (h >= 19 ? 1.6 : 1) * (i === 9 ? 6 : 1));
  VIDEO.push({ id: '7' + String(4200000000000 + i), title: '', video_description: `Puntata ${32 - i} – ${['la bancarella sotto la pioggia', 'il primo cliente', 'tre idee nuove', 'ha vinto la A', 'il regalo è sul banco', 'piazza nuova'][i % 6]} #bancariello #napoli #robot`,
    create_time: Math.floor(d.getTime() / 1000), cover_image_url: `https://p16-sign.tiktokcdn.com/cov${i % 6}.png?x=1`, share_url: `https://www.tiktok.com/@bancariello.napoli/video/${7000 + i}`,
    duration: 18 + (i * 5) % 40, view_count: v, like_count: Math.round(v * (0.04 + r() * 0.05)), comment_count: Math.round(v * (0.003 + r() * 0.01)), share_count: Math.round(v * r() * 0.01) });
}
const UTENTE = { open_id: 'oid-123', avatar_url: 'https://p16-sign.tiktokcdn.com/avatar.png', display_name: "Gennarino 'O Bancariello", username: 'bancariello.napoli', profile_deep_link: 'https://www.tiktok.com/@bancariello.napoli', bio_description: 'Il robottino della bancarella', is_verified: false, follower_count: 1840, following_count: 12, likes_count: 23500, video_count: 32 };
const log = [], chiamate = { token: 0, refresh: 0, user: 0, video: 0, revoke: 0 };
let modoAutorizza = 'ok';
async function finto(ctx) {
  await ctx.route(/fonts\.googleapis|fonts\.gstatic/, x => x.abort());
  await ctx.route(/p16-sign\.tiktokcdn\.com/, x => x.fulfill({ status: 200, contentType: 'image/svg+xml', body: `<svg xmlns='http://www.w3.org/2000/svg' width='90' height='120'><rect width='90' height='120' fill='hsl(${(x.request().url().length * 47) % 360} 45% 40%)'/></svg>` }));
  await ctx.route(/www\.tiktok\.com\/v2\/auth\/authorize/, async x => {
    const u = new URL(x.request().url()), q = u.searchParams;
    log.push(['autorizza', q.get('client_key'), q.get('scope'), q.get('redirect_uri'), q.get('response_type'), (q.get('state') || '').slice(0, 4)]);
    const dest = modoAutorizza === 'ok' ? `${q.get('redirect_uri')}?code=COD%2A123%21&scopes=${encodeURIComponent(q.get('scope'))}&state=${encodeURIComponent(q.get('state'))}`
      : `${q.get('redirect_uri')}?error=access_denied&error_description=User%20cancelled&state=${encodeURIComponent(q.get('state'))}`;
    x.fulfill({ status: 302, headers: { location: dest } });
  });
  await ctx.route(/open\.tiktokapis\.com\/v2\//, async x => {
    const rq = x.request(), u = new URL(rq.url()), h = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };
    if (rq.method() === 'OPTIONS') return x.fulfill({ status: 200, headers: { ...h, 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (u.pathname.endsWith('/oauth/token/')) {
      const f = new URLSearchParams(rq.postData() || '');
      if (f.get('client_key') !== CK || f.get('client_secret') !== CS) return x.fulfill({ status: 200, headers: h, body: JSON.stringify({ error: 'invalid_client', error_description: 'Client key or secret is incorrect.' }) });
      if (f.get('grant_type') === 'authorization_code') { chiamate.token++; log.push(['codice', f.get('code'), f.get('redirect_uri')]);
        if (f.get('code') !== 'COD*123!') return x.fulfill({ status: 200, headers: h, body: JSON.stringify({ error: 'invalid_grant', error_description: 'Authorization code is expired.' }) });
        return x.fulfill({ status: 200, headers: h, body: JSON.stringify({ access_token: 'act.uno', expires_in: 86400, open_id: 'oid-123', refresh_expires_in: 31536000, refresh_token: 'rft.uno', scope: 'user.info.basic,user.info.profile,user.info.stats,video.list', token_type: 'Bearer' }) }) }
      if (f.get('grant_type') === 'refresh_token') { chiamate.refresh++; log.push(['rinnovo', f.get('refresh_token')]);
        return x.fulfill({ status: 200, headers: h, body: JSON.stringify({ access_token: 'act.due', expires_in: 86400, open_id: 'oid-123', refresh_expires_in: 31536000, refresh_token: 'rft.due', scope: 'user.info.basic,user.info.profile,user.info.stats,video.list', token_type: 'Bearer' }) }) }
    }
    if (u.pathname.endsWith('/oauth/revoke/')) { chiamate.revoke++; return x.fulfill({ status: 200, headers: h, body: '{}' }) }
    const auth = rq.headers()['authorization'] || '';
    if (!/^Bearer act\./.test(auth)) return x.fulfill({ status: 401, headers: h, body: JSON.stringify({ data: {}, error: { code: 'access_token_invalid', message: 'The access token is invalid or not found in the request.' } }) });
    if (u.pathname.endsWith('/user/info/')) { chiamate.user++; const campi = (u.searchParams.get('fields') || '').split(','); const us = {}; campi.forEach(c => { if (c in UTENTE) us[c] = UTENTE[c] });
      return x.fulfill({ status: 200, headers: h, body: JSON.stringify({ data: { user: us }, error: { code: 'ok', message: '' } }) }) }
    if (u.pathname.endsWith('/video/list/')) { chiamate.video++; const b = JSON.parse(rq.postData() || '{}'); const da = b.cursor ? +b.cursor : 0; const pag = VIDEO.slice(da, da + (b.max_count || 20));
      return x.fulfill({ status: 200, headers: h, body: JSON.stringify({ data: { videos: pag, cursor: da + pag.length, has_more: da + pag.length < VIDEO.length }, error: { code: 'ok', message: '' } }) }) }
    x.fulfill({ status: 404, headers: h, body: '{"error":{"code":"not_found"}}' });
  });
}
const attendi = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'it-IT', serviceWorkers: 'block' });
  await finto(ctx);
  const p = await ctx.newPage();
  const errori = []; p.on('pageerror', e => errori.push(e.message)); p.on('console', m => { if (m.type() === 'error') errori.push('console: ' + m.text()) });
  await p.goto(BASE); await attendi(800);
  // un video «pubblicato dallo Studio» 2 giorni fa: deve unirsi al video TikTok più vicino, tenendo Spinta Score e formato
  const v4 = VIDEO[4];
  await p.evaluate(v => { DB.pending.push({ id: 'pend1', title: 'Puntata dallo Studio', date: '2026-10-01', hour: '20:00', hk: 'Curiosità', len: 30, format: 'Serie (puntata)', series: '', score: 77, pubAt: v.create_time * 1000 + 40 * 60e3, f: null, miss: [] });
    DB.stats.push({ id: 'man1', title: 'Video inserito a mano', date: '2025-01-05', hour: '19:00', format: 'Tutorial', hk: '', views: 900, likes: 40, comm: 3, shares: 1, saves: 5, follows: 2, len: 20, watch: 8, full: 20 });
    DB.ttSnaps = [{ d: new Date(Date.now() - 20 * 864e5).toISOString().slice(0, 10), f: 1520 }, { d: new Date(Date.now() - 13 * 864e5).toISOString().slice(0, 10), f: 1611 }, { d: new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10), f: 1744 }];
    save(); renderStats() }, v4);
  await p.evaluate(() => goTab('grow')); await attendi(400);
  await p.screenshot({ path: OUT + '/1-crescita-non-collegato.png' });
  await p.click('#tt-card button.btn'); await attendi(400);
  await p.screenshot({ path: OUT + '/2-guida.png' });
  await p.screenshot({ path: OUT + '/2b-guida-intera.png', fullPage: false });
  await p.evaluate(() => document.querySelector('#m-tt .sheet').scrollTo(0, 99999)); await attendi(200);
  await p.screenshot({ path: OUT + '/2c-guida-fondo.png' });
  // chiave «tradotta da Chrome» (sbaw→skaw e un carattere in più): Spinta si ferma e lo spiega, niente pagina d'errore di TikTok
  await p.fill('#tt-ck', 'skaw' + CK.slice(4) + 'x'); await p.fill('#tt-cs', CS);
  await p.click('#m-tt button.btn:not(.alt)'); await attendi(400);
  const av1 = await p.evaluate(() => ({ vis: !document.getElementById('tt-avviso').hidden, txt: document.getElementById('tt-avviso').innerText, url: location.href, ck: (JSON.parse(localStorage.getItem('spinta_tiktok')) || {}).ck || null }));
  console.log('chiave tradotta → avviso:', av1.vis, '| resta su Spinta:', /spinta\.html$/.test(av1.url), '| salvata?', !!av1.ck, '|', av1.txt.slice(0, 110));
  await p.locator('#tt-avviso').screenshot({ path: OUT + '/2d-avviso-chiave.png' });
  await p.screenshot({ path: OUT + '/2e-guida-avviso.png' });
  // chiave della Production
  await p.fill('#tt-ck', 'aw' + CK.slice(4)); await p.click('#m-tt button.btn:not(.alt)'); await attendi(300);
  console.log('chiave Production →', (await p.evaluate(() => document.getElementById('tt-avviso').innerText)).slice(0, 80));
  // chiave giusta ma con caratteri invisibili e spazi intorno (copia-incolla dal telefono): va bene lo stesso
  await p.fill('#tt-ck', ' \u200b' + CK.slice(0, 9) + '\u200b' + CK.slice(9) + '\u200b '); await p.fill('#tt-cs', CS + ' ');
  await Promise.all([p.waitForURL(/spinta\.html/), p.click('#m-tt button.btn:not(.alt)')]);
  await p.waitForFunction(() => window.ttStato && ttStato().collegato && ttStato().sync > 0, null, { timeout: 15000 });
  await attendi(800);
  const dopo = await p.evaluate(() => ({ url: location.href, stato: ttStato(), stats: DB.stats.length, conTT: DB.stats.filter(s => s.tt).length, pending: DB.pending.length,
    unito: DB.stats.find(s => s.score === 77) || null, manuale: DB.stats.find(s => s.id === 'man1'), snaps: DB.ttSnaps.length, chiavi: JSON.parse(localStorage.getItem('spinta_tiktok')),
    backupHaChiavi: JSON.stringify(DB).includes('segreto-di-prova') }));
  console.log('URL dopo il ritorno:', dopo.url);
  console.log('collegato:', dopo.stato.collegato, 'utente:', dopo.stato.utente && dopo.stato.utente.username, 'video letti:', dopo.stato.video, 'permessi:', dopo.stato.permessi.join(','));
  console.log('stats:', dopo.stats, 'da TikTok:', dopo.conTT, 'pending rimasti:', dopo.pending, 'snap:', dopo.snaps, 'segreto nel backup?', dopo.backupHaChiavi);
  console.log('unito dallo Studio:', dopo.unito && { tt: dopo.unito.tt, score: dopo.unito.score, format: dopo.unito.format, views: dopo.unito.views, title: dopo.unito.title });
  console.log('token salvato:', dopo.chiavi.tok && { a: dopo.chiavi.tok.a, r: dopo.chiavi.tok.r, sc: dopo.chiavi.tok.sc.length }, 'state pulito:', dopo.chiavi.state == null);
  await p.evaluate(() => window.scrollTo(0, 0)); await attendi(300);
  await p.screenshot({ path: OUT + '/3-crescita-collegato.png' });
  await p.screenshot({ path: OUT + '/3b-crescita-intera.png', fullPage: true });
  await p.click('#s-pulse .bar-v[data-i="5"]').catch(() => { }); await attendi(200);
  for (const id of ['s-kpis', 's-top-box', 's-when-box', 's-fol-box', 'g-next', 's-insight', 's-chartbox']) { const el = p.locator('#' + id); if (await el.isVisible()) await el.screenshot({ path: OUT + '/sez-' + id + '.png' }) }
  await p.locator('#s-items .item').first().screenshot({ path: OUT + '/sez-video.png' });
  await p.locator('#s-pulse-box').screenshot({ path: OUT + '/4-video-per-video.png' });
  await p.evaluate(() => openSettings()); await attendi(300);
  await p.screenshot({ path: OUT + '/5-impostazioni.png' });
  await p.evaluate(() => closeModal('m-set'));
  // rinnovo del token: scaduto da sé, ultimo aggiornamento vecchio -> all'apertura rinnova e rilegge
  await p.evaluate(() => { const t = JSON.parse(localStorage.getItem('spinta_tiktok')); t.tok.ae = 0; t.sync = 0; localStorage.setItem('spinta_tiktok', JSON.stringify(t)) });
  const prima = { ...chiamate };
  await p.reload(); await p.waitForFunction(() => window.ttStato && ttStato().sync > 0, null, { timeout: 15000 }); await attendi(500);
  const rin = await p.evaluate(() => JSON.parse(localStorage.getItem('spinta_tiktok')).tok);
  console.log('rinnovo: chiamate refresh', chiamate.refresh - prima.refresh, 'token nuovo', rin.a, rin.r, 'video riletti', chiamate.video - prima.video, 'stats', await p.evaluate(() => DB.stats.length));
  // studio e altre schede con la grafica nuova
  for (const t of ['studio', 'plan', 'tools']) { await p.evaluate(t => goTab(t), t); await attendi(300); await p.screenshot({ path: OUT + `/6-${t}.png` }) }
  // computer
  const pc = await b.newContext({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 1.5, locale: 'it-IT', serviceWorkers: 'block' });
  await finto(pc);
  const q = await pc.newPage(); q.on('pageerror', e => errori.push('pc: ' + e.message));
  await q.goto(BASE); await attendi(300);
  const memoria = await p.evaluate(() => ({ db: localStorage.getItem('spinta_v1'), tt: localStorage.getItem('spinta_tiktok') }));
  await q.evaluate(m => { localStorage.setItem('spinta_v1', m.db); localStorage.setItem('spinta_tiktok', m.tt) }, memoria);
  await q.reload(); await attendi(900); await q.evaluate(() => goTab('grow')); await attendi(500);
  await q.screenshot({ path: OUT + '/7-pc-crescita.png' });
  await q.screenshot({ path: OUT + '/7b-pc-crescita-intera.png', fullPage: true });
  await q.evaluate(() => goTab('studio')); await attendi(300); await q.screenshot({ path: OUT + '/7c-pc-studio.png' });
  // errore: accesso annullato su TikTok
  modoAutorizza = 'no';
  await p.evaluate(() => { const t = JSON.parse(localStorage.getItem('spinta_tiktok')); delete t.tok; localStorage.setItem('spinta_tiktok', JSON.stringify(t)) });
  await p.reload(); await attendi(500); await p.evaluate(() => goTab('grow'));
  await Promise.all([p.waitForURL(/spinta\.html/), p.evaluate(() => ttCollega())]); await attendi(900);
  const err = await p.evaluate(() => ({ err: ttStato().err, url: location.href, card: document.querySelector('#tt-card').innerText.slice(0, 200) }));
  console.log('annullato:', err.err, '| url pulito:', !/error=/.test(err.url));
  await p.evaluate(() => window.scrollTo(0, 0)); await p.screenshot({ path: OUT + '/8-annullato.png' });
  // chiavi sbagliate
  modoAutorizza = 'ok';
  await p.evaluate(() => { const t = JSON.parse(localStorage.getItem('spinta_tiktok')); t.cs = 'segreto-sbagliato-0000000000'; localStorage.setItem('spinta_tiktok', JSON.stringify(t)) });
  await Promise.all([p.waitForURL(/spinta\.html/), p.evaluate(() => ttCollega())]); await attendi(900);
  console.log('chiavi sbagliate:', await p.evaluate(() => ttStato().err));
  // chiave salvata storta (vecchia, tradotta): «Collega TikTok» apre la guida con l'avviso invece di andare su TikTok
  await p.evaluate(() => { const t = JSON.parse(localStorage.getItem('spinta_tiktok')); t.ck = 'skawprova1234567890'; delete t.forza; delete t.tok; t.err = null; localStorage.setItem('spinta_tiktok', JSON.stringify(t)) });
  await p.reload(); await attendi(500); await p.evaluate(() => goTab('grow')); await attendi(300);
  const carta = await p.evaluate(() => document.querySelector('#tt-card').innerText);
  const prima2 = log.length;
  await p.evaluate(() => ttCollega()); await attendi(400);
  const g = await p.evaluate(() => ({ aperta: document.getElementById('m-tt').classList.contains('on'), avviso: !document.getElementById('tt-avviso').hidden }));
  console.log('chiave storta salvata → scheda:', /non sono giuste/.test(carta), '| guida aperta:', g.aperta, '| avviso:', g.avviso, '| niente TikTok:', log.length === prima2);
  await p.screenshot({ path: OUT + '/9-guida-chiave-storta.png' });
  // stessa chiave toccata due volte: Spinta la usa lo stesso (se un giorno TikTok cambia la forma delle chiavi)
  await p.click('#m-tt button.btn:not(.alt)'); await attendi(200);
  const ancoraSu = await p.evaluate(() => document.getElementById('m-tt').classList.contains('on'));
  await Promise.all([p.waitForURL(/spinta\.html/), p.click('#m-tt button.btn:not(.alt)')]); await attendi(900);
  const f = await p.evaluate(() => ({ forza: JSON.parse(localStorage.getItem('spinta_tiktok')).forza, err: ttStato().err }));
  console.log('primo tocco ferma:', ancoraSu, '| secondo tocco usa la chiave: forza =', f.forza, '| TikTok chiamato:', log.length > prima2, '| errore:', (f.err || '').slice(0, 70));
  console.log('log TikTok:', JSON.stringify(log.slice(0, 3)));
  console.log('chiamate:', JSON.stringify(chiamate));
  console.log('ERRORI PAGINA:', errori.length ? errori.join(' | ') : 'nessuno');
  await b.close();
})();
