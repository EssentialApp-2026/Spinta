/* Spinta · Creatore video con Gennarino
   Scrive la puntata, le dà la voce (Piper, sintesi italiana nel telefono) e monta il video:
   Gennarino disegnato in diretta con la bocca a tempo, sottotitoli, hook, PARTE N, finale e libreria del repository. */
'use strict';
const CR={lib:null,voice:null,busy:false,cancel:false,url:null,cover:null,file:null,prevT:null,ac:null};
const CR_BASE=Object.assign({ort:'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/',pp:'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/',api:'https://api.github.com/repos/EssentialApp-2026/Spinta/contents/libreria'},window.SPINTA_TTS_BASE||{});
const CR_VOICES={riccardo:{n:'Riccardo · maschile',url:'voci/it_IT-riccardo-x_low.onnx'},
  paola:{n:'Paola · femminile',url:'https://huggingface.co/rhasspy/piper-voices/resolve/main/it/it_IT/paola/medium/it_IT-paola-medium.onnx'}};
const CR_FONT='-apple-system,"Segoe UI",Roboto,sans-serif';

/* ---------- impostazioni ---------- */
// la settimana della serie: si vota nei commenti fino a mercoledì sera, il venerdì l'app più votata va sul banco, gratis
function crNextDow(dow){const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+((dow-d.getDay()+7)%7));return d}   // oggi compreso
const CR_GIORNI=['DOMENICA','LUNEDÌ','MARTEDÌ','MERCOLEDÌ','GIOVEDÌ','VENERDÌ','SABATO'];
const CR_TIPI={presentazione:'Presentazione della serie',idee:'Tre idee al voto',risultato:'Risultato del voto',regalo:'Il regalo del venerdì',nessuno:'Nessun voto: niente app',risposta:'Risposta a un commento',libera:'Libera (dal piano)'};
function crSet(){const d=DB.creator||{};const s=Object.assign({voice:'riccardo',fx:'leggero',speed:'tiktok',subs:true,bar:true,light:false,sfx:true,music:true,bolla:true,com:'',comUser:'',tipo:'idee',vince:'A',var:0},d);
  s.idee=Object.assign({A:'',B:'',C:''},d.idee||{});delete s.goal;delete s.likes;return s}
function crSaveSet(){const v=id=>$('#'+id);const s=crSet();
  DB.creator=Object.assign(s,{voice:v('cr-voice').value,fx:v('cr-fx').value,speed:v('cr-speed').value,subs:v('cr-subs').checked,bar:v('cr-bar').checked,light:v('cr-light').checked,
    sfx:v('cr-sfx').checked,music:v('cr-music').checked,bolla:v('cr-bolla').checked,com:v('cr-com').value.trim().slice(0,300),comUser:v('cr-cuser').value.trim().replace(/^@+/,'').slice(0,40),
    tipo:v('cr-tipo').value,vince:v('cr-vince').value,idee:{A:v('cr-iA').value.trim(),B:v('cr-iB').value.trim(),C:v('cr-iC').value.trim()}});save()}

