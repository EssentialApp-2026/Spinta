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
function crNextSunday(){const d=new Date();d.setDate(d.getDate()+((7-d.getDay())%7||7));return d}
function crSet(){return Object.assign({voice:'riccardo',fx:'leggero',speed:'tiktok',subs:true,bar:true,light:false,goal:500,likes:0},DB.creator||{})}
function crSaveSet(){const v=id=>$('#'+id);DB.creator=Object.assign(crSet(),{voice:v('cr-voice').value,fx:v('cr-fx').value,speed:v('cr-speed').value,
  subs:v('cr-subs').checked,bar:v('cr-bar').checked,light:v('cr-light').checked,goal:Math.max(0,parseInt(v('cr-goal').value)||0),likes:Math.max(0,parseInt(v('cr-likes').value)||0)});save()}

/* ---------- finestra del creatore ---------- */
function crInject(){if($('#m-crea'))return;
  const opt=(id,lab,on)=>`<label class="opt"><input type="checkbox" id="${id}" ${on?'checked':''} onchange="crSaveSet();crPrev()"><span>${lab}</span></label>`;
  document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="m-crea"><div class="sheet" style="max-height:94vh">
  <h2>🎬 Crea con Gennarino</h2>
  <p class="sub" style="margin-bottom:8px">Scrivo la puntata, le do la voce e monto il video, tutto sul telefono. Lo stile è quello delle tue puntate.</p>
  <canvas id="cr-prev" width="360" height="640" style="width:52%;display:block;margin:0 auto;border-radius:14px;background:#000"></canvas>
  <label>Copione · una frase per riga, la prima è l'hook</label>
  <textarea id="cr-txt" style="min-height:190px" oninput="crPrevSoon()"></textarea>
  <div id="cr-len" style="color:var(--mut);font-size:12.5px;margin-top:4px"></div>
  <div class="acts"><button class="btn sm alt" onclick="crFill(true)">✨ Riscrivi dal piano</button><button class="btn sm alt" onclick="crAskClaude()">🤖 Copia la richiesta per Claude</button></div>
  <small class="n">Per un copione più bello: "Copia la richiesta per Claude", incollala in una chat con Claude e incolla qui la risposta.</small>
  <div class="row"><div><label>Voce</label><select id="cr-voice" onchange="crSaveSet()">${Object.entries(CR_VOICES).map(([k,v])=>`<option value="${k}">${v.n}</option>`).join('')}</select></div>
   <div><label>Effetto robot</label><select id="cr-fx" onchange="crSaveSet()"><option value="no">Nessuno</option><option value="leggero">Leggero</option><option value="forte">Forte</option></select></div></div>
  <div class="row"><div><label>Ritmo</label><select id="cr-speed" onchange="crSaveSet()"><option value="normale">Normale</option><option value="tiktok">Svelto</option><option value="veloce">Veloce</option></select></div>
   <div><label>Batteria · like / obiettivo</label><div style="display:flex;gap:6px"><input id="cr-likes" type="number" min="0" inputmode="numeric" onchange="crSaveSet();crPrev()"><input id="cr-goal" type="number" min="0" inputmode="numeric" onchange="crSaveSet();crPrev()"></div></div></div>
  <button class="btn alt" id="cr-listen" onclick="crListen()">▶︎ Ascolta la prima frase</button>
  <div class="grp" style="margin-top:12px">${opt('cr-subs','Sottotitoli con le parole chiave in giallo',true)}${opt('cr-bar','Barra di avanzamento',true)}${opt('cr-light','Modalità leggera (720p) per telefoni lenti',false)}</div>
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
  $('#cr-goal').value=s.goal;$('#cr-likes').value=s.likes;
  if(fromPlan||!$('#cr-txt').value.trim())crFill(!!fromPlan);
  openModal('m-crea');crPrev();crLibLoad().then(crLibShow)}

