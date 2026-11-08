"""I numeri del canale TikTok mandati da Spinta (Crescita → «Manda i dati a Claude»), e cosa se ne impara per il piano della settimana.

    python3 automatico/canale.py leggi       # legge da ntfy l'ultimo invio completo e lo salva in claude/canale.json (+ analisi)
    python3 automatico/canale.py analisi     # rifà solo claude/canale-analisi.md dai dati già salvati

Spinta manda i dati su ntfy.sh (gratis, senza account) a pezzi da meno di 4 KB; GitHub li legge ogni ora (.github/workflows/canale.yml).
Dentro ci sono solo numeri dei video (view, like, commenti, condivisioni, salvataggi, visione media, durata, giorno e ora) e i follower giorno per giorno:
niente chiavi, niente trascrizioni, niente dati personali. Il canale ntfy e claude/canale.json sono pubblici, come il repository.

L'analisi abbina ogni video alla puntata del piano da cui viene (la prima frase del copione è l'hook e il titolo del video)
e confronta le view con la mediana del canale: per tipo di puntata, per variante dell'hook degli sketch, per giorno e fascia oraria.
automatico/settimana.py usa scegli_varianti() per gli sketch della settimana dopo.
"""
import os, sys, json, re, datetime, statistics, unicodedata, urllib.request
from zoneinfo import ZoneInfo

QUI = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(QUI)
ROMA = ZoneInfo('Europe/Rome')
CANALE = os.environ.get('SPINTA_NTFY_CANALE', 'spinta-bancariello-canale-r8w3n5q2')
FILE = os.path.join(ROOT, 'claude', 'canale.json')
ANALISI = os.path.join(ROOT, 'claude', 'canale-analisi.md')
VARIANTI = ('storia', 'pov')          # come si apre uno sketch: «Mamma mia, …» oppure «POV: …»
GIOVANE = 48 * 3600                   # sotto le 48 ore i numeri crescono ancora: non si confrontano


# ---------------- leggere i dati da ntfy ----------------
def messaggi(ore=24):
    url = f'https://ntfy.sh/{CANALE}/json?poll=1&since={ore}h'
    r = urllib.request.Request(url, headers={'User-Agent': 'SpintaBancariello/1.0'})
    out = []
    with urllib.request.urlopen(r, timeout=60) as f:
        for riga in f.read().decode('utf-8').splitlines():
            try:
                e = json.loads(riga)
                if e.get('event') == 'message': out.append(json.loads(e.get('message', '{}')))
            except Exception:
                pass
    return out


def ricomponi(msgs):
    """I pezzi {k:'canale', b:<invio>, i, n, d} → l'ultimo invio completo, già decodificato."""
    invii = {}
    for m in msgs:
        if not isinstance(m, dict) or m.get('k') != 'canale': continue
        b, i, n, d = m.get('b'), m.get('i'), m.get('n'), m.get('d')
        if not isinstance(b, str) or not isinstance(i, int) or not isinstance(n, int) or not isinstance(d, str) or not 0 <= i < n <= 40: continue
        invii.setdefault((b, n), {})[i] = d
    completi = []
    for (b, n), parti in invii.items():
        if len(parti) != n: continue
        try:
            j = json.loads(''.join(parti[i] for i in range(n)))
            j = pulisci(j)
            if j: completi.append(j)
        except Exception:
            pass
    return max(completi, key=lambda j: j['at']) if completi else None


def _n(x, hi=10**10):
    if isinstance(x, bool): return None
    if isinstance(x, (int, float)) and 0 <= x <= hi: return round(float(x), 1) if isinstance(x, float) else x
    return None