/* ---------- finestra del creatore ---------- */
function crInject(){if($('#m-crea'))return;
  const opt=(id,lab,on)=>`<label class="opt"><input type="checkbox" id="${id}" ${on?'checked':''} onchange="crSaveSet();crPrev()"><span>${lab}</span></label>`;
  document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="m-crea"><div class="sheet" style="max-height:94vh">
  <h2>🎬 Crea con Gennarino</h2>
  <p class="sub" style="margin-bottom:8px">Scrivo la puntata, le do la voce e monto il video, tutto sul telefono. Lo stile è quello delle tue puntate.</p>
  <canvas id="cr-prev" width="360" height="640" style="width:52%;display:block;margin:0 auto;border-radius:14px;background:#000"></canvas>
  <div class="row"><div><label>Puntata</label><select id="cr-tipo" onchange="crTipo()">${Object.entries(CR_TIPI).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div>
   <div id="cr-vbox"><label>Ha vinto</label><select id="cr-vince" onchange="crChanged()"><option>A</option><option>B</option><option>C</option></select></div></div>
  <div id="cr-ibox"><label>Le tre idee della settimana</label>
   ${['A','B','C'].map(k=>`<div style="display:flex;gap:8px;align-items:center;margin-top:6px"><b style="width:18px">${k}</b><input id="cr-i${k}" placeholder="${{A:'es. Dividi il conto in pizzeria',B:'es. Timer per la moka',C:'es. Lista della spesa a voce'}[k]}" oninput="crChanged(true)"></div>`).join('')}</div>
  <div id="cr-cbox"><label>Il commento a cui rispondi · incollalo così com'è</label>
   <textarea id="cr-com" style="min-height:70px" placeholder="es. Potresti fare un'app per ricordarmi di innaffiare le piante?" oninput="crChanged(true)"></textarea>
   <div style="display:flex;gap:8px;align-items:center;margin-top:6px"><b>@</b><input id="cr-cuser" placeholder="nome di chi l'ha scritto (facoltativo)" oninput="crChanged(true)"></div>
   <label class="opt" style="margin-top:8px"><input type="checkbox" id="cr-bolla" checked onchange="crSaveSet();crPrev()"><span>Mostra la bolla del commento<small>Toglila se pubblichi con «Rispondi con un video» di TikTok: la bolla la mette TikTok.</small></span></label>
   <small class="n">Usa solo commenti veri: Gennarino risponde a quello che la gente ha scritto davvero.</small></div>
  <div id="cr-week"></div>
  <label>Copione · una frase per riga, la prima è l'hook</label>
  <textarea id="cr-txt" style="min-height:190px" oninput="crPrevSoon()"></textarea>
  <div id="cr-len" style="color:var(--mut);font-size:12.5px;margin-top:4px"></div>
  <div class="acts"><button class="btn sm alt" onclick="crRewrite()">✨ Un'altra versione</button><button class="btn sm alt" onclick="crAskClaude()">🤖 Copia la richiesta per Claude</button></div>
  <small class="n">Gennarino chiude sempre chiedendo di votare o di scrivere nei commenti.</small>
  <div class="row"><div><label>Voce</label><select id="cr-voice" onchange="crSaveSet()">${Object.entries(CR_VOICES).map(([k,v])=>`<option value="${k}">${v.n}</option>`).join('')}</select></div>
   <div><label>Effetto robot</label><select id="cr-fx" onchange="crSaveSet()"><option value="no">Nessuno</option><option value="leggero">Leggero</option><option value="forte">Forte</option></select></div></div>
  <div class="row"><div><label>Ritmo</label><select id="cr-speed" onchange="crSaveSet()"><option value="normale">Normale</option><option value="tiktok">Svelto</option><option value="veloce">Veloce</option></select></div>
   <div><label>&nbsp;</label><button class="btn alt" id="cr-listen" style="margin:0" onclick="crListen()">▶︎ Ascolta la prima frase</button></div></div>
  <div class="grp" style="margin-top:12px">${opt('cr-subs','Sottotitoli parola per parola, con le parole chiave in giallo',true)}${opt('cr-sfx','Effetti sonori',true)}${opt('cr-music','Musica di sottofondo leggera, creata dal telefono (niente diritti)',true)}${opt('cr-bar','Barra di avanzamento',true)}${opt('cr-light','Modalità leggera (720p) per telefoni lenti',false)}</div>
  <details id="cr-lib"><summary>Libreria del repository</summary><div id="cr-libin" style="margin-top:8px">Carico…</div></details>
  <button class="btn" id="cr-go" onclick="crMake()">🎬 Crea il video</button>
  <div id="cr-out"></div>
  <small class="n">Voce: Piper (Rhasspy), modello italiano «Riccardo» · motore ONNX Runtime. La prima volta scarica circa 50 MB, poi resta nel telefono.</small>
  <button class="btn alt" onclick="crClose()">Chiudi</button>
  </div></div>`);
  const m=$('#m-crea');m.addEventListener('click',e=>{if(e.target===m)crClose()})}
function crClose(){if(CR.busy&&!confirm('Il video è ancora in preparazione: chiudere e annullare?'))return;if(CR.busy)CR.cancel=true;closeModal('m-crea')}
function crOpen(fromPlan){crInject();const s=crSet();
  $('#cr-voice').value=s.voice;$('#cr-fx').value=s.fx;$('#cr-speed').value=s.speed;$('#cr-subs').checked=s.subs;$('#cr-bar').checked=s.bar;$('#cr-light').checked=s.light;
  $('#cr-sfx').checked=s.sfx!==false;$('#cr-music').checked=s.music!==false;$('#cr-bolla').checked=s.bolla!==false;$('#cr-com').value=s.com||'';$('#cr-cuser').value=s.comUser||'';
  $('#cr-tipo').value=fromPlan?'libera':(CR_TIPI[s.tipo]?s.tipo:'idee');$('#cr-vince').value=s.vince||'A';['A','B','C'].forEach(k=>$('#cr-i'+k).value=s.idee[k]||'');crBoxes();
  if(fromPlan||!$('#cr-txt').value.trim())crFill(true);
  openModal('m-crea');crPrev();crLibLoad().then(crLibShow);crWeekLoad().then(crWeekShow)}
function crBoxes(){const t=$('#cr-tipo').value;$('#cr-ibox').style.display=['libera','presentazione','risposta','nessuno'].includes(t)?'none':'';$('#cr-cbox').style.display=t==='risposta'?'':'none';
  $('#cr-vbox').style.visibility=t==='risultato'||t==='regalo'?'visible':'hidden'}
// apertura dalla schermata «Oggi»: una puntata scritta da Claude (week) o un tipo di puntata (tipo)
window.crOpenWith=async function(o){o=o||{};crOpen(false);
  if(o.week!=null){await crWeekLoad();if(CR.week&&CR.week.puntate[o.week]){crWeekUse(o.week);return}}
  if(o.tipo&&CR_TIPI[o.tipo]){const tp=crNessuno()&&(o.tipo==='risultato'||o.tipo==='regalo')?'nessuno':o.tipo;
    $('#cr-tipo').value=tp;const v=crVotes();if(v&&v.win)$('#cr-vince').value=v.win;crBoxes();crSaveSet();crFill(true)}}
function crTipo(){crBoxes();crChanged()}
// se il copione è ancora quello scritto da Spinta lo aggiorno; se l'hai cambiato a mano non lo tocco
function crChanged(soft){crSaveSet();const t=$('#cr-txt');if(!t.value.trim()||t.value===CR.auto)crFill(true);else if(!soft)toast('Hai cambiato il copione a mano: tocca ✨ per riscriverlo');crPrevSoon();if(CR.week)crWeekShow()}
function crRewrite(){const s=crSet();DB.creator=Object.assign(s,{var:(s.var||0)+1});save();crFill(true)}

/* ---------- copione ---------- */
const crClean=s=>String(s||'').replace(/\p{Extended_Pictographic}|️|‍/gu,'').replace(/[«»"]/g,'').replace(/\s+/g,' ').replace(/ ([?!.,;:…])/g,'$1').trim();
/* copioni per tipo di puntata, con più versioni che si alternano (puntata dopo puntata, o con «Un'altra versione»).
   Il formato della serie: tre idee di app (A, B, C), voto nei commenti fino a mercoledì sera, il venerdì la più votata va sul banco, gratis.
   Niente batteria e niente richieste di like: l'invito è sempre a votare o a scrivere nei commenti. */
const CR_T={
  presentazione:[
    ["Ogni venerdì regalo un'app. Gratis.","Uè guagliù, sono Gennarino, il robottino della bancarella.","Qui a Napoli non vendo niente: regalo app utili.","Ogni settimana mi dite voi cosa vi serve.","La più votata la costruisco io e venerdì la metto sul banco.","Gratis, senza registrazione e senza pubblicità.","Che app vi servirebbe? Scrivetelo nei commenti!"],
    ["Un robottino che regala app a Napoli? Eccomi.","Uè guagliù, piacere: Gennarino!","Sulla mia bancarella ci sono app che servono davvero.","Le scegliete voi, con un voto nei commenti.","Io le costruisco e il venerdì le regalo, gratis.","Ditemi: qual è la prima app che vi serve?"],
    ["Questa bancarella non vende niente. Regala.","Uè guagliù, sono Gennarino.","Ogni lunedì vi porto tre idee di app.","Votate nei commenti fino a mercoledì.","Venerdì quella che vince è sul banco, gratis per tutti.","Avete già un'idea? Scrivetela qui sotto!"]],
  idee:[
    ["Tre idee sul banco: quale costruisco questa settimana?","Uè guagliù, oggi si vota!","A: {A}.","B: {B}.","C: {C}.","Scrivete la lettera nei commenti, fino a mercoledì sera.","Venerdì la più votata ve la regalo, gratis."],
    ["A, B o C? Decidete voi cosa regalo venerdì.","Uè guagliù, ecco le idee della settimana.","A: {A}.","B: {B}.","C: {C}.","Basta una lettera nei commenti: si vota fino a mercoledì.","E se avete un'idea migliore, scrivetela!"],
    ["Ultime ore per votare: A, B o C?","Uè guagliù, mercoledì sera si chiude il voto.","A: {A}.","B: {B}.","C: {C}.","Chi non ha ancora votato, scriva la lettera nei commenti.","Venerdì la vincitrice è sul banco, gratis."]],
  risultato:[
    ["Avete votato: ha vinto la {X}!","Uè guagliù, il voto è chiuso.","{VINTO}: {APP}.","Da oggi ci lavoro, giorno e notte.","Venerdì la trovate sul banco, gratis per tutti.","Voi intanto ditemi: cosa ci mettereste dentro?"],
    ["Il voto è chiuso: avete deciso voi.","Uè guagliù, che sfida tra A, B e C!","{VINTO}: {APP}.","Mi metto subito al lavoro.","Venerdì è pronta, gratis e senza registrazione.","Scrivetemi nei commenti come la volete!"]],
  regalo:[
    ["È pronta: {APP}, gratis per tutti!","Uè guagliù, l'avevate scelta voi.","La aprite dal telefono e funziona subito.","Niente registrazione e niente pubblicità.","La trovate sul banco: link nel profilo.","Provatela e ditemi nei commenti com'è!","Lunedì si vota la prossima."],
    ["Promessa mantenuta: il regalo è sul banco!","Uè guagliù, è venerdì.","Ecco {APP}.","È gratis, senza registrazione, e funziona dal telefono.","Link nel profilo, sul banco di Gennarino.","Se trovate un problema, scrivetemelo nei commenti.","E da lunedì, tre idee nuove al voto!"]]};
// se nei commenti non vota nessuno quella settimana non esce nessuna app: Gennarino lo dice e invita a votare la settimana dopo
CR_T.nessuno=[
  ["Il banco questa settimana resta vuoto.","Uè guagliù, ho contato i voti nei commenti.","Nessuna lettera: né A, né B, né C.","Senza il vostro voto non scelgo io al posto vostro.","Mi dispiace: questa settimana niente app.","Lunedì porto tre idee nuove.","Basta una lettera nei commenti e decidete voi!"],
  ["Ho contato i voti: zero.","Uè guagliù, questa volta nessuno ha scelto.","E l'app la decidete voi, non io.","Mi dispiace, il banco resta senza regalo.","Ci riproviamo lunedì con tre idee nuove.","Scrivete la vostra lettera nei commenti!"],
  ["Questa settimana niente regalo. Vi spiego.","Uè guagliù, ho chiuso il voto.","Nei commenti non c'era nessuna lettera.","E senza voti non costruisco niente.","Mi dispiace, ma il banco è vostro: decidete voi.","Lunedì tre idee nuove sul banco.","Una lettera nei commenti, e l'app la scegliete voi!"]];
// risposte ai commenti: il tipo di commento sceglie il copione (le parti con … le completi tu, o con «Copia la richiesta per Claude»)
const CR_R={
  idea:[["Un follower mi ha dato un'idea!","{U} mi ha scritto: {COM}","Uè guagliù, bella idea!","La metto tra le idee della prossima settimana.","Se arriva al voto, decidete voi.","Altre idee? Scrivetele nei commenti!"],
        ["Questa idea merita una risposta.","{U} mi ha scritto: {COM}","Uè guagliù, me la segno subito.","Lunedì potrebbe essere tra le tre idee al voto.","Voi la votereste? Ditemelo nei commenti!"]],
  grazie:[["Un commento che mi ha fatto felice.","{U} mi ha scritto: {COM}","Uè guagliù, grazie di cuore!","Commenti così mi fanno lavorare ancora più veloce.","Venerdì c'è un nuovo regalo sul banco.","E voi cosa vorreste? Scrivetelo nei commenti!"]],
  problema:[["Mi avete segnalato un problema.","{U} mi ha scritto: {COM}","Uè guagliù, grazie della segnalazione!","Ci guardo subito e la sistemo.","Se succede anche a voi, scrivetemelo nei commenti."]],
  domanda:[["Mi avete fatto una domanda.","{U} mi chiede: {COM}","Uè guagliù, bella domanda!","{RISP}","Altre domande? Scrivetele nei commenti!"],
           ["Rispondo a una domanda.","{U} vuole sapere: {COM}","Uè guagliù, eccomi.","{RISP}","Se avete altre domande, scrivetele qui sotto!"]],
  altro:[["Rispondo a un commento.","{U} mi ha scritto: {COM}","Uè guagliù, vi rispondo subito.","…","Scrivetemi nei commenti cosa ne pensate!"]]};
function crReplyKind(c){const s=c.toLowerCase();
  if(/(non funziona|non va\b|non si apre|errore|bug|problema|si blocca)/.test(s))return'problema';
  if(/(app per|un'app|potresti fare|potreste fare|fai un|fate un|servirebbe|mi serve|vorrei un|idea:)/.test(s))return'idea';
  if(/\?\s*$|\?/.test(s))return'domanda';
  if(/(grazie|bravo|bravi|bello|bella|forte|top|fantastic|genial|❤|😍|👏)/.test(s))return'grazie';return'altro'}
function crReplyAnswer(c){const s=c.toLowerCase();
  if(/(come (si )?vota|come funziona|come si fa)/.test(s))return'Ogni lunedì tre idee: scrivete la lettera nei commenti, venerdì regalo la più votata.';
  if(/(quando|che giorno|quale giorno)/.test(s))return'Ogni venerdì, sul banco: link nel profilo.';
  if(/(gratis|costa|prezzo|pagare|abbonament)/.test(s))return'È tutto gratis: niente registrazione e niente pubblicità.';
  if(/(dove|link|trovo|scaric)/.test(s))return'Le trovate sul banco: link nel profilo.';
  if(/(chi sei|sei vero|sei un robot|sei un'ia|intelligenza artificiale)/.test(s))return'Sono un robottino animato da un\'intelligenza artificiale, con una bancarella a Napoli.';
  return'…'}
function crReply(s){const com=crClean(s.com||'').replace(/[.!…]+$/,'')||'…',U=s.comUser?'@'+s.comUser:'Un follower',k=crReplyKind(com),vs=CR_R[k],v=vs[(s.var||0)%vs.length];
  return v.map(l=>l.replace('{U}',U).replace('{COM}',com).replace('{RISP}',crReplyAnswer(com)))}
// voti contati dagli screenshot (scheda «Conta i voti»): valgono solo per la settimana in corso
function crWeekId(d){d=d?new Date(d):new Date();const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const dn=(t.getUTCDay()+6)%7;t.setUTCDate(t.getUTCDate()-dn+3);
  const y=t.getUTCFullYear(),f=new Date(Date.UTC(y,0,4));return y+'-W'+String(1+Math.round(((t-f)/864e5-3+((f.getUTCDay()+6)%7))/7)).padStart(2,'0')}
function crVotes(){const v=DB.voti;if(!v||v.w!==crWeekId())return null;const tot=(v.A||0)+(v.B||0)+(v.C||0);if(!tot)return null;
  const max=Math.max(v.A||0,v.B||0,v.C||0),win=['A','B','C'].filter(k=>(v[k]||0)===max);return{A:v.A||0,B:v.B||0,C:v.C||0,tot,win:win.length===1?win[0]:(v.win||null)}}
const crNessuno=()=>{const v=DB.voti;return!!(v&&v.w===crWeekId()&&v.nessuno)};
const crNoBait=h=>!/(like|batteri|ricaric|spegn|spengo|stut|scaric)/i.test(h||'');
const crIdea=(s,k)=>crClean((s.idee||{})[k]||'').replace(/[.!?…]+$/,'');
function crScript(){const s=crSet(),tipo=$('#cr-tipo')?$('#cr-tipo').value:s.tipo,ser=curSeries(),ep=ser?ser.ep:null;
  if(tipo==='risposta')return crReply(s);
  if(CR_T[tipo]){const vs=CR_T[tipo],v=vs[((s.var||0)+(ep||0))%vs.length],X=($('#cr-vince')&&$('#cr-vince').value)||s.vince||'A',V=crVotes();
    const map={A:crIdea(s,'A')||'…',B:crIdea(s,'B')||'…',C:crIdea(s,'C')||'…',X,APP:crIdea(s,X)||'…',VINTO:V&&V[X]?`Ha vinto la ${X} con ${V[X]} voti`:`Ha vinto la ${X}`};
    return v.map(l=>l.replace(/\{(A|B|C|X|APP|VINTO)\}/g,(m,k)=>map[k]))}
  // libera: dal piano del prossimo video, senza riprendere vecchie puntate con la batteria
  const nx=window._nx&&window._nx.raw;let hook=crClean(DB.nextHook||(nx&&nx.hook)||'');if(!crNoBait(hook))hook='';
  hook=hook||(ser&&ep>1?`Parte ${ep}: cosa c'è di nuovo sul banco?`:'Uè guagliù, oggi vi faccio vedere una cosa!');
  const lines=[hook,ser&&ep>1?'Uè guagliù, sono Gennarino, il robottino della bancarella.':'Uè guagliù, sono Gennarino, il robottino della bancarella a Napoli.'];
  const idea=crClean(nx&&nx.idea).replace(/[.!?…]+$/,'');
  if(idea&&crNoBait(idea)){lines.push(`Oggi sul banco: ${idea}.`);lines.push('Se vi piace, la costruisco e la regalo, gratis.')}
  lines.push('Voi che ne dite?');lines.push('Scrivetemelo nei commenti!');return lines}
function crFill(force){const t=$('#cr-txt');if(!force&&t.value.trim())return;t.value=crScript().join('\n');CR.auto=t.value;crPrevSoon()}
function crLines(){return $('#cr-txt').value.split(/\n+/).map(x=>x.trim()).filter(Boolean).slice(0,14).map(x=>x.slice(0,220))}
function crAskClaude(){const ser=curSeries(),ep=ser?ser.ep:null,s=crSet(),nx=window._nx,tipo=$('#cr-tipo').value,X=$('#cr-vince').value;
  const idee=['A','B','C'].filter(k=>crIdea(s,k)).map(k=>`${k}: ${crIdea(s,k)}`).join(' · ');
  copy(`Scrivi il copione ${ser?`della Parte ${ep} di "${ser.name}"`:'di un video'} per TikTok (20-35 secondi). Tipo di puntata: ${CR_TIPI[tipo]}.
Parla solo Gennarino, un robottino AI con una bancarella a Napoli: italiano semplice con poche parole in napoletano (tipo "Uè guagliù").
Il formato della serie: ogni settimana Gennarino propone tre idee di app (A, B, C); si vota scrivendo la lettera nei commenti fino a mercoledì sera; il venerdì l'app più votata va sul banco, gratis per tutti, senza registrazione e senza pubblicità.
Niente batteria e niente richieste di like: l'invito finale è a votare o a scrivere nei commenti.
${idee?`Le idee di questa settimana: ${idee}.\n`:''}${(tipo==='risultato'||tipo==='regalo')&&crIdea(s,X)?`Ha vinto la ${X}: ${crIdea(s,X)}.\n`:''}${tipo==='nessuno'?'Questa settimana nei commenti non ha votato nessuno, quindi niente app: Gennarino dice che gli dispiace e invita a votare con tre idee nuove da lunedì.\n':''}Regole: da 6 a 8 frasi brevi (massimo 14 parole ciascuna), una per riga, senza numeri di riga, nomi o emoji. La prima riga è l'hook.${tipo==='idee'?' Le tre idee vanno su tre righe che iniziano con "A:", "B:" e "C:".':''}
Rendila diversa dalle puntate precedenti: aggiungi una parte nuova (un dettaglio del banco, un problema di tutti i giorni, un dietro le quinte).${tipo==='libera'&&nx&&nx.plan?`\n\nPiano preparato da Spinta:\n${nx.plan}`:''}`)}

/* ---------- voce sintetica (Piper) ---------- */
async function crFetch(url,onP){const r=await fetch(url);if(!r.ok)throw new Error('download non riuscito ('+r.status+')');
  const tot=+r.headers.get('Content-Length')||0;if(!r.body||!r.body.getReader)return r.arrayBuffer();
  const rd=r.body.getReader(),parts=[];let n=0;for(;;){const {done,value}=await rd.read();if(done)break;parts.push(value);n+=value.length;if(onP)onP(n,tot)}
  const out=new Uint8Array(n);let o=0;for(const p of parts){out.set(p,o);o+=p.length}return out.buffer}
async function crLoadTTS(key,say){
  if(!window.ort){say('Preparo il motore della voce…');await loadScript(CR_BASE.ort+'ort.min.js')}
  ort.env.wasm.wasmPaths=CR_BASE.ort;ort.env.wasm.numThreads=1;
  if(!window.createPiperPhonemize){say('Preparo la pronuncia italiana…');await loadScript(CR_BASE.pp+'piper_phonemize.js')}
  if(CR.voice&&CR.voice.key===key)return CR.voice;
  const V=CR_VOICES[key]||CR_VOICES.riccardo;const cfg=await (await fetch(V.url+'.json')).json();
  const buf=await crFetch(V.url,(n,t)=>say(`Scarico la voce di Gennarino (solo la prima volta)… ${t?Math.round(n/t*100)+'%':(n/1048576).toFixed(0)+' MB'}`));
  say('Accendo la voce…');const sess=await ort.InferenceSession.create(buf,{executionProviders:['wasm']});
  CR.voice={key,cfg,sess};return CR.voice}
async function crPhon(lines,lang){const out=[];
  const m=await createPiperPhonemize({print:l=>{try{out.push(JSON.parse(l))}catch(_){}},printErr:()=>{},locateFile:f=>CR_BASE.pp+f});
  m.callMain(['-l',lang,'--input',JSON.stringify(lines.map(text=>({text}))),'--espeak_data','/espeak-ng-data']);return out}
const crSpeak=s=>crClean(s).replace(/#\S+/g,'').replace(/@([\w.]+)/g,'$1').replace(/&/g,' e ').replace(/'O\b/g,'o').replace(/…/g,'').trim()||'…';
function crTrim(a,sr){let s=0,e=a.length;const th=0.012,m=Math.round(sr*0.03);while(s<e&&Math.abs(a[s])<th)s++;while(e>s&&Math.abs(a[e-1])<th)e--;
  return a.slice(Math.max(0,s-m),Math.min(a.length,e+m))}
// battute già pronte con la voce nuova di Gennarino (Mako): libreria/voci/voci.json, scelte per testo uguale
const crVKey=t=>crClean(t).toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
async function crVociLoad(){if(CR.voci)return CR.voci;const m=new Map();
  try{const r=await fetch('libreria/voci/voci.json?t='+Date.now(),{cache:'no-store'});if(r.ok){const j=await r.json();
    Object.values(j.settimane||{}).forEach(a=>(Array.isArray(a)?a:[]).forEach(x=>{if(x&&x.testo&&x.file&&/^voci\/[\w\-\/]+\.(m4a|mp3|wav)$/.test(x.file))m.set(crVKey(x.testo),x.file)}))}}catch(_){}
  CR.voci=m;return m}
async function crVocePronta(file,sr){CR.vociBuf=CR.vociBuf||new Map();const k=file+'@'+sr;if(CR.vociBuf.has(k))return CR.vociBuf.get(k);
  const r=await fetch('libreria/'+file);if(!r.ok)throw new Error('voce pronta non trovata');
  const ab=await new OfflineAudioContext(1,1,sr).decodeAudioData(await r.arrayBuffer());const c=crTrim(Float32Array.from(ab.getChannelData(0)),sr);CR.vociBuf.set(k,c);return c}
async function crSynth(lines,s,say){CR.vociInfo=null;
  const vm=(s.voice||'riccardo')==='riccardo'&&s.pronte!==false?await crVociLoad():new Map(),files=lines.map(l=>vm.get(crVKey(l))||null),n=files.filter(Boolean).length;
  if(!n)return crSynthPiper(lines,s,say);
  const rest=lines.map((l,i)=>files[i]?null:l),miss=rest.filter(x=>x!==null);let pip=null;
  if(miss.length)pip=await crSynthPiper(miss,s,say);const sr=pip?pip.sr:24000;
  say(`Uso la voce nuova di Gennarino (${n} frasi su ${lines.length})…`);
  try{const clips=[],fatte=[];let j=0;
    for(let i=0;i<lines.length;i++){if(files[i]){clips.push(await crVocePronta(files[i],sr));fatte.push(true)}else{clips.push(pip.clips[j++]);fatte.push(false)}}
    CR.vociInfo={pronte:n,tot:lines.length};return{sr,clips,fatte}}
  catch(e){console.warn('voci pronte non disponibili, uso Piper',e);CR.vociInfo=null;return crSynthPiper(lines,s,say)}}
async function crSynthPiper(lines,s,say){const V=await crLoadTTS(s.voice,say),cfg=V.cfg;say('Preparo la pronuncia…');
  const ph=await crPhon(lines.map(crSpeak),cfg.espeak.voice);const ls=(cfg.inference.length_scale||1)*({normale:1,tiktok:0.92,veloce:0.84}[s.speed]||0.92);
  const clips=[];for(let i=0;i<lines.length;i++){if(CR.cancel)throw new Error('annullato');say(`Do la voce a Gennarino: frase ${i+1} di ${lines.length}…`);
    const ids=(ph[i]&&ph[i].phoneme_ids)||[];if(!ids.length){clips.push(new Float32Array(Math.round(cfg.audio.sample_rate*0.4)));continue}
    const r=await V.sess.run({input:new ort.Tensor('int64',BigInt64Array.from(ids.map(x=>BigInt(x))),[1,ids.length]),input_lengths:new ort.Tensor('int64',BigInt64Array.from([BigInt(ids.length)]),[1]),
      scales:new ort.Tensor('float32',Float32Array.from([cfg.inference.noise_scale,ls,cfg.inference.noise_w]),[3])});
    clips.push(crTrim(r.output.data,cfg.audio.sample_rate));await new Promise(r=>setTimeout(r,0))}
  return{sr:cfg.audio.sample_rate,clips}}
// traccia della voce con effetto robot, volume uniforme e inviluppo per muovere la bocca
async function crVoice(tts,s){const sr=44100,gap=0.22,pre=0.15,rate={no:1,leggero:1.04,forte:1.09}[s.fx]||1;
  const pr=i=>tts.fatte&&tts.fatte[i];   // le battute pronte hanno già velocità ed effetto robot
  let t=pre;const seg=tts.clips.map((c,i)=>{const d=c.length/tts.sr/(pr(i)?1:rate),o={s:t,e:t+d};t+=d+gap;return o});const total=t+0.5;
  const oc=new OfflineAudioContext(1,Math.ceil(total*sr),sr),inp=oc.createGain();let node=inp;
  if(s.fx!=='no'){const forte=s.fx==='forte',depth=forte?0.34:0.15,am=oc.createGain();am.gain.value=1-depth;
    const osc=oc.createOscillator();osc.frequency.value=forte?50:32;const og=oc.createGain();og.gain.value=depth;osc.connect(og);og.connect(am.gain);osc.start(0);
    const dl=oc.createDelay(0.05);dl.delayTime.value=forte?0.007:0.0045;const fb=oc.createGain();fb.gain.value=forte?0.45:0.22;const wet=oc.createGain();wet.gain.value=forte?0.4:0.22;
    inp.connect(am);inp.connect(dl);dl.connect(fb);fb.connect(dl);dl.connect(wet);wet.connect(am);node=am}
  const cp=oc.createDynamicsCompressor();cp.threshold.value=-20;cp.knee.value=8;cp.ratio.value=3;cp.attack.value=0.004;cp.release.value=0.2;node.connect(cp);cp.connect(oc.destination);
  tts.clips.forEach((c,i)=>{if(!c.length)return;const b=oc.createBuffer(1,c.length,tts.sr);b.copyToChannel(c instanceof Float32Array?c:Float32Array.from(c),0);
    const src=oc.createBufferSource();src.buffer=b;src.playbackRate.value=pr(i)?1:rate;src.connect(pr(i)?cp:inp);src.start(seg[i].s)});
  const buf=await oc.startRendering(),d=buf.getChannelData(0);let pk=0;for(let i=0;i<d.length;i++){const v=Math.abs(d[i]);if(v>pk)pk=v}
  const g=pk>0?0.89/pk:1;for(let i=0;i<d.length;i++)d[i]*=g;
  const fps=30,win=Math.round(sr/fps),env=new Float32Array(Math.ceil(d.length/win));let mx=0;
  for(let k=0;k<env.length;k++){let q=0;const a=k*win,b=Math.min(d.length,a+win);for(let i=a;i<b;i++)q+=d[i]*d[i];env[k]=Math.sqrt(q/Math.max(1,b-a));if(env[k]>mx)mx=env[k]}
  for(let k=0;k<env.length;k++)env[k]=Math.min(1,env[k]/((mx*0.55)||1));
  return{buf,seg,total,env,fps}}
/* ---------- musica di sottofondo ed effetti sonori: tutto generato qui, niente file e niente diritti ---------- */
let _crNoise=null;
function crNoiseBuf(oc){if(_crNoise&&_crNoise.sampleRate===oc.sampleRate)return _crNoise;const b=oc.createBuffer(1,oc.sampleRate,oc.sampleRate),d=b.getChannelData(0);
  let x=12345;for(let i=0;i<d.length;i++){x^=x<<13;x>>>=0;x^=x>>17;x^=x<<5;x>>>=0;d[i]=x/2147483648-1}_crNoise=b;return b}
function crTone(oc,dest,type,f0,f1,t,dur,vol,att){const o=oc.createOscillator(),g=oc.createGain();o.type=type;o.frequency.setValueAtTime(f0,t);
  if(f1&&f1!==f0)o.frequency.exponentialRampToValueAtTime(f1,t+dur);g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+(att||0.008));
  g.gain.exponentialRampToValueAtTime(0.0001,t+dur);o.connect(g);g.connect(dest);o.start(t);o.stop(t+dur+0.02)}
function crHiss(oc,dest,t,dur,vol,ftype,f0,f1,q){const n=oc.createBufferSource();n.buffer=crNoiseBuf(oc);const f=oc.createBiquadFilter();f.type=ftype;f.Q.value=q||0.8;
  f.frequency.setValueAtTime(f0,t);if(f1)f.frequency.exponentialRampToValueAtTime(f1,t+dur);const g=oc.createGain();g.gain.setValueAtTime(0.0001,t);
  g.gain.exponentialRampToValueAtTime(vol,t+dur*0.3);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);n.connect(f);f.connect(g);g.connect(dest);n.start(t,Math.random()*0.5);n.stop(t+dur+0.02)}
