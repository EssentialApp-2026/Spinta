"""Toglie le persone vere dalle foto delle piazze: nei video di 'O Bancariello non deve comparire nessuna persona reale.

    python3 automatico/persone.py foto.jpg uscita.jpg          # scrive la foto senza persone (e uscita-maschera.png per controllo)

Come lavora (tutto gratis e in locale, i modelli si scaricano da GitHub):
  1. YOLOX-X (Apache-2.0, Megvii) cerca le persone su tutta la foto e anche a pezzi, così trova pure quelle piccole lontane;
     con loro va via anche la bici o il motorino su cui stanno. Le statue (in alto, sul piedistallo, senza colori) restano.
  2. LaMa (big-lama, Apache-2.0) ricostruisce lo sfondo al posto loro.
  3. Ricontrolla: se ne è rimasta qualcuna, un altro giro. Se la gente copre troppa foto, la foto non va bene (errore TroppaGente).
"""
import os, sys, math, subprocess
import numpy as np
from PIL import Image, ImageFilter, ImageOps

CACHE = os.path.join(os.environ.get('SPINTA_MODELLI', os.path.expanduser('~/.cache/spinta-modelli')), 'persone')
MODELLI = {'yolox_x.onnx': 'https://github.com/Megvii-BaseDetection/YOLOX/releases/download/0.1.1rc0/yolox_x.onnx',
           'big-lama.pt': 'https://github.com/Sanster/models/releases/download/add_big_lama/big-lama.pt'}
LATO = 640                      # ingresso di YOLOX
PERSONA, BICI, MOTO = 0, 1, 3   # classi COCO
SOGLIA = 0.30                   # quanto deve essere sicuro il modello per dire «persona»
MAX_COPERTO = 0.30              # oltre questa parte di foto coperta da persone, la foto non si usa


class TroppaGente(Exception):
    pass


def scarica(nome):
    p = os.path.join(CACHE, nome)
    if not (os.path.exists(p) and os.path.getsize(p) > 1e6):
        os.makedirs(CACHE, exist_ok=True)
        subprocess.run(['curl', '-sSL', '--retry', '3', '-m', '1800', '-o', p + '.part', MODELLI[nome]], check=True)
        os.replace(p + '.part', p)
    return p


_det = _lama = None


def rilevatore():
    global _det
    if _det is None:
        import onnxruntime as ort
        _det = ort.InferenceSession(scarica('yolox_x.onnx'), providers=['CPUExecutionProvider'])
    return _det


def _griglie():
    g, s = [], []
    for st in (8, 16, 32):
        n = LATO // st
        yv, xv = np.meshgrid(np.arange(n), np.arange(n), indexing='ij')
        g.append(np.stack((xv, yv), 2).reshape(-1, 2)); s.append(np.full((n * n, 1), st))
    return np.concatenate(g).astype(np.float32), np.concatenate(s).astype(np.float32)


GRIGLIE, PASSI = _griglie()


def _yolox(rgb):
    """rgb: array HxWx3 uint8. Ritorna array N x 6 (x0, y0, x1, y1, punteggio, classe) nelle coordinate del pezzo."""
    h, w = rgb.shape[:2]; r = min(LATO / h, LATO / w)
    pic = Image.fromarray(rgb).resize((max(1, int(w * r)), max(1, int(h * r))), Image.BILINEAR)
    pad = np.full((LATO, LATO, 3), 114, np.uint8); a = np.asarray(pic); pad[:a.shape[0], :a.shape[1]] = a
    x = pad[:, :, ::-1].transpose(2, 0, 1)[None].astype(np.float32)          # YOLOX vuole BGR, 0-255
    out = rilevatore().run(None, {rilevatore().get_inputs()[0].name: x})[0][0]
    xy = (out[:, :2] + GRIGLIE) * PASSI; wh = np.exp(out[:, 2:4]) * PASSI
    cls = out[:, 5:].argmax(1); sc = out[:, 4] * out[np.arange(len(out)), 5 + cls]
    k = (sc > SOGLIA) & np.isin(cls, (PERSONA, BICI, MOTO))
    b = np.concatenate([xy[k] - wh[k] / 2, xy[k] + wh[k] / 2], 1) / r
    return np.concatenate([b, sc[k, None], cls[k, None]], 1)


def _nms(d, soglia=0.5):
    tenuti = []
    for c in np.unique(d[:, 5]) if len(d) else []:
        x = d[d[:, 5] == c]; x = x[np.argsort(-x[:, 4])]
        while len(x):
            a = x[0]; tenuti.append(a)
            xx0 = np.maximum(a[0], x[1:, 0]); yy0 = np.maximum(a[1], x[1:, 1]); xx1 = np.minimum(a[2], x[1:, 2]); yy1 = np.minimum(a[3], x[1:, 3])
            inter = np.clip(xx1 - xx0, 0, None) * np.clip(yy1 - yy0, 0, None)
            area = lambda z: (z[..., 2] - z[..., 0]) * (z[..., 3] - z[..., 1])
            iou = inter / (area(a) + area(x[1:]) - inter + 1e-6)
            # anche un riquadro quasi tutto dentro un altro è lo stesso oggetto
            dentro = inter / (np.minimum(area(a), area(x[1:])) + 1e-6)
            x = x[1:][(iou < soglia) & (dentro < 0.85)]
    return np.array(tenuti).reshape(-1, 6)