def pulisci(j):
    """Tengo solo i campi attesi, con numeri veri: un messaggio scritto da altri non può rompere niente."""
    if not isinstance(j, dict) or j.get('v') != 1 or not isinstance(j.get('at'), str): return None
    try: datetime.datetime.fromisoformat(j['at'].replace('Z', '+00:00'))
    except Exception: return None
    D = re.compile(r'^\d{4}-\d\d-\d\d$'); H = re.compile(r'^([01]\d|2[0-3]):[0-5]\d$')
    video = []
    for v in (j.get('video') or [])[:80]:
        if not isinstance(v, dict) or not isinstance(v.get('t'), str) or not D.match(str(v.get('d', ''))): continue
        x = {'t': v['t'][:120], 'd': v['d'], 'h': v.get('h') if H.match(str(v.get('h', ''))) else ''}
        for k in ('pub', 'v', 'l', 'c', 's', 'sv', 'fo', 'len', 'w', 'full', 'score'):
            n = _n(v.get(k));
            if n is not None: x[k] = n
        for k in ('hk', 'fmt'):
            if isinstance(v.get(k), str): x[k] = v[k][:40]
        if 'v' in x: video.append(x)
    snaps = [[s[0], s[1]] for s in (j.get('snaps') or [])[:400] if isinstance(s, list) and len(s) == 2 and D.match(str(s[0])) and _n(s[1]) is not None]
    u = j.get('user') if isinstance(j.get('user'), dict) else {}
    return {'v': 1, 'at': j['at'], 'user': {k: _n(u.get(k)) for k in ('f', 'l', 'n') if _n(u.get(k)) is not None}, 'snaps': snaps, 'video': video}


# ---------------- abbinare i video alle puntate ----------------
def chiave(t):
    t = unicodedata.normalize('NFC', str(t).lower())
    return ' '.join(''.join(ch if ch.isalnum() else ' ' for ch in t).split())


def puntate_note():
    """{hook normalizzato: info sulla puntata} da tutti i piani claude/settimana-*.json."""
    out = {}
    d = os.path.join(ROOT, 'claude')
    for f in sorted(os.listdir(d)):
        if not re.match(r'settimana-\d{4}-W\d\d\.json$', f): continue
        try: j = json.load(open(os.path.join(d, f), encoding='utf-8'))
        except Exception: continue
        for p in j.get('puntate', []):
            if not p.get('copione'): continue
            k = chiave(p['copione'][0])
            if len(k) >= 12: out[k] = {'settimana': j.get('settimana'), 'id': p.get('id'), 'tipo': p.get('tipo'), 'giorno': p.get('giorno'),
                                       'variante': p.get('variante', ''), 'sketch': p.get('id', '').startswith('sketch-')}
    return out


def abbina(video, note):
    for v in video:
        t = chiave(v['t'])
        p = note.get(t) or next((x for k, x in note.items() if t.startswith(k) or (len(t) >= 20 and k.startswith(t))), None)
        if p: v['puntata'] = p
    return video


# ---------------- cosa funziona ----------------
def maturi(dati, ora=None):
    ora = (ora or datetime.datetime.now(ROMA)).timestamp()
    out = []
    for v in dati.get('video', []):
        ts = v.get('pub', 0) / 1000 if v.get('pub') else datetime.datetime.fromisoformat(v['d'] + 'T' + (v.get('h') or '12:00')).replace(tzinfo=ROMA).timestamp()
        if ora - ts >= GIOVANE and v.get('v', 0) > 0: out.append(v)
    return out


def gruppi(video, chiave_di, mediana):
    g = {}
    for v in video:
        k = chiave_di(v)
        if k: g.setdefault(k, []).append(v['v'] / mediana)
    return {k: {'n': len(a), 'x': statistics.median(a)} for k, a in g.items()}


def scegli_varianti(n=3, sett=''):
    """Le varianti dell'hook per gli n sketch della settimana. Finché una variante ha meno di 3 video, si provano a turno;
    poi la migliore va su tutti tranne uno, che continua a provare l'altra (così se il pubblico cambia, ce ne accorgiamo)."""
    try: dati = json.load(open(FILE, encoding='utf-8'))
    except Exception: dati = {}
    M = abbina(maturi(dati), puntate_note()) if dati else []
    med = statistics.median([v['v'] for v in M]) if M else 1
    g = gruppi([v for v in M if v.get('puntata', {}).get('sketch')], lambda v: v['puntata'].get('variante'), med or 1)
    turno = int(re.sub(r'\D', '', sett or '0') or 0)
    if any(g.get(x, {}).get('n', 0) < 3 for x in VARIANTI):
        return [VARIANTI[(turno + i) % 2] for i in range(n)], 'prova'
    best = max(VARIANTI, key=lambda x: g[x]['x']); altra = [x for x in VARIANTI if x != best][0]
    return [best] * (n - 1) + [altra], f'{best} {g[best]["x"]:.2f}× contro {altra} {g[altra]["x"]:.2f}× la mediana'


