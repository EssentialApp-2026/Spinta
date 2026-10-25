"""Legge il risultato del voto mandato da Spinta (conta-voti → «Usa questo risultato») e aggiorna il banco della serie.

    python3 automatico/risultato.py

Spinta pubblica un messaggio su ntfy.sh (servizio gratuito, senza account) nel canale qui sotto;
GitHub lo legge ogni mezz'ora da mercoledì sera a venerdì (vedi .github/workflows/risultato.yml) e scrive in automatico/banco.json:
voti, ora del conteggio e lettera vincente (o «nessuno»). La pagina 'O Bancariello legge banco.json: giovedì mostra chi ha vinto
e venerdì alle 19 apre da sola l'app vincente, già pronta in regali/<settimana>/.
"""
import os, sys, json, copy, datetime, urllib.request
from zoneinfo import ZoneInfo

QUI = os.path.dirname(os.path.abspath(__file__))
CANALE = os.environ.get('SPINTA_NTFY', 'spinta-bancariello-voti-k7q2m9x4')
ROMA = ZoneInfo('Europe/Rome')


def messaggi(ore=96):
    url = f'https://ntfy.sh/{CANALE}/json?poll=1&since={ore}h'
    r = urllib.request.Request(url, headers={'User-Agent': 'SpintaBancariello/1.0'})
    out = []
    with urllib.request.urlopen(r, timeout=60) as f:
        for riga in f.read().decode('utf-8').splitlines():
            try:
                e = json.loads(riga)
                if e.get('event') == 'message': out.append((e.get('time', 0), json.loads(e.get('message', '{}'))))
            except Exception:
                pass
    return sorted(out, key=lambda x: x[0])


def applica(banco, msgs, ora=None):
    """Per ogni settimana conta solo l'ultimo messaggio arrivato prima dell'uscita del regalo."""
    ora = ora or datetime.datetime.now(ROMA); cambiato = False
    ultimo = {}
    for t, m in msgs:
        s = next((x for x in banco['settimane'] if x.get('settimana') == m.get('settimana')), None)
        if not s: continue
        quando = datetime.datetime.fromtimestamp(t, ROMA) if t else ora
        if quando > datetime.datetime.fromisoformat(s['uscita']): continue   # dopo l'uscita del regalo non si cambia più
        if s['settimana'] not in ultimo or quando >= ultimo[s['settimana']][0]: ultimo[s['settimana']] = (quando, m, s)
    for quando, m, s in ultimo.values():
        chiude = datetime.datetime.fromisoformat(s['chiude'])
        voti = {k: max(0, int(m.get(k, 0) or 0)) for k in 'ABC'}
        vince = m.get('vince') if m.get('vince') in ('A', 'B', 'C', 'nessuno') else ''
        if quando < chiude - datetime.timedelta(hours=6): vince = ''   # un conteggio a metà settimana aggiorna solo i numeri
        nuovo = copy.deepcopy(s)
        for o in nuovo['opzioni']: o['voti'] = voti[o['lettera']]
        nuovo['conteggio'] = quando.isoformat(timespec='minutes')
        if vince: nuovo['vince'] = vince
        if nuovo != s:
            s.clear(); s.update(nuovo); cambiato = True
            print('risultato', s['settimana'], voti, 'vince', s.get('vince', ''), flush=True)
    return cambiato


def main():
    bp = os.path.join(QUI, 'banco.json'); banco = json.load(open(bp, encoding='utf-8'))
    if applica(banco, messaggi()):
        json.dump(banco, open(bp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); open(bp, 'a').write('\n')
        print('banco aggiornato')
    else:
        print('niente di nuovo')


if __name__ == '__main__':
    main()
