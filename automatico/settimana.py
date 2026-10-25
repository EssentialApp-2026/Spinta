"""Spinta in automatico: prepara da solo la settimana dopo, gratis (gira ogni sabato su GitHub, vedi .github/workflows/settimana.yml).

    python3 automatico/settimana.py                 # prepara la prossima settimana (domenica dopo oggi)
    python3 automatico/settimana.py 2026-W45        # una settimana precisa
    python3 automatico/settimana.py 2026-W44 --solo-regali   # rifà solo le app regalo e il banco

Passi (ognuno salta da solo se è già fatto):
  1. tre idee nuove dal catalogo (automatico/catalogo.json); se finiscono, le scrive il modello AI locale (automatico/ai.py);
  2. la piazza nuova e la panoramica col volo in avanti (automatico/piazza.py);
  3. il piano claude/settimana-<W>.json con tutte le puntate (stesse regole di sempre, controllato da claude/controlla.py);
  4. le battute di Gennarino che mancano (automatico/voci.py);
  5. le tre app regalo pronte in regali/<W>/<idea>/ (automatico/regali.py), una sola uscirà sul banco;
  6. il banco della serie (automatico/banco.json, letto dalla pagina 'O Bancariello) e claude/storico.json.
"""
import os, sys, json, datetime, subprocess, re
from zoneinfo import ZoneInfo

QUI = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(QUI)
ROMA = ZoneInfo('Europe/Rome')
sys.path.insert(0, QUI)
TIPI_DIVERSI = True


def leggi(p, d=None):
    try: return json.load(open(p, encoding='utf-8'))
    except Exception: return d


def scrivi(p, j, indent=1):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    json.dump(j, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=indent); open(p, 'a').write('\n')


def domenica_di(sett):
    """2026-W45 -> la domenica prima del lunedì di quella settimana ISO (come i piani di Spinta)."""
    a, w = sett.split('-W'); lun = datetime.date.fromisocalendar(int(a), int(w), 1)
    return lun - datetime.timedelta(days=1)


def prossima_settimana(oggi=None):
    oggi = oggi or datetime.datetime.now(ROMA).date()
    dom = oggi + datetime.timedelta(days=(6 - oggi.weekday()) % 7 or 7)  # la domenica dopo oggi
    y, w, _ = (dom + datetime.timedelta(days=1)).isocalendar()
    return f'{y}-W{w:02d}'


def iso_ora(d, h, m):
    return datetime.datetime(d.year, d.month, d.day, h, m, tzinfo=ROMA).isoformat()


def maiuscola(s): return s[:1].upper() + s[1:]


def ecco(nome):
    return 'Ecco ' + (nome[:1].lower() + nome[1:] if re.match(r"^(Il|Lo|La|Le|L'|I|Gli|Un|Una|Uno)\b", nome) else nome) + '.'


# ---------------- le idee ----------------
def idee_usate():
    usate = set()
    st = leggi(os.path.join(ROOT, 'claude', 'storico.json'), {'settimane': []})
    for s in st.get('settimane', []):
        for v in (s.get('idee') or {}).values(): usate.add(str(v).lower())
    for f in os.listdir(os.path.join(ROOT, 'claude')):
        if re.match(r'settimana-\d{4}-W\d\d\.json$', f):
            for v in (leggi(os.path.join(ROOT, 'claude', f), {}).get('idee') or {}).values(): usate.add(str(v).lower())
    return usate


def catalogo():
    c = leggi(os.path.join(QUI, 'catalogo.json'), {'idee': []})['idee']
    c += leggi(os.path.join(QUI, 'idee-ai.json'), {'idee': []})['idee']
    return c


def di_stagione(i, dom):
    """«periodo»: ["MM-GG", "MM-GG"] (anche a cavallo dell'anno). La settimana va bene se la domenica o il venerdì ci cadono dentro."""
    p = i.get('periodo')
    if not p: return None
    def dentro(d):
        x = d.strftime('%m-%d'); a, b = p
        return a <= x <= b if a <= b else (x >= a or x <= b)
    return dentro(dom) or dentro(dom + datetime.timedelta(days=5))


def scegli_idee(dom):
    usate = idee_usate()
    libere = [i for i in catalogo() if i['nome'].lower() not in usate and di_stagione(i, dom) is not False]
    # al massimo un'idea di stagione (va per prima), poi le altre nell'ordine del catalogo, con tre tipi di app diversi
    stagione = [i for i in libere if di_stagione(i, dom)][:1]
    altre = [i for i in libere if not i.get('periodo')]
    scelte, tipi = list(stagione), {i['app']['tipo'] for i in stagione}
    for i in altre:
        if len(scelte) == 3: break
        if TIPI_DIVERSI and i['app']['tipo'] in tipi: continue
        scelte.append(i); tipi.add(i['app']['tipo'])
    for i in altre:
        if len(scelte) == 3: break
        if i not in scelte: scelte.append(i)
    return scelte


