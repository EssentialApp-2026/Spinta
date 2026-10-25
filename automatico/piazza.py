"""Panoramica della piazza nuova, GRATIS e automatica (senza Kling).

    python3 automatico/piazza.py 2026-W45 "Piante:🪴" "Scopa:🃏" "Sorte:🎲"        # sceglie la prossima piazza
    python3 automatico/piazza.py 2026-W45 ... --foto carita.jpg --nome "Piazza Carità"  # con una foto già scaricata

1. Prende la prossima piazza vera di Napoli da automatico/piazze.json (foto CC0 o pubblico dominio già controllate),
   oppure ne cerca una nuova su Wikimedia Commons con le stesse regole (solo CC0/pubblico dominio, foto recenti a colori).
2. Ritaglia la foto in verticale 9:16 e ci mette la bancarella con Gennarino (automatico/bancarella.png) sul selciato,
   con l'ombra e i tre telefoni delle idee della settimana (A, B, C) sul banco.
3. Fa il volo in avanti (la piazza si avvicina piano, la bancarella di più: sembra un drone) e scrive
   libreria/piazza-<settimana>.mp4 e .jpg e la voce in «aperture» di libreria/libreria.json.
Stampa un JSON con piazza, file e foto usata.
"""
import os, sys, json, re, subprocess, tempfile, urllib.request, urllib.parse
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance, ImageOps