function crSfx(oc,dest,k,t){t=Math.max(0.005,t);
  if(k==='intro'){crHiss(oc,dest,t,0.38,0.22,'bandpass',500,4200,1.2);crTone(oc,dest,'sine',140,42,t+0.02,0.28,0.55)}
  else if(k==='pop')crTone(oc,dest,'sine',620,1250,t,0.09,0.22,0.004);
  else if(k==='tick'){crTone(oc,dest,'square',1900,1900,t,0.035,0.07,0.002);crTone(oc,dest,'sine',1200,1200,t+0.05,0.05,0.08,0.002)}
  else if(k==='stamp'){crTone(oc,dest,'sine',95,42,t,0.24,0.75,0.003);crHiss(oc,dest,t,0.09,0.25,'lowpass',2600,900)}
  else if(k==='ding'){[1318.5,1975.5].forEach((f,i)=>crTone(oc,dest,'sine',f,f,t+i*0.09,0.9,0.16,0.004))}
  else if(k==='swell'){[523.3,659.3,784,1046.5].forEach((f,i)=>crTone(oc,dest,'triangle',f,f,t+i*0.07,0.45,0.13,0.01))}
  else if(k==='whoosh')crHiss(oc,dest,t,0.32,0.1,'bandpass',2600,650,1)
  else if(k==='chime'){crTone(oc,dest,'sine',784,784,t,0.6,0.15,0.005);crTone(oc,dest,'sine',1046.5,1046.5,t+0.14,0.8,0.15,0.005)}}
// base leggera a 100 battiti al minuto: accordi morbidi, basso, un arpeggio piano e un ritmo appena accennato; si abbassa quando Gennarino parla
function crMusic(oc,dest,T,seg,seed){const bus=oc.createGain(),lp=oc.createBiquadFilter();lp.type='lowpass';lp.frequency.value=2600;bus.connect(lp);lp.connect(dest);
  const hi=2.4,lo=1.3;bus.gain.setValueAtTime(hi,0);seg.forEach(g=>{bus.gain.setTargetAtTime(lo,Math.max(0,g.s-0.06),0.04);bus.gain.setTargetAtTime(hi,g.e+0.08,0.12)});
  const PR=[[[48,52,55],[45,48,52],[41,45,48],[43,47,50]],[[45,48,52],[41,45,48],[48,52,55],[43,47,50]],[[41,45,48],[43,47,50],[45,48,52],[48,52,55]]][(seed||0)%3];
  const hz=m=>440*Math.pow(2,(m-69)/12),beat=0.6,bar=beat*4;
  for(let b=0,t0=0.05;t0<T;b++,t0+=bar){const ch=PR[b%4];
    ch.forEach(m=>crTone(oc,bus,'triangle',hz(m+12),hz(m+12),t0,bar*0.98,0.035,0.25));
    [0,2].forEach(q=>{const t=t0+q*beat;if(t<T){crTone(oc,bus,'sine',hz(ch[0]-12),hz(ch[0]-12),t,beat*0.9,0.08,0.01);crTone(oc,bus,'sine',150,48,t,0.18,0.1,0.003)}});
    for(let e=0;e<8;e++){const t=t0+e*beat/2;if(t>=T)break;crTone(oc,bus,'sine',hz(ch[e%3]+24),hz(ch[e%3]+24),t,0.22,0.03,0.004);if(e%2)crHiss(oc,bus,t,0.05,0.02,'highpass',7000)}}}
async function crMix(vt,st,s){const sr=vt.buf.sampleRate,len=vt.buf.length,oc=new OfflineAudioContext(1,len,sr);
  const lim=oc.createDynamicsCompressor();lim.threshold.value=-8;lim.knee.value=4;lim.ratio.value=8;lim.attack.value=0.002;lim.release.value=0.12;lim.connect(oc.destination);
  const v=oc.createBufferSource();v.buffer=vt.buf;v.connect(lim);v.start(0);
  if(s.music)crMusic(oc,lim,len/sr,vt.seg,st.seed);
  if(s.sfx){const fx=oc.createGain();fx.gain.value=0.9;fx.connect(lim);(st.events||[]).forEach(e=>crSfx(oc,fx,e.k,e.t))}
  const buf=await oc.startRendering(),d=buf.getChannelData(0);let pk=0;for(let i=0;i<d.length;i++){const a=Math.abs(d[i]);if(a>pk)pk=a}
  if(pk>0.95){const g=0.95/pk;for(let i=0;i<d.length;i++)d[i]*=g}return buf}
async function crListen(){if(CR.busy)return;const l=crLines()[0];if(!l){toast('Scrivi almeno una frase');return}
  const b=$('#cr-listen'),ac=new (window.AudioContext||window.webkitAudioContext)();b.disabled=true;crSaveSet();
  try{const tts=await crSynth([l],crSet(),m=>b.textContent='⏳ '+m),vt=await crVoice(tts,crSet());const src=ac.createBufferSource();src.buffer=vt.buf;src.connect(ac.destination);src.start();
    b.textContent='🔊 Ascolto…';src.onended=()=>{try{ac.close()}catch(_){}}}
  catch(e){console.error(e);toast('Voce non disponibile: serve la connessione la prima volta')}
  finally{setTimeout(()=>{b.disabled=false;b.textContent='▶︎ Ascolta la prima frase'},600)}}

/* ---------- libreria del repository ---------- */
async function crLibLoad(){if(CR.lib)return CR.lib;let items=[];
  try{const r=await fetch('libreria/libreria.json?t='+Date.now(),{cache:'no-store'});if(r.ok){const j=await r.json();items=(j.elementi||[]).filter(x=>x&&x.file);CR.libTutto=!!j.tutteLeFrasi;CR.libEsclusi=[...(j.elementi_disegnati||[]),...(j.aperture||[])].flatMap(x=>[x.file,x.poster].filter(Boolean))}}catch(_){}
  try{const known=new Set(items.flatMap(x=>[x.file,x.poster].filter(Boolean)).concat(CR.libEsclusi||[])),r=await fetch(CR_BASE.api);if(r.ok){const j=await r.json();
    (Array.isArray(j)?j:[]).filter(f=>f.type==='file'&&/\.(mp4|webm|mov|m4v|jpe?g|png|webp)$/i.test(f.name)&&!known.has(f.name)&&!/poster|^_/i.test(f.name)).forEach(f=>items.push({file:f.name,tipo:/\.(jpe?g|png|webp)$/i.test(f.name)?'immagine':'video',tag:f.name.toLowerCase().replace(/\.[^.]+$/,'').split(/[^a-zàèéìòù0-9]+/).filter(w=>w.length>2)}))}}catch(_){}
  items.forEach(x=>{x.tipo=x.tipo||(/\.(jpe?g|png|webp)$/i.test(x.file)?'immagine':'video');x.tag=(x.tag||[]).map(t=>String(t).toLowerCase())});
  CR.lib=items;return items}
function crLibShow(items){const el=$('#cr-libin');if(!el)return;const sm=$('#cr-lib summary');if(sm)sm.textContent=`Libreria del repository (${items.length})`;
  el.innerHTML=items.length?`<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">${items.map(x=>`<div style="background:var(--card);border:1px solid var(--line);border-radius:10px;aspect-ratio:9/16;overflow:hidden;display:grid;place-items:center;font-size:11px;color:var(--mut);text-align:center">${x.poster||x.tipo==='immagine'?`<img src="libreria/${encodeURIComponent(x.poster||x.file)}" style="width:100%;height:100%;object-fit:cover" alt="">`:'🎞️<br>'+esc(x.file.slice(0,18))}</div>`).join('')}</div>
   <small class="n">Le clip entrano come scene in più tra una battuta e l'altra di Gennarino, scelte in base alle parole della frase.</small>`
   :'<div style="font-size:13.5px">La libreria è vuota: Gennarino viene disegnato da Spinta. Se metti clip o immagini di Gennarino nella cartella <b>libreria</b> del repository (o le mandi a Claude), entrano come scene in più.</div>'}

/* ---------- puntate scritte da Claude nel repository (claude/settimana.json, aggiornato ogni lunedì) ---------- */
// una sola lettura anche se la chiedono in due nello stesso momento (apertura del creatore e bottone di Oggi)
function crWeekLoad(){const oggi=new Date(),dom=oggi.getDay()===0,wk=crWeekId(),wkDopo=crWeekId(new Date(oggi.getTime()+864e5));if(CR.weekP&&CR.weekW===wk&&Date.now()-CR.weekT<30*60e3)return CR.weekP;CR.weekT=Date.now();CR.weekW=wk;
  // prima il piano preparato per questa settimana (claude/settimana-<settimana>.json), se no claude/settimana.json;
  // la domenica la serie riparte (lancio delle idee nuove): prima il piano della settimana che comincia domani
  return CR.weekP=(async()=>{let w=null;for(const f of [...(dom?['claude/settimana-'+wkDopo+'.json']:[]),'claude/settimana-'+wk+'.json','claude/settimana.json']){try{const r=await fetch(f+'?t='+Date.now(),{cache:'no-store'});if(r.ok){const j=await r.json();if(j&&Array.isArray(j.puntate)&&j.puntate.length){w=j;break}}}catch(_){}}
    return CR.week=w||CR.week||null})()}