/* ---------- copione ---------- */
const crClean=s=>String(s||'').replace(/\p{Extended_Pictographic}|️|‍/gu,'').replace(/[«»"]/g,'').replace(/\s+/g,' ').replace(/ ([?!.,;:…])/g,'$1').trim();
function crScript(){const nx=window._nx&&window._nx.raw,ser=curSeries(),ep=ser?ser.ep:null,L=lastVideo(),s=crSet();
  const hook=crClean(DB.nextHook||(nx&&nx.hook)||'')||(ser&&ep>1?`Parte ${ep}: com'è andata a finire?`:'Guagliù, oggi vi devo dire una cosa importante!');
  const lines=[hook];const prev=crClean((nx&&nx.prevHook)||(L&&L.title)||'').replace(/[.!?…]+$/,'');
  if(ser&&ep>1){lines.push('Uè guagliù, sono Gennarino, il robottino della bancarella.');if(prev&&prev!==hook)lines.push(`Nella puntata di prima: ${prev}.`)}
  else lines.push('Uè guagliù, sono Gennarino, il robottino della bancarella a Napoli.');
  const idea=crClean(nx&&nx.idea).replace(/[.!?…]+$/,'');
  if(idea){lines.push(`Oggi sul banco: ${idea}.`);lines.push('E io ci provo, ma mi serve il vostro aiuto.')}
  if(s.goal){lines.push(`La mia batteria è a ${s.likes} like su ${s.goal}.`);lines.push(`Se domenica non arrivo a ${s.goal}, mi spengo!`)}
  lines.push('Voi che dite, ce la faccio?');
  lines.push(ser?`Lasciatemi un like e seguitemi per la parte ${ep+1}!`:'Lasciatemi un like e seguitemi, guagliù!');
  return lines.slice(0,10)}
function crFill(force){const t=$('#cr-txt');if(!force&&t.value.trim())return;t.value=crScript().join('\n');crPrevSoon()}
function crLines(){return $('#cr-txt').value.split(/\n+/).map(x=>x.trim()).filter(Boolean).slice(0,14).map(x=>x.slice(0,220))}
function crAskClaude(){const ser=curSeries(),ep=ser?ser.ep:null,s=crSet(),nx=window._nx;
  copy(`Scrivi il copione ${ser?`della Parte ${ep} di "${ser.name}"`:'di un video'} per TikTok (25-35 secondi).
Parla solo Gennarino, un robottino AI con una bancarella a Napoli: italiano semplice con poche parole in napoletano (tipo "Uè guagliù").
Regole: da 6 a 8 frasi brevi (massimo 14 parole ciascuna), una per riga, senza numeri di riga, nomi o emoji.
La prima riga è l'hook (posta in gioco o domanda forte), l'ultima chiede un like${ser?` e annuncia la Parte ${ep+1}`:''}.
${s.goal?`La batteria di Gennarino è a ${s.likes} like su ${s.goal}: se non ci arriva entro domenica si spegne.\n`:''}${nx&&nx.plan?`\nPiano preparato da Spinta:\n${nx.plan}`:''}`)}

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
const crSpeak=s=>crClean(s).replace(/#\S+/g,'').replace(/&/g,' e ').replace(/'O\b/g,'o').trim()||'…';
function crTrim(a,sr){let s=0,e=a.length;const th=0.012,m=Math.round(sr*0.03);while(s<e&&Math.abs(a[s])<th)s++;while(e>s&&Math.abs(a[e-1])<th)e--;
  return a.slice(Math.max(0,s-m),Math.min(a.length,e+m))}
async function crSynth(lines,s,say){const V=await crLoadTTS(s.voice,say),cfg=V.cfg;say('Preparo la pronuncia…');
  const ph=await crPhon(lines.map(crSpeak),cfg.espeak.voice);const ls=(cfg.inference.length_scale||1)*({normale:1,tiktok:0.92,veloce:0.84}[s.speed]||0.92);
  const clips=[];for(let i=0;i<lines.length;i++){if(CR.cancel)throw new Error('annullato');say(`Do la voce a Gennarino: frase ${i+1} di ${lines.length}…`);
    const ids=(ph[i]&&ph[i].phoneme_ids)||[];if(!ids.length){clips.push(new Float32Array(Math.round(cfg.audio.sample_rate*0.4)));continue}
    const r=await V.sess.run({input:new ort.Tensor('int64',BigInt64Array.from(ids.map(x=>BigInt(x))),[1,ids.length]),input_lengths:new ort.Tensor('int64',BigInt64Array.from([BigInt(ids.length)]),[1]),
      scales:new ort.Tensor('float32',Float32Array.from([cfg.inference.noise_scale,ls,cfg.inference.noise_w]),[3])});
    clips.push(crTrim(r.output.data,cfg.audio.sample_rate));await new Promise(r=>setTimeout(r,0))}
  return{sr:cfg.audio.sample_rate,clips}}
// traccia della voce con effetto robot, volume uniforme e inviluppo per muovere la bocca
async function crVoice(tts,s){const sr=44100,gap=0.22,pre=0.15,rate={no:1,leggero:1.04,forte:1.09}[s.fx]||1;
  let t=pre;const seg=tts.clips.map(c=>{const d=c.length/tts.sr/rate,o={s:t,e:t+d};t+=d+gap;return o});const total=t+0.5;
  const oc=new OfflineAudioContext(1,Math.ceil(total*sr),sr),inp=oc.createGain();let node=inp;
  if(s.fx!=='no'){const forte=s.fx==='forte',depth=forte?0.34:0.15,am=oc.createGain();am.gain.value=1-depth;
    const osc=oc.createOscillator();osc.frequency.value=forte?50:32;const og=oc.createGain();og.gain.value=depth;osc.connect(og);og.connect(am.gain);osc.start(0);
    const dl=oc.createDelay(0.05);dl.delayTime.value=forte?0.007:0.0045;const fb=oc.createGain();fb.gain.value=forte?0.45:0.22;const wet=oc.createGain();wet.gain.value=forte?0.4:0.22;
    inp.connect(am);inp.connect(dl);dl.connect(fb);fb.connect(dl);dl.connect(wet);wet.connect(am);node=am}
  const cp=oc.createDynamicsCompressor();cp.threshold.value=-20;cp.knee.value=8;cp.ratio.value=3;cp.attack.value=0.004;cp.release.value=0.2;node.connect(cp);cp.connect(oc.destination);
  tts.clips.forEach((c,i)=>{if(!c.length)return;const b=oc.createBuffer(1,c.length,tts.sr);b.copyToChannel(c instanceof Float32Array?c:Float32Array.from(c),0);
    const src=oc.createBufferSource();src.buffer=b;src.playbackRate.value=rate;src.connect(inp);src.start(seg[i].s)});
  const buf=await oc.startRendering(),d=buf.getChannelData(0);let pk=0;for(let i=0;i<d.length;i++){const v=Math.abs(d[i]);if(v>pk)pk=v}
  const g=pk>0?0.89/pk:1;for(let i=0;i<d.length;i++)d[i]*=g;
  const fps=30,win=Math.round(sr/fps),env=new Float32Array(Math.ceil(d.length/win));let mx=0;
  for(let k=0;k<env.length;k++){let q=0;const a=k*win,b=Math.min(d.length,a+win);for(let i=a;i<b;i++)q+=d[i]*d[i];env[k]=Math.sqrt(q/Math.max(1,b-a));if(env[k]>mx)mx=env[k]}
  for(let k=0;k<env.length;k++)env[k]=Math.min(1,env[k]/((mx*0.55)||1));
  return{buf,seg,total,env,fps}}
async function crListen(){if(CR.busy)return;const l=crLines()[0];if(!l){toast('Scrivi almeno una frase');return}
  const b=$('#cr-listen'),ac=new (window.AudioContext||window.webkitAudioContext)();b.disabled=true;crSaveSet();
  try{const tts=await crSynth([l],crSet(),m=>b.textContent='⏳ '+m),vt=await crVoice(tts,crSet());const src=ac.createBufferSource();src.buffer=vt.buf;src.connect(ac.destination);src.start();
    b.textContent='🔊 Ascolto…';src.onended=()=>{try{ac.close()}catch(_){}}}
  catch(e){console.error(e);toast('Voce non disponibile: serve la connessione la prima volta')}
  finally{setTimeout(()=>{b.disabled=false;b.textContent='▶︎ Ascolta la prima frase'},600)}}

/* ---------- libreria del repository ---------- */
async function crLibLoad(){if(CR.lib)return CR.lib;let items=[];
  try{const r=await fetch('libreria/libreria.json?t='+Date.now(),{cache:'no-store'});if(r.ok){const j=await r.json();items=(j.elementi||[]).filter(x=>x&&x.file)}}catch(_){}
  try{const known=new Set(items.map(x=>x.file)),r=await fetch(CR_BASE.api);if(r.ok){const j=await r.json();
    (Array.isArray(j)?j:[]).filter(f=>f.type==='file'&&/\.(mp4|webm|mov|m4v|jpe?g|png|webp)$/i.test(f.name)&&!known.has(f.name)&&!/poster|^_/i.test(f.name)).forEach(f=>items.push({file:f.name,tipo:/\.(jpe?g|png|webp)$/i.test(f.name)?'immagine':'video',tag:f.name.toLowerCase().replace(/\.[^.]+$/,'').split(/[^a-zàèéìòù0-9]+/).filter(w=>w.length>2)}))}}catch(_){}
  items.forEach(x=>{x.tipo=x.tipo||(/\.(jpe?g|png|webp)$/i.test(x.file)?'immagine':'video');x.tag=(x.tag||[]).map(t=>String(t).toLowerCase())});
  CR.lib=items;return items}
function crLibShow(items){const el=$('#cr-libin');if(!el)return;const sm=$('#cr-lib summary');if(sm)sm.textContent=`Libreria del repository (${items.length})`;
  el.innerHTML=items.length?`<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">${items.map(x=>`<div style="background:var(--card);border:1px solid var(--line);border-radius:10px;aspect-ratio:9/16;overflow:hidden;display:grid;place-items:center;font-size:11px;color:var(--mut);text-align:center">${x.poster||x.tipo==='immagine'?`<img src="libreria/${encodeURIComponent(x.poster||x.file)}" style="width:100%;height:100%;object-fit:cover" alt="">`:'🎞️<br>'+esc(x.file.slice(0,18))}</div>`).join('')}</div>
   <small class="n">Le clip entrano come scene in più tra una battuta e l'altra di Gennarino, scelte in base alle parole della frase.</small>`
   :'<div style="font-size:13.5px">La libreria è vuota: Gennarino viene disegnato da Spinta. Se metti clip o immagini di Gennarino nella cartella <b>libreria</b> del repository (o le mandi a Claude), entrano come scene in più.</div>'}

/* ---------- regia: tempi, espressioni, scene ---------- */
function crExpr(t,i,n){const s=t.toLowerCase();if(i===n-1)return'wave';
  if(/(spengo|stuto|scaric|paura|aiuto|disastro|guai|problema|non ce la|triste|peccato|crisi|spegn)/.test(s))return'sad';
  if(/(^|\s)(uè|ue|ciao|salve|eccomi)\b|guagli/.test(s)&&i<2)return'wave';
  if(/(grazie|evviva|grande|bell|fatt|gratis|regal|festa|vint|forza|jamme)/.test(s))return'happy';
  if(/\?/.test(s))return'think';if(/!/.test(s))return'surprised';return'talk'}
const CR_STOP=new Set("il lo la i gli le un una uno di a da in con su per tra fra e o ma che mi ti si ci vi non del della dei al alla ai nel nella sul sulla l' un' d' c' ce se è".split(' '));
function crPages(words){const pages=[];let cur=[];const flush=()=>{if(cur.length){pages.push(cur);cur=[]}};
  words.forEach((w,i)=>{cur.push(w);const len=cur.join(' ').length,last=w.toLowerCase().replace(/[^\p{L}']/gu,'');
    if((/[,.;:!?…]$/.test(w)&&cur.length>=2&&len>=12)||cur.length>=6||len>=28){if(CR_STOP.has(last)&&i<words.length-1&&cur.length<8)return;flush()}});
  flush();if(pages.length>1&&pages[pages.length-1].length===1&&pages[pages.length-1][0].length<9){const l=pages.pop();pages[pages.length-1].push(...l)}
  return pages}
const CR_HL=/^(\d[\d.,]*|like|follower|batteria|domenica|gennarino|bancarella|napoli|parte|gratis|regalo|spengo|stuto)$/i;
function crState(lines,vt,s,lib){const ser=curSeries(),ep=ser?ser.ep:null,n=lines.length;
  const items=lines.map((text,i)=>{const sg=vt.seg[i],pages=crPages(crClean(text).split(/\s+/).filter(Boolean));
    const tot=pages.reduce((a,p)=>a+p.join(' ').length,0)||1;let t=sg.s;
    const pg=pages.map(p=>{const d=(sg.e-sg.s)*p.join(' ').length/tot,o={s:t,e:t+d,w:p};t+=d;return o});
    const low=text.toLowerCase(),STAMP=/(spengo|stuto|scaric|spegn)/i,sp=pg.find(p=>STAMP.test(p.w.join(' ')));
    const idea=i>0&&crClean(text).match(/^(oggi sul banco|sul banco|mi avete chiesto|avete chiesto|la richiesta[^:]{0,20})\s*:\s*(.{6,})$/i);
    return{i,text,s:sg.s,e:sg.e,pages:pg,expr:crExpr(text,i,n),stamp:!!sp,stampAt:sp?sp.s:null,hearts:/(like|cuor)/.test(low),shot:null,
      pop:idea?'idea':null,popTxt:idea?idea[2].replace(/[.!?…]+$/,''):'',popHead:idea?idea[1].toUpperCase():''}});
  // calendario della ricarica: una volta sola, sull'ultima frase che parla di domenica
  for(let i=n-2;i>0;i--){if(/domenic/i.test(items[i].text)&&!items[i].pop){items[i].pop='cal';break}}
  // libreria: scene in più. Prima le frasi che hanno parole in comune con le etichette della clip (tutte tranne l'hook),
  // poi, a frasi alterne, le altre scene a rotazione nelle frasi centrali (al massimo 2 volte la stessa); mai la stessa scena in due frasi vicine
  if(lib&&lib.length&&n>3){const ok=it=>it.i>0&&it.i<n-1&&it.expr!=='wave',has=i=>!!(items[i]&&items[i].shot),
      near=(i,x)=>(items[i-1]&&items[i-1].shot===x)||(items[i+1]&&items[i+1].shot===x),uses=new Map(),use=(it,x)=>{it.shot=x;uses.set(x,(uses.get(x)||0)+1)};
    items.forEach(it=>{if(it.i<1)return;const words=new Set(crClean(it.text).toLowerCase().split(/[^a-zàèéìòù0-9]+/));let best=null,bs=0;
      lib.forEach(x=>{const sc=x.tag.filter(t=>words.has(t)).length;if(sc>bs&&!near(it.i,x)){bs=sc;best=x}});if(best)use(it,best)});
    let k=ep||0;items.forEach(it=>{if(!ok(it)||it.shot||has(it.i-1)||has(it.i+1))return;
      for(let a=0;a<lib.length;a++){const x=lib[(k+a)%lib.length];if(!near(it.i,x)&&(uses.get(x)||0)<2){use(it,x);k+=a+1;break}}});
    // se una clip torna una seconda volta riparte da dove si era fermata, così non si vede ripetere lo stesso pezzo
    const off=new Map();items.forEach(it=>{if(!it.shot)return;it.shotOff=off.get(it.shot)||0;off.set(it.shot,it.shotOff+(it.e-it.s)+0.22)})}
  const hook=crClean(lines[0]),sun=crNextSunday();
  return{items,vt,total:vt.total,hook,hookShow:Math.max(2.6,items[0]?items[0].e+0.15:2.6),ser,ep,likes:s.likes,goal:s.goal,sun,
    day:`DOM ${sun.getDate()}/${sun.getMonth()+1}`,endTxt:ser?`Parte ${ep+1} in arrivo: segui 🔔`:'Segui per non perderti il prossimo 🔔',subs:s.subs,bar:s.bar,seed:(ep||1)*7}}

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
  else if(expr==='sad'){[L,R].forEach(x=>crRR(c,x-14,y-8,28,38,14));c.lineWidth=10;c.beginPath();c.moveTo(L-34,y-30);c.lineTo(L+18,y-50);c.moveTo(R+34,y-30);c.lineTo(R-18,y-50);c.stroke()}
  else if(expr==='surprised'){c.lineWidth=11;[L,R].forEach(x=>{c.beginPath();c.arc(x,y,27,0,Math.PI*2);c.stroke()})}
  else if(expr==='think'){const dx=Math.sin(t*1.5)*6;[L,R].forEach(x=>crRR(c,x-13+8+dx,y-30,26,40,13));c.lineWidth=9;c.beginPath();c.moveTo(R-24,y-56);c.quadraticCurveTo(R,y-70,R+26,y-60);c.stroke()}
  else[L,R].forEach(x=>crRR(c,x-14,y-22,28,46,14));
  c.restore()}
function crRobot(c,t,st,it,mouth){const expr=it?it.expr:'talk',bob=Math.sin(t*2.4)*5,blink=(t%3.7)<0.12;c.save();c.translate(0,bob);
  // corpo e schermo sul petto con i like
  const bg=c.createLinearGradient(0,930,0,1130);bg.addColorStop(0,'#f6f8fc');bg.addColorStop(1,'#cbd2df');crRR(c,385,928,310,220,46,bg);
  crRR(c,436,972,208,86,22,'#1b2133');crHeart(c,482,1014,20,'#ff4d5a');c.fillStyle='#fff';c.font=`900 42px ${CR_FONT}`;c.textAlign='left';c.textBaseline='middle';c.fillText(String(st.likes),512,1016);
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
function crJar(c,st,t,hearts){const fill=st.goal?Math.max(0.04,Math.min(1,st.likes/st.goal)):0.5;
  c.save();crRR(c,810,990,110,22,8,'#2a2f3d');c.globalAlpha=0.9;crRR(c,818,1010,94,112,16,'rgba(205,232,255,.28)');c.globalAlpha=1;
  const h=100*fill;crRR(c,822,1118-h,86,h,12,'#e23d4a');c.strokeStyle='rgba(255,255,255,.55)';c.lineWidth=4;crRR(c,818,1010,94,112,16);c.stroke();crHeart(c,865,1058,18,'rgba(255,255,255,.92)');
  if(hearts)for(let k=0;k<6;k++){const p=((t*0.55+k/6)%1),x=865+Math.sin((t+k)*3)*26,y=990-p*360;c.globalAlpha=Math.max(0,1-p)*0.9;crHeart(c,x,y,16+k%3*5,'#ff4d6d')}
  c.restore()}
function crStamp(c,t0,t){const a=Math.min(1,(t-t0)/0.18),sc=1+(1-a)*0.6;c.save();c.translate(760,470);c.rotate(-0.17);c.scale(sc,sc);c.globalAlpha=a;
  c.strokeStyle='#e23d3d';c.lineWidth=12;crRR(c,-210,-70,420,140,18);c.stroke();c.fillStyle='#e23d3d';c.font=`900 96px ${CR_FONT}`;c.textAlign='center';c.textBaseline='middle';c.fillText('SCARICO!',0,6);c.restore()}
// riquadri a comparsa come nelle puntate: il calendario della ricarica e l'idea del giorno
const CR_MESI=['GENNAIO','FEBBRAIO','MARZO','APRILE','MAGGIO','GIUGNO','LUGLIO','AGOSTO','SETTEMBRE','OTTOBRE','NOVEMBRE','DICEMBRE'];
function crPop(c,it,st,t){const cal=it.pop==='cal',solo=cal&&it.stamp&&it.stampAt-it.s>=0.8,end=solo?it.stampAt:it.e+0.22,a=Math.min(1,Math.max(0,(t-it.s)/0.25),Math.max(0,(end-t)/0.2));if(a<=0)return;
  const k=1-Math.pow(1-Math.min(1,(t-it.s)/0.25),3),card=(x,y,w,h)=>{c.shadowColor='rgba(0,0,0,.35)';c.shadowBlur=30;c.shadowOffsetY=12;crRR(c,x,y,w,h,28,'#fbf8f1');c.shadowColor='transparent';c.shadowBlur=0;c.shadowOffsetY=0};
  c.save();c.globalAlpha=a;c.textAlign='center';c.textBaseline='middle';
  if(cal){const sc=0.7+0.3*k;c.translate(it.stamp&&!solo?300:540,400);c.scale(sc,sc);card(-160,-165,320,330);
    c.save();crRR(c,-160,-165,320,330,28);c.clip();c.fillStyle='#e7414b';c.fillRect(-160,-165,320,76);c.restore();
    c.fillStyle='#fff';c.font=`900 34px ${CR_FONT}`;c.fillText('DOMENICA',0,-126);
    c.fillStyle='#1d1d26';c.font=`900 150px ${CR_FONT}`;c.fillText(String(st.sun.getDate()),0,-6);
    c.fillStyle='#e7414b';c.font=`900 32px ${CR_FONT}`;c.fillText(CR_MESI[st.sun.getMonth()],0,82);
    if(st.goal){c.font=`800 28px ${CR_FONT}`;const tx=`${st.goal} like`,w=c.measureText(tx).width+72;crRR(c,-w/2,106,w,44,22,'#23212e');crHeart(c,-w/2+30,130,11,'#ff4d5a');c.fillStyle='#fff';c.textAlign='left';c.fillText(tx,-w/2+48,129)}}
  else{const sc=0.85+0.15*k;c.translate(540,400);c.scale(sc,sc);c.font=`800 42px ${CR_FONT}`;
    const L=[];let cur='';it.popTxt.split(/\s+/).forEach(w=>{const nx=cur?cur+' '+w:w;if(c.measureText(nx).width>780&&cur){L.push(cur);cur=w}else cur=nx});if(cur)L.push(cur);
    const ls=L.slice(0,3),h=104+ls.length*54;card(-440,-h/2,880,h);crCirc(c,-384,-h/2+54,24,'#4ff0d0');crHeart(c,-384,-h/2+56,11,'#1b2133');
    c.textAlign='left';c.fillStyle='#8a8f9c';c.font=`900 26px ${CR_FONT}`;c.fillText(it.popHead,-344,-h/2+56);
    c.fillStyle='#1d1d26';c.font=`800 42px ${CR_FONT}`;ls.forEach((ln,j)=>c.fillText(ln,-400,-h/2+118+j*54))}
  c.restore()}
function crBadges(c,st){c.save();c.font=`900 42px ${CR_FONT}`;c.textAlign='left';c.textBaseline='middle';c.shadowColor='rgba(79,240,208,.6)';c.shadowBlur=14;c.fillStyle='#4ff0d0';
  c.fillText(st.ser?`GENNARINO · P${st.ep}`:'GENNARINO',64,142);c.restore();
  if(!st.goal)return;c.save();c.font=`900 40px ${CR_FONT}`;const txt=`CARICA ${st.likes} / ${st.goal}`,tw=c.measureText(txt).width,w=tw+96,x=1030-w;
  c.shadowColor='rgba(0,0,0,.3)';c.shadowBlur=12;crRR(c,x,106,w,70,35,'#fff');c.shadowBlur=0;crHeart(c,x+42,142,15,'#ff3b4e');c.fillStyle='#1d1d26';c.textBaseline='middle';c.textAlign='left';c.fillText(txt,x+66,143);
  c.font=`900 32px ${CR_FONT}`;const d=`RICARICA ${st.day}`,dw=c.measureText(d).width+48;crRR(c,1030-dw,190,dw,52,26,'#ff4656');c.fillStyle='#fff';c.fillText(d,1030-dw+24,217);c.restore()}
// sottotitoli: bianco con contorno, parole chiave in giallo
function crSubs(c,words,alpha){c.save();c.globalAlpha=alpha;c.textBaseline='middle';c.lineJoin='round';let fs=70,lines=[words];
  for(;fs>=48;fs-=6){c.font=`900 ${fs}px ${CR_FONT}`;const wd=a=>c.measureText(a.join(' ')).width;
    if(wd(words)<=900){lines=[words];break}
    let best=null;for(let k=1;k<words.length;k++){const m=Math.max(wd(words.slice(0,k)),wd(words.slice(k)));if(!best||m<best.m)best={k,m}}
    if(best&&best.m<=900){lines=[words.slice(0,best.k),words.slice(best.k)];break}}fs=Math.max(fs,48);
  const lh=fs*1.22,y0=1500-(lines.length-1)*lh/2;lines.forEach((ln,i)=>{const full=ln.join(' ');let x=540-c.measureText(full).width/2;const y=y0+i*lh;
    ln.forEach((w,j)=>{const ww=c.measureText(w).width,hl=CR_HL.test(w.replace(/[^\p{L}\p{N}]/gu,''));c.lineWidth=14;c.strokeStyle='#000';c.strokeText(w,x,y);c.fillStyle=hl?'#ffd23f':'#fff';c.fillText(w,x,y);
      x+=ww+(j<ln.length-1?c.measureText(' ').width:0)})});c.restore()}
// una clip o un'immagine della libreria a tutto schermo (ritaglio 9:16)
function crMedia(c,el,t,t0){const vid=el.tagName==='VIDEO';if(vid?el.readyState<2:!(el.complete&&el.naturalWidth))return false;
  const w=vid?el.videoWidth:el.naturalWidth,h=vid?el.videoHeight:el.naturalHeight;if(!w||!h)return false;
  const z=vid?1:1+Math.min(1,(t-t0)/4)*0.1,r=Math.max(1080/w,1920/h)*z,dw=w*r,dh=h*r;c.drawImage(el,(1080-dw)/2,(1920-dh)/2,dw,dh);return true}
function crDraw(ctx,W,H,t,st,L,media){const c=ctx;c.setTransform(W/1080,0,0,H/1920,0,0);
  const it=st.items.find(x=>t>=x.s&&t<x.e+0.22)||null;const k=Math.min(st.vt.env.length-1,Math.max(0,Math.floor(t*st.vt.fps)));const mouth=it?st.vt.env[k]:0;
  let drawn=false;if(it&&it.shot&&media&&media.el&&media.cur===it){c.fillStyle='#000';c.fillRect(0,0,1080,1920);drawn=crMedia(c,media.el,t,it.s)}
  // sulle clip della libreria un'ombra morbida dietro ai sottotitoli, così si leggono anche sopra l'insegna
  if(drawn&&st.subs&&it.i>0){const gr=c.createLinearGradient(0,1320,0,1700);gr.addColorStop(0,'rgba(0,0,0,0)');gr.addColorStop(0.5,'rgba(0,0,0,.42)');gr.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=gr;c.fillRect(0,1320,1080,380)}
  if(!drawn){c.drawImage(L.back,0,0,1080,1920);crRobot(c,t,st,it,mouth);c.drawImage(L.front,0,0,1080,1920);crJar(c,st,t,it&&it.hearts)}
  if(it&&it.pop)crPop(c,it,st,t);
  if(it&&it.stamp&&t>=it.stampAt)crStamp(c,it.stampAt,t);
  if(t<st.hookShow){const a=t>st.hookShow-0.3?(st.hookShow-t)/0.3:1;c.setTransform(1,0,0,1,0,0);drawCaption(ctx,st.hook,W,H,0.165,a,0.068);if(st.ser)drawPill(ctx,'PARTE '+st.ep,W,H,0.165,st.hook,a);c.setTransform(W/1080,0,0,H/1920,0,0)}
  else if(t>st.total-2.8){c.setTransform(1,0,0,1,0,0);drawCaption(ctx,st.endTxt,W,H,0.165,Math.min(1,(t-(st.total-2.8))/0.3),0.062);c.setTransform(W/1080,0,0,H/1920,0,0)}
  else crBadges(c,st);
  // la prima frase è già scritta in alto come hook: i sottotitoli partono dalla seconda
  if(st.subs&&it&&it.i>0){const pg=it.pages.find(p=>t>=p.s&&t<p.e+0.25)||it.pages[it.pages.length-1];if(pg&&t>=it.s)crSubs(c,pg.w,1)}
  if(st.bar){const h=12;c.fillStyle='rgba(255,255,255,.25)';c.fillRect(0,1920-h,1080,h);const gr=c.createLinearGradient(0,0,1080,0);gr.addColorStop(0,'#ff2d6f');gr.addColorStop(1,'#25f4ee');c.fillStyle=gr;c.fillRect(0,1920-h,1080*Math.min(1,t/st.total),h)}
  c.setTransform(1,0,0,1,0,0)}
function crLayers(W,H,st){return{back:crLayer(W,H,c=>crBack(c,st.seed)),front:crLayer(W,H,crFrontL)}}

/* ---------- anteprima ---------- */
let _crPT=null;function crPrevSoon(){clearTimeout(_crPT);_crPT=setTimeout(crPrev,250)}
function crPrev(){const cv=$('#cr-prev');if(!cv)return;const lines=crLines(),s=crSet();const n=Math.max(1,lines.length);
  $('#cr-len').textContent=lines.length?`${lines.length} frasi · circa ${Math.round(lines.join(' ').split(/\s+/).length/3.3+n*0.22+0.6)} secondi`:'';
  const fake={seg:lines.map((_,i)=>({s:i*2.4,e:i*2.4+2.2})),total:n*2.4,env:new Float32Array(1).fill(0.4),fps:30};
  const st=crState(lines.length?lines:['…'],fake,{...s,subs:$('#cr-subs').checked,bar:$('#cr-bar').checked,likes:+$('#cr-likes').value||0,goal:+$('#cr-goal').value||0},null);
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
  const cap=(window._nx&&window._nx.raw&&window._nx.cap&&ser&&window._nx.raw.ep===ep)?window._nx.cap:`${ser?`Parte ${ep} · `:''}${st.hook} 👇\n\n${[...new Set(tags)].slice(0,RULES.hashtag.max).join(' ')}`;window._spintaCap=cap;
  const hookW=st.hook.split(/\s+/).filter(Boolean).length,shots=st.items.length+st.items.filter(x=>x.shot).length;
  DB.lastPkg={id:uid(),at:Date.now(),title:cutTxt(st.hook,90),cap,hk:(((window._nx&&window._nx.hooks)||[]).find(h=>crClean(h.s)===st.hook)||{k:'Personalizzato'}).k,
    len:+st.total.toFixed(1),series:ser?{id:ser.id,name:ser.name,ep}:null,score:null,transcript:lines.join(' ').slice(0,900),topic:'',end:st.endTxt,niche:'tech',made:'creatore',
    f:{lead:0.2,pause:0,topicAt:null,pace:Math.round(shots/Math.max(1,st.total)*100)/10,hookW,subs:!!s.subs,end:true,capQ:/\?|comment|scrivete|ditemelo|dimmi/i.test(cap)},miss:[]};save();
  const canShare=!!(navigator.canShare&&navigator.canShare({files:[file]}));const slot=personalSlot().when;
  crSay(`<div class="card" style="margin-top:12px;background:var(--card2)"><h3>✅ Video pronto</h3>
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
