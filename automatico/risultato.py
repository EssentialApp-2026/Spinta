"""Legge il risultato del voto mandato da Spinta (conta-voti → «Usa questo risultato») e aggiorna il banco della serie.

    python3 automatico/risultato.py

Spinta pubblica un messaggio su ntfy.sh (servizio gratuito, senza account) nel canale qui sotto;
GitHub lo legge ogni mezz'ora da mercoledì sera a venerdì (vedi .github/workflows/risultato.yml) e scrive in automatico/banco.json:
voti, ora del conteggio e lettera vincente (o «nessuno»). La pagina 'O Bancariello legge banco.json: giovedì mostra chi ha vinto
e venerdì alle 19 apre da sola l'app vincente, già pronta in regali/<settimana>/.

Il canale ntfy è pubblico (il suo nome è nel codice di Spinta, che è pubblico): chiunque può scriverci. Per questo:
- un messaggio conta solo se è fatto come quelli di Spinta (settimana del banco, voti interi, vincente coerente con i voti);
- il vincente lo fissa il PRIMO risultato finale valido. Un risultato successivo con lo stesso vincente aggiorna solo i numeri;
  uno con un vincente DIVERSO non cambia niente e apre una issue (arriva per email) per chiedere a Sam quale tenere;
- per cambiare il vincente a mano: Actions → «Risultato del voto» → Run workflow, con settimana e vincente.
  Lo può fare solo chi ha accesso al repository, quindi ha sempre l'ultima parola.
"""
import os, sys, json, copy, datetime, urllib.request
from zoneinfo import ZoneInfo

QUI = os.path.dirname(os.path.abspath(__file__))
CANALE = os.environ.get('SPINTA_NTFY', 'spinta-bancariello-voti-k7q2m9x4')
ROMA = ZoneInfo('Europe/Rome')
LETTERE = ('A', 'B', 'C')
MAX_VOTI = 100000          # più voti di così in una settimana non sono un conteggio vero
FINALE_PRIMA = 6           # ore prima della chiusura del voto da cui un conteggio vale come risultato finale


def messaggi(ore=96):
    url = f'https://ntfy.sh/{CANALE}/json?poll=1&since={ore}h'
    r = urllib.request.Request(url, headers={'User-Agent': 'SpintaBancariello/1.0'})
    out = []
    with urllib.request.urlopen(r, timeout=60) as f:
        for riga in f.read().decode('utf-8').splitlines():
            try:
                e = json.loads(riga)
                if e.get('event') == 'message': out.append((e.get('time', 0), json.loads(e.get('message', '{}')), e.get('id', '')))
            except Exception:
                pass
    return sorted(out, key=lambda x: x[0])


def valido(m):
    """Il messaggio è fatto come quelli di Spinta? Restituisce (voti, vince) o None."""
    if not isinstance(m, dict) or not isinstance(m.get('settimana'), str): return None
    voti = {}
    for k in LETTERE:
        v = m.get(k, 0)
        if isinstance(v, bool) or not isinstance(v, int) or not 0 <= v <= MAX_VOTI: return None
        voti[k] = v
    vince, tot = m.get('vince'), sum(voti.values())
    if vince == 'nessuno':
        if tot: return None                                   # «nessuno ha votato» con dei voti: non torna
    elif vince in LETTERE:
        if not tot or voti[vince] != max(voti.values()): return None   # deve vincere la lettera con più voti (a pari merito una di quelle)
    else:
        return None
    return voti, vince


def scrivi(s, voti, vince, quando):
    nuovo = copy.deepcopy(s)
    for o in nuovo['opzioni']: o['voti'] = voti[o['lettera']]
    nuovo['conteggio'] = quando.isoformat(timespec='minutes')
    if vince: nuovo['vince'] = vince
    if nuovo == s: return False
    s.clear(); s.update(nuovo)
    print('risultato', s['settimana'], voti, 'vince', s.get('vince', ''), flush=True)
    return True