def pct(x): return ('+' if x >= 1 else '−') + f'{abs(round((x - 1) * 100))}%'


def analisi(dati):
    M = abbina(maturi(dati), puntate_note())
    righe = [f'# Il canale in numeri', '', f'Aggiornato da Spinta il {dati["at"][:16].replace("T", " alle ")} · scritto da `automatico/canale.py`.', '']
    u = dati.get('user', {})
    if u: righe += [f'Follower **{u.get("f", "–")}** · like totali {u.get("l", "–")} · video sul profilo {u.get("n", "–")}', '']
    sn = dati.get('snaps', [])
    if len(sn) >= 2: righe += [f'Follower dal {sn[0][0]} al {sn[-1][0]}: {sn[0][1]} → {sn[-1][1]}', '']
    if not M:
        righe += ['Nessun video con almeno 48 ore e le view: l\'analisi parte quando ce ne sono.']
        return '\n'.join(righe) + '\n'
    med = statistics.median([v['v'] for v in M]) or 1
    righe += [f'**{len(M)} video** con almeno 48 ore · mediana **{med:g} view** · abbinati al piano: {sum("puntata" in v for v in M)}', '']
    def tabella(titolo, g, nota=''):
        nonlocal righe
        if not g: return
        righe += [f'## {titolo}', '', '| | video | view rispetto alla mediana |', '|---|---|---|']
        for k, x in sorted(g.items(), key=lambda kv: -kv[1]['x']): righe.append(f'| {k} | {x["n"]} | {pct(x["x"])} |')
        righe += ['', nota, ''] if nota else ['']
    tabella('Per tipo di puntata', gruppi(M, lambda v: v.get('puntata', {}).get('tipo'), med))
    tabella('Sketch: come si apre', gruppi([v for v in M if v.get('puntata', {}).get('sketch')], lambda v: v['puntata'].get('variante'), med),
            'Il piano usa la variante migliore quando entrambe hanno almeno 3 video.')
    tabella('Per giorno', gruppi(M, lambda v: ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'][datetime.date.fromisoformat(v['d']).weekday()], med))
    fascia = lambda v: None if not v.get('h') else ('mattina' if int(v['h'][:2]) < 11 else 'pranzo' if int(v['h'][:2]) < 15 else 'pomeriggio' if int(v['h'][:2]) < 19 else 'sera' if int(v['h'][:2]) < 22 else 'notte')
    tabella('Per fascia oraria', gruppi(M, fascia, med))
    dl = [v for v in M if v.get('len')]
    if dl: tabella('Per durata', gruppi(dl, lambda v: 'sotto 20 s' if v['len'] < 20 else '20-30 s' if v['len'] < 30 else '30-45 s' if v['len'] < 45 else 'oltre 45 s', med))
    righe += ['## I migliori', '']
    for v in sorted(M, key=lambda v: -v['v'])[:5]:
        p = v.get('puntata', {})
        righe.append(f'- **{v["v"]:g}** view · {v["d"]} {v.get("h", "")} · «{v["t"][:70]}»' + (f' · {p.get("tipo")}{" " + p["variante"] if p.get("variante") else ""}' if p else ''))
    righe += ['', 'Con pochi video per riga sono indizi, non certezze.']
    return '\n'.join(righe) + '\n'


def main():
    cosa = sys.argv[1] if len(sys.argv) > 1 else 'leggi'
    if cosa == 'leggi':
        nuovo = ricomponi(messaggi())
        vecchio = None
        try: vecchio = json.load(open(FILE, encoding='utf-8'))
        except Exception: pass
        if not nuovo or (vecchio and vecchio.get('at', '') >= nuovo['at']):
            print('niente di nuovo'); return
        json.dump(nuovo, open(FILE, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); open(FILE, 'a').write('\n')
        print('dati del canale salvati:', len(nuovo['video']), 'video')
    dati = json.load(open(FILE, encoding='utf-8'))
    open(ANALISI, 'w', encoding='utf-8').write(analisi(dati))
    print('analisi scritta', ANALISI)


if __name__ == '__main__':
    main()
