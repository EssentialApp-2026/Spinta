"""Il modello AI di Spinta, gratis e in locale: scrive idee nuove per la bancarella quando il catalogo finisce.

    python3 automatico/ai.py prova 2     # scrive 2 idee e le stampa (senza salvarle)
    python3 automatico/ai.py nuove 6     # scrive 6 idee e le aggiunge ad automatico/idee-ai.json

Gira su GitHub (gratis per i repository pubblici): scarica llama.cpp (MIT) e un modello Qwen3 4B Instruct (Apache-2.0)
in formato GGUF, lo avvia in locale e gli chiede le idee con uno schema JSON fisso; ogni idea viene controllata
(lunghezze, parole vietate, niente emoji nelle battute, tipo di app esistente) e quelle sbagliate si buttano.
"""
import os, sys, json, re, time, subprocess, zipfile, tarfile, glob, random, urllib.request, unicodedata

QUI = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(QUI)
CACHE = os.environ.get('SPINTA_MODELLI', os.path.expanduser('~/.cache/spinta-modelli'))
UA = {'User-Agent': 'SpintaBancariello/1.0'}
MODELLI = [('unsloth/Qwen3-4B-Instruct-2507-GGUF', 'Q4_K_M'), ('bartowski/Qwen_Qwen3-4B-Instruct-2507-GGUF', 'Q4_K_M'),
           ('lmstudio-community/Qwen3-4B-Instruct-2507-GGUF', 'Q4_K_M'), ('Qwen/Qwen2.5-7B-Instruct-GGUF', 'q4_k_m'), ('Qwen/Qwen2.5-3B-Instruct-GGUF', 'q4_k_m')]
PORTA = 8089
TIPI = ['scadenze', 'timer', 'turni', 'lista', 'registro', 'ricorrenze', 'segnapunti', 'sorteggio', 'calendario', 'contatore']
VIETATE = re.compile(r'\b(like|batteri\w*|ricaric\w*|spegn\w*|spengo|stut\w*|scaric\w*|mettete mi piace|dieta|calorie|peso|farmac\w*|medicin\w*|scommess\w*|investiment\w*|politic\w*)\b', re.I)
EMOJI_RE = re.compile(r'[\U0001F000-\U0001FAFF☀-➿]')


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
            f = [s['rfilename'] for s in info.get('siblings', []) if s['rfilename'].lower().endswith('.gguf') and q.lower() in s['rfilename'].lower() and '-of-' not in s['rfilename']]
            if f:
                print('modello', repo, f[0], flush=True)
                return scarica(f'https://huggingface.co/{repo}/resolve/main/{f[0]}', os.path.join(CACHE, 'gguf', os.path.basename(f[0])))
        except Exception as e:
            print('modello non disponibile', repo, e, flush=True)
    raise SystemExit('nessun modello GGUF scaricabile')


def llama_server():
    trovati = glob.glob(os.path.join(CACHE, 'llama', '**', 'llama-server'), recursive=True)
    if trovati: return trovati[0]
    d = os.path.join(CACHE, 'llama', 'bin'); os.makedirs(d, exist_ok=True)
    try:   # 1) il programma già pronto dall'ultima versione di llama.cpp (CPU, Linux x64)
        rel = json.loads(http('https://api.github.com/repos/ggml-org/llama.cpp/releases/latest', timeout=60))
        nomi = [x['name'] for x in rel['assets']]; print('llama.cpp', rel.get('tag_name'), nomi, flush=True)
        buoni = [x for x in rel['assets'] if re.search(r'(ubuntu|linux)', x['name'], re.I) and re.search(r'(x64|x86_64|amd64)', x['name'], re.I)
                 and re.search(r'\.(zip|tar\.gz)$', x['name']) and not re.search(r'(vulkan|cuda|rocm|hip|sycl|musa|openvino|arm|aarch64|s390|kompute|opencl)', x['name'], re.I)]
        buoni.sort(key=lambda x: (0 if 'cpu' in x['name'].lower() else 1, len(x['name'])))
        a = buoni[0]; f = scarica(a['browser_download_url'], os.path.join(CACHE, 'llama', a['name']))
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
        m = modello(); s = llama_server()
        env = dict(os.environ, LD_LIBRARY_PATH=os.path.dirname(s) + ':' + os.environ.get('LD_LIBRARY_PATH', ''))
        self.p = subprocess.Popen([s, '-m', m, '-c', '8192', '--port', str(PORTA), '-t', str(os.cpu_count() or 2), '--jinja'],
                                  stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT, env=env)
        for _ in range(300):
            try:
                if json.loads(http(f'http://127.0.0.1:{PORTA}/health', timeout=5)).get('status') == 'ok': return self
            except Exception: time.sleep(2)
        raise SystemExit('il modello non parte')

    def __exit__(self, *a): self.p.terminate()

    def json(self, sistema, utente, schema, temp=0.8):
        r = json.loads(http(f'http://127.0.0.1:{PORTA}/v1/chat/completions', {
            'messages': [{'role': 'system', 'content': sistema}, {'role': 'user', 'content': utente}], 'temperature': temp, 'max_tokens': 1800,
            'response_format': {'type': 'json_object', 'schema': schema}}, timeout=1800))
        return json.loads(r['choices'][0]['message']['content'])


