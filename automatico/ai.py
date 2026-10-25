"""Il modello AI di Spinta, gratis e in locale: scrive idee nuove per la bancarella prima che il catalogo finisca.

    python3 automatico/ai.py prova 3      # scrive 3 idee, costruisce e prova le app, stampa tutto (senza salvare)
    python3 automatico/ai.py nuove 6      # come sopra, ma le aggiunge ad automatico/idee-ai.json
    python3 automatico/ai.py scorta 9     # se restano meno di 9 idee nuove, ne scrive 6 (lo fa GitHub ogni lunedì)
    python3 automatico/ai.py serve 9      # stampa «si» se la scorta è sotto 9, altrimenti «no»

Gira su GitHub (gratis per i repository pubblici), senza account né chiavi: scarica llama.cpp (MIT) e un modello aperto
in formato GGUF (Gemma 3 12B; se non si scarica, Qwen3 4B) e lo avvia in locale. Come lavora:
  1. pensa a una dozzina di idee in breve (nome, tipo di app, fastidio che risolve);
  2. le giudica da solo (utile, chiara, nuova, adatta a tutti) e tiene solo le migliori;
  3. per ognuna scrive le battute di Gennarino e i testi dell'app, sul modello delle idee del catalogo;
  4. controlla tutto (lunghezze, frasi tagliate a metà, parole vietate, segnaposto come {ora}) e prova l'app
     in un browser vero (automatico/prova_regali.py): se qualcosa non va, l'idea si butta.
"""
import os, sys, json, re, time, subprocess, zipfile, tarfile, glob, random, urllib.request, unicodedata, difflib

QUI = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(QUI)
sys.path.insert(0, QUI)
CACHE = os.environ.get('SPINTA_MODELLI', os.path.expanduser('~/.cache/spinta-modelli'))
GGUF = os.environ.get('SPINTA_GGUF', os.path.join(CACHE, 'gguf'))   # il modello (7 GB) non va nella cache di GitHub: si riscarica
UA = {'User-Agent': 'SpintaBancariello/1.0'}
# in ordine: il primo che si scarica. Gemma 3 12B scrive meglio in italiano; Qwen3 4B è il ripiego veloce.
MODELLI = [('lmstudio-community/gemma-3-12b-it-GGUF', 'Q4_K_M'), ('unsloth/gemma-3-12b-it-GGUF', 'Q4_K_M'), ('bartowski/google_gemma-3-12b-it-GGUF', 'Q4_K_M'),
           ('unsloth/Qwen3-4B-Instruct-2507-GGUF', 'Q4_K_M'), ('Qwen/Qwen2.5-7B-Instruct-GGUF', 'q4_k_m')]
if os.environ.get('SPINTA_MODELLO'): MODELLI.insert(0, tuple(os.environ['SPINTA_MODELLO'].split(':', 1)))
PORTA = 8089
TIPI = ['scadenze', 'timer', 'turni', 'lista', 'registro', 'ricorrenze', 'segnapunti', 'sorteggio', 'calendario', 'contatore']
PIEDE = 'Gratis, senza registrazione e senza pubblicità. Tutto resta solo sul tuo telefono e funziona anche senza internet.'
# temi e parole che nella serie non devono esserci (batteria e like, salute, soldi, gioco d'azzardo, amore, religione, politica, alcol e fumo)
VIETATE_TEMI = re.compile(r"\b(dieta|diete|calori\w*|peso|dimagr\w*|farmac\w*|medicin\w*|pillol\w*|malatt\w*|sintom\w*|pression[ei]|glicemia|dottor\w*|"
                          r"medic[oi]|ospedal\w*|scommess\w*|schedin\w*|gratta e vinci|lotto|investiment\w*|cripto\w*|politic\w*|elezion\w*|sigarett\w*|"
                          r"fum(o|are|ate|atori)|alcol\w*|birr[ae]|vino|ubriac\w*|baci|bacio|bacia\w*|amor[ei]?|amoros\w*|fidanzat\w*|sess[oi]|sexy|rito|riti|"
                          r"preghier\w*|santo|santi|chies[ae]|religio\w*|arm[ai]|pistol\w*|drog\w*|tinder)\b", re.I)
# nelle battute di Gennarino, in più: niente like e niente batteria (anche solo come parola)
VIETATE = re.compile(VIETATE_TEMI.pattern[:-3] + r"|like|mi piace|batteri\w*|ricaric\w*|spegn\w*|spengo|stut\w*|scaric\w*)\b", re.I)
EMOJI_RE = re.compile(r'[\U0001F000-\U0001FAFF☀-➿⬀-⯿]')
DEBOLI = set('e o di a da in con su per tra fra il lo la i gli le un una uno che ma del dello della dei degli delle al allo alla ai agli alle dal dallo dalla dai '
             'dagli dalle nel nello nella nei negli nelle sul sullo sulla sui sugli sulle mi ti si ci vi non come quando se perché'.split())


# ---------------- il programma e il modello ----------------
def http(url, data=None, timeout=600):
    r = urllib.request.Request(url, data=json.dumps(data).encode() if data is not None else None,
                               headers=dict(UA, **({'Content-Type': 'application/json'} if data is not None else {})))
    with urllib.request.urlopen(r, timeout=timeout) as f: return f.read()