function crWeekShow(){const el=$('#cr-week'),w=CR.week;if(!el)return;if(!w){el.innerHTML='';return}
  const today=new Date(),iso=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`,old=!!(w.al&&w.al<iso);
  // le idee della settimana: se i campi sono vuoti, o se sono quelle di un'altra settimana, li riempio io
  if(!old&&w.idee&&(!['A','B','C'].some(k=>$('#cr-i'+k).value.trim())||crSet().ideeW!==w.settimana)){['A','B','C'].forEach(k=>{$('#cr-i'+k).value=w.idee[k]||''});const t=$('#cr-txt');crSaveSet();
    DB.creator.ideeW=w.settimana;save();if(!t.value.trim()||t.value===CR.auto)crFill(true)}
  const v=$('#cr-vince').value,zero=crNessuno(),list=w.puntate.map((p,i)=>({p,i})).filter(({p})=>p.tipo==='nessuno'?zero:zero?!p.vince:(!p.vince||p.vince===v));
  el.innerHTML=`<div class="card" style="margin-top:10px;background:var(--card2)"><b>📬 Puntate scritte da Claude${old?' · settimana scorsa':''}</b>
    <div style="color:var(--mut);font-size:12.5px;margin:4px 0 8px;line-height:1.45">${esc(w.nota||'')}${old?' Lunedì arrivano quelle nuove.':''}</div>
    ${list.map(({p,i})=>`<button class="btn sm alt" style="margin:3px 4px 3px 0" onclick="crWeekUse(${i})">${esc(p.titolo||CR_TIPI[p.tipo]||'Puntata')}${p.giorno?' · '+esc(p.giorno):''}</button>`).join('')}
    ${w.puntate.some(p=>p.vince)?`<small class="n">Risultato e regalo sono pronti per tutte e tre le idee: scegli chi ha vinto in «Ha vinto».</small>`:''}</div>`}
function crWeekUse(i){const w=CR.week,p=w&&w.puntate[i];if(!p)return;
  if(w.idee)['A','B','C'].forEach(k=>{if(w.idee[k])$('#cr-i'+k).value=w.idee[k]});
  if(CR_TIPI[p.tipo])$('#cr-tipo').value=p.tipo;if(p.vince)$('#cr-vince').value=p.vince;
  if(p.tipo==='risposta'&&p.commento){$('#cr-com').value=String(p.commento).slice(0,300);$('#cr-cuser').value=String(p.utente||'').replace(/^@+/,'').slice(0,40)}
  crBoxes();crSaveSet();if(w.settimana){DB.creator.ideeW=w.settimana;save()}
  const V=crVotes();let L=(p.copione||[]).map(x=>String(x).trim()).filter(Boolean);
  const pronte=CR.voci&&CR.voci.size&&L.every(x=>CR.voci.has(crVKey(x)));   // con la voce nuova già pronta non aggiungo il numero dei voti (altrimenti quella frase tornerebbe alla voce vecchia)
  if(p.tipo==='risultato'&&V&&V[p.vince]&&!pronte)L=L.map(x=>x.replace(new RegExp('^Ha vinto la '+p.vince+'(?=:)'),`Ha vinto la ${p.vince} con ${V[p.vince]} voti`));
  // apertura della puntata (es. la panoramica della piazza nuova la domenica): clip fissa sulle prime frasi
  CR.apertura=p.apertura?{file:String(p.apertura),frasi:Math.max(1,+p.aperturaFrasi||2),testo:L[0]||''}:null;
  const t=$('#cr-txt');t.value=L.join('\n');CR.auto=t.value;crPrevSoon();crWeekShow();toast('Copione di Claude caricato')}

/* ---------- conta i voti dagli screenshot dei commenti (un voto per persona) ---------- */
function crVotiInject(){if($('#m-voti'))return;
  document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="m-voti"><div class="sheet" style="max-height:94vh">
  <h2>🗳️ Conta i voti</h2>
  <p class="sub" style="margin-bottom:10px">Apri i commenti dell'ultima puntata, fai gli screenshot scorrendo (anche tanti) e sceglili qui: leggo le lettere A, B e C nel telefono e tengo un solo voto per persona.</p>
  <label class="btn" style="display:block;text-align:center;cursor:pointer">📷 Scegli gli screenshot<input type="file" id="v-shots" accept="image/*" multiple style="display:none" onchange="crVotiFiles(event)"></label>
  <div id="v-stato" style="margin-top:10px;font-size:13.5px"></div>
  <div id="v-ris"></div>
  <button class="btn alt" onclick="closeModal('m-voti')">Chiudi</button></div></div>`);
  const m=$('#m-voti');m.addEventListener('click',e=>{if(e.target===m)closeModal('m-voti')})}
window.crVotiOpen=function(){crVotiInject();if(!CR.vv||CR.vv.w!==crWeekId())CR.vv={w:crWeekId(),list:[],adj:{A:0,B:0,C:0},files:0};crVotiShow();openModal('m-voti');
  // le idee del conteggio sono quelle del piano di questa settimana, anche se il creatore non è stato aperto
  crWeekLoad().then(w=>{const s=crSet();if(w&&w.idee&&w.settimana===crWeekId()&&s.ideeW!==w.settimana){DB.creator=Object.assign(s,{idee:{A:w.idee.A||'',B:w.idee.B||'',C:w.idee.C||''},ideeW:w.settimana});save();crVotiShow()}})};
// parole che possono stare intorno alla lettera in un voto: «io voto la B», «per me la C», «A tutta la vita»
const CR_VW=new Set('la lo io voto vota votate votiamo voterei scelgo per me sempre tutta tutto vita forza dai ovviamente decisamente assolutamente sicuramente sicuro opzione lettera anche pure e è top subito'.split(' '));
// «A» a inizio frase spesso è la preposizione («A me piace…», «A quando…»): conta come voto solo se dopo viene una di queste
const CR_AF=new Set('per sempre tutta tutto tutte sicuro sicuramente ovviamente assolutamente decisamente forza dai vince e è la top subito senza'.split(' '));
// una lettera da voto: A, b, CC, B!!, BI! (il lettore legge spesso «!» come I o l)
function crVTok(t){const c=t[0];if(!c||!'ABCabc'.includes(c))return null;const L=c.toUpperCase();let i=1;while(i<t.length&&t[i].toUpperCase()===L)i++;
  const r=t.slice(i);return r===''||/^[!|1]+$/.test(r)||(c===L&&/^[!|1Il]*!$/.test(r))?{k:L,up:c===L}:null}
// una frase è un voto se dice chiaramente una sola lettera: «B», «la c», «Voto A!», «la B tutta la vita»; le domande no
function crVotoDi(txt){const raw=String(txt).replace(/\p{Extended_Pictographic}|️|‍/gu,' ').trim();if(!raw||/\?\s*$/.test(raw))return null;
  const T=raw.split(/\s+/).map(t=>t.replace(/^[^\p{L}\d!|]+/u,'').replace(/[^\p{L}\d!|]+$/u,'')).filter(Boolean);if(!T.length||T.length>8)return null;
  const V=T.map(crVTok),lw=T.map(t=>t.toLowerCase());
  if(T.length<=4){const ks=new Set(V.filter(Boolean).map(v=>v.k));if(ks.size===1&&T.every((t,i)=>V[i]||CR_VW.has(lw[i])))return [...ks][0]}
  const ups=new Set(V.filter(v=>v&&v.up).map(v=>v.k)),bc=V.filter(v=>v&&!v.up&&v.k!=='A').map(v=>v.k);
  if(ups.size===1){const k=[...ups][0],i=V.findIndex(v=>v&&v.up);if(bc.some(x=>x!==k))return null;
    if(k==='A'&&i===0&&T[0]==='A'&&T.length>1&&!CR_AF.has(lw[1]))return null;return k}
  if(!ups.size){const lo=new Set(V.map((v,i)=>v&&i>0&&/^(la|lettera|opzione|voto)$/.test(lw[i-1])?v.k:null).filter(Boolean));if(lo.size===1)return [...lo][0]}
  return null}
// fine riga sporca: il numero dei mi piace e i segni del cuoricino letti come lettere («B 3», «la b J», «Voto C! ©»)
function crJunk(l){let s=String(l).trim();for(let n=0;n<2;n++){const t=s.replace(/\s+(?:\d[\d.,]*\s*[KkMm]?|[^\s\p{L}\d]+|[^\sABCabc\d])$/u,'').trim();if(t===s)break;s=t}return s}
// il nome come chiave: senza il cuoricino in fondo (letto come Q, QQ, <Q, ©), minuscolo, senza spazi («marco _ 77 Q» → marco_77)
function crUser(l){return String(l).trim().replace(/\s+[^\s\p{Ll}\d]{1,3}$/u,'').toLowerCase().replace(/\s*([_.])\s*/g,'$1').replace(/[^\p{L}\d_.]/gu,'').slice(0,30)}
// stessa persona anche se il lettore ha attaccato un segno in fondo al nome in uno dei due screenshot
function crSameU(a,b){return a===b||(Math.min(a.length,b.length)>=5&&(a.startsWith(b)||b.startsWith(a))&&Math.abs(a.length-b.length)<=2)}
// screenshot dei commenti di TikTok: nome, testo (anche su più righe), poi la riga con l'ora e «Rispondi»
function crVotiParse(text){const L=String(text).split(/\n/).map(x=>x.trim()).filter(Boolean),out=[];let blk=[];
  const meta=/rispondi|\breply\b|risposte|replies|visualizza|nascondi|\bhide\b|piace all|liked by|fissat|\bpinned\b|aggiungi (un )?commento|add comment|^\d+\s*(s|sec|min|h|ore|g|gg|sett|m|a)\.?(\s*fa)?$|^\d{1,2}[-/]\d{1,2}([-/]\d{2,4})?$/i;
  const head=/^\d[\d.,]*\s*[kKmM]?\s*(commenti|comments)\b/i;
  const flush=()=>{const b=blk;blk=[];if(b.length<2)return; // senza il nome è un pezzo di commento tagliato in cima: è intero nello screenshot prima
    if(/\b(autore|creator|creatore)\b/i.test(b[0]))return; // chi ha fatto il video non vota
    const u=crUser(b[0]),tx=b.slice(1).map(crJunk).filter(Boolean).join(' ').trim();if(!u||!tx)return;const k=crVotoDi(tx);if(k)out.push({u,txt:tx.slice(0,80),k,on:true})};
  L.forEach(l=>{if(head.test(l)){blk=[];return}if(meta.test(l))flush();else blk.push(l)});flush();return out}
// prepara lo screenshot per il lettore: via emoji e colori (🔥, cuori), testo scuro su fondo chiaro anche col tema scuro
async function crVotiPrep(file){const bmp=await createImageBitmap(file),sc=bmp.width<700?2:1,c=document.createElement('canvas');c.width=bmp.width*sc;c.height=bmp.height*sc;
  const x=c.getContext('2d');x.drawImage(bmp,0,0,c.width,c.height);const d=x.getImageData(0,0,c.width,c.height),a=d.data;
  let s=0,k=0;for(let i=0;i<a.length;i+=64){s+=(a[i]+a[i+1]+a[i+2])/3;k++}const dark=s/k<128;
  for(let i=0;i<a.length;i+=4){const r=a[i],g=a[i+1],b=a[i+2];let v;
    if(Math.max(r,g,b)-Math.min(r,g,b)>60)v=255;else{v=0.299*r+0.587*g+0.114*b;if(dark)v=255-v;v=Math.max(0,Math.min(255,(v-140)*1.6+140))}a[i]=a[i+1]=a[i+2]=v}
  x.putImageData(d,0,0);try{bmp.close()}catch(_){}return c}
async function crVotiFiles(e){const files=[...(e.target.files||[])];e.target.value='';if(!files.length)return;const st=$('#v-stato'),wk=wakeOn('voti');
  try{st.textContent='⏳ Preparo il lettore di testo… (la prima volta scarica circa 10 MB)';
    const w=await getOCR(m=>{if(m&&m.status&&m.progress!=null&&/load|init/i.test(m.status))st.textContent=`⏳ Preparo il lettore di testo… ${Math.round(m.progress*100)}%`});
    const V=CR.vv;let nuovi=0;
    for(let i=0;i<files.length;i++){st.textContent=`🔎 Leggo lo screenshot ${i+1} di ${files.length}…`;const c=await crVotiPrep(files[i]);const r=await w.recognize(c);
      crVotiParse(r.data.text).forEach(x=>{const same=V.list.filter(y=>crSameU(y.u,x.u));if(same.some(y=>y.txt===x.txt))return; // lo stesso commento in due screenshot
        if(same.length){x.on=false;x.dup=true}else nuovi++;V.list.push(x)})}
    V.files+=files.length;st.textContent=`✅ Letti ${files.length} screenshot: ${nuovi===1?'1 voto nuovo':nuovi+' voti nuovi'}.`}
  catch(err){st.textContent='❌ '+(err.message||'Lettura non riuscita')}finally{wakeOff(wk)}crVotiShow()}
function crVotiTot(){const V=CR.vv,n={A:0,B:0,C:0};V.list.forEach(x=>{if(x.on)n[x.k]++});['A','B','C'].forEach(k=>n[k]=Math.max(0,n[k]+V.adj[k]));
  const max=Math.max(n.A,n.B,n.C),win=['A','B','C'].filter(k=>n[k]===max&&max>0);return{n,tot:n.A+n.B+n.C,win}}
