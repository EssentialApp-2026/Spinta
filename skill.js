/* Spinta · 13 skill per TikTok (Strumenti → Skill)
   Tutto gira nel telefono: niente API, niente chiavi, niente librerie esterne.
   Le skill che usano i tuoi dati (Virale, Piano, Audit) leggono i video che hai inserito in «Crescita». */
'use strict';
const SK={cur:null,plan:null};
const skT=(s,v)=>String(s).replace(/\{t\}/g,v.t||'').replace(/\{T\}/g,cap1(v.t||'')).replace(/\{k\}/g,v.k||'');
const skItem=(title,body,copy)=>`<div class="item">${copy?copyBtn(copy):''}<div class="t">${title}</div>${body?`<div class="m" style="margin-top:4px;white-space:pre-wrap">${body}</div>`:''}</div>`;
const skNote=t=>`<div class="card"><div class="m" style="color:var(--mut);font-size:13px">💡 ${t}</div></div>`;
const skNiches=()=>Object.entries(NICHES).map(([k,v])=>[k,v.n]);
const skF={t:{id:'t',l:'Di cosa parla il video?',ph:'es. frittata di pasta, trading, pesca a spinning…'},
  tono:{id:'tono',l:'Tono',type:'select',o:[['diretto','Diretto'],['ironico','Ironico'],['misterioso','Misterioso'],['educativo','Educativo']]},
  nic:{id:'nic',l:'Nicchia',type:'select',o:skNiches}};
const skDay=d=>DAYS[d.getDay()];
const skISO=d=>{const x=new Date(d);x.setMinutes(x.getMinutes()-x.getTimezoneOffset());return x.toISOString().slice(0,10)};
const skStats=()=>(DB.stats||[]).filter(s=>s.views>0).sort((a,b)=>(a.date||'').localeCompare(b.date||''));

