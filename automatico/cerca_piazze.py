"""Cerca su Wikimedia Commons le foto libere (CC0 o pubblico dominio) delle piazze di «da_cercare» e fa dei fogli con le miniature,
così si possono controllare a occhio e mettere le migliori in automatico/piazze.json («piazze»).

    python3 automatico/cerca_piazze.py claude/piazze-candidate      # scrive candidate.json e fogli-N.jpg in quella cartella

Gira su GitHub (.github/workflows/cerca-piazze.yml), perché da lì Commons si raggiunge.
"""
import os, sys, json, io, re
from PIL import Image, ImageDraw, ImageFont

QUI = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, QUI)
import piazza as P

FONT = P.FONT
TW, TH = 420, 280


def miniatura(titolo):
    j = P.commons(dict(action='query', titles=titolo, prop='imageinfo', iiprop='url', iiurlwidth=TW * 2))
    ii = next(iter(j['query']['pages'].values()))['imageinfo'][0]
    im = Image.open(io.BytesIO(P.get(ii.get('thumburl') or ii['url']))).convert('RGB')
    im.thumbnail((TW, TH)); fondo = Image.new('RGB', (TW, TH), (30, 30, 30)); fondo.paste(im, ((TW - im.width) // 2, (TH - im.height) // 2))
    return fondo


def membri(cat, tipo, pagine=10, **extra):
    cont, out = {}, []
    for _ in range(pagine):
        j = P.commons(dict(action='query', generator='categorymembers', gcmtitle=cat, gcmtype=tipo, gcmlimit=50, **extra, **cont))
        out += list((j.get('query', {}).get('pages', {}) or {}).values())
        if 'continue' not in j: break
        cont = j['continue']
    return out


def tutte_le_piazze(gia):
    """Tutte le foto CC0 o di pubblico dominio nelle categorie delle piazze di Napoli (e nelle loro sottocategorie), divise per piazza."""
    per = {}
    piazze = []
    for madre in ('Category:Squares in Naples', 'Category:Piazzas in Naples', 'Category:Squares of Naples', 'Category:Piazze di Napoli', 'Category:Streets and squares in Naples'):
        figlie = [pg['title'] for pg in membri(madre, 'subcat', pagine=4)]
        print('categoria', madre, len(figlie), flush=True)
        piazze += [x for x in figlie if x not in piazze]
    if not piazze:   # ultima strada: le categorie che si chiamano «Piazza … (Naples)»
        for q in ('intitle:Piazza Naples', 'intitle:Largo Naples'):
            j = P.commons(dict(action='query', list='search', srnamespace=14, srlimit=200, srsearch=q))
            piazze += [r['title'] for r in j.get('query', {}).get('search', []) if re.search(r'\((Naples|Napoli)\)$', r['title'])]
    print('categorie di piazze:', len(piazze), flush=True)
    for cat in piazze:
        nome = re.sub(r'\s*\((Naples|Napoli)\)$', '', cat.replace('Category:', ''))
        if nome.lower() in gia or not re.match(r'^(Piazza|Largo|Piazzetta) ', nome): continue
        cats = [cat] + [pg['title'] for pg in membri(cat, 'subcat', pagine=1) if not re.search(r'(interior|church|chiesa|night|notte|museum|statue|monument|fountain|fontana|metro|station)', pg['title'], re.I)][:8]
        n = 0
        for c in cats:
            for pg in membri(c, 'file', pagine=6, prop='imageinfo', iiprop='url|size|extmetadata', iiextmetadatafilter='LicenseShortName|AttributionRequired|DateTimeOriginal'):
                if not pg.get('imageinfo'): continue
                n += 1
                ii = pg['imageinfo'][0]; ok, licenza = P.libera(ii.get('extmetadata', {}))
                dt = re.sub('<[^>]+>', '', (ii.get('extmetadata', {}).get('DateTimeOriginal', {}) or {}).get('value', ''))
                anno = int(m.group(0)) if (m := re.search(r'(19|20)\d\d', dt)) else 0
                if not ok or anno < 2000 or ii['width'] < 1600 or ii['height'] < 1000 or ii['width'] / ii['height'] < 1.2: continue
                tit = pg['title'].lower(); senza = tit
                for w in re.findall(r'[a-zà-ù0-9]+', nome.lower()): senza = senza.replace(w, ' ')
                if P.SCARTA.search(senza): continue
                punti = min(ii['width'] * ii['height'], 24e6) / 1e6 + (4 if 'piazza' in tit else 0) + (anno - 2000) / 5 + (3 if c == cat else 0)
                if not any(x[1] == pg['title'] for x in per.get(nome, [])): per.setdefault(nome, []).append((punti, pg['title'], licenza, ii.get('descriptionurl', '')))
        print(f'  {nome}: {n} foto guardate, {len(per.get(nome, []))} libere e adatte', flush=True)
    return {k: sorted(v, reverse=True) for k, v in per.items()}


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(P.ROOT, 'claude', 'piazze-candidate')
    os.makedirs(out, exist_ok=True)
    pz = json.load(open(os.path.join(QUI, 'piazze.json'), encoding='utf-8'))
    tutte = {}
    gia = {p['nome'].lower() for p in pz['piazze'] + pz.get('trovate', [])} | P.piazze_usate()
    try:
        for nome, cand in tutte_le_piazze(gia).items():
            tutte[nome] = [{'n': k + 1, 'file': c[1], 'licenza': c[2], 'pagina': c[3], 'punti': round(c[0], 1)} for k, c in enumerate(cand[:3])]
            print('(categorie)', nome, len(cand), [c['file'] for c in tutte[nome]], flush=True)
    except Exception as e:
        print('errore nella ricerca per categorie', e, flush=True)
    for nome in pz.get('da_cercare', []):
        if any(nome.lower() == k.lower() for k in tutte): continue
        spiega = []
        try: cand = P.cerca_su_commons(nome, spiega)[:3]
        except Exception as e: print('errore', nome, e, flush=True); cand = []
        for x in spiega: print('   ', x, flush=True)
        tutte[nome] = [{'n': k + 1, 'file': c[1], 'licenza': c[2], 'pagina': c[3], 'punti': round(c[0], 1)} for k, c in enumerate(cand)]
        print(nome, [c['file'] for c in tutte[nome]], flush=True)
    json.dump(tutte, open(os.path.join(out, 'candidate.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    for f in os.listdir(out):
        if f.startswith('fogli-'): os.remove(os.path.join(out, f))
    f = ImageFont.truetype(FONT, 22) if FONT else ImageFont.load_default(); fp = ImageFont.truetype(FONT, 15) if FONT else ImageFont.load_default()
    nomi = [n for n in tutte if tutte[n]]
    for s in range(0, len(nomi), 5):
        blocco = nomi[s:s + 5]
        foglio = Image.new('RGB', (TW * 3 + 40, len(blocco) * (TH + 70) + 10), (245, 240, 230)); d = ImageDraw.Draw(foglio)
        for r, nome in enumerate(blocco):
            y = 10 + r * (TH + 70); d.text((10, y), nome, fill=(20, 20, 20), font=f)
            for k, c in enumerate(tutte[nome]):
                try: foglio.paste(miniatura(c['file']), (10 + k * (TW + 10), y + 32))
                except Exception as e: d.text((10 + k * (TW + 10), y + 120), 'non scaricata', fill=(200, 0, 0), font=fp)
                d.text((14 + k * (TW + 10), y + 36), str(c['n']), fill=(255, 255, 0), font=f)
                d.text((10 + k * (TW + 10), y + 34 + TH), c['file'].replace('File:', '')[:52], fill=(60, 60, 60), font=fp)
        foglio.save(os.path.join(out, f'fogli-{s // 5 + 1}.jpg'), quality=82)
    print('fatto', out, flush=True)


def prova(out):
    """Fa la locandina della panoramica (bancarella compresa) per le foto di automatico/piazze-prova.json, per sceglierle a occhio."""
    import tempfile, subprocess
    os.makedirs(out, exist_ok=True)
    for x in json.load(open(os.path.join(QUI, 'piazze-prova.json'), encoding='utf-8')):
        try: foto, url, lic = P.scarica_foto(x)
        except BaseException as e: print('non scaricata', x['file'], e, flush=True); continue
        for c in x.get('centri', [0.5]):
            nome = re.sub(r'[^a-z0-9]+', '-', x['nome'].lower()).strip('-') + f'-{int(c * 100)}'
            P.video(foto, [('Prova', '⭐'), ('Idea', '💡'), ('Gratis', '🎁')], tempfile.mktemp(suffix='.mp4'), os.path.join(out, f'prova-{nome}.jpg'), c)
            print('fatta', nome, lic, flush=True)


if __name__ == '__main__':
    if '--prova' in sys.argv: prova(sys.argv[1] if not sys.argv[1].startswith('--') else os.path.join(P.ROOT, 'claude', 'piazze-candidate'))
    else: main()