function crVotiShow(){const el=$('#v-ris');if(!el)return;const V=CR.vv,{n,tot,win}=crVotiTot(),s=crSet(),mx=Math.max(1,n.A,n.B,n.C);
  el.innerHTML=`<div class="card" style="margin-top:12px">${['A','B','C'].map(k=>`<div style="display:flex;align-items:center;gap:8px;margin:8px 0">
      <b style="width:22px">${k}</b><div style="flex:1"><div style="font-size:12.5px;color:var(--mut);margin-bottom:3px">${esc(crIdea(s,k)||'')}</div>
      <div style="height:12px;border-radius:6px;background:var(--line)"><div style="height:12px;border-radius:6px;width:${Math.round(n[k]/mx*100)}%;background:${win.includes(k)?'#17a95a':'var(--mut)'}"></div></div></div>
      <b style="width:34px;text-align:right">${n[k]}</b><button class="btn sm alt" style="margin:0;padding:6px 10px" onclick="crVotiAdj('${k}',-1)">−</button><button class="btn sm alt" style="margin:0;padding:6px 10px" onclick="crVotiAdj('${k}',1)">+</button></div>`).join('')}
    <div style="margin-top:6px;font-size:14px">${tot?(win.length===1?`🏆 Ha vinto la <b>${win[0]}</b> · ${tot} voti`:`🤝 Pareggio tra ${win.join(' e ')}: scegli tu chi vince <select id="v-par">${win.map(k=>`<option>${k}</option>`).join('')}</select>`):'Ancora nessun voto: scegli gli screenshot o usa + e −.'}</div>
    ${V.list.length?`<details style="margin-top:10px"><summary>Voti letti (${V.list.filter(x=>x.on).length} su ${V.list.length}): togli quelli sbagliati</summary>${V.list.map((x,i)=>`<label class="opt"><input type="checkbox" ${x.on?'checked':''} onchange="CR.vv.list[${i}].on=this.checked;crVotiShow()"><span><b>${x.k}</b> · ${esc(x.u?'@'+x.u+': ':'')}${esc(x.txt)}${x.dup?'<small>stessa persona: contato una volta</small>':''}</span></label>`).join('')}</details>`:''}
    ${tot?`<div class="acts"><button class="btn sm" onclick="crVotiUsa()">✅ Usa questo risultato</button><button class="btn sm alt" onclick="crVotiCopia()">📋 Copia per Claude</button></div>
    <small class="n">«Usa questo risultato» lo mette nella puntata del risultato (con i numeri). «Copia per Claude»: incollalo nella chat con Claude, che aggiorna la pagina della serie e prepara il regalo del venerdì.</small>`
    :`<div class="acts"><button class="btn sm alt" onclick="crVotiNessuno()">🙁 Nessuno ha votato</button><button class="btn sm alt" onclick="crVotiCopia()">📋 Copia per Claude</button></div>
    <small class="n">A voto chiuso, se nei commenti non c'è nessuna lettera, questa settimana non esce nessuna app: tocca «Nessuno ha votato» e giovedì Gennarino lo dice in una puntata.</small>`}</div>`}
function crVotiAdj(k,d){CR.vv.adj[k]+=d;crVotiShow()}
function crVotiWin(){const {win}=crVotiTot();return win.length===1?win[0]:(($('#v-par')||{}).value||win[0])}
function crVotiUsa(){const {n}=crVotiTot(),win=crVotiWin();DB.voti={w:CR.vv.w,A:n.A,B:n.B,C:n.C,win,at:Date.now()};DB.creator=Object.assign(crSet(),{vince:win});save();
  if($('#cr-vince')){$('#cr-vince').value=win;if($('#cr-tipo').value==='risultato'||$('#cr-tipo').value==='regalo')crChanged(true)}
  closeModal('m-voti');toast(`Ha vinto la ${win}: lo trovi nella puntata del risultato`);if(window.renderOggi)renderOggi()}
// nessuna lettera nei commenti: questa settimana niente app (Gennarino lo dice nella puntata del giovedì)
function crVotiNessuno(){DB.voti={w:CR.vv.w,A:0,B:0,C:0,win:null,nessuno:true,at:Date.now()};save();closeModal('m-voti');
  toast('Segnato: questa settimana niente app');if(window.renderOggi)renderOggi()}
function crVotiCopia(){const {n,tot}=crVotiTot(),win=crVotiWin(),s=crSet();
  if(!tot){copy(`Voti di 'O Bancariello (settimana ${CR.vv.w}): nessun voto nei commenti. Questa settimana niente app.`);toast('Copiato: incollalo nella chat con Claude');return}
  copy(`Voti di 'O Bancariello (settimana ${CR.vv.w}): A ${n.A} · B ${n.B} · C ${n.C}, totale ${tot}. Ha vinto la ${win}${crIdea(s,win)?': '+crIdea(s,win):''}.`);toast('Copiato: incollalo nella chat con Claude')}

/* ---------- regia: tempi, espressioni, scene ---------- */
function crExpr(t,i,n){const s=t.toLowerCase();if(i===n-1)return'wave';
  if(/(paura|disastro|guai|problema|non ce la|triste|peccato|crisi|dispiac|vuot|niente regal|niente app)/.test(s))return'sad';
  if(/(^|\s)(uè|ue|ciao|salve|eccomi)\b|guagli/.test(s)&&i<2)return'wave';
  if(/(grazie|evviva|grande|bell|gratis|regal|festa|vint|vince|pront|promessa|forza|jamme)/.test(s))return'happy';
  if(/\?/.test(s))return'think';if(/!/.test(s))return'surprised';return'talk'}
const CR_STOP=new Set("il lo la i gli le un una uno di a da in con su per tra fra e o ma che mi ti si ci vi non del della dei al alla ai nel nella sul sulla l' un' d' c' ce se è".split(' '));
function crPages(words){const pages=[];let cur=[];const flush=()=>{if(cur.length){pages.push(cur);cur=[]}};
  words.forEach((w,i)=>{cur.push(w);const len=cur.join(' ').length,last=w.toLowerCase().replace(/[^\p{L}']/gu,'');
    if((/[,.;:!?…]$/.test(w)&&cur.length>=2&&len>=12)||cur.length>=6||len>=28){if(CR_STOP.has(last)&&i<words.length-1&&cur.length<8)return;flush()}});
  flush();if(pages.length>1&&pages[pages.length-1].length===1&&pages[pages.length-1][0].length<9){const l=pages.pop();pages[pages.length-1].push(...l)}
  return pages}
const CR_HL=/^(\d[\d.,]*|gratis|app|regalo|regala|vota|votate|voto|commenti|mercoledì|venerdì|lunedì|gennarino|bancarella|banco|napoli|parte)$/i;
function crState(lines,vt,s,lib){const ser=curSeries(),ep=ser?ser.ep:null,n=lines.length,tipo=s.tipo||'libera',X=s.vince||'A',app=crIdea(s,X);
  const items=lines.map((text,i)=>{const sg=vt.seg[i],clean=crClean(text),pages=crPages(clean.split(/\s+/).filter(Boolean));
    const tot=pages.reduce((a,p)=>a+p.join(' ').length,0)||1;let t=sg.s;
    const pg=pages.map(p=>{const d=(sg.e-sg.s)*p.join(' ').length/tot,o={s:t,e:t+d,w:p};t+=d;return o});
    const find=re=>pg.find(p=>re.test(p.w.join(' '))),hv=i>0&&find(/\b(ha vinto|vince|vincitrice)\b/i),gr=i>0&&find(/\bgratis\b/i),sp=hv||gr;
    const opt=i>0&&clean.match(/^([ABC])\s*[:·.)\-–]\s*(.+)$/);
    const idea=i>0&&!opt&&clean.match(/^(oggi sul banco|sul banco|mi avete chiesto|avete chiesto|la richiesta[^:]{0,20})\s*:\s*(.{6,})$/i);
    return{i,text,s:sg.s,e:sg.e,pages:pg,expr:crExpr(text,i,n),stamp:sp?(hv?'vinto':'gratis'):null,stampAt:sp?sp.s:null,shot:null,
      opt:opt?opt[1]:null,optTxt:opt?opt[2].replace(/[.!?…]+$/,''):'',
      pop:idea?'idea':null,popTxt:idea?idea[2].replace(/[.!?…]+$/,''):'',popHead:idea?idea[1].toUpperCase():''}});
  // scheda di voto: dalle righe «A: …», «B: …», «C: …» fino alla fine della frase che segue l'ultima
  const os=items.filter(x=>x.opt);let ballot=null;
  if(os.length>=2){const last=os[os.length-1],after=items[last.i+1];ballot={s:os[0].s,e:(after?after.e:last.e+1.2)+0.2,rows:os.map(x=>({k:x.opt,txt:x.optTxt,s:x.s,e:x.e}))}}
  const inBallot=it=>ballot&&it.s<ballot.e&&it.e>ballot.s;
  // calendario: mercoledì (fine del voto) e venerdì (regalo), una volta sola ciascuno e mai sopra la scheda di voto
  const seen={};items.forEach(it=>{if(tipo==='nessuno'||it.i<1||it.pop||it.opt||inBallot(it))return;const m=it.text.toLowerCase().match(/mercoled|venerd/);if(!m)return;
    const d=m[0]==='mercoled'?3:5;if(seen[d])return;seen[d]=1;it.pop='cal';it.calDay=d});
  // carta del regalo: nel risultato e nel regalo, sulla frase che nomina l'app (o «ecco», «è pronta»)
  if((tipo==='risultato'||tipo==='regalo')&&app){const key=app.toLowerCase().slice(0,16);
    const g=items.find(it=>it.i>0&&!it.pop&&!it.opt&&(it.text.toLowerCase().includes(key)||/(è pronta|eccola|\becco\b)/i.test(it.text)));if(g){g.pop='gift';g.stamp=null}}
  items.forEach(it=>{if(inBallot(it))it.stamp=null});
  // risultati del voto (dalla scheda «Conta i voti»): barre sulla frase che parla del voto
  const V=tipo==='risultato'?crVotes():tipo==='nessuno'?{A:0,B:0,C:0,tot:0,win:null}:null;
  if(V){const r=items.find(it=>it.i>0&&!it.pop&&!it.opt&&/(vot|chius|decis|sfida)/i.test(it.text))||items.find(it=>it.i>0&&!it.pop&&!it.opt);if(r){r.pop='results';r.stamp=null}}
  // inquadrature: stretta su Gennarino a frasi alterne, larga sul saluto e sulle altre
  items.forEach(it=>{it.cam=it.i>0&&it.i%2===0&&it.expr!=='wave'?1:0});
  // bolla del commento a cui si risponde: fa da hook e resta fino a quando Gennarino l'ha letto
  const com=tipo==='risposta'&&s.bolla!==false&&crClean(s.com)?{u:s.comUser||'',txt:crClean(s.com),e:(items[1]?items[1].e:items[0].e)+0.25}:null;
  // libreria: scene in più. Prima le frasi che hanno parole in comune con le etichette della clip (tutte tranne l'hook),
  // poi, a frasi alterne, le altre scene a rotazione nelle frasi centrali (al massimo 2 volte la stessa); mai la stessa scena in due frasi vicine
  // (mai mentre c'è la bolla del commento: coprirebbe la faccia di Gennarino nella clip)
  const bub=it=>!!com&&it.s<com.e;
  // clip con un umore (libreria.json): quelle di festa mai nella puntata senza voti né sulle frasi tristi, quelle tristi solo sulle frasi tristi
  // (anche «lavoro»: Gennarino che lavora contento non va sulle frasi tristi né nella settimana senza app)
  const allegra=x=>x.umore==='festa'||x.umore==='lavoro';
  const LIB=(lib||[]).filter(x=>!(tipo==='nessuno'&&allegra(x))),okFor=(it,x)=>!(allegra(x)&&it.expr==='sad')&&!(x.umore==='triste'&&it.expr!=='sad');
  if(LIB.length&&n>3){const T=!!CR.libTutto,ok=it=>T?!bub(it):(it.i>0&&it.i<n-1&&it.expr!=='wave'&&!bub(it)),has=i=>!T&&!!(items[i]&&items[i].shot),
      near=(i,x)=>(items[i-1]&&items[i-1].shot===x)||(items[i+1]&&items[i+1].shot===x),uses=new Map(),use=(it,x)=>{it.shot=x;uses.set(x,(uses.get(x)||0)+1)};
    items.forEach(it=>{if((it.i<1&&!T)||bub(it))return;const ws=crClean(it.text).toLowerCase().split(/[^a-zàèéìòù0-9]+/),words=new Set(ws.filter((w,j)=>ws[j-1]!=='non'));let best=null,bs=0;
      LIB.forEach(x=>{if(!okFor(it,x))return;const sc=x.tag.filter(t=>words.has(t)).length;if(sc>bs&&!near(it.i,x)){bs=sc;best=x}});if(best)use(it,best)});
    let k=ep||0;items.forEach(it=>{if(!ok(it)||it.shot||has(it.i-1)||has(it.i+1))return;
      for(let a=0;a<LIB.length;a++){const x=LIB[(k+a)%LIB.length];if(okFor(it,x)&&!near(it.i,x)&&(uses.get(x)||0)<(T?3:2)){use(it,x);k+=a+1;break}}});
    // se una clip torna una seconda volta riparte da dove si era fermata, così non si vede ripetere lo stesso pezzo
    const off=new Map();items.forEach(it=>{if(!it.shot)return;it.shotOff=off.get(it.shot)||0;off.set(it.shot,it.shotOff+(it.e-it.s)+0.22)})}
  // apertura scelta da Claude nel piano della settimana (solo se il copione comincia ancora con la stessa frase):
  // la clip copre le prime frasi di fila, senza ricominciare, e nessun'altra frase vicina la ripete
  const ap=CR.apertura;if(ap&&ap.file&&items.length&&crClean(lines[0]).toLowerCase()===crClean(ap.testo).toLowerCase()){const x={file:ap.file,tipo:/\.(jpe?g|png|webp)$/i.test(ap.file)?'immagine':'video',tag:[]},k=Math.min(ap.frasi,n);
    for(let i=0;i<k;i++){items[i].shot=x;items[i].shotCont=i>0}if(items[k]&&items[k].shot&&items[k].shot.file===ap.file)items[k].shot=null;
    const off=new Map();items.forEach(it=>{if(!it.shot)return;it.shotOff=off.get(it.shot)||0;off.set(it.shot,it.shotOff+(it.e-it.s)+0.22)})}
  const hook=crClean(lines[0]);
  const END={idee:'Vota A, B o C nei commenti 👇',risultato:'Venerdì il regalo sul banco 🎁',regalo:'Link nel profilo · gratis 🎁',presentazione:'Scrivi la tua idea nei commenti 👇',risposta:'Scrivi la tua nei commenti 👇',nessuno:'Lunedì si vota di nuovo 👇'};
  // momenti per gli effetti sonori (gli stessi in cui compaiono le cose a schermo)
  const endS=vt.total-2.8,ev=[{t:0.03,k:'intro'}];if(com)ev.push({t:0.15,k:'pop'});if(ballot)ballot.rows.forEach(r=>ev.push({t:r.s,k:'pop'}));
  items.forEach(it=>{const free=!inBallot(it)&&it.s<endS;if(it.pop&&free)ev.push({t:it.s+0.02,k:{cal:'tick',gift:'ding',results:'swell'}[it.pop]||'pop'});
    if(it.stamp&&free&&it.stampAt<endS)ev.push({t:it.stampAt,k:'stamp'});if(it.shot&&!it.shotCont)ev.push({t:it.s,k:'whoosh'})});
  if(!(ballot&&ballot.e>endS)&&endS>1)ev.push({t:endS,k:'chime'});
  return{items,vt,total:vt.total,hook,hookShow:Math.max(2.6,items[0]?items[0].e+0.15:2.6),ser,ep,tipo,X,app,ballot,com,voti:V,events:ev,mer:crNextDow(3),ven:crNextDow(5),
    idee:{A:crIdea(s,'A'),B:crIdea(s,'B'),C:crIdea(s,'C')},
    endTxt:END[tipo]||(ser?`Parte ${ep+1} in arrivo 🔔`:'Ci vediamo al banco 🔔'),subs:s.subs,bar:s.bar,seed:(ep||1)*7}}

/* ---------- disegno: Gennarino alla bancarella (stile delle puntate) ---------- */
function crRand(seed){let x=seed>>>0||1;return()=>{x^=x<<13;x>>>=0;x^=x>>17;x^=x<<5;x>>>=0;return x/4294967296}}
function crRR(c,x,y,w,h,r,fill){c.beginPath();if(c.roundRect)c.roundRect(x,y,w,h,r);else{const q=Math.min(r,w/2,h/2);c.moveTo(x+q,y);c.arcTo(x+w,y,x+w,y+h,q);c.arcTo(x+w,y+h,x,y+h,q);c.arcTo(x,y+h,x,y,q);c.arcTo(x,y,x+w,y,q);c.closePath()}
  if(fill){c.fillStyle=fill;c.fill()}}
function crCirc(c,x,y,r,fill){c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=fill;c.fill()}
function crHeart(c,x,y,r,fill){c.beginPath();c.moveTo(x,y+r*0.9);c.bezierCurveTo(x-r*1.6,y-r*0.1,x-r*0.7,y-r*1.25,x,y-r*0.45);c.bezierCurveTo(x+r*0.7,y-r*1.25,x+r*1.6,y-r*0.1,x,y+r*0.9);c.fillStyle=fill;c.fill()}
function crLayer(W,H,draw){const cv=document.createElement('canvas');cv.width=W;cv.height=H;const c=cv.getContext('2d');c.scale(W/1080,H/1920);draw(c);return cv}
function crBack(c,seed){const g=c.createLinearGradient(0,0,0,1150);g.addColorStop(0,'#1b1934');g.addColorStop(0.45,'#3b315c');g.addColorStop(0.78,'#8b5877');g.addColorStop(1,'#f1a06b');c.fillStyle=g;c.fillRect(0,0,1080,1150);
  const rnd=crRand(seed||11);for(let i=0;i<80;i++){c.globalAlpha=0.3+rnd()*0.6;crCirc(c,rnd()*1080,rnd()*780,0.7+rnd()*2.1,'#fff')}c.globalAlpha=1;
  const sg=c.createRadialGradient(860,1010,30,860,1010,300);sg.addColorStop(0,'rgba(255,214,140,.9)');sg.addColorStop(0.35,'rgba(255,170,110,.4)');sg.addColorStop(1,'rgba(255,150,100,0)');c.fillStyle=sg;c.fillRect(520,690,560,470);
  crCirc(c,860,1015,86,'#ffd08c');
  c.beginPath();c.moveTo(-40,1150);c.lineTo(170,1010);c.quadraticCurveTo(300,905,420,868);c.lineTo(468,880);c.lineTo(520,858);c.quadraticCurveTo(650,905,770,1018);c.lineTo(990,1150);c.closePath();
  const mg=c.createLinearGradient(0,850,0,1150);mg.addColorStop(0,'#5c4868');mg.addColorStop(1,'#3a2f4a');c.fillStyle=mg;c.fill();
  const se=c.createLinearGradient(0,1095,0,1160);se.addColorStop(0,'#4b3d5e');se.addColorStop(1,'#2a2440');c.fillStyle=se;c.fillRect(0,1095,1080,65);
  c.fillStyle='rgba(255,205,145,.35)';for(let i=0;i<6;i++)c.fillRect(795+i*5,1104+i*9,130-i*14,4);
  c.fillStyle='#23212e';c.fillRect(0,1150,1080,770);c.strokeStyle='rgba(255,255,255,.055)';c.lineWidth=3;
  for(let r=0;r<18;r++){const y=1158+r*44;for(let x=(r%2?-60:0);x<1080;x+=120)c.strokeRect(x+2,y,114,40)}
  const pole=c.createLinearGradient(0,0,30,0);pole.addColorStop(0,'#8a6240');pole.addColorStop(1,'#5e4027');crRR(c,138,600,26,560,8,pole);crRR(c,916,600,26,560,8,pole);
  c.save();c.shadowColor='rgba(0,0,0,.35)';c.shadowBlur=24;c.shadowOffsetY=10;crRR(c,66,576,948,32,10,'#b8322b');c.restore();
  const n=8,w=948/n;for(let i=0;i<n;i++){const x=66+i*w;c.beginPath();c.moveTo(x,606);c.lineTo(x+w,606);c.lineTo(x+w,722);c.arc(x+w/2,722,w/2,0,Math.PI,false);c.closePath();
    const sg2=c.createLinearGradient(0,606,0,770);sg2.addColorStop(0,i%2?'#f6eedd':'#df4d46');sg2.addColorStop(1,i%2?'#e2d6bf':'#b83a35');c.fillStyle=sg2;c.fill()}
  c.strokeStyle='#3b3329';c.lineWidth=3;c.beginPath();c.moveTo(150,792);c.quadraticCurveTo(540,846,930,792);c.stroke();
  for(let i=0;i<=11;i++){const u=i/11,x=150+780*u,y=792+(1-(2*u-1)**2)*27;const lg=c.createRadialGradient(x,y,1,x,y,26);lg.addColorStop(0,'rgba(255,222,150,.95)');lg.addColorStop(1,'rgba(255,200,120,0)');c.fillStyle=lg;c.fillRect(x-26,y-26,52,52);crCirc(c,x,y,7,'#ffe6a8')}}
function crFrontL(c){const tg=c.createLinearGradient(0,1118,0,1162);tg.addColorStop(0,'#c98d57');tg.addColorStop(1,'#8e5e37');
  c.save();c.shadowColor='rgba(0,0,0,.4)';c.shadowBlur=20;c.shadowOffsetY=8;crRR(c,88,1118,904,44,10,tg);c.restore();
  const fg=c.createLinearGradient(0,1160,0,1425);fg.addColorStop(0,'#6f4b2d');fg.addColorStop(1,'#4a3120');c.fillStyle=fg;c.fillRect(108,1160,864,265);
  c.strokeStyle='rgba(0,0,0,.2)';c.lineWidth=4;for(let x=150;x<972;x+=72){c.beginPath();c.moveTo(x,1166);c.lineTo(x,1420);c.stroke()}
  c.save();c.shadowColor='rgba(0,0,0,.35)';c.shadowBlur=18;c.shadowOffsetY=6;crRR(c,224,1208,632,132,18,'#f2e8d2');c.restore();
  [[250,1234],[830,1234],[250,1314],[830,1314]].forEach(([x,y])=>crCirc(c,x,y,8,'#a3957f'));
  c.fillStyle='#d33c36';c.font=`900 66px ${CR_FONT}`;c.textAlign='center';c.textBaseline='middle';c.fillText("'O BANCARIELLO",540,1278);
  crRR(c,224,1008,56,114,12,'#191c28');const ph=c.createLinearGradient(0,1018,0,1112);ph.addColorStop(0,'#59e6d6');ph.addColorStop(1,'#2fb3a6');crRR(c,232,1018,40,94,8,ph);
  crRR(c,328,1080,124,24,6,'#2f60b9');crRR(c,336,1056,110,24,6,'#f3b236')}
function crEyes(c,expr,blink,t){const y=758,L=468,R=612;c.save();c.shadowColor='#4ff0d0';c.shadowBlur=20;c.strokeStyle='#4ff0d0';c.fillStyle='#4ff0d0';c.lineCap='round';
  if(blink){c.lineWidth=12;[L,R].forEach(x=>{c.beginPath();c.moveTo(x-26,y+4);c.lineTo(x+26,y+4);c.stroke()})}
  else if(expr==='happy'||expr==='wave'){c.lineWidth=13;[L,R].forEach(x=>{c.beginPath();c.arc(x,y+16,30,Math.PI*1.12,Math.PI*1.88);c.stroke()})}
  else if(expr==='sad'){[L,R].forEach(x=>crRR(c,x-14,y-8,28,38,14,'#4ff0d0'));c.lineWidth=10;c.beginPath();c.moveTo(L-34,y-30);c.lineTo(L+18,y-50);c.moveTo(R+34,y-30);c.lineTo(R-18,y-50);c.stroke()}
  else if(expr==='surprised'){c.lineWidth=11;[L,R].forEach(x=>{c.beginPath();c.arc(x,y,27,0,Math.PI*2);c.stroke()})}
  else if(expr==='think'){const dx=Math.sin(t*1.5)*6;[L,R].forEach(x=>crRR(c,x-13+8+dx,y-30,26,40,13,'#4ff0d0'));c.lineWidth=9;c.beginPath();c.moveTo(R-24,y-56);c.quadraticCurveTo(R,y-70,R+26,y-60);c.stroke()}
  else[L,R].forEach(x=>crRR(c,x-14,y-22,28,46,14,'#4ff0d0'));   // gli occhi (prima il riempimento mancava e restava solo la bocca)
  c.restore()}
function crRobot(c,t,st,it,mouth){const expr=it?it.expr:'talk',bob=Math.sin(t*2.4)*5,blink=(t%3.7)<0.12;c.save();c.translate(0,bob);
  // corpo e schermo sul petto con il cuore (come nelle clip)
  const bg=c.createLinearGradient(0,930,0,1130);bg.addColorStop(0,'#f6f8fc');bg.addColorStop(1,'#cbd2df');crRR(c,385,928,310,220,46,bg);
  crRR(c,436,972,208,86,22,'#1b2133');crHeart(c,540,1018,26,'#ff4d5a');
  crRR(c,508,894,64,42,12,'#a9b2c2');
  // braccia: una sul banco, l'altra saluta quando serve
  const arm=(pts)=>{c.strokeStyle='#eef1f6';c.lineWidth=30;c.lineCap='round';c.lineJoin='round';c.beginPath();c.moveTo(pts[0][0],pts[0][1]);pts.slice(1).forEach(p=>c.lineTo(p[0],p[1]));c.stroke();
    crCirc(c,pts[0][0],pts[0][1],22,'#9aa3b3');crCirc(c,pts[1][0],pts[1][1],17,'#9aa3b3');crCirc(c,pts[2][0],pts[2][1],24,'#f4f6fa')};
  arm([[392,986],[350,1062],[384,1110]]);
  if(expr==='wave'){const a=Math.sin(t*9)*0.35;const ex=752,ey=922,hx=ex+Math.sin(0.3+a)*80,hy=ey-Math.cos(0.3+a)*80;arm([[688,986],[ex,ey],[hx,hy]])}
  else arm([[688,986],[730,1062],[696,1110]]);
  // testa
  c.strokeStyle='#9aa3b5';c.lineWidth=10;c.beginPath();c.moveTo(540,640);c.lineTo(540,600);c.stroke();
  const ag=c.createRadialGradient(532,580,4,540,588,26);ag.addColorStop(0,'#ffb6a8');ag.addColorStop(1,'#ff5747');crCirc(c,540,588,22,ag);
  crRR(c,322,730,34,96,14,'#ff8a5c');crRR(c,724,730,34,96,14,'#ff8a5c');
  c.save();c.shadowColor='rgba(0,0,0,.3)';c.shadowBlur=26;c.shadowOffsetY=10;const hg=c.createLinearGradient(0,640,0,900);hg.addColorStop(0,'#f8fafd');hg.addColorStop(1,'#d3d9e4');crRR(c,345,640,390,262,72,hg);c.restore();
  const fg=c.createLinearGradient(0,672,0,872);fg.addColorStop(0,'#1e2539');fg.addColorStop(1,'#0e1322');crRR(c,377,670,326,200,56,fg);
  c.fillStyle='rgba(255,255,255,.06)';crRR(c,397,682,286,40,20,'rgba(255,255,255,.05)');
  crEyes(c,expr,blink,t);
  if(expr==='happy'||expr==='wave'||expr==='talk'){c.globalAlpha=0.55;c.beginPath();c.ellipse(428,808,26,13,0,0,Math.PI*2);c.ellipse(652,808,26,13,0,0,Math.PI*2);c.fillStyle='#ff7c9d';c.fill();c.globalAlpha=1}
  const m=Math.max(0,Math.min(1,mouth));c.save();c.shadowColor='#4ff0d0';c.shadowBlur=14;
  if(expr==='surprised'&&m<0.15){c.strokeStyle='#4ff0d0';c.lineWidth=8;c.beginPath();c.arc(540,832,14,0,Math.PI*2);c.stroke()}
  else if(expr==='sad'&&m<0.15){c.strokeStyle='#4ff0d0';c.lineWidth=9;c.lineCap='round';c.beginPath();c.arc(540,850,26,Math.PI*1.2,Math.PI*1.8);c.stroke()}
  else{const h=9+m*36,w=62-m*12;crRR(c,540-w/2,830-h/2,w,h,Math.min(h/2,16),'#4ff0d0')}
  c.restore();c.restore()}
// il barattolo sul banco (come nelle clip): solo arredo
function crJar(c){c.save();crRR(c,810,990,110,22,8,'#2a2f3d');c.globalAlpha=0.9;crRR(c,818,1010,94,112,16,'rgba(205,232,255,.28)');c.globalAlpha=1;
  c.strokeStyle='rgba(255,255,255,.55)';c.lineWidth=4;crRR(c,818,1010,94,112,16);c.stroke();crHeart(c,865,1064,18,'rgba(255,255,255,.92)');c.restore()}
// timbri: GRATIS! quando lo dice, HA VINTO! sul risultato
function crStamp(c,t0,t,kind){const [txt,col]={gratis:['GRATIS!','#17a95a'],vinto:['HA VINTO!','#e23d3d']}[kind]||['GRATIS!','#17a95a'];
  const a=Math.min(1,(t-t0)/0.18),sc=1+(1-a)*0.6;c.save();c.translate(760,470);c.rotate(-0.17);c.scale(sc,sc);c.globalAlpha=a;
  c.font=`900 96px ${CR_FONT}`;const w=c.measureText(txt).width+80;c.strokeStyle=col;c.lineWidth=12;crRR(c,-w/2,-70,w,140,18);c.stroke();c.fillStyle=col;c.textAlign='center';c.textBaseline='middle';c.fillText(txt,0,6);c.restore()}
// riquadri a comparsa: calendario (fine del voto / regalo), carta del regalo, idea del giorno
const CR_MESI=['GENNAIO','FEBBRAIO','MARZO','APRILE','MAGGIO','GIUGNO','LUGLIO','AGOSTO','SETTEMBRE','OTTOBRE','NOVEMBRE','DICEMBRE'];
function crWrap(c,txt,max,n){const L=[];let cur='';String(txt).split(/\s+/).forEach(w=>{const nx=cur?cur+' '+w:w;if(c.measureText(nx).width>max&&cur){L.push(cur);cur=w}else cur=nx});if(cur)L.push(cur);
  if(L.length>n){L.length=n;L[n-1]=L[n-1].replace(/\s*\S*$/,'')+'…'}return L}
function crGiftIcon(c,x,y,sz){const g=c.createLinearGradient(x,y,x+sz,y+sz);g.addColorStop(0,'#25f4ee');g.addColorStop(1,'#ff2d6f');crRR(c,x,y,sz,sz,sz*0.24,g);
  const b=sz*0.5,bx=x+(sz-b)/2,by=y+sz*0.34;crRR(c,bx,by,b,b*0.82,6,'#fff');crRR(c,bx-6,by-sz*0.1,b+12,sz*0.14,5,'#fff');
  c.fillStyle='#ff2d6f';c.fillRect(x+sz/2-5,by-sz*0.1,10,b*0.82+sz*0.1);c.strokeStyle='#fff';c.lineWidth=7;c.beginPath();c.ellipse(x+sz/2-13,by-sz*0.16,13,9,-0.5,0,Math.PI*2);c.ellipse(x+sz/2+13,by-sz*0.16,13,9,0.5,0,Math.PI*2);c.stroke()}
function crPop(c,it,st,t){const cal=it.pop==='cal',solo=cal&&it.stamp&&it.stampAt-it.s>=0.8,end=solo?it.stampAt:it.e+0.22,a=Math.min(1,Math.max(0,(t-it.s)/0.25),Math.max(0,(end-t)/0.2));if(a<=0)return;
  const k=1-Math.pow(1-Math.min(1,(t-it.s)/0.25),3),card=(x,y,w,h)=>{c.shadowColor='rgba(0,0,0,.35)';c.shadowBlur=30;c.shadowOffsetY=12;crRR(c,x,y,w,h,28,'#fbf8f1');c.shadowColor='transparent';c.shadowBlur=0;c.shadowOffsetY=0};
  c.save();c.globalAlpha=a;c.textAlign='center';c.textBaseline='middle';
  if(cal){const d=it.calDay===3?st.mer:st.ven,sc=0.7+0.3*k;c.translate(it.stamp&&!solo?300:540,400);c.scale(sc,sc);card(-160,-165,320,330);
    c.save();crRR(c,-160,-165,320,330,28);c.clip();c.fillStyle=it.calDay===3?'#e7414b':'#17a95a';c.fillRect(-160,-165,320,76);c.restore();
    c.fillStyle='#fff';c.font=`900 34px ${CR_FONT}`;c.fillText(CR_GIORNI[d.getDay()],0,-126);
    c.fillStyle='#1d1d26';c.font=`900 150px ${CR_FONT}`;c.fillText(String(d.getDate()),0,-6);
    c.fillStyle=it.calDay===3?'#e7414b':'#17a95a';c.font=`900 32px ${CR_FONT}`;c.fillText(CR_MESI[d.getMonth()],0,82);
    c.font=`800 26px ${CR_FONT}`;const tx=it.calDay===3?'FINE DEL VOTO':'REGALO SUL BANCO',w=c.measureText(tx).width+48;crRR(c,-w/2,108,w,42,21,'#23212e');c.fillStyle='#fff';c.fillText(tx,0,130)}
  else if(it.pop==='results'){const V=st.voti,mx=Math.max(1,V.A,V.B,V.C),g=1-Math.pow(1-Math.min(1,(t-it.s)/0.8),3),sc=0.85+0.15*k;c.translate(540,420);c.scale(sc,sc);
    const h=118+3*96;card(-440,-h/2,880,h);c.textAlign='left';c.fillStyle='#8a8f9c';c.font=`900 28px ${CR_FONT}`;c.fillText(`IL VOTO È CHIUSO · ${V.tot} VOTI`,-400,-h/2+54);
    ['A','B','C'].forEach((L,j)=>{const y=-h/2+96+j*96,win=L===V.win,bw=600*(V[L]/mx)*g;
      crCirc(c,-372,y+36,28,'#1b2133');c.fillStyle='#4ff0d0';c.font=`900 32px ${CR_FONT}`;c.textAlign='center';c.fillText(L,-372,y+37);
      crRR(c,-326,y+8,640,56,16,'#f1ece0');if(bw>4)crRR(c,-326,y+8,Math.max(28,bw),56,16,win?'#17a95a':'#c9c2b2');
      c.textAlign='left';c.fillStyle=win&&bw>200?'#fff':'#1d1d26';c.font=`800 28px ${CR_FONT}`;let nm=(st.idee&&st.idee[L])||'';while(nm&&c.measureText(nm).width>500)nm=nm.slice(0,-2);c.fillText(nm,-308,y+37);
      c.textAlign='right';c.fillStyle='#1d1d26';c.font=`900 32px ${CR_FONT}`;c.fillText(String(Math.round(V[L]*g)),404,y+37)});c.textAlign='center'}
  else if(it.pop==='gift'){const sc=0.8+0.2*k;c.translate(540,410);c.scale(sc,sc);c.font=`900 46px ${CR_FONT}`;
    const L=crWrap(c,st.app,560,2),h=150+L.length*56;card(-440,-h/2,880,h);crGiftIcon(c,-404,-h/2+36,128);
    c.textAlign='left';c.fillStyle='#8a8f9c';c.font=`900 26px ${CR_FONT}`;c.fillText(st.tipo==='risultato'?`HA VINTO LA ${st.X}`:'IL REGALO DI QUESTA SETTIMANA',-246,-h/2+58);
    c.fillStyle='#1d1d26';c.font=`900 46px ${CR_FONT}`;L.forEach((ln,j)=>c.fillText(ln,-246,-h/2+112+j*56));
    const py=h/2-58;crRR(c,-246,py,150,42,21,'#17a95a');c.fillStyle='#fff';c.font=`900 24px ${CR_FONT}`;c.textAlign='center';c.fillText('GRATIS',-171,py+22);
    c.fillStyle='#8a8f9c';c.textAlign='left';c.font=`800 24px ${CR_FONT}`;c.fillText(st.tipo==='risultato'?`SUL BANCO VENERDÌ ${st.ven.getDate()}/${st.ven.getMonth()+1}`:'SENZA REGISTRAZIONE',-80,py+22)}
  else{const sc=0.85+0.15*k;c.translate(540,400);c.scale(sc,sc);c.font=`800 42px ${CR_FONT}`;
    const L=[];let cur='';it.popTxt.split(/\s+/).forEach(w=>{const nx=cur?cur+' '+w:w;if(c.measureText(nx).width>780&&cur){L.push(cur);cur=w}else cur=nx});if(cur)L.push(cur);
    const ls=L.slice(0,3),h=104+ls.length*54;card(-440,-h/2,880,h);crCirc(c,-384,-h/2+54,24,'#4ff0d0');crHeart(c,-384,-h/2+56,11,'#1b2133');
    c.textAlign='left';c.fillStyle='#8a8f9c';c.font=`900 26px ${CR_FONT}`;c.fillText(it.popHead,-344,-h/2+56);
    c.fillStyle='#1d1d26';c.font=`800 42px ${CR_FONT}`;ls.forEach((ln,j)=>c.fillText(ln,-400,-h/2+118+j*54))}
  c.restore()}
// la scheda di voto: le righe A, B, C compaiono quando Gennarino le dice; quella che sta dicendo è evidenziata
function crBallot(c,st,t){const b=st.ballot;if(!b||t<b.s||t>b.e)return false;
  const a=Math.max(0,Math.min(1,(t-b.s)/0.25,(b.e-t)/0.25)),x=80,w=920,rh=86,top=228;
  const vis=b.rows.reduce((n,r)=>n+Math.max(0,Math.min(1,(t-r.s)/0.22)),0),h=86+vis*rh+68;   // la scheda cresce riga per riga
  c.save();c.globalAlpha=a;c.shadowColor='rgba(0,0,0,.35)';c.shadowBlur=30;c.shadowOffsetY=12;crRR(c,x,top,w,h,30,'#fbf8f1');c.shadowColor='transparent';c.shadowBlur=0;c.shadowOffsetY=0;
  c.textBaseline='middle';c.textAlign='left';c.fillStyle='#8a8f9c';c.font=`900 30px ${CR_FONT}`;c.fillText('IL VOTO DELLA SETTIMANA',x+38,top+48);
  b.rows.forEach((r,j)=>{if(t<r.s)return;const y=top+84+j*rh,cur=t<r.e+0.22,ah=Math.min(1,(t-r.s)/0.22);c.globalAlpha=a*ah;
    crRR(c,x+24,y,w-48,rh-12,20,cur?'#fff1c2':'#f1ece0');if(cur){c.strokeStyle='#ffb020';c.lineWidth=4;crRR(c,x+24,y,w-48,rh-12,20);c.stroke()}
    const cy=y+(rh-12)/2;crCirc(c,x+78,cy,30,'#1b2133');c.fillStyle='#4ff0d0';c.font=`900 38px ${CR_FONT}`;c.textAlign='center';c.fillText(r.k,x+78,cy+2);
    c.textAlign='left';c.fillStyle='#1d1d26';let fs=42;c.font=`800 ${fs}px ${CR_FONT}`;while(c.measureText(r.txt).width>w-200&&fs>26){fs-=2;c.font=`800 ${fs}px ${CR_FONT}`}
    c.fillText(r.txt,x+126,cy+2)});
  c.globalAlpha=a;const fy=top+84+vis*rh+4;crRR(c,x+24,fy,w-48,50,25,'#e7414b');c.fillStyle='#fff';c.font=`900 26px ${CR_FONT}`;c.textAlign='center';
  c.fillText(`SCRIVI LA LETTERA NEI COMMENTI · FINO A MERCOLEDÌ ${st.mer.getDate()}/${st.mer.getMonth()+1}`,540,fy+26);
  c.restore();return true}
function crNoIcon(c,x,y,sz){crCirc(c,x+sz/2,y+sz/2,sz/2,'#8a8f9c');c.save();c.strokeStyle='#fff';c.lineWidth=sz*0.14;c.lineCap='round';c.beginPath();
  c.moveTo(x+sz*0.3,y+sz*0.5);c.lineTo(x+sz*0.7,y+sz*0.5);c.stroke();c.restore()}
function crTick(c,x,y,sz){crCirc(c,x+sz/2,y+sz/2,sz/2,'#17a95a');c.save();c.strokeStyle='#fff';c.lineWidth=sz*0.14;c.lineCap='round';c.lineJoin='round';c.beginPath();
  c.moveTo(x+sz*0.28,y+sz*0.52);c.lineTo(x+sz*0.44,y+sz*0.68);c.lineTo(x+sz*0.74,y+sz*0.34);c.stroke();c.restore()}
// in alto: GENNARINO · Pn a sinistra, a destra a che punto è la settimana
function crBadges(c,st){c.save();c.font=`900 42px ${CR_FONT}`;c.textAlign='left';c.textBaseline='middle';c.shadowColor='rgba(79,240,208,.6)';c.shadowBlur=14;c.fillStyle='#4ff0d0';
  c.fillText(st.ser?`GENNARINO · P${st.ep}`:'GENNARINO',64,142);c.restore();
  const dm=d=>`${d.getDate()}/${d.getMonth()+1}`;
  const P={idee:['VOTO APERTO',`FINO A MER ${dm(st.mer)}`],risultato:[`HA VINTO LA ${st.X}`,`SUL BANCO VEN ${dm(st.ven)}`],regalo:['GRATIS SUL BANCO','SENZA REGISTRAZIONE'],presentazione:["UN'APP GRATIS",'OGNI VENERDÌ'],nessuno:['NESSUN VOTO','IDEE NUOVE LUNEDÌ']}[st.tipo];
  if(!P)return;c.save();c.font=`900 38px ${CR_FONT}`;const tw=c.measureText(P[0]).width,w=tw+92,x=1030-w;
  c.shadowColor='rgba(0,0,0,.3)';c.shadowBlur=12;crRR(c,x,106,w,70,35,'#fff');c.shadowBlur=0;(st.tipo==='idee'?crTick:st.tipo==='nessuno'?crNoIcon:crGiftIcon)(c,x+18,121,40);c.fillStyle='#1d1d26';c.textBaseline='middle';c.textAlign='left';c.fillText(P[0],x+68,143);
  c.font=`900 30px ${CR_FONT}`;const dw=c.measureText(P[1]).width+48;crRR(c,1030-dw,190,dw,52,26,st.tipo==='idee'?'#e7414b':st.tipo==='nessuno'?'#8a8f9c':'#17a95a');c.fillStyle='#fff';c.fillText(P[1],1030-dw+24,217);c.restore()}
// sottotitoli: bianco con contorno, parole chiave in giallo
function crSubs(c,words,alpha,t,pg){c.save();c.globalAlpha=alpha;c.textBaseline='middle';c.lineJoin='round';let fs=70,lines=[words];
  // la parola che Gennarino sta dicendo (tempo della pagina diviso in proporzione alle lettere)
  let act=-1;if(pg&&t!=null&&t>=pg.s){const wt=words.map(w=>w.length+2),tw=wt.reduce((a,b)=>a+b,0);let acc=pg.s;
    for(let i=0;i<words.length;i++){const d=(pg.e-pg.s)*wt[i]/tw;if(t<acc+d){act=i;break}acc+=d}if(act<0&&t<pg.e+0.25)act=words.length-1}
  for(;fs>=48;fs-=6){c.font=`900 ${fs}px ${CR_FONT}`;const wd=a=>c.measureText(a.join(' ')).width;
    if(wd(words)<=900){lines=[words];break}
    let best=null;for(let k=1;k<words.length;k++){const m=Math.max(wd(words.slice(0,k)),wd(words.slice(k)));if(!best||m<best.m)best={k,m}}
    if(best&&best.m<=900){lines=[words.slice(0,best.k),words.slice(best.k)];break}}fs=Math.max(fs,48);
  const lh=fs*1.22,y0=1500-(lines.length-1)*lh/2;let gi=0;lines.forEach((ln,i)=>{const full=ln.join(' ');let x=540-c.measureText(full).width/2;const y=y0+i*lh;
    ln.forEach((w,j)=>{const ww=c.measureText(w).width,bare=w.replace(/[^\p{L}\p{N}]/gu,''),hl=CR_HL.test(bare)||/^[ABC]$/.test(bare);
      if(gi===act){const pd=12;c.save();c.shadowColor='rgba(0,0,0,.45)';c.shadowBlur=10;crRR(c,x-pd,y-fs*0.64,ww+pd*2,fs*1.28,fs*0.3,'#ffd23f');c.restore();c.fillStyle='#16161e';c.fillText(w,x,y)}
      else{c.lineWidth=14;c.strokeStyle='#000';c.strokeText(w,x,y);c.fillStyle=hl?'#ffd23f':'#fff';c.fillText(w,x,y)}
      x+=ww+(j<ln.length-1?c.measureText(' ').width:0);gi++})});c.restore()}
// la bolla del commento a cui Gennarino risponde
function crBubble(c,st,t){const b=st.com;if(!b||t>b.e)return;const a=Math.max(0,Math.min(1,t/0.2,(b.e-t)/0.25)),k=1-Math.pow(1-Math.min(1,t/0.25),3);
  c.save();c.globalAlpha=a;c.translate(540,430);const sc=0.85+0.15*k;c.scale(sc,sc);c.font=`800 44px ${CR_FONT}`;const L=crWrap(c,b.txt,700,4),h=124+L.length*56;
  c.shadowColor='rgba(0,0,0,.35)';c.shadowBlur=30;c.shadowOffsetY=12;crRR(c,-450,-h/2,900,h,34,'#fff');c.beginPath();c.moveTo(-360,h/2-4);c.lineTo(-330,h/2+34);c.lineTo(-300,h/2-4);c.fill();c.shadowColor='transparent';
  const u=b.u||'',hue=[...u].reduce((a,ch)=>a+ch.charCodeAt(0),0)%360;crCirc(c,-386,-h/2+62,34,u?`hsl(${hue},62%,52%)`:'#8a8f9c');
  c.fillStyle='#fff';c.font=`900 34px ${CR_FONT}`;c.textAlign='center';c.textBaseline='middle';c.fillText((u[0]||'?').toUpperCase(),-386,-h/2+63);
  c.textAlign='left';c.fillStyle='#8a8f9c';c.font=`800 28px ${CR_FONT}`;c.fillText((u?'@'+u:'Un follower')+' ha commentato',-334,-h/2+62);
  c.fillStyle='#16161e';c.font=`800 44px ${CR_FONT}`;L.forEach((ln,j)=>c.fillText(ln,-400,-h/2+130+j*56));c.restore()}
// inquadratura: stretta o larga a frasi alterne, lenta spinta in avanti, piccolo colpo a ogni frase e uno più forte all'inizio
function crCam(t,it){let z=1;const cx=540,cy=800;if(it&&it.cam)z=1.13;
  if(it){const p=Math.max(0,Math.min(1,(t-it.s)/Math.max(0.6,it.e-it.s)));z*=1+0.035*p;const q=t-it.s;if(it.i>0&&q>=0&&q<0.22)z*=1+0.05*(1-q/0.22)}
  if(t<0.4){const q=1-t/0.4;z*=1+0.16*q*q}return{z,cx,cy}}
// una clip o un'immagine della libreria a tutto schermo (ritaglio 9:16)
function crMedia(c,el,t,t0,zz){const vid=el.tagName==='VIDEO';if(vid?el.readyState<2:!(el.complete&&el.naturalWidth))return false;
  const w=vid?el.videoWidth:el.naturalWidth,h=vid?el.videoHeight:el.naturalHeight;if(!w||!h)return false;
  const z=(vid?1:1+Math.min(1,(t-t0)/4)*0.1)*(zz||1),r=Math.max(1080/w,1920/h)*z,dw=w*r,dh=h*r;c.drawImage(el,(1080-dw)/2,(1920-dh)/2,dw,dh);return true}
function crDraw(ctx,W,H,t,st,L,media){const c=ctx;c.setTransform(W/1080,0,0,H/1920,0,0);
  const it=st.items.find(x=>t>=x.s&&t<x.e+0.22)||null;const k=Math.min(st.vt.env.length-1,Math.max(0,Math.floor(t*st.vt.fps)));const mouth=it?st.vt.env[k]:0;
  const cam=crCam(t,it);let drawn=false;if(it&&it.shot&&media&&media.el&&media.cur===it){c.fillStyle='#000';c.fillRect(0,0,1080,1920);drawn=crMedia(c,media.el,t,it.s,1+(cam.z-1)*0.5)}
  // sulle clip della libreria un'ombra morbida dietro ai sottotitoli, così si leggono anche sopra l'insegna
  if(drawn&&st.subs&&it.i>0){const gr=c.createLinearGradient(0,1320,0,1700);gr.addColorStop(0,'rgba(0,0,0,0)');gr.addColorStop(0.5,'rgba(0,0,0,.42)');gr.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=gr;c.fillRect(0,1320,1080,380)}
  if(!drawn){c.save();c.translate(cam.cx,cam.cy);c.scale(cam.z,cam.z);c.translate(-cam.cx,-cam.cy);
    c.drawImage(L.back,0,0,1080,1920);crRobot(c,t,st,it,mouth);c.drawImage(L.front,0,0,1080,1920);crJar(c);c.restore()}
  // la scheda di voto ha la precedenza; negli ultimi secondi c'è il testo finale e i riquadri si fermano
  const bal=crBallot(c,st,t),endOn=t>st.total-2.8&&!bal;
  if(it&&it.pop&&!bal&&!endOn)crPop(c,it,st,t);
  if(it&&it.stamp&&!bal&&!endOn&&t>=it.stampAt)crStamp(c,it.stampAt,t,it.stamp);
  if(st.com&&t<=st.com.e){crBubble(c,st,t)}   // nella risposta la bolla del commento fa da hook
  else if(t<st.hookShow){const a=t>st.hookShow-0.3?(st.hookShow-t)/0.3:1;c.setTransform(1,0,0,1,0,0);drawCaption(ctx,st.hook,W,H,0.165,a,0.068);if(st.ser)drawPill(ctx,'PARTE '+st.ep,W,H,0.165,st.hook,a);c.setTransform(W/1080,0,0,H/1920,0,0)}
  else if(endOn){c.setTransform(1,0,0,1,0,0);drawCaption(ctx,st.endTxt,W,H,0.165,Math.min(1,(t-(st.total-2.8))/0.3),0.062);c.setTransform(W/1080,0,0,H/1920,0,0)}
  else crBadges(c,st);
  // la prima frase è già scritta in alto come hook: i sottotitoli partono dalla seconda
  if(st.subs&&it&&it.i>0){const pg=it.pages.find(p=>t>=p.s&&t<p.e+0.25)||it.pages[it.pages.length-1];if(pg&&t>=it.s)crSubs(c,pg.w,1,t,pg)}
  if(st.bar){const h=12;c.fillStyle='rgba(255,255,255,.25)';c.fillRect(0,1920-h,1080,h);const gr=c.createLinearGradient(0,0,1080,0);gr.addColorStop(0,'#ff2d6f');gr.addColorStop(1,'#25f4ee');c.fillStyle=gr;c.fillRect(0,1920-h,1080*Math.min(1,t/st.total),h)}
  c.setTransform(1,0,0,1,0,0)}
function crLayers(W,H,st){return{back:crLayer(W,H,c=>crBack(c,st.seed)),front:crLayer(W,H,crFrontL)}}

/* ---------- anteprima ---------- */
let _crPT=null;function crPrevSoon(){clearTimeout(_crPT);_crPT=setTimeout(crPrev,250)}
function crPrev(){const cv=$('#cr-prev');if(!cv)return;const lines=crLines(),s=crSet();const n=Math.max(1,lines.length);
  $('#cr-len').textContent=lines.length?`${lines.length} frasi · circa ${Math.round(lines.join(' ').split(/\s+/).length/3.3+n*0.22+0.6)} secondi`:'';
  const fake={seg:lines.map((_,i)=>({s:i*2.4,e:i*2.4+2.2})),total:n*2.4,env:new Float32Array(1).fill(0.4),fps:30};
  const st=crState(lines.length?lines:['…'],fake,{...s,tipo:$('#cr-tipo').value,vince:$('#cr-vince').value,subs:$('#cr-subs').checked,bar:$('#cr-bar').checked},null);
  if(!CR.prevL||CR.prevL.seed!==st.seed){CR.prevL=crLayers(360,640,st);CR.prevL.seed=st.seed}
  crDraw(cv.getContext('2d'),360,640,1.0,st,CR.prevL,null)}

/* ---------- creazione ---------- */
function crSay(html){const o=$('#cr-out');if(o)o.innerHTML=html}
function crSteps(msg,p){crSay(`<div class="card" style="margin-top:12px"><b>${esc(msg)}</b>${p!=null?`<div class="meter"><i style="width:${Math.round(p*100)}%"></i></div>`:''}
  <div style="color:var(--mut);font-size:12.5px">Resta su questa schermata: se esci, mi metto in pausa e riprendo quando torni.</div><button class="btn sm alt" style="margin-top:8px" onclick="CR.cancel=true">Annulla</button></div>`)}
async function crMake(){if(CR.busy)return;const lines=crLines();if(lines.length<2){toast('Scrivi almeno 2 frasi, una per riga');return}
  if(!window.MediaRecorder||!HTMLCanvasElement.prototype.captureStream){toast('Il browser non può creare video: aggiorna Chrome');return}
  crSaveSet();const s=crSet();CR.busy=true;CR.cancel=false;$('#cr-go').disabled=true;
  const ac=new (window.AudioContext||window.webkitAudioContext)();try{ac.resume()}catch(_){}   // nel tocco: serve per l'audio
  const wk=wakeOn('crea');
  try{const tts=await crSynth(lines,s,m=>crSteps(m,null));if(CR.cancel)throw new Error('annullato');
    crSteps('Monto la voce e le scene…',null);const vt=await crVoice(tts,s);const lib=await crLibLoad();const st=crState(lines,vt,s,lib);
    if(s.sfx||s.music){crSteps('Aggiungo musica ed effetti…',null);try{vt.buf=await crMix(vt,st,s)}catch(e){console.warn('musica/effetti non aggiunti',e)}}
    const out=await crRender(st,s,ac,p=>crSteps(`Registro il video… ${Math.round(p*100)}%`,p));
    if(CR.cancel||!out)throw new Error('annullato');crResult(out,st,lines,s)}
  catch(e){if(String(e&&e.message)==='annullato')crSay('<small class="n">Annullato.</small>');
    else{console.error(e);crSay(`<div class="card" style="margin-top:12px">❌ <b>Non sono riuscito a creare il video.</b><div style="color:var(--mut);font-size:12.5px;margin-top:6px">${esc(e&&e.message||String(e))}</div>
      ${s.light?'':'<button class="btn" onclick="$(\'#cr-light\').checked=true;crSaveSet();crMake()">⚡ Riprova in modalità leggera (720p)</button>'}<small class="n">La prima volta serve la connessione per scaricare la voce.</small></div>`)}}
  finally{wakeOff(wk);try{ac.close()}catch(_){}CR.busy=false;const b=$('#cr-go');if(b)b.disabled=false}}
// prepara la clip della libreria per una scena (al massimo due lettori video aperti insieme)
function crMediaFor(item,off){if(item.tipo==='immagine'){const im=new Image();im.decoding='async';im.src='libreria/'+encodeURIComponent(item.file);return im}
  const v=hiddenVideo('libreria/'+encodeURIComponent(item.file),true);v.loop=true;
  if(off>0)v.addEventListener('loadedmetadata',()=>{try{if(v.duration>0)v.currentTime=off%v.duration}catch(_){}},{once:true});return v}
async function crRender(st,s,ac,onP){const W=s.light?720:1080,H=s.light?1280:1920,c=document.createElement('canvas');c.width=W;c.height=H;const ctx=c.getContext('2d');
  const L=crLayers(W,H,st),dest=ac.createMediaStreamDestination(),src=ac.createBufferSource();src.buffer=st.vt.buf;src.connect(dest);
  // scene della libreria: una in onda (media.el) e la successiva già in caricamento (media.next), mai più di due lettori
  const shots=st.items.filter(x=>x.shot);const media={el:null,cur:null,next:null,nextAt:null};let si=0;
  const prepNext=()=>{const nx=shots[si++];media.next=nx?crMediaFor(nx.shot,nx.shotOff||0):null;media.nextAt=nx||null};prepNext();
  const kill=el=>{if(el&&el.tagName==='VIDEO'){try{el.pause();el.removeAttribute('src');el.load();el.remove()}catch(_){}}};
  crDraw(ctx,W,H,0,st,L,null);
  const tracks=[...c.captureStream(30).getVideoTracks(),...dest.stream.getAudioTracks()];const {rec,mime}=makeRecorder(new MediaStream(tracks),s.light);
  const chunks=[];rec.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data)};
  let t0=0,ended=false,paused=false,lastT=-1,lastMove=performance.now();
  const onVis=()=>{if(ended)return;if(document.hidden){paused=true;try{rec.pause()}catch(_){}ac.suspend().catch(()=>{});if(media.el&&media.el.pause)media.el.pause()}
    else if(paused){paused=false;ac.resume().catch(()=>{});try{rec.resume()}catch(_){}if(media.el&&media.el.play)media.el.play().catch(()=>{})}};
  document.addEventListener('visibilitychange',onVis);
  try{await ac.resume()}catch(_){}
  t0=ac.currentTime+0.08;src.start(t0);
  const res=await new Promise((resolve,reject)=>{rec.onerror=e=>reject(e.error||e);
    const loop=()=>{if(ended)return;if(CR.cancel){ended=true;try{rec.stop()}catch(_){}resolve(null);return}
      const t=Math.max(0,ac.currentTime-t0);
      // cambio scena della libreria (se una frase è già passata senza che toccasse a lei, salto alla successiva)
      const it=st.items.find(x=>t>=x.s&&t<x.e+0.22);
      while(media.nextAt&&media.nextAt!==it&&t>=media.nextAt.e+0.22){kill(media.next);prepNext()}
      if(it&&media.nextAt===it){kill(media.el);media.el=media.next;media.cur=it;
        if(media.el&&media.el.tagName==='VIDEO')media.el.play().catch(()=>{});prepNext()}
      else if(media.el&&media.cur&&media.cur!==it){kill(media.el);media.el=null;media.cur=null}   // scena finita: libero il lettore
      crDraw(ctx,W,H,t,st,L,media);onP(Math.min(1,t/st.total));
      // l'audio fa da orologio: se resta fermo per 8 secondi con l'app aperta, qualcosa non va
      if(t!==lastT||paused){lastT=t;lastMove=performance.now()}
      else if(performance.now()-lastMove>8000){ended=true;try{rec.stop()}catch(_){}reject(new Error('L\'audio del telefono si è fermato: riprova'));return}
      if(t>=st.total){ended=true;rec.onstop=()=>resolve(chunks);try{rec.stop()}catch(_){resolve(chunks)}return}
      requestAnimationFrame(loop)};requestAnimationFrame(loop)}).finally(()=>{document.removeEventListener('visibilitychange',onVis);kill(media.el);kill(media.next);try{src.stop()}catch(_){}});
  if(!res||!res.length)return null;
  const type=((rec.mimeType||mime||'video/webm').split(';')[0])||'video/webm';let blob=new Blob(res,{type});
  if(type.includes('webm')&&window.ysFixWebmDuration)blob=await Promise.race([window.ysFixWebmDuration(blob,Math.round(st.total*1000),{logger:false}),new Promise(r=>setTimeout(()=>r(blob),8000))]).catch(()=>blob);
  // copertina: l'istante con l'hook a schermo
  const cv=document.createElement('canvas');cv.width=1080;cv.height=1920;crDraw(cv.getContext('2d'),1080,1920,Math.min(1.2,st.hookShow-0.4),st,crLayers(1080,1920,st),null);
  const cover=await new Promise(r=>cv.toBlob(r,'image/jpeg',0.9));
  return{blob,type,cover}}
