"""Prova le app regalo in un browser vero (Chromium senza schermo): le apre, le usa come farebbe una persona e controlla che funzionino.

    python3 automatico/prova_regali.py regali/2026-W45        # prova le app già costruite in quella cartella
    python3 automatico/prova_regali.py --catalogo             # costruisce e prova tutte le app del catalogo (e delle idee AI)

Serve Playwright (pip install playwright; python -m playwright install --with-deps chromium).
Lo usa automatico/ai.py: un'app scritta dal modello AI entra nel catalogo solo se passa questa prova.
"""
import os, sys, json, tempfile, threading, functools, http.server, socketserver

QUI = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(QUI)
sys.path.insert(0, QUI)


class _Zitto(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass


def _servi(cartella):
    h = functools.partial(_Zitto, directory=cartella)
    s = socketserver.ThreadingTCPServer(('127.0.0.1', 0), h); s.daemon_threads = True
    threading.Thread(target=s.serve_forever, daemon=True).start()
    return s, s.server_address[1]


def _da_ignorare(m):
    """I caratteri di Google Fonts (bloccati apposta nella prova: l'app deve andare anche senza) e la favicon non contano."""
    try: u = (m.location or {}).get('url', '')
    except Exception: u = ''
    return any(x in (u + ' ' + m.text) for x in ('fonts.googleapis', 'fonts.gstatic', 'favicon.ico'))


def _usa(pg, tipo):
    """Fa quello che farebbe una persona con quel tipo di app; alza un errore se qualcosa non torna."""
    if tipo == 'scadenze':
        chips = pg.locator('button.x')
        if chips.count(): chips.first.click()
        else: pg.fill('#cosa', 'Prova')
        pg.click('button.grande'); pg.wait_for_timeout(200)
        assert pg.locator('li.voce').count() >= 1, 'non si aggiunge niente'
        pg.locator('li.voce .az button.ok').first.click(); pg.wait_for_timeout(100)
    elif tipo == 'timer':
        pg.locator('.due button.piccolo').first.click(); pg.click('button.grande'); pg.wait_for_timeout(1200)
        assert ':' in pg.inner_text('.tempo b'), 'il tempo non si vede'
        pg.click('button.grande')
    elif tipo == 'turni':
        assert pg.locator('.voce').count() >= 1, 'nessun turno'
        pg.locator('.voce .az button').first.click()
        r = pg.locator('table.tab tr').count(); assert r == 8, f'tabella della settimana con {r} righe'
    elif tipo == 'lista':
        pg.fill('input[type=text]', 'Calzini e mutande, documenti'); pg.press('input[type=text]', 'Enter'); pg.wait_for_timeout(200)
        n = pg.locator('li.voce').count(); assert n == 3, f'{n} voci invece di 3'
        pg.locator('li.voce').first.click()
    elif tipo == 'registro':
        ins = pg.locator('form input[type=text]'); ins.nth(0).fill('Sciarpa'); ins.nth(1).fill('Nonna')
        num = pg.locator('form input[type=number]')
        if num.count(): num.first.fill('25')
        pg.click('button.grande'); pg.wait_for_timeout(200)
        assert pg.locator('li.voce').count() == 1, 'non si segna niente'
    elif tipo == 'ricorrenze':
        assert pg.locator('li.voce').count() >= 1, 'nessun esempio'
        pg.locator('li.voce .az button.ok').first.click()
    elif tipo == 'segnapunti':
        sq = pg.locator('.squadra').first; bottoni = sq.locator('.tre button'); grande = bottoni.nth(bottoni.count() - 1)
        fino = pg.evaluate('(CFG.opzioni.giochi || [{fino: 11}])[0].fino || 0')
        for _ in range(400):
            if pg.locator('.squadra.vince').count() or not fino: break
            grande.click()
        if fino: assert pg.locator('.squadra.vince').count() == 1, 'la partita non finisce mai'
        else: assert pg.inner_text('.squadra .n >> nth=0') != '0', 'i punti non contano'
    elif tipo == 'sorteggio':
        pg.click('button.grande'); pg.wait_for_timeout(4500)
        assert pg.inner_text('.ruota') != '?', 'la ruota non gira'
    elif tipo == 'calendario':
        n = pg.locator('.campi input[type=text]').count(); assert n == 7, f'{n} giorni invece di 7'
        pg.locator('.campi input[type=text]').first.fill('Organico'); pg.locator('.campi input[type=text]').first.dispatch_event('change')
    elif tipo == 'contatore':
        pg.locator('button[aria-label="Più"]').first.click(); pg.locator('button[aria-label="Più"]').first.click()
        v = pg.locator('.voce b.grosso').first.inner_text(); assert v == '2', f'conta {v} invece di 2'
    else:
        raise AssertionError('tipo sconosciuto ' + str(tipo))


def prova_cartella(radice, nomi=None, foto=None):
    """Prova le app in radice/<nome>/index.html. Ritorna {nome: (tipo, 'ok' o l'errore, [errori della pagina])}."""
    from playwright.sync_api import sync_playwright
    nomi = nomi or sorted(d for d in os.listdir(radice) if os.path.exists(os.path.join(radice, d, 'index.html')))
    srv, porta = _servi(radice); res = {}
    try:
        with sync_playwright() as p:
            b = p.chromium.launch()
            for n in nomi:
                ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
                pg = ctx.new_page(); errs = []
                pg.on('pageerror', lambda e: errs.append('errore: ' + str(e)))
                pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' and not _da_ignorare(m) else None)
                pg.route('**/fonts.googleapis.com/**', lambda r: r.abort()); pg.route('**/fonts.gstatic.com/**', lambda r: r.abort())
                tipo = None
                try:
                    pg.goto(f'http://127.0.0.1:{porta}/{n}/', wait_until='load'); pg.wait_for_timeout(400)
                    tipo = pg.evaluate('CFG.tipo')
                    _usa(pg, tipo)
                    pg.reload(); pg.wait_for_timeout(300)   # dopo aver ricaricato, l'app deve ripartire coi dati salvati
                    assert pg.locator('main, body').first.inner_text().strip(), 'pagina vuota dopo il ricarico'
                    esito = 'ok' if not errs else 'errori nella pagina'
                except Exception as e:
                    esito = 'ERRORE ' + str(e).splitlines()[0][:200]
                if foto:
                    os.makedirs(foto, exist_ok=True)
                    try: pg.screenshot(path=os.path.join(foto, n + '.png'), full_page=True)
                    except Exception: pass
                res[n] = (tipo, esito, errs[:3]); ctx.close()
            b.close()
    finally:
        srv.shutdown()
    return res


def prova_app(app, foto=None):
    """Costruisce l'app (dict «app» del catalogo, con id) in una cartella temporanea e la prova. Ritorna (va_bene, spiegazione)."""
    import regali
    with tempfile.TemporaryDirectory() as d:
        nome = app.get('id') or 'app'
        regali.costruisci(app, os.path.join(d, nome))
        tipo, esito, errs = prova_cartella(d, [nome], foto)[nome]
        return esito == 'ok', esito + ('' if not errs else ' · ' + ' | '.join(errs))


if __name__ == '__main__':
    if '--catalogo' in sys.argv:
        import regali
        from settimana import catalogo
        d = tempfile.mkdtemp()
        for i in catalogo(): regali.costruisci(dict(i['app'], id=i['id']), os.path.join(d, i['id']))
        r = prova_cartella(d, foto=os.environ.get('SPINTA_FOTO'))
    else:
        r = prova_cartella(os.path.join(ROOT, sys.argv[1]) if not os.path.isabs(sys.argv[1]) else sys.argv[1])
    for k, v in r.items(): print(k, v)
    male = [k for k, v in r.items() if v[1] != 'ok']
    print('tutte ok' if not male else 'NON VANNO: ' + ', '.join(male))
    sys.exit(1 if male else 0)
