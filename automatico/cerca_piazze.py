"""Cerca su Wikimedia Commons le foto libere (CC0 o pubblico dominio) delle piazze di «da_cercare» e fa dei fogli con le miniature,
così si possono controllare a occhio e mettere le migliori in automatico/piazze.json («piazze»).

    python3 automatico/cerca_piazze.py claude/piazze-candidate      # scrive candidate.json e fogli-N.jpg in quella cartella

Gira su GitHub (.github/workflows/cerca-piazze.yml), perché da lì Commons si raggiunge.
"""
import os, sys, json, io
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


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(P.ROOT, 'claude', 'piazze-candidate')
    os.makedirs(out, exist_ok=True)
    pz = json.load(open(os.path.join(QUI, 'piazze.json'), encoding='utf-8'))
    tutte = {}
    for nome in pz.get('da_cercare', []):
        try: cand = P.cerca_su_commons(nome)[:3]
        except Exception as e: print('errore', nome, e, flush=True); cand = []
        tutte[nome] = [{'n': k + 1, 'file': c[1], 'licenza': c[2], 'pagina': c[3], 'punti': round(c[0], 1)} for k, c in enumerate(cand)]
        print(nome, [c['file'] for c in tutte[nome]], flush=True)
    json.dump(tutte, open(os.path.join(out, 'candidate.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
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


if __name__ == '__main__':
    main()