S = lambda n=80: {'type': 'string', 'minLength': 3, 'maxLength': n}
SCHEMA_IDEA = {'type': 'object', 'additionalProperties': False, 'required': ['nome', 'emoji', 'telefono', 'tipo', 'problema', 'storia', 'domandaE', 'vince', 'cosa', 'domanda', 'regalo', 'righe', 'manda', 'descrizione', 'slogan'],
               'properties': {'nome': S(40), 'emoji': {'type': 'string', 'minLength': 1, 'maxLength': 4}, 'telefono': S(9), 'tipo': {'enum': TIPI},
                              'problema': S(40), 'storia': S(85), 'domandaE': S(85), 'vince': S(60), 'cosa': S(85), 'domanda': S(85), 'regalo': S(60),
                              'righe': {'type': 'array', 'minItems': 2, 'maxItems': 2, 'items': S(70)}, 'manda': S(70), 'descrizione': S(260), 'slogan': S(70)}}
LST = lambda it, a, b: {'type': 'array', 'minItems': a, 'maxItems': b, 'items': it}
INT = lambda a, b: {'type': 'integer', 'minimum': a, 'maximum': b}
OGG = lambda req, props: {'type': 'object', 'additionalProperties': False, 'required': req, 'properties': props}
SCHEMI = {
    'scadenze': OGG(['etichetta', 'placeholder', 'etichettaData', 'giorniBase', 'avviso', 'titoloLista', 'fatto', 'vuoto'],
                    dict(etichetta=S(40), placeholder=S(50), etichettaData=S(30), giorniBase=INT(1, 3650), avviso=INT(0, 60), titoloLista=S(30), fatto=S(20), vuoto=S(70))),
    'timer': OGG(['preset', 'avvisaPrima', 'etichetta', 'avvia', 'testoFine'],
                 dict(preset=LST(OGG(['nome', 'min'], dict(nome=S(30), min=INT(1, 600))), 2, 4), avvisaPrima=INT(0, 30), etichetta=S(20), avvia=S(30), testoFine=S(70))),
    'turni': OGG(['persone', 'compiti', 'giro'], dict(persone=LST(S(20), 2, 5), compiti=LST(S(40), 1, 5), giro={'enum': ['giorno', 'settimana']})),
    'lista': OGG(['esempi', 'titoloLista', 'placeholder'], dict(esempi=LST(S(30), 4, 10), titoloLista=S(30), placeholder=S(50))),
    'registro': OGG(['etichetta', 'placeholder', 'chiudi', 'vuoto'], dict(etichetta=S(30), placeholder=S(50), chiudi=S(20), vuoto=S(70))),
    'ricorrenze': OGG(['esempi', 'etichetta', 'fatto'], dict(esempi=LST(OGG(['nome', 'ogni'], dict(nome=S(30), ogni=INT(1, 365))), 2, 5), etichetta=S(30), fatto=S(20))),
    'segnapunti': OGG(['giochi', 'squadre'], dict(giochi=LST(OGG(['nome', 'fino'], dict(nome=S(30), fino=INT(0, 200))), 1, 4), squadre=LST(S(15), 2, 2))),
    'sorteggio': OGG(['liste'], dict(liste=LST(OGG(['nome', 'voci'], dict(nome=S(40), voci=LST(S(25), 2, 12))), 1, 3))),
    'calendario': OGG(['giorni', 'ora'], dict(giorni=OGG([], {str(k): {'type': 'string', 'maxLength': 40} for k in range(7)}), ora={'type': 'string', 'pattern': '^[0-2][0-9]:[0-5][0-9]$'})),
    'contatore': OGG(['voci'], dict(voci=LST(OGG(['nome', 'emoji', 'obiettivo'], dict(nome=S(30), emoji={'type': 'string', 'maxLength': 4}, obiettivo=INT(0, 500))), 1, 3))),
}

SISTEMA = """Sei l'autore della serie TikTok «'O Bancariello»: Gennarino è un robottino napoletano simpatico con una bancarella nelle piazze di Napoli.
Ogni settimana propone tre idee di piccole app utili per la vita di tutti i giorni; il pubblico vota con una lettera nei commenti e il venerdì
Gennarino regala l'app più votata: gratis, senza registrazione, senza pubblicità, funziona sul telefono anche senza internet.
Scrivi in italiano semplice con un pizzico di napoletano («Mamma mia», «Uè guagliù» li aggiunge già il programma: tu non usarli tranne in «storia»).
Regole: niente emoji nelle battute (l'emoji va solo nel campo «emoji»); niente richieste di like; niente batteria; niente salute, diete, soldi da investire, scommesse o politica;
le battute sono corte e da dire a voce; «domandaE» comincia con «E »; «vince» e «regalo» sono frasi brevi che finiscono con «!»; «storia» comincia con «Mamma mia,»."""