QUI = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(QUI)
LIB = os.path.join(ROOT, 'libreria')
UA = 'SpintaBancariello/1.0 (https://github.com/EssentialApp-2026/Spinta; panoramica settimanale)'
W, H, FPS, DUR = 720, 1280, 24, 8.5
COL = [(47, 158, 110), (59, 111, 216), (224, 138, 46)]
EMOJI = next((p for p in ['/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf', '/usr/share/fonts/noto/NotoColorEmoji.ttf'] if os.path.exists(p)), None)
FONT = next((p for p in ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf'] if os.path.exists(p)), None)


def get(url):
    r = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(r, timeout=60) as f: return f.read()


def commons(params):
    q = urllib.parse.urlencode(dict(params, format='json'))
    return json.loads(get('https://commons.wikimedia.org/w/api.php?' + q))


def piazze_usate():
    l = json.load(open(os.path.join(LIB, 'libreria.json'), encoding='utf-8'))
    return {a.get('piazza', '').lower() for a in l.get('aperture', [])}


def libera(meta):
    lic = (meta.get('LicenseShortName', {}) or {}).get('value', '')
    att = (meta.get('AttributionRequired', {}) or {}).get('value', '')
    return bool(re.match(r'^(cc0|public domain|pd)', lic, re.I)) and att != 'true', lic


def scegli_piazza():
    usate = piazze_usate()
    lista = json.load(open(os.path.join(QUI, 'piazze.json'), encoding='utf-8'))['piazze']
    for p in lista:
        if p['nome'].lower() not in usate: return p
    # finite quelle controllate: se ne cerca una nuova su Commons
    for nome in json.load(open(os.path.join(QUI, 'piazze.json'), encoding='utf-8')).get('da_cercare', []):
        if nome.lower() in usate: continue
        j = commons(dict(action='query', generator='search', gsrnamespace=6, gsrlimit=50, gsrsearch=f'"{nome}" Napoli filetype:bitmap',
                         prop='imageinfo', iiprop='url|size|extmetadata', iiextmetadatafilter='LicenseShortName|AttributionRequired|DateTimeOriginal'))
        cand = []
        for pg in (j.get('query', {}).get('pages', {}) or {}).values():
            ii = pg['imageinfo'][0]; ok, lic = libera(ii.get('extmetadata', {}))
            dt = re.sub('<[^>]+>', '', (ii.get('extmetadata', {}).get('DateTimeOriginal', {}) or {}).get('value', ''))
            anno = int(m.group(0)) if (m := re.search(r'(19|20)\d\d', dt)) else 0
            if ok and anno >= 2000 and ii['width'] >= 1600 and ii['height'] >= 1100 and 'napoli' in (pg['title'] + ' Napoli').lower():
                cand.append((ii['width'] * ii['height'], pg['title'], lic))
        if cand:
            cand.sort(reverse=True); return {'nome': nome, 'file': cand[0][1], 'licenza': cand[0][2], 'trovata': 'automatica'}
    raise SystemExit('nessuna piazza nuova con foto libera')


def scarica_foto(p):
    j = commons(dict(action='query', titles=p['file'], prop='imageinfo', iiprop='url|size|extmetadata', iiurlwidth=1920,
                     iiextmetadatafilter='LicenseShortName|AttributionRequired|Artist'))
    ii = next(iter(j['query']['pages'].values()))['imageinfo'][0]
    ok, lic = libera(ii.get('extmetadata', {}))
    if not ok: raise SystemExit(f"{p['file']}: licenza non libera ({lic})")
    f = tempfile.mktemp(suffix='.jpg'); open(f, 'wb').write(get(ii.get('thumburl') or ii['url']))
    return f, ii.get('descriptionurl', ''), lic


def emoji_img(e, lato):
    if not EMOJI: return None
    try:
        f = ImageFont.truetype(EMOJI, 109); im = Image.new('RGBA', (160, 160), (0, 0, 0, 0))
        ImageDraw.Draw(im).text((80, 80), e, font=f, embedded_color=True, anchor='mm'); bb = im.getbbox()
        if not bb: return None
        im = im.crop(bb); k = lato / max(im.size); return im.resize((max(1, int(im.width * k)), max(1, int(im.height * k))), Image.LANCZOS)
    except Exception:
        return None


def telefono(w, h, lettera, nome, emoji, col):
    S = 4; W2, H2 = w * S, h * S
    im = Image.new('RGBA', (W2, H2), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    bx, by, bw, bh = W2 * .08, H2 * .07, W2 * .86, H2 * .9
    d.rounded_rectangle([bx, by, bx + bw, by + bh], bw * .13, fill=(24, 25, 32, 255))
    d.rounded_rectangle([bx + bw * .06, by + bh * .04, bx + bw * .94, by + bh * .96], bw * .1, fill=(251, 251, 253, 255))
    d.rounded_rectangle([bx + bw * .13, by + bh * .1, bx + bw * .87, by + bh * .25], bw * .06, fill=col + (255,))
    if FONT:
        fs = int(bh * .085); f = ImageFont.truetype(FONT, fs)
        while f.getlength(nome) > bw * .7 and fs > 8: fs -= 2; f = ImageFont.truetype(FONT, fs)
        d.text((bx + bw / 2, by + bh * .175), nome, font=f, fill=(255, 255, 255, 255), anchor='mm')
    d.rounded_rectangle([bx + bw * .13, by + bh * .3, bx + bw * .87, by + bh * .78], bw * .08, fill=col + (40,))
    e = emoji_img(emoji, int(bw * .52))
    if e is not None: im.alpha_composite(e, (int(bx + bw / 2 - e.width / 2), int(by + bh * .54 - e.height / 2)))
    d.rounded_rectangle([bx + bw * .13, by + bh * .83, bx + bw * .87, by + bh * .92], bw * .05, fill=(229, 72, 77, 255))
    r = min(W2, H2) * .17
    d.ellipse([0, 0, r * 2.2, r * 2.2], fill=(255, 255, 255, 255)); d.ellipse([r * .2, r * .2, r * 2, r * 2], fill=col + (255,))
    if FONT: d.text((r * 1.1, r * 1.12), lettera, font=ImageFont.truetype(FONT, int(r * 1.3)), fill=(255, 255, 255, 255), anchor='mm')
    return im.resize((w, h), Image.LANCZOS)


def bancarella(telefoni):
    b = Image.open(os.path.join(QUI, 'bancarella.png')).convert('RGBA')
    info = json.load(open(os.path.join(QUI, 'bancarella.json'), encoding='utf-8'))
    d = ImageDraw.Draw(b)
    for i, (x0, y0, x1, y1) in enumerate(info['telefoni']):
        # copre i telefoni vecchi col legno del banco, poi disegna quelli nuovi un filo più grandi
        d.rounded_rectangle([x0 - 4, y0 - 4, x1 + 4, y1 + 4], 10, fill=(122, 74, 40, 255))
        nome, emo = telefoni[i]
        t = telefono(x1 - x0 + 14, y1 - y0 + 14, 'ABC'[i], nome, emo, COL[i])
        b.alpha_composite(t, (x0 - 7, y0 - 7))
    return b


def ritaglia(foto):
    im = ImageOps.exif_transpose(Image.open(foto)).convert('RGB')
    w, h = im.size; tw = int(h * 9 / 16)
    if tw <= w: im = im.crop(((w - tw) // 2, 0, (w - tw) // 2 + tw, h))
    else:
        th = int(w * 16 / 9); im = im.crop((0, max(0, h - th), w, h))
    return im.resize((W * 2, H * 2), Image.LANCZOS)


def armonizza(stall, bg):
    """Porta la bancarella alla luce della foto (luminosità e colore medi del selciato)."""
    a = np.asarray(bg.resize((90, 160))).astype(np.float32)
    ref = a[100:, :].reshape(-1, 3).mean(0)
    s = np.asarray(stall).astype(np.float32); m = s[..., 3] > 200
    if m.sum() < 100: return stall
    cur = s[m][:, :3].mean(0); lum_r, lum_c = ref.mean(), cur.mean()
    k = np.clip((lum_r / max(1, lum_c)) ** 0.35, 0.8, 1.15)
    tint = np.clip((ref / max(1, ref.mean())) ** 0.12, 0.93, 1.07)
    s[..., :3] = np.clip(s[..., :3] * k * tint, 0, 255)
    return Image.fromarray(s.astype(np.uint8), 'RGBA')


def video(foto, telefoni, uscita, poster):
    bg = ritaglia(foto)
    st = armonizza(bancarella(telefoni), bg)
    hb = int(H * 2 * 0.36); st = st.resize((int(st.width * hb / st.height), hb), Image.LANCZOS)
    cx, base = W, int(H * 2 * 0.955)                      # centro in basso (coordinate 2x)
    # ombra morbida sotto la bancarella
    ombra = Image.new('L', (W * 2, H * 2), 0); od = ImageDraw.Draw(ombra)
    od.ellipse([cx - st.width * .48, base - st.height * .05, cx + st.width * .48, base + st.height * .035], fill=120)
    ombra = ombra.filter(ImageFilter.GaussianBlur(18))
    bg = Image.composite(Image.new('RGB', bg.size, (20, 18, 16)), bg, ombra)
    px, py = cx, base - st.height * 0.62                   # il punto dove arriva il volo: la faccia di Gennarino
    sw0, sh0 = st.size; n = int(DUR * FPS)
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                          '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', uscita], stdin=subprocess.PIPE)
    mezzo = None
    for i in range(n):
        t = i / (n - 1); e = t * t * (3 - 2 * t)
        z = 1 + 0.22 * e; zs = 1 + 1.05 * e                 # la piazza si avvicina poco, la bancarella di più (sembra un drone)
        dy = 0.06 * e * H * 2                                 # e la camera scende un po' verso il banco
        fr = bg.transform(bg.size, Image.AFFINE, (1 / z, 0, px - px / z, 0, 1 / z, py - py / z + dy), Image.BICUBIC)
        s2 = st.resize((max(1, int(sw0 * zs)), max(1, int(sh0 * zs))), Image.LANCZOS if i % 4 == 0 else Image.BILINEAR)
        x = int(round(px + (cx - sw0 / 2 - px) * zs)); y = int(round(py + (base - sh0 - py - dy) * zs))
        fr.paste(s2, (x, y), s2)
        out = fr.resize((W, H), Image.LANCZOS)
        if i == n // 3: mezzo = out
        p.stdin.write(out.tobytes())
    p.stdin.close(); p.wait()
    mezzo.save(poster, quality=85)


def main():
    a = [x for x in sys.argv[1:]]
    sett = a.pop(0)
    foto = nome = None
    if '--foto' in a: i = a.index('--foto'); foto = a[i + 1]; del a[i:i + 2]
    if '--nome' in a: i = a.index('--nome'); nome = a[i + 1]; del a[i:i + 2]
    telefoni = [(x.split(':', 1)[0], x.split(':', 1)[1] if ':' in x else '⭐') for x in a[:3]]
    if foto: p = {'nome': nome or 'Piazza', 'file': os.path.basename(foto), 'licenza': 'data a mano'}; url = ''; lic = p['licenza']
    else:
        p = scegli_piazza(); foto, url, lic = scarica_foto(p)
    mp4 = f'piazza-{sett}.mp4'; jpg = f'piazza-{sett}.jpg'
    video(foto, telefoni, os.path.join(LIB, mp4), os.path.join(LIB, jpg))
    lp = os.path.join(LIB, 'libreria.json'); l = json.load(open(lp, encoding='utf-8'))
    l['aperture'] = [x for x in l.get('aperture', []) if x.get('file') != mp4] + [{
        'file': mp4, 'poster': jpg, 'settimana': sett, 'piazza': p['nome'],
        'descrizione': f"Volo in avanti su {p['nome']} (foto vera, {lic}: «{p['file'].replace('File:', '')}», nessun credito da citare) fino alla bancarella di Gennarino coi telefoni della settimana. Fatta in automatico da automatico/piazza.py. Si usa solo come apertura della puntata della domenica."}]
    json.dump(l, open(lp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(json.dumps({'piazza': p['nome'], 'file': mp4, 'poster': jpg, 'foto': p['file'], 'licenza': lic, 'pagina': url}, ensure_ascii=False))


if __name__ == '__main__':
    main()
