"""Costruisce un'app regalo di Gennarino da una configurazione (vedi automatico/catalogo.json, campo «app»).

    python3 automatico/regali.py automatico/catalogo.json frigo-scadenze /tmp/prova-frigo

Esce una cartella pronta da pubblicare: index.html (tutta l'app in un file, modello automatico/regalo/app.html),
manifest.webmanifest, sw.js (funziona senza internet) e le icone 192/512.
"""
import os, sys, json, hashlib, html
from PIL import Image, ImageDraw, ImageFont

QUI = os.path.dirname(os.path.abspath(__file__))
MODELLO = os.path.join(QUI, 'regalo', 'app.html')
EMOJI_FONT = next((p for p in ['/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf', '/usr/share/fonts/noto/NotoColorEmoji.ttf'] if os.path.exists(p)), None)
TIPI = {'scadenze', 'timer', 'turni', 'lista', 'registro', 'ricorrenze', 'segnapunti', 'sorteggio', 'calendario', 'contatore'}


def icona(emoji, lato):
    S = 4 * lato
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, S - 1, S - 1], int(S * .22), fill=(23, 26, 51, 255))
    # la tenda a strisce in alto
    h = int(S * .2); w = S / 6
    for k in range(6):
        d.rectangle([k * w, 0, (k + 1) * w, h], fill=(230, 57, 70, 255) if k % 2 == 0 else (251, 243, 226, 255))
    for k in range(6):
        d.pieslice([k * w, h - w / 2, (k + 1) * w, h + w / 2], 0, 180, fill=(230, 57, 70, 255) if k % 2 == 0 else (251, 243, 226, 255))
    mask = Image.new('L', (S, S), 0); ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], int(S * .22), fill=255)
    im.putalpha(Image.composite(im.getchannel('A'), Image.new('L', (S, S), 0), mask))
    if EMOJI_FONT and emoji:
        try:
            f = ImageFont.truetype(EMOJI_FONT, 109)
            e = Image.new('RGBA', (160, 160), (0, 0, 0, 0)); ImageDraw.Draw(e).text((80, 80), emoji, font=f, embedded_color=True, anchor='mm')
            bb = e.getbbox()
            if bb:
                e = e.crop(bb); k = (S * .5) / max(e.size); e = e.resize((max(1, int(e.width * k)), max(1, int(e.height * k))), Image.LANCZOS)
                im.alpha_composite(e, (int((S - e.width) / 2), int(S * .6 - e.height / 2)))
        except Exception:
            pass
    return im.resize((lato, lato), Image.LANCZOS)


def costruisci(app, uscita):
    """app: dict con nome, breve, emoji, tipo, slogan, descrizione, chiave, opzioni."""
    assert app.get('tipo') in TIPI, f"tipo sconosciuto: {app.get('tipo')}"
    os.makedirs(uscita, exist_ok=True)
    cfg = {k: app[k] for k in ('nome', 'tipo', 'slogan', 'chiave', 'opzioni', 'piede') if k in app}
    cfg.setdefault('chiave', (app.get('id') or app['tipo']) + '-v1')
    t = open(MODELLO, encoding='utf-8').read()
    t = t.replace('{{NOME}}', html.escape(app['nome'])).replace('{{DESCRIZIONE}}', html.escape(app.get('descrizione', app['nome'])))
    t = t.replace('{{BREVE}}', html.escape(app.get('breve', app['nome'][:12])))
    t = t.replace('/*CONFIG*/{}', json.dumps(cfg, ensure_ascii=False).replace('</', '<\\/'))
    open(os.path.join(uscita, 'index.html'), 'w', encoding='utf-8').write(t)
    man = {'name': app['nome'] + ' · Gennarino', 'short_name': app.get('breve', app['nome'][:12]), 'description': app.get('descrizione', ''), 'lang': 'it',
           'start_url': './', 'scope': './', 'display': 'standalone', 'background_color': '#fbf3e2', 'theme_color': '#171a33',
           'icons': [{'src': 'icona-192.png', 'sizes': '192x192', 'type': 'image/png', 'purpose': 'any maskable'},
                     {'src': 'icona-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any maskable'}]}
    json.dump(man, open(os.path.join(uscita, 'manifest.webmanifest'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    ver = hashlib.sha1(t.encode()).hexdigest()[:8]
    sw = f'''// {app['nome']}: funziona anche senza internet.
const CACHE = "{cfg['chiave']}-{ver}";
const FILE = ["./", "index.html", "manifest.webmanifest", "icona-192.png", "icona-512.png"];
self.addEventListener("install", e => {{ e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILE)).then(() => self.skipWaiting())); }});
self.addEventListener("activate", e => {{
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n !== CACHE).map(n => caches.delete(n)))).then(() => self.clients.claim()));
}});
self.addEventListener("fetch", e => {{
  if (e.request.method !== "GET") return;
  e.respondWith(fetch(e.request).then(r => {{
    if (r.ok || r.type === "opaque") {{ const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); }}
    return r;
  }}).catch(() => caches.match(e.request).then(r => r || caches.match("index.html"))));
}});
self.addEventListener("notificationclick", e => {{ e.notification.close(); e.waitUntil(self.clients.matchAll({{ type: "window" }}).then(l => l.length ? l[0].focus() : self.clients.openWindow("./"))); }});
'''
    open(os.path.join(uscita, 'sw.js'), 'w', encoding='utf-8').write(sw)
    for lato in (192, 512):
        icona(app.get('emoji', ''), lato).save(os.path.join(uscita, f'icona-{lato}.png'))
    return uscita


if __name__ == '__main__':
    cat = json.load(open(sys.argv[1], encoding='utf-8'))
    idee = {i['id']: i for i in cat['idee']}
    i = idee[sys.argv[2]]
    print(costruisci(dict(i['app'], id=i['id']), sys.argv[3]))
