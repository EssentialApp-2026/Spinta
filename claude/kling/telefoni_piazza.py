"""Sostituisce i tre telefoni sul banco nella panoramica della piazza con quelli della settimana.
Uso: python3 telefoni_piazza.py ingresso.mp4 uscita.mp4 poster.jpg "Macchina:auto" "Pasta:timer" "Prestiti:quaderno"
Ogni telefono è «Nome:icona» (icone: auto, timer, quaderno, bidone, goccia, carrello, frigo, casa, parcheggio, altro).
I telefoni vecchi sono nelle posizioni del primo fotogramma (BOX: x, y, larghezza, altezza); il davanti del banco si segue di fotogramma
in fotogramma (ECC, trasformazione affine), i vecchi telefoni si cancellano con inpaint e i nuovi si disegnano nella stessa posizione e misura.
Va fatto solo se la clip è quella del banco con i telefoni nelle stesse posizioni (la panoramica della piazza della settimana)."""
import sys, subprocess, cv2, numpy as np
from PIL import Image, ImageDraw, ImageFont

import json, os
src, out, poster = sys.argv[1:4]
specs = [a.split(':') + ['altro'] for a in sys.argv[4:7]]
# per una clip nuova: TELEFONI_BOX='[[x,y,w,h],[...],[...]]' e TELEFONI_REG='[x,y,w,h]' misurati sul primo fotogramma
COL = [(47, 158, 110), (59, 111, 216), (224, 138, 46)]
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
BOX = [(322, 918, 34, 50), (362, 916, 33, 49), (398, 914, 34, 49)]   # nel primo fotogramma, compreso il pallino della lettera
REG = (250, 905, 205, 135)   # davanti del banco da seguire (x, y, w, h) nel primo fotogramma
SC = 6
if os.environ.get('TELEFONI_BOX'): BOX = [tuple(b) for b in json.loads(os.environ['TELEFONI_BOX'])]
if os.environ.get('TELEFONI_REG'): REG = tuple(json.loads(os.environ['TELEFONI_REG']))

def icon(d, kind, cx, cy, r, col):
    if kind == 'auto':
        d.rounded_rectangle([cx - r, cy - r * .1, cx + r, cy + r * .5], r * .2, fill=(214, 40, 40))
        d.polygon([(cx - r * .6, cy - r * .1), (cx - r * .3, cy - r * .6), (cx + r * .3, cy - r * .6), (cx + r * .6, cy - r * .1)], fill=(214, 40, 40))
        for sx in (-.5, .5): d.ellipse([cx + sx * r - r * .22, cy + r * .35, cx + sx * r + r * .22, cy + r * .8], fill=(30, 30, 40))
    elif kind == 'timer':
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 255, 255), outline=col, width=max(2, int(r * .22)))
        d.line([cx, cy, cx, cy - r * .62], fill=(30, 30, 40), width=max(2, int(r * .14)))
        d.line([cx, cy, cx + r * .45, cy + r * .2], fill=(214, 40, 40), width=max(2, int(r * .14)))
    elif kind == 'quaderno':
        d.rounded_rectangle([cx - r * .8, cy - r, cx + r * .8, cy + r], r * .12, fill=(120, 72, 38))
        d.rectangle([cx - r * .62, cy - r * .8, cx + r * .7, cy + r * .85], fill=(250, 245, 230))
        for k in range(4): d.line([cx - r * .45, cy - r * .5 + k * r * .4, cx + r * .5, cy - r * .5 + k * r * .4], fill=(120, 140, 200), width=max(1, int(r * .08)))
    elif kind == 'bidone':
        for k, c in enumerate([(40, 110, 230), (240, 200, 30), (130, 80, 40)]): d.rounded_rectangle([cx - r + k * r * .7, cy - r * .8, cx - r * .4 + k * r * .7, cy + r], 2, fill=c)
    elif kind == 'goccia':
        d.polygon([(cx, cy - r), (cx + r * .7, cy + r * .3), (cx - r * .7, cy + r * .3)], fill=(40, 140, 230)); d.ellipse([cx - r * .7, cy - r * .1, cx + r * .7, cy + r * .9], fill=(40, 140, 230))
    elif kind == 'frigo':
        d.rounded_rectangle([cx - r * .6, cy - r, cx + r * .6, cy + r], r * .15, fill=(235, 240, 245), outline=(120, 130, 150), width=max(2, int(r * .1)))
        d.line([cx - r * .6, cy - r * .15, cx + r * .6, cy - r * .15], fill=(120, 130, 150), width=max(2, int(r * .1)))
        d.line([cx + r * .35, cy - r * .7, cx + r * .35, cy - r * .35], fill=(120, 130, 150), width=max(2, int(r * .12)))
    elif kind == 'casa':
        d.polygon([(cx - r, cy), (cx, cy - r), (cx + r, cy)], fill=(214, 40, 40)); d.rectangle([cx - r * .75, cy, cx + r * .75, cy + r * .85], fill=(240, 215, 160))
        d.rectangle([cx - r * .2, cy + r * .3, cx + r * .2, cy + r * .85], fill=(120, 72, 38))
    elif kind == 'parcheggio':
        d.rounded_rectangle([cx - r * .85, cy - r * .85, cx + r * .85, cy + r * .85], r * .2, fill=(40, 100, 220))
        f = ImageFont.truetype(FONT, int(r * 1.5)); d.text((cx, cy + r * .05), 'P', font=f, fill=(255, 255, 255), anchor='mm')
    elif kind == 'carrello':
        d.polygon([(cx - r, cy - r * .6), (cx + r, cy - r * .6), (cx + r * .7, cy + r * .3), (cx - r * .6, cy + r * .3)], fill=col)
        for sx in (-.4, .5): d.ellipse([cx + sx * r - r * .2, cy + r * .45, cx + sx * r + r * .2, cy + r * .85], fill=(30, 30, 40))
    else:
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)

