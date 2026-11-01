/* Spinta – collegamento ufficiale a TikTok («Accedi con TikTok»: Login Kit + Display API), tutto dentro Spinta.
 *
 * Come funziona (nessun server e nessun account oltre a TikTok):
 *  1. Sam crea una sua app su TikTok for Developers (la guida è dentro Spinta) e incolla in Spinta Client key e Client secret:
 *     restano solo su questo dispositivo (localStorage «spinta_tiktok»: fuori dal backup e fuori dal repository).
 *  2. «Collega TikTok» apre la pagina di accesso di TikTok: la password si scrive solo lì, Spinta non la vede mai.
 *  3. TikTok rimanda a spinta.html con un codice; Spinta lo scambia con un token direttamente con TikTok
 *     (le API di TikTok accettano chiamate dal browser). Il token dura 24 ore e si rinnova da solo per un anno.
 *  4. Spinta legge il profilo (follower, like, numero di video) e i video (view, like, commenti, condivisioni, durata, data,
 *     copertina, link) e li mette nella Crescita. Salvataggi, visione media e % di visione completa TikTok non li dà alle app:
 *     restano da inserire (anche dagli screenshot).
 */
(function () {
  'use strict';
  const TT_KEY = 'spinta_tiktok';
  const AUTH = 'https://www.tiktok.com/v2/auth/authorize/';
  const API = 'https://open.tiktokapis.com/v2/';
  const SCOPES = ['user.info.basic', 'user.info.profile', 'user.info.stats', 'video.list'];
  const VFIELDS = 'id,title,video_description,create_time,cover_image_url,share_url,duration,view_count,like_count,comment_count,share_count';
  const UFIELDS = {
    'user.info.basic': 'open_id,avatar_url,display_name',
    'user.info.profile': 'username,profile_deep_link,bio_description,is_verified',
    'user.info.stats': 'follower_count,following_count,likes_count,video_count'
  };
  const SITO = 'https://essentialapp-2026.github.io/Spinta/';
  const OGNI = 30 * 60e3;              // aggiornamento automatico al massimo ogni mezz'ora
  const MAX_PAGINE = 10;               // 10 × 20 = gli ultimi 200 video

  /* ---------- memoria (solo su questo dispositivo) ---------- */
  const leggi = () => { try { return JSON.parse(localStorage.getItem(TT_KEY)) || {} } catch (_) { return {} } };
  const scrivi = o => { try { localStorage.setItem(TT_KEY, JSON.stringify(o)) } catch (_) { } };
  const aggiorna = f => { const t = leggi(); f(t); scrivi(t); return t };
  const casuale = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => b.toString(16).padStart(2, '0')).join('');
  // sul sito vero sempre l'indirizzo registrato nell'app TikTok, anche se Spinta è stata aperta con un indirizzo scritto diverso
  const ritorno = () => { if (location.hostname === 'essentialapp-2026.github.io') return SITO + 'spinta.html'; const u = new URL('spinta.html', location.href); return u.origin + u.pathname };
  const e = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const https = u => (/^https:\/\/[^\s"'<>]+$/.test(String(u || '')) ? String(u) : '');   // solo indirizzi https veri
  const ico = (n, c) => `<svg class="ic${c ? ' ' + c : ''}" aria-hidden="true"><use href="#i-${n}"/></svg>`;

  class Errore extends Error { constructor(codice, testo) { super(testo || codice); this.codice = codice; this.testo = testo || codice } }

  /* ---------- stato ---------- */
  function ttStato() {
    const t = leggi(), tok = t.tok;
    return {
      chiavi: !!(t.ck && t.cs),
      collegato: !!(tok && tok.r && Date.now() < tok.re),
      utente: t.user || null, sync: t.sync || 0, err: t.err || null,
      permessi: tok ? tok.sc || [] : [], video: t.nvid || 0
    };
  }

  /* ---------- accesso con TikTok ---------- */
  function ttCollega() {
    const t = leggi();
    if (!t.ck || !t.cs) { ttGuida(); return }
    const stato = 'sp1.' + Date.now().toString(36) + '.' + casuale(12);
    aggiorna(x => { x.state = stato; x.err = null });
    const q = new URLSearchParams({ client_key: t.ck, scope: SCOPES.join(','), response_type: 'code', redirect_uri: ritorno(), state: stato });
    location.href = AUTH + '?' + q;
  }

  async function modulo(dati) {
    let r, j = {};
    try { r = await fetch(API + 'oauth/token/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(dati) }) }
    catch (_) { throw new Errore('rete', 'Non riesco a raggiungere TikTok: controlla la connessione e riprova.') }
    try { j = await r.json() } catch (_) { }
    return j;
  }

  function salvaToken(t, j) {
    const ora = Date.now();
    t.tok = {
      a: j.access_token, ae: ora + ((+j.expires_in || 86400) - 300) * 1e3,
      r: j.refresh_token, re: ora + ((+j.refresh_expires_in || 31536000) - 3600) * 1e3,
      id: j.open_id || '', sc: String(j.scope || '').split(/[,\s]+/).filter(Boolean)
    };
  }

  function erroreToken(j) {
    const c = j.error || (j.data && j.data.error_code) || '', d = j.error_description || (j.data && j.data.description) || '';
    if (/invalid_client|client_key|client_secret/i.test(c + ' ' + d)) return 'TikTok non riconosce Client key o Client secret: ricopiali dalla Sandbox della tua app (sezione Credentials).';
    if (/redirect/i.test(c + ' ' + d)) return `L'indirizzo di ritorno non corrisponde: nella tua app su TikTok, in Login Kit, metti esattamente ${ritorno()}`;
    if (/invalid_grant|expired|code/i.test(c + ' ' + d)) return 'Il codice di TikTok è scaduto o è già stato usato: tocca di nuovo «Collega TikTok».';
    return 'TikTok ha rifiutato il collegamento' + (d || c ? ` (${d || c})` : '') + '. Riprova; se succede ancora, ricontrolla la guida.';
  }

  function erroreAccesso(c, d) {
    if (c === 'access_denied') return 'Accesso annullato su TikTok. Quando vuoi, tocca di nuovo «Collega TikTok».';
    if (/scope/i.test(c + ' ' + d)) return 'TikTok non ha dato i permessi: nella tua app aggiungi gli scope user.info.basic, user.info.profile, user.info.stats e video.list (anche nella Sandbox).';
    return 'TikTok non ha completato l\'accesso' + (d || c ? ` (${d || c})` : '') + '. Se usi la Sandbox, controlla che il tuo account sia tra i «Target users».';
  }

  // TikTok rimanda qui con ?code=…&state=… (o ?error=…): si scambia subito il codice con il token
  async function ttRitorno() {
    const qs = location.search;
    if (!/[?&](code|error)=/.test(qs)) return false;
    const q = new URLSearchParams(qs);
    const crudo = (qs.match(/[?&]code=([^&]*)/) || [])[1];
    let codice = null; try { codice = crudo ? decodeURIComponent(crudo) : null } catch (_) { codice = crudo }
    history.replaceState(null, '', location.pathname + location.hash);     // via il codice dall'indirizzo
    const t = leggi(), st = q.get('state') || '';
    const recente = st.startsWith('sp1.') && Date.now() - parseInt(st.split('.')[1], 36) < 20 * 60e3;
    const errore = m => { aggiorna(x => { x.err = m; x.state = null }); ttMostraTutto(); if (window.goTab) goTab('grow'); if (window.toast) toast('Collegamento non riuscito') };
    if (q.has('error')) { errore(erroreAccesso(q.get('error'), q.get('error_description') || '')); return true }
    // stesso «state» dato all'uscita; se manca (app installata e browser con memorie separate) basta che sia nostro e recente
    if (!st || (t.state ? st !== t.state : !recente)) { errore('Il ritorno da TikTok non viene da questo collegamento: tocca di nuovo «Collega TikTok».'); return true }
    if (!t.ck || !t.cs) { errore('Mancano Client key e Client secret: inseriscili nella guida e collega di nuovo.'); return true }
    if (window.toast) toast('Collego TikTok…');
    try {
      const j = await modulo({ client_key: t.ck, client_secret: t.cs, code: codice, grant_type: 'authorization_code', redirect_uri: ritorno() });
      if (!j.access_token) throw new Errore('token', erroreToken(j));
      aggiorna(x => { salvaToken(x, j); x.state = null; x.err = null; x.collegatoIl = Date.now() });
      if (window.goTab) goTab('grow');
      await ttAggiorna(true);
      if (window.toast) toast('TikTok collegato ✓');
    } catch (err) { errore(err.testo || err.message) }
    return true;
  }

  let rinnovo = null;
  async function token() {
    const t = leggi(), k = t.tok;
    if (!k || !k.r) throw new Errore('scollegato', 'TikTok non è collegato.');
    if (Date.now() < k.ae) return k.a;
    if (Date.now() > k.re) throw new Errore('scaduto', 'Il collegamento con TikTok è scaduto (dura un anno): collegalo di nuovo.');
    if (!rinnovo) rinnovo = (async () => {
      const j = await modulo({ client_key: t.ck, client_secret: t.cs, grant_type: 'refresh_token', refresh_token: k.r });
      if (!j.access_token) throw new Errore('rinnovo', /invalid_grant/i.test(j.error || '') ? 'TikTok ha chiuso il collegamento (accesso revocato o scaduto): collegalo di nuovo.' : erroreToken(j));
      return aggiorna(x => salvaToken(x, j)).tok.a;
    })().finally(() => { rinnovo = null });
    return rinnovo;
  }

  async function chiama(percorso, { metodo = 'GET', query = {}, corpo = null } = {}, riprova = true) {
    const tk = await token();
    let r, j = {};
    try {
      r = await fetch(API + percorso + '?' + new URLSearchParams(query), {
        method: metodo, headers: Object.assign({ Authorization: 'Bearer ' + tk }, corpo ? { 'Content-Type': 'application/json' } : {}),
        body: corpo ? JSON.stringify(corpo) : undefined
      });
    } catch (_) { throw new Errore('rete', 'Non riesco a raggiungere TikTok: controlla la connessione.') }
    try { j = await r.json() } catch (_) { }
    const c = j.error && j.error.code;
    if ((c && c !== 'ok') || !r.ok) {
      if (riprova && (c === 'access_token_invalid' || r.status === 401)) { aggiorna(x => { if (x.tok) x.tok.ae = 0 }); return chiama(percorso, { metodo, query, corpo }, false) }
      if (c === 'scope_not_authorized' || c === 'scope_permission_missed') throw new Errore(c, 'Manca un permesso: collega di nuovo TikTok e lascia attive tutte le voci.');
      if (c === 'rate_limit_exceeded' || r.status === 429) throw new Errore(c, 'TikTok chiede di aspettare un po\': riprovo più tardi.');
      throw new Errore(c || 'http' + r.status, `TikTok ha risposto con un errore (${(j.error && j.error.message) || c || r.status}).`);
    }
    return j.data || {};
  }

  /* ---------- lettura dei dati ---------- */
  let inCorso = null;
  function ttAggiorna(forza) {
    const s = ttStato();
    if (!s.collegato) return Promise.resolve(null);
    if (!forza && s.sync && Date.now() - s.sync < OGNI) return Promise.resolve(null);
    if (inCorso) return inCorso;
    inCorso = (async () => {
      try {
        const perm = new Set(s.permessi.length ? s.permessi : SCOPES);
        const campi = Object.entries(UFIELDS).filter(([k]) => perm.has(k)).map(([, v]) => v).join(',') || UFIELDS['user.info.basic'];
        const u = (await chiama('user/info/', { query: { fields: campi } })).user || {};
        let video = [];
        if (perm.has('video.list')) {
          let cursore = null;
          for (let i = 0; i < MAX_PAGINE; i++) {
            const d = await chiama('video/list/', { metodo: 'POST', query: { fields: VFIELDS }, corpo: cursore ? { max_count: 20, cursor: cursore } : { max_count: 20 } });
            video = video.concat(d.videos || []);
            if (!d.has_more || !d.cursor) break;
            cursore = d.cursor;
          }
        }
        const esito = unisci(u, video, perm);
        aggiorna(x => { x.user = u; x.sync = Date.now(); x.err = null; x.nvid = video.length });
        return esito;
      } catch (err) {
        aggiorna(x => { x.err = err.testo || err.message });
        if (err.codice === 'scaduto' || err.codice === 'rinnovo') aggiorna(x => { if (x.tok) x.tok.re = 0 });
        throw err;
      } finally {
        inCorso = null; ttMostraTutto();
        if (window.renderStats) try { renderStats() } catch (_) { }
      }
    })();
    ttMostraTutto();          // «aggiorno…» mentre legge
    return inCorso;
  }

  /* ---------- i video di TikTok nella Crescita di Spinta ---------- */
  const pad = n => String(n).padStart(2, '0');
  const giorno = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const ora = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const minuti = h => { const m = /^(\d{1,2}):(\d{2})/.exec(h || ''); return m ? +m[1] * 60 + +m[2] : null };
  function titoloDi(v) {
    const t = (v.title || '').trim();
    if (t) return t.slice(0, 90);
    const d = String(v.video_description || '').replace(/#[\p{L}\p{N}_]+/gu, '').replace(/\s+/g, ' ').trim();
    return d ? (Array.from(d).length > 80 ? Array.from(d).slice(0, 80).join('') + '…' : d) : 'Video del ' + new Date((+v.create_time || 0) * 1000).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
  }

  function unisci(u, video, perm) {
    if (typeof DB === 'undefined') return { nuovi: 0, aggiornati: 0 };
    normDB();
    const adesso = Date.now(), oggi = giorno(new Date());
    let nuovi = 0, aggiornati = 0;
    video.forEach(v => {
      if (!v || !v.id) return;
      const ts = (+v.create_time || 0) * 1000, dt = new Date(ts), data = giorno(dt), h = ora(dt);
      let s = DB.stats.find(x => x.tt === v.id);
      if (!s) {     // pubblicato dallo Studio con «L'ho pubblicato»: si porta dietro montaggio, Spinta Score, hook e formato
        const p = DB.pending.find(p => p.pubAt && Math.abs(p.pubAt - ts) < 3 * 3600e3);
        if (p) { s = Object.assign({}, p, { id: uid() }); DB.pending = DB.pending.filter(x => x !== p); DB.stats.push(s) }
      }
      if (!s) {     // inserito a mano: stesso giorno e orario vicino
        s = DB.stats.find(x => !x.tt && x.date === data && (!x.hour || Math.abs(minuti(x.hour) - minuti(h)) <= 180));
      }
      if (!s) { s = { id: uid(), title: titoloDi(v), format: '', hk: '', saves: '', follows: '', watch: '', full: '', src: 'tiktok' }; DB.stats.push(s); nuovi++ }
      else aggiornati++;
      Object.assign(s, {
        tt: v.id, date: data, hour: h, pubAt: s.pubAt || ts,
        views: +v.view_count || 0, likes: +v.like_count || 0, comm: +v.comment_count || 0, shares: +v.share_count || 0,
        cover: https(v.cover_image_url) || s.cover || '', link: https(v.share_url) || s.link || '', caption: v.video_description || s.caption || '', ttAt: adesso
      });
      if (+v.duration && !s.len) s.len = +v.duration;
      if (!s.title) s.title = titoloDi(v);
    });
    // fotografia del giorno: follower, like, video e view totali (per l'andamento nel tempo)
    const tot = video.reduce((a, v) => a + (+v.view_count || 0), 0);
    DB.ttSnaps = (DB.ttSnaps || []).filter(x => x.d !== oggi).concat([{
      d: oggi, f: u.follower_count ?? null, l: u.likes_count ?? null, n: u.video_count ?? null, v: video.length ? tot : null
    }]).slice(-500);
    DB.ttUser = { nome: u.display_name || '', user: u.username || '', foto: https(u.avatar_url), link: https(u.profile_deep_link) };
    save();
    return { nuovi, aggiornati };
  }

  /* ---------- scollega ---------- */
  async function ttScollega() {
    if (!confirm('Scollegare TikTok? I dati già letti restano in Spinta; le chiavi dell\'app restano salvate per ricollegarti.')) return;
    const t = leggi();
    if (t.tok && t.tok.a && t.ck && t.cs) {   // chiede a TikTok di chiudere l'accesso (se non risponde, basta cancellare il token qui)
      try { await fetch(API + 'oauth/revoke/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_key: t.ck, client_secret: t.cs, token: t.tok.a }) }) } catch (_) { }
    }
    aggiorna(x => { delete x.tok; delete x.user; x.sync = 0; x.err = null });
    ttMostraTutto(); if (window.renderStats) renderStats(); if (window.toast) toast('TikTok scollegato');
  }

  /* ---------- guida e chiavi dell'app ---------- */
  const VALORI = () => ({
    nome: 'Spinta',
    descrizione: 'Spinta mostra al creatore le statistiche dei suoi video TikTok (view, like, commenti e condivisioni) per capire cosa funziona sul suo canale. I dati restano sul suo telefono.',
    termini: SITO + 'termini.html', privacy: SITO + 'privacy.html', sito: SITO, ritorno: ritorno(), scope: SCOPES.join(', ')
  });
  function copia(v) { return `<button class="btn sm alt" type="button" onclick="copy(decodeURIComponent('${encodeURIComponent(v).replace(/'/g, '%27')}'))">Copia</button>` }
  function riga(et, v) { return `<div class="tt-val"><div><small>${e(et)}</small><code>${e(v)}</code></div>${copia(v)}</div>` }

  function ttGuida() {
    let m = document.getElementById('m-tt');
    if (!m) {
      m = document.createElement('div'); m.className = 'modal'; m.id = 'm-tt';
      m.addEventListener('click', ev => { if (ev.target === m) m.classList.remove('on') });
      document.body.appendChild(m);
    }
    const V = VALORI(), t = leggi();
    m.innerHTML = `<div class="sheet" role="dialog" aria-labelledby="tt-g-t">
      <div class="sheet-h"><h2 id="tt-g-t">Collega TikTok</h2><button class="iconbtn" type="button" aria-label="Chiudi" onclick="closeModal('m-tt')">${ico('x')}</button></div>
      <p class="sub">Una volta sola, circa 15 minuti dal computer: crei su TikTok for Developers una piccola app tua, con il tuo account TikTok. Poi Spinta legge da sola i numeri del tuo canale.</p>
      <div class="tt-note">${ico('lock')}<div>La password di TikTok la scrivi solo sulla pagina di TikTok. Client key e Client secret restano su questo dispositivo: non finiscono nel backup né su internet.</div></div>
      <ol class="tt-passi">
        <li><b>Entra in TikTok for Developers</b><span>Apri <a href="https://developers.tiktok.com/" target="_blank" rel="noopener">developers.tiktok.com</a>, tocca «Log in» e registrati come sviluppatore (gratis).</span></li>
        <li><b>Crea l'app</b><span>In alto a destra apri il tuo profilo, poi «Manage apps» → «Connect an app». Come proprietario scegli te stesso e conferma.</span></li>
        <li><b>Compila «App details»</b><span>Copia questi valori nei campi con lo stesso nome. Categoria: una qualsiasi, per esempio «Productivity».</span>
          ${riga('App name', V.nome)}${riga('Description', V.descrizione)}${riga('Terms of Service URL', V.termini)}${riga('Privacy Policy URL', V.privacy)}${riga('Platforms → Web → Website URL', V.sito)}
          <a class="btn sm alt" style="margin-top:8px" href="icon-1024.png" download="spinta-icona-1024.png">${ico('download')}Scarica l'icona (1024 × 1024)</a></li>
        <li><b>Aggiungi Login Kit</b><span>In «Products» tocca «Add products» e aggiungi «Login Kit» (e «Display API», se compare). In Login Kit, nella parte Web, metti questo Redirect URI:</span>${riga('Redirect URI', V.ritorno)}</li>
        <li><b>Aggiungi i permessi</b><span>In «Scopes» aggiungi questi quattro: servono per leggere profilo, numeri e video.</span>${riga('Scopes', V.scope)}</li>
        <li><b>Prepara la Sandbox</b><span>In alto passa da «Production» a «Sandbox» e crea una Sandbox copiando la configurazione di Production. Nella Sandbox apri «Target users», aggiungi il tuo account TikTok e accetta. Così l'app funziona per te senza aspettare la revisione di TikTok.</span></li>
        <li><b>Copia le chiavi</b><span>Nella Sandbox, sezione «Credentials», copia Client key e Client secret qui sotto.</span></li>
      </ol>
      <label for="tt-ck">Client key</label><input id="tt-ck" autocomplete="off" spellcheck="false" value="${e(t.ck || '')}" placeholder="es. sbaw1x2y3z…">
      <label for="tt-cs">Client secret</label>
      <div class="tt-segreto"><input id="tt-cs" type="password" autocomplete="off" spellcheck="false" value="${e(t.cs || '')}" placeholder="Incolla qui il Client secret"><button class="btn sm alt" type="button" onclick="const i=document.getElementById('tt-cs');i.type=i.type==='password'?'text':'password';this.textContent=i.type==='password'?'Mostra':'Nascondi'">Mostra</button></div>
      <button class="btn" type="button" onclick="ttSalvaChiavi(true)">${ico('tiktok-link')}Salva e collega TikTok</button>
      ${t.ck ? `<button class="btn alt" type="button" onclick="ttSalvaChiavi(false)">Salva solo le chiavi</button>` : ''}
      <small class="n">Si collega solo il tuo account (quello aggiunto tra i «Target users»). Per scollegare: Impostazioni di Spinta, oppure su TikTok → Impostazioni → Sicurezza → App e servizi.</small>
    </div>`;
    openModal('m-tt');
  }

  function ttSalvaChiavi(eCollega) {
    const ck = (document.getElementById('tt-ck').value || '').trim(), cs = (document.getElementById('tt-cs').value || '').trim();
    if (!ck || !cs) { toast('Servono Client key e Client secret'); return }
    if (/\s/.test(ck) || /\s/.test(cs) || ck.length < 8 || cs.length < 16) { toast('Le chiavi non sembrano giuste: ricopiale dalla Sandbox'); return }
    const t = leggi(), cambiate = t.ck !== ck || t.cs !== cs;
    aggiorna(x => { x.ck = ck; x.cs = cs; x.err = null; if (cambiate) { delete x.tok; x.sync = 0 } });
    closeModal('m-tt'); ttMostraTutto();
    if (eCollega) ttCollega(); else toast('Chiavi salvate ✓');
  }

  /* ---------- cosa si vede ---------- */
  const fmtN = n => { n = Number(n) || 0; return n >= 1e6 ? (n / 1e6).toFixed(1).replace('.0', '') + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1).replace('.0', '') + 'K' : String(Math.round(n)) };
  function quando(ts) {
    if (!ts) return 'mai';
    const d = new Date(ts), oggi = new Date(), ieri = new Date(Date.now() - 864e5);
    const hh = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === oggi.toDateString()) return 'oggi alle ' + hh;
    if (d.toDateString() === ieri.toDateString()) return 'ieri alle ' + hh;
    return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) + ' alle ' + hh;
  }
  function avatar(u, cls) {
    const nome = (u && (u.display_name || u.nome)) || 'TikTok', foto = https(u && (u.avatar_url || u.foto));
    const ini = Array.from(nome.trim())[0] || 'T';
    return `<span class="av ${cls || ''}">${foto ? `<img src="${e(foto)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}<b>${e(ini.toUpperCase())}</b></span>`;
  }

  // la scheda in cima alla Crescita
  function ttScheda() {
    const s = ttStato(), u = s.utente;
    if (!s.collegato) {
      const scaduto = s.chiavi && leggi().tok;
      return `<div class="card tt-card">
        <div class="tt-head">${ico('tiktok-link', 'big')}<div><h3>${scaduto ? 'Ricollega TikTok' : 'Collega il tuo account TikTok'}</h3>
        <p>${scaduto ? 'Il collegamento non è più valido: ricollegalo e Spinta riprende ad aggiornare i numeri da sola.' : 'Spinta legge da sola follower, like e i numeri di ogni video: niente più dati da copiare. Salvataggi e visione media restano da inserire, perché TikTok non li dà alle app.'}</p></div></div>
        ${s.err ? `<div class="tt-err">${ico('alert')}<span>${e(s.err)}</span></div>` : ''}
        <div class="acts"><button class="btn sm" type="button" onclick="${s.chiavi ? 'ttCollega()' : 'ttGuida()'}">${s.chiavi ? 'Collega TikTok' : 'Inizia'}</button>${s.chiavi ? '<button class="btn sm alt" type="button" onclick="ttGuida()">Guida e chiavi</button>' : ''}</div>
      </div>`;
    }
    const nome = (u && u.display_name) || 'Il tuo account', user = u && u.username ? '@' + u.username : '';
    return `<div class="tt-bar">
      ${avatar(u, 'lg')}
      <div class="tt-who"><b>${e(nome)}</b><span>${e(user)}${user ? ' · ' : ''}${inCorso ? 'aggiorno…' : 'aggiornato ' + quando(s.sync)}</span></div>
      <button class="iconbtn" type="button" aria-label="Aggiorna i dati da TikTok" onclick="ttAggiornaOra()" ${inCorso ? 'disabled' : ''}>${ico('refresh', inCorso ? 'gira' : '')}</button>
    </div>${s.err ? `<div class="tt-err">${ico('alert')}<span>${e(s.err)}</span></div>` : ''}`;
  }

  // nelle Impostazioni
  function ttImpostazioni() {
    const el = document.getElementById('tt-set'); if (!el) return;
    const s = ttStato(), u = s.utente;
    el.innerHTML = `<h3>Account TikTok</h3>
      ${s.collegato
        ? `<div class="tt-bar" style="margin-top:8px">${avatar(u, 'lg')}<div class="tt-who"><b>${e((u && u.display_name) || 'Collegato')}</b><span>${u && u.username ? '@' + e(u.username) + ' · ' : ''}${s.video} video letti · ${quando(s.sync)}</span></div></div>
           <div class="acts"><button class="btn sm" type="button" onclick="ttAggiornaOra()">Aggiorna ora</button><button class="btn sm alt" type="button" onclick="ttGuida()">Chiavi dell'app</button><button class="btn sm alt danger" type="button" onclick="ttScollega()">Scollega</button></div>`
        : `<p class="sub" style="margin:6px 0 0">${s.chiavi ? 'Chiavi dell\'app salvate: manca solo l\'accesso.' : 'Non collegato. Con TikTok collegato, i numeri dei tuoi video arrivano da soli.'}</p>
           <div class="acts"><button class="btn sm" type="button" onclick="${s.chiavi ? 'ttCollega()' : 'ttGuida()'}">Collega TikTok</button>${s.chiavi ? '<button class="btn sm alt" type="button" onclick="ttGuida()">Chiavi dell\'app</button>' : ''}</div>`}
      ${s.err ? `<div class="tt-err">${ico('alert')}<span>${e(s.err)}</span></div>` : ''}`;
  }

  // nella barra in alto
  function ttChip() {
    const el = document.getElementById('tt-chip'); if (!el) return;
    const s = ttStato();
    el.innerHTML = s.collegato
      ? `<button class="chipacc" type="button" onclick="goTab('grow')" aria-label="Il tuo account TikTok">${avatar(s.utente)}<span>${s.utente && s.utente.follower_count != null ? fmtN(s.utente.follower_count) : 'TikTok'}</span></button>`
      : `<button class="chipacc off" type="button" onclick="goTab('grow')">${ico('tiktok-link')}<span>Collega TikTok</span></button>`;
  }

  function ttMostraTutto() {
    ttChip(); ttImpostazioni();
    const c = document.getElementById('tt-card'); if (c) c.innerHTML = ttScheda();
  }

  function ttAggiornaOra() {
    ttAggiorna(true).then(r => { if (r && window.toast) toast(r.nuovi ? `Dati aggiornati: ${r.nuovi} video nuovi` : 'Dati aggiornati ✓') })
      .catch(err => { if (window.toast) toast(err.codice === 'rete' ? 'Niente connessione' : 'Non riesco ad aggiornare: guarda il messaggio') });
  }

  /* ---------- avvio ---------- */
  async function ttAvvio() {
    ttMostraTutto();
    const ritornato = await ttRitorno().catch(() => false);
    if (!ritornato) ttAggiorna(false).catch(() => { });
    // tornando su Spinta (per esempio dall'app installata dopo l'accesso fatto nel browser) si rilegge tutto
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { ttMostraTutto(); ttAggiorna(false).catch(() => { }) } });
    addEventListener('storage', ev => {
      if (ev.key === TT_KEY) ttMostraTutto();
      if (ev.key === 'spinta_v1' && typeof load === 'function') { load(); normDB(); try { renderStats() } catch (_) { } }
    });
  }

  Object.assign(window, { ttStato, ttCollega, ttScollega, ttAggiorna, ttAggiornaOra, ttGuida, ttSalvaChiavi, ttMostraTutto, ttScheda, ttAvvio, ttUnisci: unisci });
})();