const SKILLS=[
/* 1 ─ VIDEO */
{k:'video',e:'🎬',n:'Copione',d:'Scrive il copione di un video, secondo per secondo',f:[skF.t,{id:'dur',l:'Durata',type:'select',o:[['15','15 secondi'],['30','30 secondi'],['60','60 secondi']]},skF.tono],
 run(v){const t=v.t,tone=TONE[v.tono]||TONE.diretto,hooks=shuffle(HOOKS).slice(0,3).map(h=>{let s=h.s.replace(/\{t\}/g,t).replace(/\{T\}/g,cap1(t));const p=pick(tone.pre);if(p)s=p+s.charAt(0).toLowerCase()+s.slice(1);return{s:cap1(s),o:h.o}});
  const H=hooks[0],V=()=>pick(VISUAL),d=+v.dur;let parts;
  if(d===15)parts=[['0-2 s','HOOK',H.s,H.o],['2-11 s','Il trucco',`Mostra subito {t}: un solo passaggio, veloce, senza introduzioni.`,'Un solo trucco'],['11-15 s','Chiusura a loop',`Finisci con la frase con cui hai iniziato, così si rivede da capo. Poi: "Segui per il prossimo".`,'Parte 2 domani']];
  else if(d===30)parts=[['0-3 s','HOOK',H.s,H.o],['3-10 s','Il problema',`Qual è l'errore più comune su {t}? Dillo in una frase e mostralo.`,'Il problema'],['10-24 s','3 passi',`Passo 1, passo 2, passo 3: una frase per ognuno, con il testo a schermo che cambia ogni 4 secondi.`,'1 · 2 · 3'],['24-30 s','Finale + invito',`Risultato finale e una domanda: "Voi come fate con {t}?"`,'Scrivilo nei commenti']];
  else parts=[['0-3 s','HOOK',H.s,H.o],['3-12 s','Perché ti riguarda',`Racconta in 2 frasi perché {t} serve a chi guarda, con un esempio vero.`,'Perché ti serve'],['12-30 s','Punto 1 e 2',`Due cose concrete su {t}. Un taglio ogni 3-4 secondi e testo a schermo.`,'Punto 1 · Punto 2'],['30-48 s','Colpo di scena',`Quello che quasi nessuno dice su {t}: il punto che fa dire «ah, non lo sapevo».`,'Quasi nessuno lo dice'],['48-60 s','Finale + invito',`Riassumi in una frase e chiedi un parere nei commenti. Aggiungi "Parte 2" se vuoi la serie.`,'Parte 2?']];
  const txt=parts.map(p=>`${p[0]} · ${p[1]}\n🗣️ ${skT(p[2],v)}\n📱 ${p[3]}\n🎥 ${V()}`).join('\n\n');
  return skItem('Copione da '+d+' secondi',parts.map(p=>`<div style="margin-bottom:10px"><span class="tag p">${p[0]}</span> <b>${esc(p[1])}</b><div class="m">🗣️ ${esc(skT(p[2],v))}</div><div class="m">📱 Testo a schermo: <b style="color:var(--txt)">${esc(p[3])}</b></div><div class="m">🎥 ${esc(V())}</div></div>`).join(''),txt)+
   skItem('Altri 2 hook da provare',hooks.slice(1).map(h=>'• '+esc(h.s)).join('\n'),hooks.slice(1).map(h=>h.s).join('\n'))+skNote('Gira il video a voce, senza leggere: il copione è una traccia. I primi 3 secondi decidono tutto.')}},

/* 2 ─ VIRALE */
{k:'virale',e:'🔥',n:'Virale',d:'Trova cosa è andato meglio del solito e te lo fa ripetere',data:1,f:[{id:'t',l:'Tema per le nuove idee (facoltativo)',ph:'es. pesca a spinning'}],
 run(v){const S=skStats(),t=v.t||'il tuo tema';
  const pat=[['Domanda che divide','«{T} è meglio A o B?» Il pubblico vota nei commenti.'],['Errore che tutti fanno','«Stai sbagliando {t}: ecco perché»'],['Prima / dopo','Mostra il risultato finale nei primi 2 secondi, poi spiega come.'],['Numero preciso','«3 cose su {t} che avrei voluto sapere prima»'],['Sfida con una regola','«Provo {t} per 7 giorni: ecco cosa succede»']].map(p=>skItem(p[0],skT(p[1],{t,T:t}),skT(p[1],{t,T:t}))).join('');
  if(S.length<3)return `<div class="card"><b>Servono almeno 3 video con i dati.</b><div class="m" style="margin-top:6px">Inseriscili in «Crescita» dopo 48 ore: poi qui vedrai quali sono andati meglio e cosa hanno in comune. Intanto, 5 strutture che funzionano:</div></div>`+pat;
  const m=avg(S.map(s=>s.views)),top=S.filter(s=>s.views>=m*1.4).sort((a,b)=>b.views-a.views).slice(0,5);
  if(!top.length)return `<div class="card"><b>Nessun video batte la tua media di ${Math.round(m)} view di almeno il 40%.</b><div class="m" style="margin-top:6px">Prova una di queste strutture e confronta:</div></div>`+pat;
  const cnt=(k)=>{const c={};top.forEach(s=>{if(s[k])c[s[k]]=(c[s[k]]||0)+1});return Object.entries(c).sort((a,b)=>b[1]-a[1])[0]};
  const f=cnt('format'),h=cnt('hk'),hr=cnt('hour');
  return `<div class="card"><b>I tuoi video più forti</b> (almeno 1,4× la tua media di ${Math.round(m)} view)</div>`+top.map(s=>skItem(esc(cutTxt(s.title,50)),`${s.views} view · ${(s.views/m).toFixed(1)}× la media${s.format?' · '+esc(s.format):''}${s.hk?' · hook: '+esc(s.hk):''}${s.hour?' · '+esc(s.hour):''}`)).join('')+
   skItem('Cosa hanno in comune',[f?`• Formato più ricorrente: <b>${esc(f[0])}</b> (${f[1]} su ${top.length})`:'',h?`• Tipo di hook: <b>${esc(h[0])}</b>`:'',hr?`• Orario: <b>${esc(hr[0])}</b>`:'',`• Ripetili cambiando solo il tema, non la struttura.`].filter(Boolean).join('\n'))+
   `<h3 style="font-size:16px;margin:10px 0 6px">Da provare su «${esc(t)}»</h3>`+pat}},

/* 3 ─ PIANO */
{k:'piano',e:'📅',n:'Piano settimana',d:'Decide cosa pubblicare e quando, e lo mette nel Piano',data:1,f:[skF.t,{id:'n',l:'Video a settimana',type:'select',o:[['3','3'],['4','4'],['5','5']]},{id:'d',l:'Parti da',type:'date'}],
 run(v){const n=+v.n,start=v.d?new Date(v.d+'T12:00'):new Date(Date.now()+864e5);start.setHours(12,0,0,0);
  const F=[['Domanda','{T}: voi come la pensate? (domanda in apertura, risposte nei commenti)'],['Problema → soluzione','Il problema più comune su {t} e come risolverlo'],['Storia','Mini-storia su {t}: posta in gioco, ostacolo, finale'],['Tutorial 15 secondi','Un solo trucco su {t}, veloce e da rivedere in loop'],['Serie','Puntata numerata su {t}: «Parte 1»'],['Carosello foto','5 foto con testo: i punti chiave su {t}']];
  const gap=n>=5?1:n===4?2:2,out=[];let d=new Date(start);const used=new Set((DB.posts||[]).map(p=>p.date));
  for(let i=0;i<n;i++){let guard=0;while(used.has(skISO(d))&&guard++<5)d=new Date(d.getTime()+864e5);const f=F[i%F.length],time=BEST[d.getDay()][i%3===0?0:1];
    out.push({date:skISO(d),time,title:cap1(skT(f[1],v)).slice(0,90),fmt:f[0]});d=new Date(d.getTime()+gap*864e5)}
  SK.plan=out;
  return `<div class="card"><b>Piano di ${n} video</b><div class="m" style="margin-top:4px">Orari scelti tra i migliori del giorno; i giorni già occupati nel Piano sono saltati. Alterna formati diversi per non annoiare.</div></div>`+out.map(o=>skItem(`${skDay(new Date(o.date+'T12:00'))} ${o.date.slice(8)}/${o.date.slice(5,7)} · ${o.time} <span class="tag p">${esc(o.fmt)}</span>`,esc(o.title))).join('')+
   `<button class="btn" onclick="skAddPlan()">＋ Aggiungi tutto al Piano</button>`}},

/* 4 ─ CAPTION */
{k:'caption',e:'🏷️',n:'Caption e ricerca',d:'Caption che ti fanno trovare nella ricerca di TikTok',f:[skF.t,{id:'kw',l:'Parole chiave (separate da virgola)',ph:'es. esche, spinning, bass'},skF.nic],
 run(v){const kw=(v.kw||'').split(',').map(x=>x.trim()).filter(Boolean),k1=kw[0]||v.t;
  const C=[`Come ${v.t}: ${k1} spiegato semplice 👇`,`${cap1(v.t)} — la guida di 30 secondi su ${k1}`,`Cerchi ${k1}? Ecco cosa ti serve sapere su ${v.t}`,`Errori su ${v.t} che si risolvono in un minuto. Salva il video 📌`];
  return shuffle(C).slice(0,3).map(c=>{const tg=tagsFor(v.t,kw,v.nic),full=c+'\n\n'+tg;return skItem(esc(c),`<span style="color:var(--cyan)">${esc(tg)}</span>`,full)}).join('')+
   skNote(`La ricerca di TikTok legge caption, testo a schermo e parlato: dì «${esc(k1)}» a voce nei primi secondi, scrivilo a schermo e mettilo nella prima riga della caption. Massimo ${RULES.hashtag.max} hashtag specifici.`)}},

/* 5 ─ CAROSELLO */
{k:'carosello',e:'🖼️',n:'Carosello foto',d:'Schema slide per slide per un post a foto',f:[skF.t,{id:'n',l:'Quante slide',type:'select',o:[['5','5'],['7','7'],['9','9']]},{id:'ty',l:'Tipo',type:'select',o:[['lista','Lista di consigli'],['errori','Errori da evitare'],['passi','Passo dopo passo'],['pd','Prima / dopo']]}],
 run(v){const n=+v.n,t=v.t,H={lista:`${n-2} cose su ${t} che vorrei aver saputo prima`,errori:`${n-2} errori su ${t} (il n.${n-2} è il più comune)`,passi:`${t} in ${n-2} passi`,pd:`${cap1(t)}: prima e dopo`}[v.ty],L={lista:'Consiglio',errori:'Errore',passi:'Passo',pd:'Punto'},sl=[`COPERTINA · ${cap1(H)}\n(una foto chiara + il titolo grande, massimo 8 parole)`];
  for(let i=1;i<n-1;i++)sl.push(v.ty==='pd'&&i<=2?`SLIDE ${i+1} · ${i===1?'PRIMA':'DOPO'}\n(la foto dice tutto, una riga di testo)`:`SLIDE ${i+1} · ${L[v.ty]} ${i}\n(una frase corta su ${t} + una foto che la mostra)`);
  sl.push(`ULTIMA · Invito\n«Salvalo per dopo e scrivimi nei commenti il tuo n.1 su ${t}»`);
  return skItem('Carosello da '+n+' slide',sl.map((s,i)=>`<div style="margin-bottom:8px"><span class="tag p">${i+1}</span> ${esc(s).replace(/\n/g,'<br>')}</div>`).join(''),sl.join('\n\n'))+skItem('Caption',esc(`${cap1(H)}. Scorri e salva 📌`),`${cap1(H)}. Scorri e salva 📌`)+skNote('Una sola idea per slide, testo grande e leggibile, stesso stile in tutte. I caroselli si salvano molto: chiedi il salvataggio nell’ultima slide.')}},

/* 6 ─ STORIA */
{k:'storia',e:'📖',n:'Storia 60-90 s',d:'Una mini-storia con posta in gioco, ostacolo e finale',f:[skF.t,{id:'p',l:'Chi è il protagonista?',ph:'es. Gennarino, io, un pescatore…'},{id:'g',l:'Finale',type:'select',o:[['bene','Va a finire bene'],['male','Va a finire male'],['sospeso','Finale aperto (serie)']]}],
 run(v){const p=v.p||'Io',t=v.t,fin={bene:`${p} ce la fa. Mostra il risultato e dì cosa ha imparato.`,male:`Non va come previsto. Ridici su e dì cosa farai diversamente.`,sospeso:`Si ferma sul momento più teso: «Domani vi dico come è andata» → Parte 2.`}[v.g];
  const B=[['0-4 s','Posta in gioco',`${p} deve riuscire con ${t} entro una scadenza. Dillo subito: «${cap1(p)} ha 24 ore per ${t}».`],['4-15 s','Situazione normale',`Mostra com’è di solito. Una scena, una frase.`],['15-30 s','Il problema',`Qualcosa va storto su ${t}. Fai vedere l’ostacolo, non spiegarlo.`],['30-45 s','Primo tentativo',`${cap1(p)} prova la soluzione più ovvia e non funziona.`],['45-65 s','La svolta',`L’idea giusta su ${t}: il momento «ahh».`],['65-80 s','Finale',fin],['80-90 s','Invito',`«Voi cosa avreste fatto? Scrivetelo nei commenti.»`]];
  return skItem('Struttura della storia',B.map(b=>`<div style="margin-bottom:8px"><span class="tag p">${b[0]}</span> <b>${esc(b[1])}</b><div class="m">${esc(b[2])}</div></div>`).join(''),B.map(b=>`${b[0]} · ${b[1]}\n${b[2]}`).join('\n\n'))+skNote('Taglia ogni 3-4 secondi e tieni la domanda aperta fino alla svolta: chi vuole sapere come va a finire resta fino alla fine.')}},

/* 7 ─ PROFILO */
{k:'profilo',e:'👤',n:'Profilo',d:'Bio, video fissati e controllo del profilo',f:[{id:'c',l:'Cosa offri?',ph:'es. ricette veloci, trucchi di pesca…'},{id:'w',l:'Per chi?',ph:'es. chi ha poco tempo'},{id:'b',l:'La tua bio attuale (facoltativa)',type:'area'},{id:'s',l:'Quanti video hai fissati in alto?',type:'select',o:[['0','0'],['1','1'],['2','2'],['3','3']]}],
 run(v){const c=v.c,w=v.w||'te',B=[`${cap1(c)} per ${w} 🎯 Nuovo video ogni giorno`,`${cap1(c)} · per ${w} · segui per non perderti niente 👇`,`Qui trovi: ${c}. Per ${w}. Link in basso ⬇️`].map(b=>b.slice(0,80));
  let sc=0;const ok=[],ko=[];const b=v.b||'';
  if(b){if(b.length<=80){sc+=25;ok.push('Bio breve (max 80 caratteri)')}else ko.push(`Bio troppo lunga (${b.length}): accorciala a 80.`);
    if(/(per|se sei|chi)/i.test(b)){sc+=25;ok.push('Dice a chi parla')}else ko.push('Scrivi a chi ti rivolgi: «per chi…».');
    if(/(segui|link|👇|⬇|clicca|nuovo video|ogni)/i.test(b)){sc+=25;ok.push('Ha un invito')}else ko.push('Aggiungi un invito: «segui per…», «nuovo video ogni giorno».');
    if((b.match(/\p{Extended_Pictographic}/gu)||[]).length<=3){sc+=25;ok.push('Emoji misurate')}else ko.push('Troppe emoji: massimo 2-3.')}
  const pin=+v.s,pins=['Il video migliore (quello con più view)','Un video di presentazione: chi sei e cosa trovi','La puntata 1 della tua serie'];
  return (b?skItem(`La tua bio: ${sc}/100`,ok.map(x=>'✅ '+esc(x)).concat(ko.map(x=>'💡 '+esc(x))).join('\n')):'')+
   B.map(x=>skItem(esc(x),`${x.length}/80 caratteri`,x)).join('')+
   skItem('Video fissati ('+pin+'/3)',pins.map((p,i)=>(i<pin?'✅ ':'⬜ ')+esc(p)).join('\n'))+
   skItem('Controlli rapidi','⬜ Nome utente semplice da scrivere e da ricordare\n⬜ Nome visualizzato con la parola chiave (es. «Ricette veloci · Anna»)\n⬜ Foto profilo chiara anche in piccolo\n⬜ Un solo link nel profilo')}},

/* 8 ─ AUDIT */
{k:'audit',e:'🔍',n:'Audit del canale',d:'Controlla i tuoi dati e dice cosa sistemare per prima',data:1,f:[],
 run(){const S=skStats();if(S.length<3)return `<div class="card"><b>Servono almeno 3 video con i dati.</b><div class="m" style="margin-top:6px">Aggiungili in «Crescita»: poi l’audit confronta view, interazioni, visione completa e costanza con gli obiettivi di Spinta.</div></div>`;
  const R=RULES.obiettivi||{},rows=[],A=[];const m=avg(S.map(s=>s.views)),E=avg(S.map(er)),rt=S.map(ret).filter(x=>x!=null),rm=rt.length?avg(rt):null;
  const wk=(()=>{const d=new Date(Date.now()-28*864e5);const n=S.filter(s=>s.date&&new Date(s.date+'T12:00')>=d).length;return n/4})();
  rows.push([wk>=3,`Costanza: ${wk.toFixed(1)} video a settimana (obiettivo ${R.frequenza||'3-5'})`]);if(wk<3)A.push('Pubblica più spesso: fissa 3 giorni e usa la skill «Piano settimana».');
  rows.push([E>=5,`Interazioni: ${E.toFixed(1)}% in media`]);if(E<5)A.push('Chiudi ogni video con una domanda precisa: i commenti salgono.');
  if(rm!=null){rows.push([rm>=(R.completamento||70),`Quanto del video viene guardato: ${rm.toFixed(0)}% (obiettivo ${R.completamento||70}%)`]);if(rm<(R.completamento||70))A.push('Accorcia i video e metti il punto forte entro i primi 8 secondi.')}
  const fm={};S.forEach(s=>{if(s.format){(fm[s.format]=fm[s.format]||[]).push(s.views)}});const bf=Object.entries(fm).map(([k,a])=>[k,avg(a),a.length]).sort((a,b)=>b[1]-a[1])[0];
  if(bf)A.push(`Il formato «${bf[0]}» rende di più (${Math.round(bf[1])} view in media): fanne di più.`);
  const last=S.slice(-3).map(s=>s.views),tr=last.length===3&&last[2]>last[0]?'in crescita':'in calo o stabile';
  rows.push([last[2]>=last[0],`Ultimi 3 video: ${tr}`]);
  return `<div class="card"><b>${S.length} video · ${Math.round(m)} view in media</b></div>`+rows.map(r=>skItem((r[0]?'✅ ':'⚠️ ')+esc(r[1]),'')).join('')+skItem('Da fare adesso',A.slice(0,3).map((a,i)=>`${i+1}. ${esc(a)}`).join('\n')||'Tutto in linea: continua così.')}},

/* 9 ─ UMANO */
{k:'umano',e:'🧑',n:'Parlato naturale',d:'Toglie dai testi il tono «da robot» e li rende parlati',f:[{id:'x',l:'Incolla il testo (copione o caption)',type:'area'}],
 run(v){let x=v.x;  const W=(src,rep)=>[new RegExp('(?<![\\p{L}])'+src+'(?![\\p{L}])','giu'),rep],R=[W('in questo video',''),W('inoltre','e poi'),W('pertanto','quindi'),W('altresì','anche'),W('in conclusione','insomma'),W('è importante notare che',''),W('nel mondo di oggi','oggi'),W('scopri come','ecco come'),W('sblocca','prova'),W('rivoluzionari([oa])','nuov$1'),W('tuffiamoci','partiamo'),W('utilizzare','usare'),W('successivamente','dopo'),W('al fine di','per'),W('non solo (.+?) ma anche','$1 e anche'),W('siete pronti\\?','')];
  const found=[];R.forEach(([r,w])=>{const m=x.match(r);if(m)found.push(m[0])});
  let out=x.replace(/\s[—–]\s/g,', ').replace(/[•▪►]/g,'-');R.forEach(([r,w])=>{out=out.replace(r,w)});out=out.replace(/\s{2,}/g,' ').replace(/\s+([,.!?])/g,'$1').trim();
  const sents=x.split(/(?<=[.!?])\s+/),long=sents.filter(s=>s.split(/\s+/).length>20),emo=(x.match(/\p{Extended_Pictographic}/gu)||[]).length,dash=(x.match(/[—–]/g)||[]).length;
  let sc=100-found.length*8-long.length*10-Math.max(0,emo-4)*3-dash*4;sc=Math.max(5,Math.min(100,sc));const col=sc>=75?'var(--ok)':sc>=50?'var(--warn)':'var(--pink)';
  return skItem(`<span style="color:${col}">Naturalezza ${sc}/100</span>`,[found.length?`🤖 Frasi da robot: ${esc([...new Set(found.map(f=>f.toLowerCase()))].join(', '))}`:'✅ Nessuna frase da robot',long.length?`✂️ ${long.length} frase/i sopra le 20 parole: spezzale`:'✅ Frasi corte',emo>4?`😅 ${emo} emoji: ne bastano 2-3`:'✅ Emoji misurate',dash?`➖ ${dash} trattini lunghi «—»: sostituiti con la virgola`:'' ].filter(Boolean).join('\n'))+
   skItem('Versione più parlata',esc(out),out)+skNote('Leggi il testo ad alta voce: dove inciampi, cambia la frase. I contenuti fatti con l’AI vanno etichettati come tali su TikTok.')}},

/* 10 ─ RISPOSTE */
{k:'risposte',e:'💬',n:'Risposte ai commenti',d:'Capisce che commento è e ti scrive tre risposte',f:[{id:'c',l:'Incolla il commento',type:'area'},{id:'u',l:'Nome di chi l’ha scritto (facoltativo)',ph:'senza @'}],
 run(v){const c=v.c,u=v.u?'@'+v.u.replace(/^@+/,''):'',s=c.toLowerCase();
  const kind=/(https?:|www\.|segui\s?mi|follow\s?me|guadagna|€\s?\d+\s*al giorno)/i.test(c)?'spam':/\?|come |quando |dove |quanto |perch[eé]/.test(s)?'domanda':/(fa schifo|non serve|bufala|falso|truffa|sbagliat|mai|inutile|male)/.test(s)?'critica':/(potresti|puoi fare|fai un video|vorrei|fai un'app|fai un app|idea)/.test(s)?'richiesta':/(bravo|brava|grande|bellissim|top|forte|grazie|complimenti|❤|🔥|😍)/.test(s)?'complimento':'altro';
  const R={domanda:[`Bella domanda${u?' '+u:''}! In breve: [la tua risposta in una frase]. Se vuoi, ci faccio un video 👀`,`${u?u+', ':''}te lo spiego meglio nel prossimo video: resta sintonizzato!`,`Domanda da 10 e lode. Risposta: [una frase]. Qualcun altro se lo chiede?`],
   critica:[`Capisco il dubbio${u?' '+u:''}. Io faccio così per questo motivo: [una frase]. Se hai un’idea migliore dimmela!`,`Può darsi che tu abbia ragione su una parte: [cosa concedi]. Provo a farti cambiare idea col prossimo video 😄`,`Grazie per il parere sincero: ne tengo conto. Cosa faresti tu al posto mio?`],
   richiesta:[`Idea segnata${u?' '+u:''}! Se altri la vogliono, mettete un like al commento: così capisco quanto interessa 👇`,`Ci faccio un video, promesso. Ti taggo quando esce 🎬`,`Bella! Vediamo se riesco a metterla tra le prossime 3 idee.`],
   complimento:[`Grazie${u?' '+u:''}, mi fa tanto piacere! 🙏 Quale video ti è piaciuto di più?`,`Che bello leggerlo, grazie! Dimmi cosa vorresti vedere nel prossimo 👇`,`Grazie mille! Condividilo con chi può servire 😉`],
   altro:[`Grazie del commento${u?' '+u:''}! Tu cosa ne pensi?`,`Interessante! Mi racconti di più?`,`Ti rispondo con un video se piace anche agli altri 👀`],
   spam:[]}[kind],L={domanda:'Domanda',critica:'Critica',richiesta:'Richiesta di idea',complimento:'Complimento',altro:'Commento generico',spam:'Spam'}[kind];
  if(kind==='spam')return skItem('Spam o pubblicità','Non rispondere: tieni premuto sul commento e scegli «Elimina» o «Segnala». Rispondere dà visibilità a chi non la merita.');
  const vid=kind==='domanda'||kind==='critica'||kind==='richiesta';
  return skItem(`Tipo: ${L}`,vid?'🎥 Vale una risposta con un video: da TikTok, tieni premuto sul commento → «Rispondi con un video».':'💬 Basta la risposta scritta; rispondi entro 30 minuti dalla pubblicazione, aiuta il video.')+R.map(r=>skItem(esc(r),'',r)).join('')+skNote('Rispondi in modo vero e con parole tue: le parti tra [parentesi] sono da completare. Non inventare dati.')}},

/* 11 ─ DM */
{k:'dm',e:'✉️',n:'Messaggi privati',d:'Testi pronti per i messaggi diretti',f:[{id:'s',l:'Situazione',type:'select',o:[['nuovo','Nuovo follower'],['link','Chi chiede dove trovare qualcosa'],['collab','Proposta di collaborazione'],['critica','Messaggio critico'],['grazie','Chi ha condiviso il tuo video']]},{id:'n',l:'Nome di chi scrive',ph:'es. Marco'},{id:'m',l:'Il tuo nome o brand',ph:'es. EssentialApp'},{id:'l',l:'Link da dare (facoltativo)',ph:'es. essentialapp-2026.github.io/…'}],
 run(v){const n=v.n||'ciao',m=v.m||'me',l=v.l?` Qui: ${v.l}`:'',T={nuovo:[`Ciao ${n}! Grazie per il follow 🙏 Se c’è un argomento che vuoi vedere nei prossimi video, scrivimelo qui.`,`Ciao ${n}, benvenuto! Io sono ${m}: ogni settimana pubblico cose nuove. Dimmi pure cosa ti interessa.`],
   link:[`Ciao ${n}! Certo:${l||' [metti il link]'} Fammi sapere se funziona.`,`${cap1(n)}, ecco quello che cercavi.${l||' [metti il link]'} Se ti serve altro scrivimi.`],
   collab:[`Ciao ${n}, grazie della proposta! Mi interessa: puoi dirmi in due righe di cosa si tratta, tempi e cosa chiedi in cambio? Poi ti rispondo con calma.`,`Ciao ${n}! Prima di decidere mi mandi un esempio di cosa avete fatto con altri? Grazie, ${m}.`],
   critica:[`Ciao ${n}, grazie per averlo scritto. Prendo nota. Che cosa avresti voluto vedere al posto di quello che hai trovato?`,`${cap1(n)}, capisco il punto. Se mi spieghi meglio cosa non ti ha convinto, posso migliorare.`],
   grazie:[`Ciao ${n}! Ho visto che hai condiviso il mio video: grazie davvero 🙏 Se ti va, dimmi cosa ti è piaciuto di più.`,`${cap1(n)}, grazie della condivisione! Mi aiuti tantissimo. Ti serve altro su questo tema?`]}[v.s];
  return T.map((x,i)=>skItem('Versione '+(i+1),esc(x),x)).join('')+skNote('Un messaggio, una richiesta, tono tuo. Niente messaggi uguali a tantissime persone: TikTok può limitarti.')}},

/* 12 ─ COMMENTI */
{k:'commenti',e:'👀',n:'Commenti utili',d:'Commenti da lasciare sotto altri video per farti notare',f:[{id:'t',l:'Di cosa parla il video che stai commentando?',ph:'es. come pulire una canna da pesca'},{id:'ty',l:'Che tipo di commento',type:'select',o:[['valore','Aggiungo un’informazione'],['domanda','Faccio una domanda'],['opinione','Dico la mia'],['ironico','Ironico']]}],
 run(v){const t=v.t,C={valore:[`Aggiungo una cosa su ${t}: [un tuo dettaglio vero, in una frase]. Per me cambia tutto.`,`Io faccio un passaggio in più su ${t}: [quale]. Funziona benissimo.`,`Piccolo consiglio su ${t}: [consiglio]. Grazie per il video!`],
   domanda:[`Bel video! Su ${t}, quanto ci metti di solito?`,`Domanda sincera: con ${t} cosa fai quando [problema comune]?`,`Per ${t} serve per forza [cosa]? Io ho provato senza.`],
   opinione:[`Su ${t} io la penso un po’ diversamente: [tua idea]. Però il video è fatto bene.`,`Concordo al 100% su ${t}. Il punto più vero è [punto].`,`Sono d’accordo, ma su ${t} aggiungerei [cosa].`],
   ironico:[`Io su ${t}: «ci provo»… mia moglie: «ancora?» 😂`,`Dopo questo video guarderò ${t} con occhi nuovi (e un po’ di paura) 😅`,`Il mio cervello su ${t}: sembra facile, poi tocca a me 🤡`]}[v.ty];
  return C.map(c=>skItem(esc(c),'',c)).join('')+skNote('Commenta solo quando hai davvero qualcosa da dire, con parole tue. Mai «seguimi», link o commenti copiati: sembrano spam e danneggiano il profilo. Meglio 5 commenti buoni al giorno che 50 vuoti.')}},

/* 13 ─ RIUSO */
{k:'riuso',e:'♻️',n:'Riuso',d:'Da un video ne ricava altri 7, senza rigirare tutto',f:[{id:'t',l:'Titolo o tema del video già fatto',ph:'es. Come scelgo l’esca per la spigola'},{id:'p',l:'Il punto più forte (facoltativo)',ph:'es. la regola dei 3 secondi'}],
 run(v){const t=v.t,P=v.p?`«${v.p}»`:'il punto più forte';
  const R=[['✂️ Taglio da 15 secondi',`Prendi solo ${P} del video originale. Hook nuovo, via l’introduzione.`],['🖼️ Carosello foto',`5 slide: titolo su «${t}», 3 punti, invito a salvare. (skill «Carosello foto»)`],['🎞️ Serie in 3 parti',`Dividi «${t}» in Parte 1, 2, 3: ogni parte finisce con una domanda aperta.`],['💬 Risposta a un commento',`Scegli il commento più interessante sotto «${t}» e rispondi con un video.`],['🔁 Stitch o duetto',`Reagisci al tuo stesso video: «L’ho fatto un mese fa, ecco cosa cambierei».`],['🔴 Live breve',`15 minuti: rispondi alle domande su «${t}».`],['📝 Post di testo',`Scrivi ${P} in 5 righe nella caption, con una domanda finale.`]];
  return R.map(r=>skItem(r[0],esc(r[1]),r[0].slice(2)+': '+r[1])).join('')+skNote('Aspetta qualche giorno tra un riuso e l’altro e cambia sempre l’hook: così non sembra lo stesso video. Un video che ha funzionato vale più di uno nuovo tutto da girare.')}}
];

/* ---------- interfaccia ---------- */
function skInput(f){const id='sk-'+f.id;
  if(f.type==='select'){const o=typeof f.o==='function'?f.o():f.o;return `<label>${f.l}</label><select id="${id}">${o.map(x=>`<option value="${esc(x[0])}">${esc(x[1])}</option>`).join('')}</select>`}
  if(f.type==='area')return `<label>${f.l}</label><textarea id="${id}" style="min-height:90px"></textarea>`;
  if(f.type==='date')return `<label>${f.l}</label><input id="${id}" type="date" value="${skISO(new Date(Date.now()+864e5))}">`;
  return `<label>${f.l}</label><input id="${id}" placeholder="${esc(f.ph||'')}">`}
function skHome(){SK.cur=null;$('#sk-root').innerHTML=`<h2>13 skill</h2><p class="sub">Strumenti per far crescere il canale. Funzionano nel telefono, senza internet e senza account. Quelle con 📊 usano i dati che inserisci in «Crescita».</p>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${SKILLS.map(s=>`<button class="card" style="text-align:left;margin:0;cursor:pointer;color:inherit" onclick="skOpen('${s.k}')"><div style="font-size:26px">${s.e}${s.data?' <small>📊</small>':''}</div><b style="font-size:15px">${esc(s.n)}</b><div class="m" style="font-size:12.5px;margin-top:2px">${esc(s.d)}</div></button>`).join('')}</div>`}
function skOpen(k){const s=SKILLS.find(x=>x.k===k);SK.cur=s;
  $('#sk-root').innerHTML=`<button class="btn sm alt" onclick="skHome()">← Tutte le skill</button><h2 style="margin-top:10px">${s.e} ${esc(s.n)}</h2><p class="sub">${esc(s.d)}</p>
  <div class="card">${s.f.map(skInput).join('')}<button class="btn" onclick="skRun()">${s.f.length?'✨ Crea':'🔍 Controlla'}</button></div><div id="sk-out" class="out"></div>`;
  if(!s.f.length)skRun();window.scrollTo({top:0})}
function skRun(){const s=SK.cur;if(!s)return;const v={};s.f.forEach(f=>v[f.id]=($('#sk-'+f.id)||{}).value||'');v.t=(v.t||'').trim();
  const need=s.f[0];if(need&&!['b','kw','d'].includes(need.id)&&!v[need.id].trim()&&!(s.k==='virale')){toast('Compila il primo campo');return}
  if(s.k==='risposte'&&!v.c.trim()){toast('Incolla il commento');return}
  try{$('#sk-out').innerHTML=s.run(v)}catch(e){console.error(e);$('#sk-out').innerHTML='<div class="card">❌ Qualcosa non ha funzionato. Riprova.</div>'}}
function skAddPlan(){if(!SK.plan)return;SK.plan.forEach(o=>DB.posts.push({id:uid(),title:o.title,date:o.date,time:o.time,note:o.fmt,st:'idea'}));save();try{renderPlan();scheduleNotifs()}catch(_){}toast(SK.plan.length+' video aggiunti al Piano ✓')}
window.skInit=()=>{if(!$('#sk-root').innerHTML.trim())skHome()};