def sprite(i):
    x, y, w, h = BOX[i]; W, H = w * SC, h * SC; col = COL[i]
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    bx, by, bw, bh = W * .1, H * .08, W * .88, H * .9
    d.rounded_rectangle([bx, by, bx + bw, by + bh], bw * .13, fill=(24, 25, 32, 255))
    d.rounded_rectangle([bx + bw * .06, by + bh * .04, bx + bw * .94, by + bh * .96], bw * .11, fill=(251, 251, 253, 255))
    d.rounded_rectangle([bx + bw * .14, by + bh * .1, bx + bw * .86, by + bh * .26], bw * .06, fill=col + (255,))
    d.rounded_rectangle([bx + bw * .14, by + bh * .31, bx + bw * .86, by + bh * .76], bw * .08, fill=col + (45,))
    icon(d, specs[i][1], bx + bw / 2, by + bh * .535, min(bw * .26, bh * .17), col)
    d.rounded_rectangle([bx + bw * .14, by + bh * .81, bx + bw * .86, by + bh * .92], bw * .05, fill=(229, 72, 77, 255))
    rr = min(W, H) * .2
    d.ellipse([0, 0, rr * 2.2, rr * 2.2], fill=(255, 255, 255, 255)); d.ellipse([rr * .2, rr * .2, rr * 2, rr * 2], fill=col + (255,))
    f = ImageFont.truetype(FONT, int(rr * 1.4)); d.text((rr * 1.1, rr * 1.12), 'ABC'[i], font=f, fill=(255, 255, 255, 255), anchor='mm')
    return np.array(im)

def mat3(m): return np.vstack([m, [0, 0, 1]]).astype(np.float64)

cap = cv2.VideoCapture(src); fps = cap.get(cv2.CAP_PROP_FPS) or 24
frames = []
while True:
    ok, f = cap.read()
    if not ok: break
    frames.append(f)
H, W = frames[0].shape[:2]
gray = [cv2.GaussianBlur(cv2.cvtColor(f, cv2.COLOR_BGR2GRAY), (0, 0), 1.2).astype(np.float32) for f in frames]
rx, ry, rw, rh = REG
corners = np.array([[rx, ry, 1], [rx + rw, ry, 1], [rx + rw, ry + rh, 1], [rx, ry + rh, 1]], np.float64).T
C = [np.eye(3)]   # coordinate del primo fotogramma -> fotogramma i
crit = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-6)
for i in range(len(frames) - 1):
    q = (C[i] @ corners)[:2].T.astype(np.int32)
    mask = np.zeros((H, W), np.uint8); cv2.fillConvexPoly(mask, q, 255)
    Wm = np.eye(2, 3, dtype=np.float32)
    try:
        _, Wm = cv2.findTransformECC(gray[i], gray[i + 1], Wm, cv2.MOTION_AFFINE, crit, mask, 5)
    except cv2.error:
        pass   # se non converge si tiene lo spostamento nullo per quel passo
    C.append(mat3(Wm) @ C[i])
spr = [sprite(i) for i in range(3)]
p = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H}', '-r', str(fps), '-i', '-',
                      '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', out], stdin=subprocess.PIPE)
res = []
for fi, f in enumerate(frames):
    mask = np.zeros((H, W), np.uint8)
    for (x, y, w, h) in BOX:
        q = (C[fi] @ np.array([[x - 2, y - 2, 1], [x + w + 2, y - 2, 1], [x + w + 2, y + h + 2, 1], [x - 2, y + h + 2, 1]], np.float64).T)[:2].T.astype(np.int32)
        cv2.fillConvexPoly(mask, q, 255)
    out_f = cv2.inpaint(f, mask, 4, cv2.INPAINT_TELEA).astype(np.float32)
    for i, (x, y, w, h) in enumerate(BOX):
        T = np.array([[1 / SC, 0, x], [0, 1 / SC, y], [0, 0, 1]], np.float64)
        A = (C[fi] @ T)[:2]
        sp = cv2.warpAffine(spr[i], A, (W, H), flags=cv2.INTER_AREA | cv2.WARP_INVERSE_MAP if False else cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
        a = sp[..., 3:4].astype(np.float32) / 255.0
        out_f = out_f * (1 - a) + sp[..., [2, 1, 0]].astype(np.float32) * a
    g = np.clip(out_f, 0, 255).astype(np.uint8); res.append(g); p.stdin.write(g.tobytes())
p.stdin.close(); p.wait()
cv2.imwrite(poster, cv2.resize(res[len(res) // 2], (360, 640), interpolation=cv2.INTER_AREA), [cv2.IMWRITE_JPEG_QUALITY, 85])
print('fatto', out, len(res))