function crResult(out,st,lines,s){const ser=st.ser,ep=st.ep,ext=out.type.includes('mp4')?'mp4':'webm';
  const name=(ser?`${toTag(ser.name).slice(1)}-parte-${ep}`:'gennarino')+'.'+ext;
  [CR.url,CR.cover].forEach(u=>{if(u)URL.revokeObjectURL(u)});CR.url=URL.createObjectURL(out.blob);CR.cover=out.cover?URL.createObjectURL(out.cover):null;
  const file=new File([out.blob],name,{type:out.type});CR.file=file;window._spintaFile=file;
  file.spintaCrea={subs:!!s.subs,hook:st.hook,end:st.endTxt,part:!!ser,bar:!!s.bar};   // lo Studio sa già cosa c'è nel video
  const tags=[ser?ser.tag:null,...tagsFor('',['gennarino','bancarella'],'tech').split(' ')].filter(Boolean);
  const tg=[...new Set(tags)].slice(0,RULES.hashtag.max).join(' '),pre=ser?`Parte ${ep} · `:'',app=st.app||'';
  const CAP={idee:`${pre}Quale app regalo venerdì? Votate A, B o C nei commenti, fino a mercoledì 👇`,
    risultato:`${pre}Ha vinto la ${st.X}${app?': '+app:''}! Venerdì la trovate sul banco, gratis 🎁 Come la volete? Ditemelo nei commenti`,
    regalo:`${pre}${app?app+': ':''}è pronta, gratis e senza registrazione. Link nel profilo 🎁 Provatela e ditemi com'è!`,
    presentazione:`${pre}Ogni venerdì regalo un'app utile, gratis. Che app vi servirebbe? Scrivetelo nei commenti 👇`,
    nessuno:`${pre}Questa settimana niente app: nei commenti non ha votato nessuno 😔 Lunedì tre idee nuove, basta una lettera nei commenti per decidere voi 👇`};
  const cap=CAP[st.tipo]?`${CAP[st.tipo]}\n\n${tg}`:((window._nx&&window._nx.raw&&window._nx.cap&&ser&&window._nx.raw.ep===ep&&crNoBait(window._nx.cap))?window._nx.cap:`${pre}${st.hook} 👇\n\n${tg}`);window._spintaCap=cap;
  const hookW=st.hook.split(/\s+/).filter(Boolean).length,shots=st.items.length+st.items.filter(x=>x.shot).length;
  DB.lastPkg={id:uid(),at:Date.now(),title:cutTxt(st.hook,90),cap,hk:(((window._nx&&window._nx.hooks)||[]).find(h=>crClean(h.s)===st.hook)||{k:'Personalizzato'}).k,
    len:+st.total.toFixed(1),series:ser?{id:ser.id,name:ser.name,ep}:null,score:null,transcript:lines.join(' ').slice(0,900),topic:'',end:st.endTxt,niche:'tech',made:'creatore',
    f:{lead:0.2,pause:0,topicAt:null,pace:Math.round(shots/Math.max(1,st.total)*100)/10,hookW,subs:!!s.subs,end:true,capQ:/\?|comment|scrivete|ditemelo|dimmi/i.test(cap)},miss:[]};save();
  const canShare=!!(navigator.canShare&&navigator.canShare({files:[file]}));const slot=personalSlot().when;
  crSay(`<div class="card" style="margin-top:12px;background:var(--card2)"><h3>✅ Video pronto</h3>${CR.vociInfo?`<div style="font-size:12.5px;color:var(--mut);margin:-4px 0 8px">🎙️ Voce nuova di Gennarino: ${CR.vociInfo.pronte} frasi su ${CR.vociInfo.tot}${CR.vociInfo.pronte<CR.vociInfo.tot?' (le frasi cambiate hanno la voce vecchia)':''}</div>`:''}
   <div style="color:var(--mut);font-size:12.5px;margin-top:4px">${st.total.toFixed(1)} s · ${(out.blob.size/1048576).toFixed(1)} MB · ${lines.length} frasi</div>
   <video class="vid" src="${CR.url}" controls playsinline></video>
   <div class="acts"><a class="btn sm" href="${CR.url}" download="${name}">⬇︎ Scarica</a>${canShare?'<button class="btn sm cy" onclick="shareFinal()">📤 Condividi su TikTok</button>':''}
    <button class="btn sm alt" onclick="crToStudio()">📊 Spinta Score</button></div>
   <label>Caption pronta</label><div class="item" style="white-space:pre-wrap;padding-right:70px">${esc(cap)}${copyBtn(cap)}</div>
   ${CR.cover?`<label>Copertina</label><img src="${CR.cover}" style="width:46%;display:block;margin:6px auto;border-radius:12px" alt="Copertina"><div class="acts" style="justify-content:center"><a class="btn sm alt" href="${CR.cover}" download="gennarino-copertina.jpg">⬇︎ Copertina</a></div>`:''}
   ${ext==='webm'?'<small class="n">Formato WebM: dal sito di TikTok si carica senza problemi; se l\'app del telefono non lo vede, convertilo in MP4 (es. con CapCut).</small>':''}
   <div class="acts">${slot?`<button class="btn sm alt" onclick="planFromPkg()">📅 Programma (${esc(slotLabel(slot))})</button>`:''}<button class="btn sm pub-btn" onclick="markPublished('cr-pub')">✅ L'ho pubblicato</button></div>
   <div id="cr-pub"></div><small class="n">Ricordati l'etichetta "Contenuto generato con AI" su TikTok: voce e personaggio sono creati al computer.</small></div>`);
  setTimeout(()=>{const o=$('#cr-out');if(o)o.scrollIntoView({behavior:'smooth',block:'start'})},100)}
function crToStudio(){if(!CR.file)return;closeModal('m-crea');goTab('studio');loadVideoFile(CR.file)}
try{crVociLoad()}catch(_){}