# ---------------- il piano ----------------
def piano(sett, dom, piazza, idee, apertura):
    A, B, C = idee; L = dict(zip('ABC', idee))
    abc = [f'A: {A["nome"]}.', f'B: {B["nome"]}.', f'C: {C["nome"]}.']
    P = []
    P.append(dict(id='piazza-nuova', tipo='idee', giorno='domenica', titolo='Piazza nuova, tre idee nuove', data=dom.isoformat(),
                  copione=['Piazza nuova, tre idee nuove: quale costruisco?', f'Uè guagliù, il bancariello si è spostato in {piazza}!', *abc,
                           'Scrivete la lettera nei commenti, fino a mercoledì sera.', 'Venerdì la più votata è sul banco, gratis.']))
    if apertura: P[0].update(apertura=apertura, aperturaFrasi=2)
    P.append(dict(id='promemoria-lunedi', tipo='idee', giorno='lunedì', titolo='Avete già votato?',
                  copione=[f'{maiuscola(A["problema"])}, {B["problema"]} o {C["problema"]}: chi vi frega di più?', 'Uè guagliù, il voto è aperto da ieri.', *abc,
                           'Basta una lettera nei commenti per decidere.', 'Chi non ha ancora votato, ha tempo fino a mercoledì sera!']))
    P.append(dict(id='cosa-dimenticate', tipo='libera', giorno='martedì', titolo='Cosa vi frega ogni giorno?',
                  copione=[A['storia'], 'Uè guagliù, a me succede sempre!', B['domandaE'], C['domandaE'], 'Per questo ho pensato a queste tre idee.',
                           'Ditemi nei commenti cosa vi frega ogni giorno.', 'E chi non ha votato: A, B o C, fino a domani sera!']))
    P.append(dict(id='ultime-ore', tipo='idee', giorno='mercoledì', titolo='Ultime ore per votare',
                  copione=['Stasera chiudo le urne: manca poco!', "Uè guagliù, l'ultima occasione per votare.", *abc, 'Una lettera nei commenti e avete deciso.', 'Domani vi dico chi ha vinto!']))
    for k, i in L.items():
        P.append(dict(id=f'risultato-{k}', tipo='risultato', giorno='giovedì', titolo='Risultato del voto', vince=k,
                      copione=[f'Ha vinto la {k}: {i["vince"]}', 'Uè guagliù, ho contato i voti e avete scelto voi.', f'Ha vinto la {k}: {i["nome"]}.', i['cosa'],
                               'Da oggi ci lavoro, giorno e notte.', 'Venerdì è sul banco, gratis per tutti.', i['domanda']]))
    P.append(dict(id='nessun-voto', tipo='nessuno', giorno='giovedì', titolo='Niente voti, niente app',
                  copione=['Zero voti: questa volta niente app.', 'Uè guagliù, ho letto tutti i commenti.', 'Ma nessuno ha scritto A, B o C.',
                           'Mi dispiace: venerdì niente regalo.', 'Domenica torno con tre idee nuove.', 'Basta una lettera nei commenti e decidete voi!']))
    for k, i in L.items():
        P.append(dict(id=f'regalo-{k}', tipo='regalo', giorno='venerdì', titolo='Il regalo è sul banco', vince=k,
                      copione=[f'È venerdì: {i["regalo"]}', 'Uè guagliù, il regalo è sul banco.', ecco(i['nome']), i['righe'][0], i['righe'][1],
                               'Gratis, senza registrazione: link nel profilo.', i['manda']]))
    P.append(dict(id='smontaggio', tipo='libera', giorno='sabato', titolo='Si smonta la bancarella',
                  copione=['Sabato si smonta: domani cambio piazza!', 'Uè guagliù, chiudo la tenda e piego il banco.', 'Arrotolo le lampadine e metto tutto nel carretto.',
                           f'Saluto {piazza}: grazie per questa settimana!', 'Dove vado domani? Non ve lo dico ancora.', 'Domani piazza nuova e tre idee nuove da votare.',
                           'Secondo voi dove mi sposto? Scrivetelo nei commenti!']))
    d = lambda n: (dom + datetime.timedelta(days=n)).isoformat()
    return {'versione': 1, 'settimana': sett, 'dal': d(0), 'al': d(7), 'scritto': datetime.datetime.now(ROMA).date().isoformat(),
            'voto_fino_a': d(3), 'regalo': d(5), 'idee': {k: i['nome'] for k, i in L.items()}, 'idee_id': {k: i['id'] for k, i in L.items()},
            'nota': f'Settimana preparata da Spinta in automatico (automatico/settimana.py): domenica {piazza} e tre idee, lunedì e martedì promemoria, mercoledì chiude il voto, '
                    'giovedì il risultato, venerdì il regalo, sabato si smonta la bancarella. Risultato e regalo sono pronti per tutte e tre le idee; se nessuno vota c\'è «Niente voti, niente app».',
            'puntate': P, 'piazza': piazza}