def pulisci(t): return unicodedata.normalize('NFC', str(t)).strip()


def valida(i, usate):
    err = []
    for k in ('storia', 'domandaE', 'vince', 'cosa', 'domanda', 'regalo', 'manda', 'problema', 'nome'):
        v = i.get(k, '')
        if EMOJI_RE.search(v): err.append(f'emoji in {k}')
        if VIETATE.search(v): err.append(f'parola vietata in {k}')
    for r in i.get('righe', []):
        if EMOJI_RE.search(r) or VIETATE.search(r): err.append('riga non valida')
    if not i.get('domandaE', '').startswith('E '): err.append('domandaE senza E')
    if not i.get('storia', '').startswith('Mamma mia'): err.append('storia senza Mamma mia')
    if i.get('nome', '').lower() in usate: err.append('idea già usata')
    if i.get('tipo') not in TIPI: err.append('tipo')
    if not EMOJI_RE.search(i.get('emoji', '')): err.append('emoji mancante')
    return err


def slug(t):
    t = ''.join(c for c in unicodedata.normalize('NFD', t.lower()) if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]+', '-', t).strip('-')[:40] or 'idea'


def scrivi_idee(n, salva=True):
    sys.path.insert(0, QUI)
    from settimana import catalogo, idee_usate
    usate = idee_usate() | {i['nome'].lower() for i in catalogo()}
    esempi = random.sample([i for i in catalogo() if i['app']['tipo'] in TIPI], 3)
    es_txt = '\n'.join(json.dumps({k: i[k] for k in ('nome', 'emoji', 'telefono', 'problema', 'storia', 'domandaE', 'vince', 'cosa', 'domanda', 'regalo', 'righe', 'manda', 'descrizione')} | {'tipo': i['app']['tipo'], 'slogan': i['app']['slogan']}, ensure_ascii=False) for i in esempi)
    nuove = []
    with Server() as srv:
        tentativi = 0
        while len(nuove) < n and tentativi < n * 4:
            tentativi += 1
            tipo = random.choice(TIPI)
            gia = sorted(usate | {x['nome'].lower() for x in nuove})
            try:
                i = srv.json(SISTEMA, f"Esempi di idee già fatte (stile da seguire):\n{es_txt}\n\nIdee da NON ripetere: {', '.join(gia)}.\n\n"
                                      f"Scrivi UNA idea nuova e diversa, con app di tipo «{tipo}». Rispondi solo col JSON.", SCHEMA_IDEA)
                i = {k: (pulisci(v) if isinstance(v, str) else [pulisci(x) for x in v] if isinstance(v, list) else v) for k, v in i.items()}
                e = valida(i, usate | {x['nome'].lower() for x in nuove})
                if e: print('scartata', i.get('nome'), e, flush=True); continue
                o = srv.json(SISTEMA, f"Per l'app «{i['nome']}» ({i['cosa']}) di tipo «{i['tipo']}» scrivi le opzioni dell'app in JSON (testi brevi in italiano, esempi realistici di Napoli).",
                             SCHEMI[i['tipo']], temp=0.6)
                iid = slug(i['nome'])
                idea = {k: i[k] for k in ('nome', 'emoji', 'telefono', 'problema', 'storia', 'domandaE', 'vince', 'cosa', 'domanda', 'regalo', 'righe', 'manda', 'descrizione')}
                idea.update(id=iid, fatto_da='ai', app=dict(nome=i['nome'], breve=i['telefono'], emoji=i['emoji'], tipo=i['tipo'], slogan=i['slogan'],
                                                            descrizione=i['descrizione'], chiave=iid + '-v1', opzioni=o,
                                                            piede='Gratis, senza registrazione e senza pubblicità. Tutto resta solo sul tuo telefono e funziona anche senza internet.'))
                nuove.append(idea); print('nuova idea:', i['nome'], '·', i['tipo'], flush=True)
            except Exception as ex:
                print('errore', ex, flush=True)
    if salva and nuove:
        p = os.path.join(QUI, 'idee-ai.json')
        try: j = json.load(open(p, encoding='utf-8'))
        except Exception: j = {'nota': "Idee scritte dal modello AI locale (automatico/ai.py) quando il catalogo è finito.", 'idee': []}
        j['idee'] += nuove
        json.dump(j, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return nuove


def nuove_idee(n=6): return scrivi_idee(n, True)


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'prova'; n = int(sys.argv[2]) if len(sys.argv) > 2 else 2
    r = scrivi_idee(n, salva=(cmd == 'nuove'))
    print(json.dumps(r, ensure_ascii=False, indent=1))