def scarica(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 1000: return dest
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    subprocess.run(['curl', '-sSL', '--retry', '3', '-m', '3600', '-A', UA['User-Agent'], '-o', dest + '.part', url], check=True)
    os.replace(dest + '.part', dest); return dest


def modello():
    for repo, q in MODELLI:
        try:
            info = json.loads(http(f'https://huggingface.co/api/models/{repo}', timeout=60))
            f = [s['rfilename'] for s in info.get('siblings', []) if s['rfilename'].lower().endswith('.gguf') and q.lower() in s['rfilename'].lower()
                 and '-of-' not in s['rfilename'] and 'mmproj' not in s['rfilename'].lower()]
            if f:
                print('modello', repo, f[0], flush=True)
                return scarica(f'https://huggingface.co/{repo}/resolve/main/{f[0]}', os.path.join(GGUF, os.path.basename(f[0]))), repo
        except Exception as e:
            print('modello non disponibile', repo, e, flush=True)
    raise SystemExit('nessun modello GGUF scaricabile')


def llama_server():
    trovati = glob.glob(os.path.join(CACHE, 'llama', '**', 'llama-server'), recursive=True)
    if trovati: return trovati[0]
    d = os.path.join(CACHE, 'llama', 'bin'); os.makedirs(d, exist_ok=True)
    try:   # 1) il programma già pronto dall'ultima versione di llama.cpp (CPU, Linux x64)
        rel = json.loads(http('https://api.github.com/repos/ggml-org/llama.cpp/releases/latest', timeout=60))
        buoni = [x for x in rel['assets'] if re.search(r'(ubuntu|linux)', x['name'], re.I) and re.search(r'(x64|x86_64|amd64)', x['name'], re.I)
                 and re.search(r'\.(zip|tar\.gz)$', x['name']) and not re.search(r'(vulkan|cuda|rocm|hip|sycl|musa|openvino|arm|aarch64|s390|kompute|opencl)', x['name'], re.I)]
        buoni.sort(key=lambda x: (0 if 'cpu' in x['name'].lower() else 1, len(x['name'])))
        a = buoni[0]; print('llama.cpp', rel.get('tag_name'), a['name'], flush=True)
        f = scarica(a['browser_download_url'], os.path.join(CACHE, 'llama', a['name']))
        if f.endswith('.zip'): zipfile.ZipFile(f).extractall(d)
        else: tarfile.open(f).extractall(d)
        s = glob.glob(os.path.join(d, '**', 'llama-server'), recursive=True)[0]
    except Exception as e:   # 2) altrimenti si compila dai sorgenti (qualche minuto in più)
        print('niente programma pronto, compilo llama.cpp:', e, flush=True)
        src = os.path.join(CACHE, 'llama', 'src')
        if not os.path.exists(src): subprocess.run(['git', 'clone', '-q', '--depth', '1', 'https://github.com/ggml-org/llama.cpp.git', src], check=True)
        subprocess.run(['cmake', '-S', src, '-B', os.path.join(src, 'build'), '-DCMAKE_BUILD_TYPE=Release', '-DLLAMA_CURL=OFF', '-DGGML_NATIVE=ON'], check=True)
        subprocess.run(['cmake', '--build', os.path.join(src, 'build'), '--target', 'llama-server', '-j', str(os.cpu_count() or 2)], check=True)
        s = glob.glob(os.path.join(src, 'build', '**', 'llama-server'), recursive=True)[0]
    for x in glob.glob(os.path.join(os.path.dirname(s), '*')):
        try: os.chmod(x, 0o755)
        except Exception: pass
    return s


class Server:
    def __enter__(self):
        m, self.repo = modello(); s = llama_server()
        env = dict(os.environ, LD_LIBRARY_PATH=os.path.dirname(s) + ':' + os.environ.get('LD_LIBRARY_PATH', ''))
        self.log = open(os.path.join(CACHE, 'llama-server.log'), 'w')
        self.p = subprocess.Popen([s, '-m', m, '-c', '8192', '--port', str(PORTA), '-t', str(os.cpu_count() or 2), '--jinja'],
                                  stdout=self.log, stderr=subprocess.STDOUT, env=env)
        for _ in range(450):
            try:
                if json.loads(http(f'http://127.0.0.1:{PORTA}/health', timeout=5)).get('status') == 'ok': return self
            except Exception: time.sleep(2)
            if self.p.poll() is not None: break
        raise SystemExit('il modello non parte: ' + open(self.log.name).read()[-1500:])

    def __exit__(self, *a):
        self.p.terminate()
        try: self.p.wait(30)
        except Exception: self.p.kill()

    def json(self, testo, schema, temp=0.7, max_tokens=1500):
        t0 = time.time()
        if GRAMMATICA == 'leggera':   # solo JSON valido (veloce); la forma la controlla conforme() qui sotto
            testo += '\n\nRispondi solo con un oggetto JSON che rispetta questo schema (tutte le chiavi, nessuna in più): ' + json.dumps(schema, ensure_ascii=False)
            fmt = {'type': 'json_object'}
        else:
            fmt = {'type': 'json_object', 'schema': schema}
        r = json.loads(http(f'http://127.0.0.1:{PORTA}/v1/chat/completions', {
            'messages': [{'role': 'user', 'content': testo}], 'temperature': temp, 'top_p': 0.95, 'top_k': 64, 'max_tokens': max_tokens,
            'response_format': fmt}, timeout=2400))
        u, tm = r.get('usage', {}), r.get('timings', {}) or {}
        print(f"  ({time.time() - t0:.0f}s, {u.get('prompt_tokens', '?')}+{u.get('completion_tokens', '?')} token, "
              f"lettura {tm.get('prompt_per_second', 0):.1f} t/s, scrittura {tm.get('predicted_per_second', 0):.1f} t/s)", flush=True)
        x = json.loads(r['choices'][0]['message']['content'])
        if GRAMMATICA == 'leggera':
            p = conforme(x, schema)
            if p: raise ValueError('risposta fuori schema: ' + '; '.join(p[:5]))
        return x


GRAMMATICA = os.environ.get('SPINTA_GRAMMATICA', 'schema')


def conforme(x, s, dove='risposta'):
    """Controlla una risposta contro il piccolo sottoinsieme di JSON Schema usato qui (per la grammatica leggera)."""
    p = []
    if 'enum' in s:
        return [] if x in s['enum'] else [f'{dove}: valore {x!r} non previsto']
    t = s.get('type')
    if t == 'object':
        if not isinstance(x, dict): return [f'{dove}: serve un oggetto']
        for k in s.get('required', []):
            if k not in x: p.append(f'{dove}: manca {k}')
        for k, v in x.items():
            if k in s.get('properties', {}): p += conforme(v, s['properties'][k], f'{dove}.{k}')
            elif s.get('additionalProperties') is False: p.append(f'{dove}: chiave in più {k}')
    elif t == 'array':
        if not isinstance(x, list): return [f'{dove}: serve una lista']
        if len(x) < s.get('minItems', 0) or len(x) > s.get('maxItems', 10 ** 6): p.append(f'{dove}: {len(x)} elementi')
        for k, v in enumerate(x): p += conforme(v, s['items'], f'{dove}[{k}]')
    elif t == 'string':
        if not isinstance(x, str): return [f'{dove}: serve un testo']
        if len(x) < s.get('minLength', 0) or len(x) > s.get('maxLength', 10 ** 6): p.append(f'{dove}: lunghezza {len(x)}')
        if s.get('pattern') and not re.search(s['pattern'], x): p.append(f'{dove}: forma sbagliata')
    elif t == 'integer':
        if not isinstance(x, int) or isinstance(x, bool): return [f'{dove}: serve un numero intero']
        if x < s.get('minimum', -10 ** 9) or x > s.get('maximum', 10 ** 9): p.append(f'{dove}: {x} fuori misura')
    elif t == 'boolean':
        if not isinstance(x, bool): p.append(f'{dove}: serve vero o falso')
    return p


# ---------------- gli schemi JSON (il modello non può uscire da qui) ----------------
def S(n): return {'type': 'string', 'minLength': 2, 'maxLength': n}
def INT(a, b): return {'type': 'integer', 'minimum': a, 'maximum': b}
def LST(it, a, b): return {'type': 'array', 'minItems': a, 'maxItems': b, 'items': it}
def OGG(props, req=None): return {'type': 'object', 'additionalProperties': False, 'required': list(props) if req is None else req, 'properties': props}


# lunghezze vere (in caratteri) di ogni battuta; nello schema si lascia più spazio, così il modello non taglia a metà frase
LIMITI = dict(nome=40, telefono=10, problema=35, storia=100, domandaE=95, vince=65, cosa=95, domanda=100, regalo=65, riga=75, manda=75, descrizione=280, slogan=85)
SCHEMA_LISTA = OGG(dict(idee=LST(OGG(dict(nome=S(60), tipo={'enum': TIPI}, problema=S(70), perche=S(160))), 10, 14)))
SCHEMA_GIUDIZIO = OGG(dict(voti=LST(OGG(dict(n=INT(1, 20), utile=INT(1, 10), chiara=INT(1, 10), nuova=INT(1, 10), adatta=INT(1, 10), tipo=INT(1, 10))), 1, 20)))


def schema_idea():
    L = lambda k: S(int(LIMITI[k] * 1.6))
    return OGG(dict(nome=L('nome'), emoji={'type': 'string', 'minLength': 1, 'maxLength': 4}, telefono=S(16), problema=L('problema'), storia=L('storia'),
                    domandaE=L('domandaE'), vince=L('vince'), cosa=L('cosa'), domanda=L('domanda'), regalo=L('regalo'),
                    righe=LST(L('riga'), 2, 2), manda=L('manda'), descrizione=L('descrizione'), slogan=L('slogan')))


# testi dell'app per ogni tipo: chiavi del modello automatico/regalo/app.html (quelle che mancano prendono il testo di base)
OPZ = {
    'scadenze': dict(etichetta=S(45), placeholder=S(50), etichettaData=S(30), giorniBase=INT(1, 3650), rapidi=LST(INT(1, 3650), 3, 4), avviso=INT(0, 60),
                     esempi=LST(OGG(dict(nome=S(30), giorni=INT(1, 3650))), 4, 10), notaEsempi=S(90), bottone=S(30), titoloForm=S(30), titoloLista=S(30),
                     filtroAperti=S(25), filtroChiusi=S(25), fatto=S(20), fattoIl=S(25), scritto=S(40), vuoto=S(70), contaTutti=S(30), contaPresto=S(30),
                     contaScaduti=S(25), promemoria=S(70), erroreVuoto=S(50)),
    'timer': dict(preset=LST(OGG(dict(nome=S(30), min=INT(1, 600))), 2, 4), passo=INT(1, 30), avvisaPrima=INT(0, 30), etichetta=S(20), avvia=S(30), ferma=S(30),
                  testoPrima=S(70), testoFine=S(70), basta=S(20), partito=S(60), titoloScelta=S(40), consigli=LST(S(100), 1, 3)),
    'turni': dict(persone=LST(S(20), 2, 5), compiti=LST(S(40), 1, 5), giro={'enum': ['giorno', 'settimana']}, messaggio=S(40), titoloOggi=S(30),
                  titoloPersone=S(30), titoloCompiti=S(30), placeholderPersona=S(30), placeholderCompito=S(40)),
    'lista': dict(esempi=LST(S(30), 4, 12), placeholder=S(40), titoloLista=S(30), presi=S(25), togli=S(30), notaEsempi=S(50), vuoto=S(60)),
    'registro': dict(versi=LST(OGG(dict(bottone=S(25), chi=S(20))), 1, 2), soldi={'type': 'boolean'}, etichetta=S(30), placeholder=S(50), etichettaData=S(40),
                     bottone=S(30), titoloForm=S(30), titoloLista=S(30), filtroAperti=S(25), filtroChiusi=S(25), chiudi=S(20), chiusoIl=S(25), scritto=S(40),
                     vuoto=S(70), erroreCosa=S(40), whatsapp={'type': 'boolean'}, messaggio=S(90)),
    'ricorrenze': dict(esempi=LST(OGG(dict(nome=S(30), ogni=INT(1, 365))), 2, 6), etichetta=S(30), placeholder=S(50), ogniBase=INT(1, 365), titoloLista=S(30),
                       titoloForm=S(30), fatto=S(25), ultimaVolta=S(25), oggiTesto=S(30), ritardo=S(25), promemoria=S(50), bottone=S(30)),
    'segnapunti': dict(giochi=LST(OGG(dict(nome=S(30), fino=INT(0, 200), bottoni=LST(INT(1, 50), 1, 4))), 1, 4), squadre=LST(S(15), 2, 2), vince=S(40), etichettaGioco=S(30)),
    'sorteggio': dict(liste=LST(OGG(dict(nome=S(40), voci=LST(S(25), 2, 12))), 1, 3), gira=S(25), risultato=S(40), placeholder=S(45)),
    'calendario': dict(lunedi=S(40), martedi=S(40), mercoledi=S(40), giovedi=S(40), venerdi=S(40), sabato=S(40), domenica={'type': 'string', 'maxLength': 40},
                       ora={'type': 'string', 'pattern': '^[0-2][0-9]:[0-5][0-9]$'}, titoloOggi=S(30), testoOggi=S(50), niente=S(50), titoloSettimana=S(30),
                       etichettaOra=S(30), promemoria=S(50)),
    'contatore': dict(voci=LST(OGG(dict(nome=S(30), emoji={'type': 'string', 'minLength': 1, 'maxLength': 4}, obiettivo=INT(0, 500))), 1, 3), titolo=S(20), brav=S(50)),
}
NECESSARIE = {'scadenze': ['etichetta', 'placeholder', 'giorniBase'], 'timer': ['preset'], 'turni': ['persone', 'compiti', 'giro'], 'lista': ['esempi'],
              'registro': ['versi', 'etichetta', 'placeholder'], 'ricorrenze': ['esempi'], 'segnapunti': ['giochi', 'squadre'], 'sorteggio': ['liste'],
              'calendario': ['ora'], 'contatore': ['voci']}
SEGNAPOSTO = {'scadenze': {'promemoria': ['{cosa}', '{quando}']}, 'timer': {'partito': ['{ora}'], 'testoPrima': ['{min}']}, 'ricorrenze': {'promemoria': ['{nome}']},
              'segnapunti': {'vince': ['{nome}']}, 'sorteggio': {'risultato': ['{x}']}, 'calendario': {'testoOggi': ['{cosa}'], 'promemoria': ['{cosa}']},
              'registro': {'messaggio': ['{chi}', '{cosa}']}}
GIORNI = ['domenica', 'lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato']   # 0 = domenica, come in JavaScript
# esempio scritto a mano per il tipo che nel catalogo non c'è ancora
ESEMPIO_CALENDARIO = dict(lunedi='Organico', martedi='Plastica e metalli', mercoledi='Carta e cartone', giovedi='Organico', venerdi='Vetro', sabato='Indifferenziata',
                          domenica='', ora='20:00', titoloOggi='Stasera si butta', testoOggi='Stasera: {cosa}', niente='Stasera non si butta niente.',
                          titoloSettimana='La settimana', etichettaOra='Avvisami alle', promemoria='Fuori la munnezza: {cosa}')


def opzioni_per_ai(tipo, o):
    """Le opzioni di un'app del catalogo nella forma dello schema OPZ (per farle vedere al modello come esempio)."""
    if tipo == 'calendario': return ESEMPIO_CALENDARIO
    o = dict(o)
    if tipo == 'scadenze': o['esempi'] = [{'nome': k, 'giorni': v} for k, v in (o.pop('durate', None) or {}).items()][:8]
    if tipo == 'registro':
        o['versi'] = [{'bottone': a, 'chi': b} for a, b in (o.get('versi') or [["Io a lui", "A chi"], ["Lui a me", "Da chi"]])]
        o.setdefault('whatsapp', True); o.setdefault('messaggio', 'Ciao {chi}, ti ricordi di {cosa}? Grazie!')
    base = {'turni': dict(titoloOggi='Oggi tocca a…', placeholderPersona='Nome'), 'lista': dict(vuoto='La lista è vuota.'),
            'sorteggio': dict(placeholder='Aggiungi un nome o una cosa')}.get(tipo, {})
    return {k: v for k, v in (base | o).items() if k in OPZ[tipo] and v not in (None, [], {})}


def opzioni_per_app(tipo, o):
    """Dalla forma dello schema a quella che legge app.html; i testi coi segnaposto sbagliati si tolgono (resta il testo di base)."""
    o = {k: (pulisci(v) if isinstance(v, str) else v) for k, v in o.items()}
    for k, segni in SEGNAPOSTO.get(tipo, {}).items():
        if k in o and not all(s in o[k] for s in segni): o.pop(k)
    for k, v in list(o.items()):
        if isinstance(v, str) and (re.search(r'\{(?!cosa|quando|ora|min|nome|x|chi)\w*\}', v) or not v.strip()): o.pop(k)
    if tipo == 'scadenze':
        es = o.pop('esempi', [])
        if es: o['durate'] = {pulisci(e['nome']): e['giorni'] for e in es}
    if tipo == 'registro':
        o['versi'] = [[pulisci(v['bottone']), pulisci(v['chi'])] for v in o.get('versi', [])] or [["Io a lui", "A chi"], ["Lui a me", "Da chi"]]
        o['whatsapp'] = bool(o.get('whatsapp')) and 'messaggio' in o
    if tipo == 'calendario':
        o['giorni'] = {str(i): pulisci(o.pop(g, '') or '') for i, g in enumerate(GIORNI)}
    if tipo == 'timer' and not o.get('avvisaPrima'): o.pop('testoPrima', None)
    return o


# ---------------- le istruzioni ----------------
SERIE = """Lavori per la serie TikTok «'O Bancariello»: Gennarino è un robottino napoletano simpatico con una bancarella nelle piazze vere di Napoli.
Ogni settimana propone tre idee di piccole app utili per la vita di tutti i giorni; il pubblico vota con una lettera nei commenti e il venerdì
Gennarino regala l'app più votata: gratis, senza registrazione, senza pubblicità, funziona sul telefono anche senza internet.
Il pubblico sono famiglie, ragazzi e nonni napoletani: le idee devono far dire «questa mi serve!» in tre secondi."""

TIPI_SPIEGATI = """I tipi di app che il programma sa costruire (ogni idea deve stare in uno di questi):
- scadenze: cose con una data da non scordare, in ordine di scadenza (cosa scade nel frigo, garanzie, bollette, documenti, revisione della macchina);
- timer: conto alla rovescia con sveglia (sosta, cottura, lavatrice, compiti);
- turni: a chi tocca cosa, a giro tra più persone, ogni giorno o ogni settimana (lavori di casa, chi porta fuori il cane);
- lista: lista da spuntare, anche a voce (valigia, spesa, cose da portare al mare);
- registro: chi ha cosa o chi deve cosa, con data e stato aperto o chiuso (cose prestate, regali da comprare);
- ricorrenze: cose da rifare ogni tot giorni (innaffiare le piante, cambiare lo spazzolino, pulire il filtro del condizionatore);
- segnapunti: punti di due squadre fino a un traguardo (scopa, briscola, giochi in famiglia);
- sorteggio: la sorte sceglie tra nomi o cose, anche due squadre (chi scende la munnezza, dove si mangia stasera);
- calendario: cosa succede ogni giorno della settimana, con promemoria (raccolta differenziata, mercato rionale, allenamenti dei figli);
- contatore: quante volte al giorno, con un obiettivo (bicchieri d'acqua, caffè, piegamenti)."""

REGOLE = """Regole fisse della serie:
- italiano semplice e corto, da dire a voce; al massimo una parola napoletana ogni tanto;
- niente richieste di like o di «mi piace», niente batteria o ricarica;
- niente salute, diete, medicine, soldi da investire, scommesse, lotto, politica, amore, religione, alcol, fumo;
- niente marche e niente persone vere (né famose né private): negli esempi solo nomi inventati e comuni (Mamma, Papà, Ciro, Sofia, Nonna);
- niente prese in giro di nessuno."""


MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']


def quando():
    m = int(time.strftime('%m')); return f"{MESI[m - 1]} e {MESI[m % 12]}"


def prompt_lista(gia, quante):
    return f"""{SERIE}

{TIPI_SPIEGATI}

{REGOLE}

Idee già fatte o già in lista (NON ripeterle e non fare varianti di queste, neanche con un altro tipo di app):
{gia}

Scrivi {quante} idee NUOVE e diverse tra loro, usando almeno 6 tipi di app diversi. Ogni idea risolve un fastidio vero che capita quasi a tutti
(in casa, in macchina, a scuola, al lavoro, con i parenti, con gli amici). Le idee si useranno in {quando()}: niente idee legate a stagioni o feste
lontane (niente mare d'inverno, niente Natale d'estate). Ogni idea deve stare bene nel suo tipo di app (per esempio: un ricettario non è un «registro»).
Evita idee vaghe, romantiche, strane o inutili (come «la lista dei baci» o «il giorno del rito»).
Per ogni idea: «nome» in italiano naturale, come si dice a voce, con articoli e preposizioni (massimo 5 parole, maiuscola solo all'inizio,
come «Cosa scade nel frigo» o «Timer della lavatrice», MAI «Timer lavatrice»), «tipo», «problema» (il fastidio in poche parole, minuscolo,
come «il latte scaduto») e «perche» (perché serve, in una frase). Rispondi solo col JSON."""


def prompt_giudizio(cand, gia):
    righe = '\n'.join(f"{n}. {c['nome']} ({c['tipo']}): {c['problema']} — {c['perche']}" for n, c in enumerate(cand, 1))
    return f"""{SERIE}

{TIPI_SPIEGATI}

{REGOLE}

Idee già fatte (un'idea che le somiglia, anche con un altro nome o un altro tipo di app, NON è nuova):
{gia}

Giudica queste idee come farebbe un pubblico napoletano su TikTok, in {quando()}. Sii severo: 8 o più solo se l'idea è davvero buona.
{righe}

Per ogni idea (n = il suo numero) dai un voto da 1 a 10:
- «utile»: quanto serve davvero a tanta gente, in queste settimane;
- «chiara»: quanto si capisce in tre secondi cosa fa l'app, e se il nome è italiano corretto e naturale;
- «nuova»: quanto è diversa dalle idee già fatte;
- «adatta»: quanto rispetta le regole della serie e va bene per tutta la famiglia;
- «tipo»: quanto il tipo di app scelto è quello giusto per l'idea (guarda l'elenco dei tipi).
Rispondi solo col JSON."""


def esempio_idea(i):
    campi = ('nome', 'emoji', 'telefono', 'problema', 'storia', 'domandaE', 'vince', 'cosa', 'domanda', 'regalo', 'righe', 'manda', 'descrizione')
    return json.dumps({k: i[k] for k in campi} | {'slogan': i['app']['slogan']}, ensure_ascii=False)


ISTRUZIONI_IDEA = f"""Campi dell'idea, con le lunghezze massime in caratteri (contale: le frasi lunghe si buttano):
- «nome» (max {LIMITI['nome']}): il nome dell'app, corto, maiuscola solo all'inizio;
- «emoji»: una sola emoji che rappresenta l'app;
- «telefono» (max {LIMITI['telefono']}): UNA parola sola, che si legge sullo schermo del telefono finto della bancarella;
- «problema» (max {LIMITI['problema']}): il fastidio in poche parole, minuscolo, senza punto finale (si dice: «il latte scaduto, le strisce blu o i piatti: chi vi frega di più?»);
- «storia» (max {LIMITI['storia']}): comincia con «Mamma mia,» ed è UNA frase comica corta in prima persona, finisce con «!»;
- «domandaE» (max {LIMITI['domandaE']}): comincia con «E » ed è una domanda corta al pubblico, finisce con «?»;
- «vince» (max {LIMITI['vince']}): si dice dopo «Ha vinto la A:», minuscolo, finisce con «!»;
- «cosa» (max {LIMITI['cosa']}): cosa fa l'app, detto al pubblico col «voi», finisce con «.»;
- «domanda» (max {LIMITI['domanda']}): domanda al pubblico che chiede di rispondere nei commenti, finisce con «!»;
- «regalo» (max {LIMITI['regalo']}): si dice dopo «È venerdì:», minuscolo, finisce con «!»;
- «righe»: due frasi (max {LIMITI['riga']} l'una) che spiegano come si usa, col «voi», finiscono con «.»;
- «manda» (max {LIMITI['manda']}): comincia con «Mandatela a» e finisce con «!»;
- «descrizione» (max {LIMITI['descrizione']}): la descrizione dell'app col «tu», due o tre frasi, finisce con «.»;
- «slogan» (max {LIMITI['slogan']}): una frase corta e poi «Un regalo di Gennarino.».
Niente emoji fuori dal campo «emoji». Rispondi solo col JSON."""


def prompt_idea(c, esempi):
    return f"""{SERIE}

{REGOLE}

{ISTRUZIONI_IDEA}

Esempi di idee complete già fatte (segui lo stesso stile, la stessa lunghezza e le stesse forme):
{chr(10).join(esempio_idea(e) for e in esempi)}

Scrivi l'idea completa per: «{c['nome']}» (app di tipo «{c['tipo']}»; fastidio: {c['problema']}; {c['perche']}). Il campo «nome» resta «{c['nome']}»."""


SCHEMA_CORTO = lambda n: OGG(dict(frase=S(int(n * 1.3))))
REGOLE_CAMPO = dict(storia='deve cominciare con «Mamma mia,» e finire con «!»', domandaE='deve cominciare con «E » e finire con «?»',
                    manda='deve cominciare con «Mandatela a» e finire con «!»', vince='minuscola all\'inizio, finisce con «!»',
                    regalo='minuscola all\'inizio, finisce con «!»', problema='minuscola, senza punto finale', telefono='una parola sola',
                    domanda='finisce con «!» o «?»', cosa='finisce con «.»', descrizione='finisce con «.»', riga1='finisce con «.»', riga2='finisce con «.»',
                    slogan='finisce con «Un regalo di Gennarino.»', nome='maiuscola solo all\'inizio, senza punto')


def accorcia(srv, campo, testo, n):
    """Una frase troppo lunga si fa riscrivere più corta (richiesta piccola e veloce), con le stesse regole del campo."""
    r = srv.json(f"Riscrivi questa frase in italiano più corta, al massimo {n} caratteri, con lo stesso senso e lo stesso tono "
                 f"({REGOLE_CAMPO.get(campo, '')}). Frase: «{testo}». Rispondi solo col JSON.", SCHEMA_CORTO(n), temp=0.3, max_tokens=120)
    return pulisci(r['frase'])


RIPARABILI = ('troppo lungo', 'tagliato a metà', 'finisce male', 'senza «', 'non è una parola sola')


def ripara(srv, i, gia):
    """Fa riscrivere solo le battute sbagliate (troppo lunghe, tagliate, senza l'inizio o la fine giusti): poche parole, molto più veloce
    che riscrivere tutta l'idea. Ritorna l'idea sistemata e gli errori che restano."""
    for _ in range(2):
        err = errori_idea(i, gia)
        campi = sorted({e.split(' ')[0] for e in err if any(r in e for r in RIPARABILI)})
        if not campi or any(not any(r in e for r in RIPARABILI) for e in err): break
        for k in campi:
            try:
                if k in ('riga1', 'riga2'): j = int(k[-1]) - 1; i['righe'][j] = accorcia(srv, k, i['righe'][j], LIMITI['riga'])
                elif k in LIMITI: i[k] = accorcia(srv, k, i[k], LIMITI[k])
            except Exception as ex:
                print('  errore', ex, flush=True)
        i = sistema_idea(i)
    return i, errori_idea(i, gia)


def prompt_opzioni(idea, tipo, esempio):
    return f"""Scrivi i testi dell'app «{idea['nome']}» ({idea['cosa']} {' '.join(idea['righe'])}), un'app di tipo «{tipo}».
I testi sono in italiano semplice, corti e chiari, col «tu» (sono i bottoni e le scritte dell'app); gli esempi devono essere realistici e utili
per una famiglia napoletana, ma generici e sicuri: niente nomi di posti, di negozi o di persone vere. I numeri «giorni», «ogni» e «min» sono sempre in giorni
o in minuti (6 mesi = 180 giorni). Ogni scritta deve essere una frase finita, corta. I segnaposto tra graffe come {{ora}}, {{min}}, {{cosa}}, {{quando}}, {{nome}}, {{x}} e {{chi}} vanno lasciati così,
solo dove ci sono nel modello. Ecco, come modello, i testi di un'altra app dello stesso tipo:
{json.dumps(esempio, ensure_ascii=False)}
Rispondi solo col JSON, coi testi per «{idea['nome']}»."""


# ---------------- i controlli ----------------
def pulisci(t):
    t = unicodedata.normalize('NFC', str(t)).strip()
    t = re.sub(r'\s+', ' ', t).replace(' ,', ',').replace(' .', '.').replace(' !', '!').replace(' ?', '?')
    return t.replace('...', '…').replace('"', '').strip()


def norm(t): return ''.join(c for c in unicodedata.normalize('NFD', t.lower()) if unicodedata.category(c) != 'Mn')


def tagliata(t):
    """Una frase finita male (virgola, «e», «di»… in fondo) vuol dire che il modello l'ha troncata."""
    t = t.strip()
    if not t or t[-1] in ',;:-–(«"\'': return True
    p = re.findall(r"[\w']+", t.lower())
    return bool(p) and p[-1] in DEBOLI and t[-1] not in '.!?…'


GENERICHE = DEBOLI | set('turni turno timer lista conta conto quanti quanta quanto quante chi cosa cose app sveglia promemoria giorno giorni ogni oggi '
                          'settimana segna segnapunti sorteggio calendario contatore nostro nostra mio mia tuo tua'.split())


def parole(t):
    return {(w[:-1] if len(w) > 4 else w) for w in re.findall(r'[a-z]+', norm(t)) if w not in GENERICHE and len(w) > 2}


def simile(a, b):
    """Due idee sono la stessa se hanno le stesse parole importanti (o una contiene l'altra) o se i nomi sono quasi uguali."""
    A, B = parole(a), parole(b)
    if norm(a).strip() == norm(b).strip(): return True
    if A and B and (A <= B or B <= A): return True
    return difflib.SequenceMatcher(None, norm(a), norm(b)).ratio() >= 0.85


def doppione(c, cat, passate=()):
    """Un'idea è un doppione se somiglia a una già fatta, o se ha lo stesso tipo di app e una parola importante in comune
    (nome o fastidio): «Contatore bicchiere acqua» e «Quanta acqua ho bevuto» sono la stessa app. Con le idee delle settimane
    fatte a mano prima del catalogo («passate», solo il nome) basta una parola importante in comune nel nome."""
    mie = parole(c['nome']) | parole(c.get('problema', ''))
    for i in cat:
        if simile(c['nome'], i['nome']): return i['nome']
        if c.get('tipo') == i['app']['tipo'] and mie & (parole(i['nome']) | parole(i.get('problema', ''))): return i['nome']
    for n in passate:
        if simile(c['nome'], n) or parole(c['nome']) & parole(n): return n
    return None


def telegrafico(nome):
    """«Timer pizza croccante», «Contatore bicchiere acqua»: tre parole o più senza articoli né preposizioni non sono italiano naturale."""
    w = re.findall(r"[a-zà-ù']+", nome.lower())
    return len(w) >= 3 and not any(x.strip("'") in DEBOLI or x.endswith("'") or x in ('quanto', 'quanta', 'quanti', 'quante', 'chi', 'cosa') for x in w)


# idee di stagione: si tengono, ma si usano solo nel loro periodo (campo «periodo», come nel catalogo)
STAGIONI = [(re.compile(r'\b(mare|spiagg\w*|ombrellon\w*|estat\w*|abbronz\w*|piscin\w*|condizionator\w*|ventilator\w*|zanzar\w*|barbecue|grigliat\w*|bbq)\b', re.I), ['06-01', '09-10']),
            (re.compile(r'\b(natal\w*|presep\w*|panetton\w*|tombol\w*|befana|capodanno|vigilia|cenone|albero)\b', re.I), ['11-25', '01-06']),
            (re.compile(r'\b(pasqu\w*|colomba|pasquetta)\b', re.I), ['03-15', '04-25']),
            (re.compile(r'\b(carneval\w*|chiacchier\w*|coriandol\w*)\b', re.I), ['01-20', '02-28']),
            (re.compile(r'\b(riscaldament\w*|stufa|termosifon\w*|neve|cappotto)\b', re.I), ['11-01', '02-28'])]


def stagione(testo):
    for r, p in STAGIONI:
        if r.search(testo): return p
    return None


def minuscola(t): return t[:1].lower() + t[1:] if len(t) > 1 and not t[1:2].isupper() else t


PROPRI = {'natale', 'pasqua', 'carnevale', 'capodanno', 'ferragosto', 'epifania', 'befana', 'napoli', 'gennarino', 'italia', 'san', 'santa', 'whatsapp', 'tiktok'}


def frase(t):
    """«La Spesa per il Mare» → «La spesa per il mare» (restano maiuscoli i nomi propri come Natale o Napoli)."""
    p = t.split(' ')
    return ' '.join([p[0][:1].upper() + p[0][1:]] + [w if (w.lower().strip("'?!.,") in PROPRI or (len(w) > 1 and w.isupper())) else w.lower() for w in p[1:]])


def sistema_idea(i):
    """Piccole correzioni sicure: maiuscole, spazi, chiusura dello slogan."""
    i = {k: ([pulisci(x) for x in v] if isinstance(v, list) else pulisci(v) if isinstance(v, str) else v) for k, v in i.items()}
    for k in ('problema', 'vince', 'regalo'): i[k] = minuscola(i[k]).rstrip('.')
    i['problema'] = i['problema'].rstrip('!?.,;: ')
    i['nome'] = frase(i['nome']).rstrip('.!')
    i['telefono'] = i['telefono'].strip(" .!'«»")
    i['telefono'] = i['telefono'][:1].upper() + i['telefono'][1:].lower()
    # la punteggiatura finale che manca si mette (solo se la frase finisce con una parola intera)
    fine = dict(storia='!', domandaE='?', cosa='.', domanda='!', descrizione='.')
    for k, f in fine.items():
        if i[k] and i[k][-1].isalnum() and not tagliata(i[k] + f): i[k] += f
    i['righe'] = [r + '.' if r and r[-1].isalnum() and not tagliata(r + '.') else r for r in i['righe']]
    if not i['slogan'].endswith('Un regalo di Gennarino.'):
        t = i['slogan'].replace('Un regalo di Gennarino', '').rstrip(' .,;:')
        i['slogan'] = (t + ('' if t[-1:] in '!?' else '.') + ' Un regalo di Gennarino.') if t else 'Un regalo di Gennarino.'
    for k in ('vince', 'regalo', 'manda'):
        if i[k] and i[k][-1] not in '!?': i[k] = i[k].rstrip('.') + '!'
    return i


def errori_idea(i, gia):
    e = []
    testi = {k: i[k] for k in ('nome', 'problema', 'storia', 'domandaE', 'vince', 'cosa', 'domanda', 'regalo', 'manda', 'descrizione', 'slogan', 'telefono')}
    testi.update(riga1=i['righe'][0], riga2=i['righe'][1])
    for k, v in testi.items():
        lim = LIMITI.get(k, LIMITI['riga'])
        if len(v) > lim: e.append(f'{k} troppo lungo ({len(v)}>{lim})')
        if EMOJI_RE.search(v): e.append(f'emoji in {k}')
        if VIETATE.search(v): e.append(f'parola vietata in {k}: {VIETATE.search(v).group(0)}')
        if tagliata(v): e.append(f'{k} tagliato a metà')
    fine = dict(storia='!.', domandaE='?', cosa='.!', domanda='!?', riga1='.!', riga2='.!', descrizione='.', manda='!', vince='!', regalo='!')
    for k, f in fine.items():
        if testi[k][-1:] not in f: e.append(f'{k} finisce male')
    if not i['storia'].startswith('Mamma mia'): e.append('storia senza «Mamma mia»')
    if not i['domandaE'].startswith('E '): e.append('domandaE senza «E »')
    if not i['manda'].startswith('Mandatela a'): e.append('manda senza «Mandatela a»')
    if len(i['nome'].split()) > 6: e.append('nome di troppe parole')
    if len(i['telefono'].split()) != 1 or not re.match(r"^[A-Za-zÀ-ÿ']+$", i['telefono']): e.append('telefono non è una parola sola')
    if not EMOJI_RE.search(i['emoji']) or len(i['emoji']) > 3: e.append('emoji sbagliata')
    if any(simile(i['nome'], g) for g in gia): e.append('idea già fatta')
    return e


def largo(sch, k=2.0):
    """Lo stesso schema con le stringhe lunghe il doppio: così il modello finisce le frasi, e la lunghezza vera si controlla dopo."""
    if not isinstance(sch, dict): return sch
    x = dict(sch)
    if x.get('type') == 'string' and 'maxLength' in x and 'pattern' not in x: x['maxLength'] = int(x['maxLength'] * k)
    if 'items' in x: x['items'] = largo(x['items'], k)
    if 'properties' in x: x['properties'] = {kk: largo(v, k) for kk, v in x['properties'].items()}
    return x


def testo_buono(t, n, segni_ok=()):
    """Una scritta dell'app va bene se non è troppo lunga, non è tagliata a metà, ha le parentesi chiuse e usa solo i segnaposto previsti."""
    if not isinstance(t, str) or not t.strip(): return False
    if len(t) > n or t.count('(') != t.count(')'): return False
    if len(t.split()) >= 3 and tagliata(t): return False          # le etichette corte come «A chi» o «Per» vanno bene
    if any(x not in segni_ok for x in re.findall(r'\{\w*\}', t)): return False
    if EMOJI_RE.search(t) or VIETATE_TEMI.search(t): return False
    return True


def ripulisci_opzioni(tipo, o):
    """Toglie le scritte venute male (se ne occupa il testo di base dell'app) e gli esempi sbagliati; ritorna le opzioni e quello che manca."""
    sch, segni = OPZ[tipo], SEGNAPOSTO.get(tipo, {})
    out = {}
    for k, v in o.items():
        sk = sch.get(k)
        if sk is None: continue
        t = sk.get('type')
        if t == 'string':
            if (testo_buono(v, sk.get('maxLength', 80), segni.get(k, ())) or (k == 'domenica' and v == '') or
                    ('pattern' in sk and isinstance(v, str) and re.match(sk['pattern'], v))):
                out[k] = pulisci(v) if isinstance(v, str) else v
        elif t == 'array':
            it = sk['items']; buoni = []
            for x in v:
                if it.get('type') == 'string':
                    if testo_buono(x, it.get('maxLength', 40)): buoni.append(pulisci(x))
                elif it.get('type') == 'object':
                    y, ok = {}, True
                    for kk, vv in x.items():
                        si = it['properties'].get(kk, {})
                        if si.get('type') == 'string':
                            if kk == 'emoji': y[kk] = vv; continue
                            ok = ok and testo_buono(vv, si.get('maxLength', 40))
                            y[kk] = pulisci(vv) if isinstance(vv, str) else vv
                        elif si.get('type') == 'array' and si['items'].get('type') == 'string':
                            y[kk] = [pulisci(z) for z in vv if testo_buono(z, si['items'].get('maxLength', 30))]
                            ok = ok and len(y[kk]) >= si.get('minItems', 0)
                        else:
                            y[kk] = vv
                    if ok: buoni.append(y)
                else:
                    buoni.append(x)
            if len(buoni) >= sk.get('minItems', 0): out[k] = buoni[:sk.get('maxItems', len(buoni))]
        else:
            out[k] = v
    return out, [f'manca o è venuto male: {k}' for k in NECESSARIE[tipo] if k not in out or out[k] in ('', [], None)]


def errori_opzioni(tipo, o):
    e = [f'manca {k}' for k in NECESSARIE[tipo] if k not in o or o[k] in ('', [], None)]
    for k, v in o.items():
        for t in (v if isinstance(v, list) else [v]):
            for x in (t.values() if isinstance(t, dict) else [t]):
                if isinstance(x, str) and ((EMOJI_RE.search(x) and k != 'voci') or VIETATE_TEMI.search(x)): e.append(f'testo non adatto in {k}')
    if tipo == 'timer' and any(p['min'] <= 0 for p in o.get('preset', [])): e.append('tempi sbagliati')
    if tipo == 'turni' and len(set(o.get('persone', []))) < 2: e.append('servono due persone')
    if tipo == 'calendario' and sum(1 for g in GIORNI if o.get(g)) < 2: e.append('calendario quasi vuoto')
    return sorted(set(e))


# ---------------- il lavoro ----------------
def slug(t):
    return re.sub(r'[^a-z0-9]+', '-', norm(t)).strip('-')[:40] or 'idea'


def scorta():
    """Le idee nuove (mai usate, non di stagione) che restano nel catalogo e nelle idee AI."""
    import settimana as S
    usate = S.idee_usate()
    return [i for i in S.catalogo() if i['nome'].lower() not in usate and not i.get('periodo')]


def scrivi_idee(n, salva=True, prova_app=True):
    import settimana as S
    cat = S.catalogo()
    gia_nomi = sorted({i['nome'] for i in cat} | {x for x in S.idee_usate()}, key=str.lower)
    gia = '\n'.join(f"- {i['nome']} ({i['app']['tipo']}): {i['problema']}" for i in cat)
    altre = [x for x in gia_nomi if not any(norm(x) == norm(i['nome']) for i in cat)]
    if altre: gia += '\n' + '\n'.join(f'- {x}' for x in altre)
    per_tipo = {}
    for i in cat: per_tipo.setdefault(i['app']['tipo'], []).append(i)
    nuove, scartate, giri = [], [], 0
    t0 = time.time()
    with Server() as srv:
        print('modello pronto:', srv.repo, f'({time.time() - t0:.0f}s)', flush=True)
        fine = t0 + float(os.environ.get('SPINTA_MINUTI', '270')) * 60   # oltre, si salva quello che c'è (GitHub ferma il lavoro dopo 340 minuti)
        while len(nuove) < n and giri < 4 and time.time() < fine:
            giri += 1
            print(f'\n== giro {giri}: penso a idee nuove', flush=True)
            try:
                lista = srv.json(prompt_lista(gia + ''.join(f"\n- {x['nome']} ({x['app']['tipo']}): {x['problema']}" for x in nuove), 12), SCHEMA_LISTA, temp=1.0, max_tokens=1600)['idee']
            except Exception as ex:
                print('  errore', ex, flush=True); continue
            cand = []
            for c in lista:
                c = {k: pulisci(v) for k, v in c.items()}
                c['nome'] = frase(c['nome']).rstrip('?!.')
                d = doppione(c, cat + nuove + [{'nome': x['nome'], 'problema': x['problema'], 'app': {'tipo': x['tipo']}} for x in cand], altre)
                motivo = ('nome lungo' if len(c['nome']) > LIMITI['nome'] or len(c['nome'].split()) > 6 else
                          'nome telegrafico' if telegrafico(c['nome']) else
                          f'come «{d}»' if d else
                          'già fatta' if any(simile(c['nome'], g) for g in gia_nomi) else
                          'tema vietato' if VIETATE.search(c['nome'] + ' ' + c['problema'] + ' ' + c['perche']) else '')
                print(f"  {'scarto' if motivo else 'ok    '} {c['nome']} · {c['tipo']} · {c['problema']} {('(' + motivo + ')') if motivo else ''}", flush=True)
                if not motivo: cand.append(c)
            if not cand: continue
            try:
                voti = {v['n']: v for v in srv.json(prompt_giudizio(cand, gia), SCHEMA_GIUDIZIO, temp=0.1, max_tokens=900)['voti']}
            except Exception as ex:
                print('  errore', ex, flush=True); continue
            buone = []
            for k, c in enumerate(cand, 1):
                v = voti.get(k)
                if not v: continue
                v = {k: v.get(k, 0) for k in ('utile', 'chiara', 'nuova', 'adatta', 'tipo')}
                c['voto'] = round((v['utile'] * 2 + v['chiara'] + v['nuova'] + v['adatta'] + v['tipo']) / 6, 1)
                ok = min(v['utile'], v['adatta']) >= 7 and min(v['chiara'], v['tipo']) >= 8 and v['nuova'] >= 7
                print(f"  giudizio {c['nome']}: utile {v['utile']} chiara {v['chiara']} nuova {v['nuova']} adatta {v['adatta']} tipo {v['tipo']} → {c['voto']}{'' if ok else ' (scartata)'}", flush=True)
                if ok: buone.append(c)
            buone.sort(key=lambda c: -c['voto'])
            tipi_presi = [x['app']['tipo'] for x in nuove]
            buone.sort(key=lambda c: tipi_presi.count(c['tipo']))     # prima i tipi che ancora mancano
            for c in buone:
                if len(nuove) >= n or time.time() > fine: break
                if any(simile(c['nome'], x['nome']) for x in nuove) or c['nome'] in scartate: continue
                print(f"\n-- scrivo «{c['nome']}» ({c['tipo']})", flush=True)
                es = []
                for e in per_tipo.get(c['tipo'], []) + random.sample(cat, len(cat)):
                    if e['id'] not in [x['id'] for x in es]: es.append(e)
                es = es[:3]
                idea, nota = None, ''
                for tent in range(2):
                    try:
                        i = srv.json(prompt_idea(c, es) + nota, schema_idea(), temp=0.7, max_tokens=1200)
                        i['nome'] = c['nome']                                  # il nome resta quello che è stato giudicato
                        i = sistema_idea(i)
                    except Exception as ex:
                        print('  errore', ex, flush=True); continue
                    err = errori_idea(i, gia_nomi + [x['nome'] for x in nuove])
                    if err and all(any(r in e for r in RIPARABILI) for e in err):
                        print('  sistemo:', '; '.join(err), flush=True)
                        i, err = ripara(srv, i, gia_nomi + [x['nome'] for x in nuove])
                    if not err: idea = i; break
                    nota = ('\nAttenzione: la versione di prima aveva questi problemi, correggili: ' + '; '.join(err) +
                            '.\nVersione di prima (da correggere): ' + json.dumps(i, ensure_ascii=False))
                    print('  da rifare:', '; '.join(err), flush=True)
                if not idea:
                    scartate.append(c['nome']); continue
                tipo = c['tipo']; esempio = opzioni_per_ai(tipo, per_tipo[tipo][0]['app']['opzioni']) if per_tipo.get(tipo) else opzioni_per_ai(tipo, {})
                opz, nota = None, ''
                for tent in range(2):
                    try:
                        o = srv.json(prompt_opzioni(idea, tipo, esempio) + nota, largo(OGG(OPZ[tipo])), temp=0.4, max_tokens=1800)
                    except Exception as ex:
                        print('  errore', ex, flush=True); continue
                    o, err = ripulisci_opzioni(tipo, o)
                    err += errori_opzioni(tipo, o)
                    if not err: opz = opzioni_per_app(tipo, o); break
                    nota = '\nAttenzione: la versione di prima aveva questi problemi, correggili: ' + '; '.join(err) + '.'
                    print('  testi dell\'app da rifare:', '; '.join(err), flush=True)
                if not opz:
                    scartate.append(c['nome']); continue
                iid = slug(idea['nome'])
                while any(x['id'] == iid for x in cat + nuove): iid += '-2'
                app = dict(nome=idea['nome'], breve=idea['telefono'], emoji=idea['emoji'], tipo=tipo, slogan=idea['slogan'], descrizione=idea['descrizione'],
                           chiave=iid + '-v1', opzioni=opz, piede=PIEDE)
                if prova_app:
                    import prova_regali
                    ok, perche = prova_regali.prova_app(dict(app, id=iid), foto=os.environ.get('SPINTA_FOTO'))
                    print('  prova dell\'app nel browser:', perche, flush=True)
                    if not ok: scartate.append(c['nome']); continue
                x = {k: idea[k] for k in ('nome', 'emoji', 'telefono', 'problema', 'storia', 'domandaE', 'vince', 'cosa', 'domanda', 'regalo', 'righe', 'manda', 'descrizione')}
                x.update(id=iid, fatto_da='ai', modello=srv.repo, voto_ai=c['voto'], scritta=time.strftime('%Y-%m-%d'), app=app)
                per = stagione(' '.join([x['nome'], x['problema'], x['storia'], x['cosa'], x['descrizione']]))
                if per: x['periodo'] = per; print(f'  idea di stagione: si usa dal {per[0]} al {per[1]}', flush=True)
                nuove.append(x)
                print(f"  TENUTA: {x['nome']} · {tipo} · voto {c['voto']}", flush=True)
    print(f'\nidee tenute: {len(nuove)} su {n} · scartate dopo la scrittura: {len(scartate)} · {(time.time() - t0) / 60:.0f} minuti', flush=True)
    if salva and nuove:
        p = os.path.join(QUI, 'idee-ai.json')
        try: j = json.load(open(p, encoding='utf-8'))
        except Exception: j = {'nota': "Idee scritte dal modello AI locale (automatico/ai.py), controllate e con l'app provata nel browser. Si usano dopo quelle del catalogo.", 'idee': []}
        j['idee'] += nuove
        json.dump(j, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); open(p, 'a').write('\n')
        print('salvate in', p, flush=True)
    return nuove


def nuove_idee(n=6): return scrivi_idee(n, True)


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'prova'; n = int(sys.argv[2]) if len(sys.argv) > 2 else 3
    if cmd in ('serve', 'scorta'):
        resta = scorta(); print(f'idee nuove in scorta: {len(resta)} (soglia {n})', file=sys.stderr if cmd == 'serve' else sys.stdout, flush=True)
        if cmd == 'serve': print('si' if len(resta) < n else 'no'); sys.exit(0)
        if len(resta) >= n: print('la scorta basta: niente da scrivere'); sys.exit(0)
        r = scrivi_idee(max(6, 12 - len(resta)), salva=True)
        # nessuna idea abbastanza buona non è un guasto: i controlli sono severi apposta, si riprova lunedì prossimo
        # (e intanto la serie va avanti col catalogo e con le idee che avevano perso)
        if not r: print('questa volta nessuna idea abbastanza buona: si riprova la settimana prossima')
    else:
        r = scrivi_idee(n, salva=(cmd == 'nuove'))
        print(json.dumps(r, ensure_ascii=False, indent=1))
        if not r: raise SystemExit('il modello non ha scritto nessuna idea buona')
