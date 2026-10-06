"""Controlla il piano della settimana prima di pubblicarlo: python3 claude/controlla.py [file]"""
import json, re, sys, datetime, os
# si può dare il file da controllare: python3 claude/controlla.py claude/settimana-2026-W42.json
P = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'settimana.json')
j = json.load(open(P, encoding='utf-8')); err = []
VIETATE = re.compile(r'\b(like|batteri\w*|ricaric\w*|spegn\w*|spengo|stut\w*|scaric\w*|mettete mi piace)\b', re.I)
for k in ('settimana', 'dal', 'al', 'voto_fino_a', 'regalo', 'idee', 'puntate', 'nota'):
    if k not in j: err.append(f'manca "{k}"')
d = {k: datetime.date.fromisoformat(j[k]) for k in ('dal', 'al', 'voto_fino_a', 'regalo') if k in j}
if len(d) == 4:
    if d['voto_fino_a'].weekday() != 2: err.append('voto_fino_a deve essere un mercoledì')
    if d['regalo'].weekday() != 4: err.append('regalo deve essere un venerdì')
    if not (d['dal'] <= d['voto_fino_a'] <= d['regalo'] <= d['al']): err.append('date fuori dalla settimana')
idee = j.get('idee', {})
for k in 'ABC':
    if not str(idee.get(k, '')).strip(): err.append(f'manca l\'idea {k}')
tipi = {'presentazione', 'idee', 'risultato', 'regalo', 'nessuno', 'risposta', 'libera'}; vinc = {'risultato': set(), 'regalo': set()}
for p in j.get('puntate', []):
    n = p.get('id', '?')
    if p.get('tipo') not in tipi: err.append(f'{n}: tipo non valido')
    c = p.get('copione', [])
    if not 5 <= len(c) <= 9: err.append(f'{n}: servono 5-9 frasi (ora {len(c)})')
    for r in c:
        if len(r) > 110: err.append(f'{n}: frase troppo lunga: {r[:40]}…')
        if VIETATE.search(r): err.append(f'{n}: niente batteria né richieste di like: {r}')
        if re.search(r'[\U0001F300-\U0001FAFF]', r): err.append(f'{n}: niente emoji nel copione: {r}')
    if p.get('tipo') == 'risposta' and not str(p.get('commento', '')).strip(): err.append(f'{n}: la risposta serve un commento vero in "commento"')
    if p.get('tipo') == 'idee' and sum(bool(re.match(r'^[ABC]\s*[:·]', r)) for r in c) != 3: err.append(f'{n}: le tre idee vanno su righe che iniziano con "A:", "B:", "C:"')
    if p.get('tipo') in vinc:
        if p.get('vince') not in ('A', 'B', 'C'): err.append(f'{n}: manca "vince" (A, B o C)')
        else: vinc[p['tipo']].add(p['vince'])
if not any(p.get('tipo') == 'nessuno' for p in j.get('puntate', [])): err.append('manca la puntata "nessuno" (giovedì, se nessuno vota: niente app)')
for t, s in vinc.items():
    if s and s != {'A', 'B', 'C'}: err.append(f'{t}: servono le versioni per A, B e C (ci sono {sorted(s)})')
print('\n'.join(err) if err else f'ok: {j.get("settimana")} · {len(j.get("puntate", []))} puntate')
sys.exit(1 if err else 0)