def applica(banco, msgs, ora=None):
    """Aggiorna il banco con i messaggi validi. Restituisce (cambiato, conflitti)."""
    ora = ora or datetime.datetime.now(ROMA); cambiato = False; conflitti = []
    for t, m, mid in msgs:
        ok = valido(m)
        if not ok:
            print('scartato (non è un messaggio di Spinta):', str(m)[:120], flush=True); continue
        voti, vince = ok
        s = next((x for x in banco['settimane'] if x.get('settimana') == m['settimana']), None)
        if not s: continue
        quando = datetime.datetime.fromtimestamp(t, ROMA) if t else ora
        if quando > datetime.datetime.fromisoformat(s['uscita']): continue   # dopo l'uscita del regalo non si cambia più
        if quando < datetime.datetime.fromisoformat(s['dal']): continue      # prima che la settimana cominci non vale
        finale = quando >= datetime.datetime.fromisoformat(s['chiude']) - datetime.timedelta(hours=FINALE_PRIMA)
        fissato = s.get('vince') or ''
        if not finale:
            if not fissato: cambiato |= scrivi(s, voti, '', quando)          # a metà settimana: solo i numeri
            continue
        if not fissato or vince == fissato:
            cambiato |= scrivi(s, voti, vince, quando)                      # primo risultato finale, o conferma dello stesso vincente
        elif mid not in s.get('scartati', []):
            s.setdefault('scartati', []).append(mid); cambiato = True       # ricordo il messaggio per non riaprire la issue
            conflitti.append({'settimana': s['settimana'], 'tenuto': fissato, 'arrivato': vince, 'voti': voti,
                              'quando': quando.isoformat(timespec='minutes')})
            print('conflitto', conflitti[-1], flush=True)
    return cambiato, conflitti


def a_mano(banco, settimana, vince, voti_txt=''):
    """Run workflow da GitHub: chi ha accesso al repository sceglie il vincente."""
    s = next((x for x in banco['settimane'] if x.get('settimana') == settimana), None)
    if not s: sys.exit(f'Settimana {settimana} non trovata nel banco')
    if vince not in LETTERE + ('nessuno',): sys.exit('Vincente: A, B, C oppure nessuno')
    voti = {o['lettera']: o.get('voti', 0) for o in s['opzioni']}
    if voti_txt.strip():
        n = [int(x) for x in voti_txt.replace(' ', '').split(',')]
        if len(n) != 3 or min(n) < 0: sys.exit('Voti: tre numeri separati da virgola, es. 4,2,1')
        voti = dict(zip(LETTERE, n))
    elif vince == 'nessuno':
        voti = dict.fromkeys(LETTERE, 0)
    print('scelto a mano', end=' ')
    return scrivi(s, voti, vince, datetime.datetime.now(ROMA))


def main():
    bp = os.path.join(QUI, 'banco.json'); banco = json.load(open(bp, encoding='utf-8'))
    conflitti = []
    if os.environ.get('VOTO_SETTIMANA'):
        cambiato = a_mano(banco, os.environ['VOTO_SETTIMANA'].strip(), os.environ.get('VOTO_VINCE', '').strip(), os.environ.get('VOTO_VOTI', ''))
    else:
        cambiato, conflitti = applica(banco, messaggi())
    if cambiato:
        json.dump(banco, open(bp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); open(bp, 'a').write('\n')
        print('banco aggiornato')
    else:
        print('niente di nuovo')
    out = os.environ.get('GITHUB_OUTPUT')
    if out and conflitti:
        c = conflitti[-1]
        with open(out, 'a', encoding='utf-8') as f:
            f.write(f"conflitto=1\nsettimana={c['settimana']}\ntenuto={c['tenuto']}\narrivato={c['arrivato']}\n"
                    f"voti={c['voti']['A']},{c['voti']['B']},{c['voti']['C']}\nquando={c['quando']}\n")


if __name__ == '__main__':
    main()