# ---------------- il banco della serie ----------------
def aggiorna_banco(sett, dom, j, regali):
    bp = os.path.join(QUI, 'banco.json'); b = leggi(bp, {'versione': 1, 'settimane': []})
    s = next((x for x in b['settimane'] if x['settimana'] == sett), None)
    if s is None: s = {'settimana': sett}; b['settimane'].append(s)
    s.update(dal=iso_ora(dom, 0, 0), chiude=iso_ora(dom + datetime.timedelta(days=3), 23, 59), uscita=iso_ora(dom + datetime.timedelta(days=5), 19, 0),
             piazza=j.get('piazza', ''), regali=regali)
    s.setdefault('opzioni', [{'lettera': k, 'idea': j['idee'][k], 'voti': 0} for k in 'ABC'])
    for o in s['opzioni']: o['idea'] = j['idee'][o['lettera']]
    s.setdefault('conteggio', ''); s.setdefault('vince', '')
    b['settimane'].sort(key=lambda x: x['dal'])
    scrivi(bp, b)


def costruisci_regali(sett, j):
    import regali as R
    cat = {i['id']: i for i in catalogo()}; out = {}
    for k in 'ABC':
        iid = (j.get('idee_id') or {}).get(k) or next((i['id'] for i in catalogo() if i['nome'] == j['idee'][k]), None)
        if not iid or iid not in cat: print('niente app per', k, j['idee'][k]); continue
        i = cat[iid]; cartella = os.path.join(ROOT, 'regali', sett, iid)
        R.costruisci(dict(i['app'], id=iid), cartella)
        out[k] = {'id': iid, 'nome': i['nome'], 'emoji': i['emoji'], 'descrizione': i['descrizione'], 'link': f'../Spinta/regali/{sett}/{iid}/'}
    return out


def storico(sett, j):
    sp = os.path.join(ROOT, 'claude', 'storico.json'); st = leggi(sp, {'nota': '', 'settimane': []})
    st['settimane'] = [s for s in st['settimane'] if s.get('settimana') != sett] + [{
        'settimana': sett, 'idee': j['idee'], 'piazza': j.get('piazza', ''), 'fatto_da': 'automatico/settimana.py',
        'hook': [p['copione'][0] for p in j['puntate']], 'parti': [f"{p['giorno']}: {p['titolo']}" for p in j['puntate'] if p['tipo'] in ('idee', 'libera')]}]
    scrivi(sp, st)


def esegui(cmd):
    print('$', ' '.join(cmd), flush=True); r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
    print(r.stdout[-3000:], r.stderr[-3000:], flush=True); r.check_returncode(); return r.stdout


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    sett = args[0] if args else prossima_settimana()
    dom = domenica_di(sett)
    pp = os.path.join(ROOT, 'claude', f'settimana-{sett}.json')
    print('settimana', sett, 'dal', dom, flush=True)
    j = leggi(pp)
    if j is None and '--solo-regali' not in sys.argv:
        idee = scegli_idee(dom)
        if len(idee) < 3:
            import ai
            ai.nuove_idee(6)                      # il modello AI locale scrive idee nuove nel catalogo
            idee = scegli_idee(dom)
        if len(idee) < 3: raise SystemExit('non ci sono tre idee nuove')
        print('idee:', [i['nome'] for i in idee], flush=True)
        telefoni = [f"{i['telefono']}:{i['emoji']}" for i in idee]
        out = json.loads(esegui([sys.executable, 'automatico/piazza.py', sett, *telefoni]).strip().splitlines()[-1])
        j = piano(sett, dom, out['piazza'], idee, out['file'])
        scrivi(pp, j, indent=2)
        esegui([sys.executable, 'claude/controlla.py', pp])
    if j is None: raise SystemExit('manca il piano ' + pp)
    if '--senza-voci' not in sys.argv and '--solo-regali' not in sys.argv:
        esegui([sys.executable, 'automatico/voci.py', pp])
        esegui([sys.executable, 'claude/controlla.py', pp])
    regali = costruisci_regali(sett, j)
    aggiorna_banco(sett, dom, j, regali)
    if '--solo-regali' not in sys.argv: storico(sett, j)
    print('fatto', sett, flush=True)


if __name__ == '__main__':
    main()