def trova(img):
    """Persone (e bici/moto con qualcuno sopra) nella foto PIL: lista di riquadri (x0, y0, x1, y1, punteggio)."""
    a = np.asarray(img.convert('RGB')); H, W = a.shape[:2]
    tutte = [_yolox(a)]
    t = 800; passo = 560                                                         # a pezzi, per le persone piccole e lontane
    for y in range(0, max(1, H - 240), passo):
        for x in range(0, max(1, W - 240), passo):
            y0, x0 = min(y, max(0, H - t)), min(x, max(0, W - t))
            d = _yolox(a[y0:y0 + t, x0:x0 + t])
            if len(d): d[:, [0, 2]] += x0; d[:, [1, 3]] += y0; tutte.append(d)
    d = _nms(np.concatenate(tutte))
    pers = [p for p in d if p[5] == PERSONA]
    hsv = np.asarray(img.convert('RGB').convert('HSV')).astype(np.float32) / 255
    tenere = []
    for p in pers:
        x0, y0, x1, y1 = [int(round(v)) for v in p[:4]]; x0, y0 = max(0, x0), max(0, y0); x1, y1 = min(W, x1), min(H, y1)
        if x1 - x0 < 4 or y1 - y0 < 8: continue
        sat = hsv[y0:y1, x0:x1, 1].mean()
        statua = y1 < 0.58 * H and sat < 0.16          # in alto e senza colori: una statua sul piedistallo, non una persona
        if not statua: tenere.append((x0, y0, x1, y1, float(p[4])))
    # bici e motorini con una persona sopra vanno via insieme a lei
    for v in d:
        if v[5] in (BICI, MOTO):
            for p in tenere:
                ix = max(0, min(v[2], p[2]) - max(v[0], p[0])); iy = max(0, min(v[3], p[3]) - max(v[1], p[1]))
                if ix * iy > 0.25 * (v[2] - v[0]) * (v[3] - v[1]):
                    tenere.append((max(0, int(v[0])), max(0, int(v[1])), min(W, int(v[2])), min(H, int(v[3])), float(v[4]))); break
    return tenere


def maschera(dim, riquadri):
    W, H = dim; m = Image.new('L', dim, 0); px = m.load()
    from PIL import ImageDraw
    d = ImageDraw.Draw(m)
    for x0, y0, x1, y1, _ in riquadri:
        bw, bh = x1 - x0, y1 - y0
        d.rectangle([x0 - 0.12 * bw - 3, y0 - 0.06 * bh - 3, x1 + 0.12 * bw + 3, y1 + 0.08 * bh + 4], fill=255)   # un po' più largo: ombre e bordi
    return m.filter(ImageFilter.MaxFilter(9))


def lama():
    global _lama
    if _lama is None:
        import torch, warnings
        warnings.filterwarnings('ignore')
        _lama = torch.jit.load(scarica('big-lama.pt'), map_location='cpu').eval()
    return _lama


def riempi(img, m):
    import torch
    a = np.asarray(img.convert('RGB')).astype(np.float32) / 255; k = (np.asarray(m) > 127).astype(np.float32)
    H, W = k.shape; ph, pw = (8 - H % 8) % 8, (8 - W % 8) % 8
    a = np.pad(a, ((0, ph), (0, pw), (0, 0)), mode='symmetric'); k = np.pad(k, ((0, ph), (0, pw)), mode='symmetric')
    with torch.inference_mode():
        out = lama()(torch.from_numpy(a.transpose(2, 0, 1))[None], torch.from_numpy(k)[None, None])
    r = np.clip(out[0].permute(1, 2, 0).numpy() * 255, 0, 255).astype(np.uint8)[:H, :W]
    # fuori dalla maschera resta la foto originale, pixel per pixel
    orig = np.asarray(img.convert('RGB')); mm = (np.asarray(m) > 127)[..., None]
    return Image.fromarray(np.where(mm, r, orig))


def pulisci(img, max_coperto=MAX_COPERTO, giri_max=3, tieni=()):
    """Immagine PIL senza persone (e la maschera di quello che è stato rifatto). Alza TroppaGente se non si può.
    «tieni»: riquadri da non toccare (per esempio Gennarino stesso, quando si ricontrolla il fotogramma finale)."""
    def fuori(r):
        return [x for x in r if not any(min(x[2], t[2]) - max(x[0], t[0]) > 0.5 * (x[2] - x[0]) and min(x[3], t[3]) - max(x[1], t[1]) > 0.5 * (x[3] - x[1]) for t in tieni)]
    tolte, tot = 0, Image.new('L', img.size, 0)
    for giro in range(1, giri_max + 1):
        r = fuori(trova(img))
        if not r: break
        m = maschera(img.size, r); tot = Image.fromarray(np.maximum(np.asarray(tot), np.asarray(m)))
        coperto = (np.asarray(tot) > 127).mean()
        if coperto > max_coperto: raise TroppaGente(f'le persone coprono il {coperto:.0%} della foto')
        img = riempi(img, m); tolte += len(r)
    else:
        if fuori(trova(img)): raise TroppaGente(f'restano persone anche dopo {giri_max} giri')
    if tolte: print(f'persone tolte: {tolte}, foto rifatta per il {(np.asarray(tot) > 127).mean():.1%}', file=sys.stderr, flush=True)
    return img, tot


def togli(foto, uscita=None, lato_max=1920):
    """Prende il percorso di una foto, scrive (e ritorna) il percorso di quella senza persone. Alza TroppaGente se non si può."""
    img = ImageOps.exif_transpose(Image.open(foto)).convert('RGB')
    if max(img.size) > lato_max:
        k = lato_max / max(img.size); img = img.resize((int(img.width * k), int(img.height * k)), Image.LANCZOS)
    img, tot = pulisci(img)
    uscita = uscita or os.path.splitext(foto)[0] + '-senza-persone.jpg'
    img.save(uscita, quality=93)
    tot.save(os.path.splitext(uscita)[0] + '-maschera.png')
    return uscita


if __name__ == '__main__':
    print(togli(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None))
