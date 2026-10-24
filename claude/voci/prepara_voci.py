"""Divide un audio Mako (blocco di frasi separate da <long pause>) in una battuta per frase.
Uso: python3 prepara_voci.py settimana primo_numero grezzo.wav "frase 1" "frase 2" ...
Scrive libreria/voci/<settimana>/NN.mp3 (MP3 24 kHz mono, leggero effetto robot) e aggiorna libreria/voci/voci.json.
Se il numero di pezzi trovati non è uguale al numero di frasi, si ferma senza scrivere nulla."""
import sys, os, json, subprocess, tempfile
import numpy as np, scipy.io.wavfile as wav

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sett, primo, src, frasi = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4:]
tmp = tempfile.mkdtemp()
w = os.path.join(tmp, 'in.wav')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-ac', '1', '-ar', '24000', w], check=True)
sr, x = wav.read(w); x = x.astype(np.float32) / 32768

def pezzi(th, minsil):
    fr = int(sr * 0.02); e = np.array([np.abs(x[i:i + fr]).max() for i in range(0, len(x) - fr, fr)])
    on = e > th; out = []; s = None; sil = 0
    for i, v in enumerate(on):
        if v:
            if s is None: s = i
            sil = 0
        elif s is not None:
            sil += 1
            if sil * 0.02 >= minsil: out.append((s, i - sil + 1)); s = None; sil = 0
    if s is not None: out.append((s, len(on)))
    return [(a * 0.02, b * 0.02) for a, b in out if (b - a) * 0.02 > 0.25]

trovati = None
for minsil in (0.7, 0.6, 0.8, 0.5, 0.9, 1.0, 0.45):
    for th in (0.02, 0.015, 0.03, 0.01):
        p = pezzi(th, minsil)
        if len(p) == len(frasi): trovati = p; break
    if trovati: break
if not trovati:
    print('ERRORE: pezzi trovati', len(pezzi(0.02, 0.7)), 'frasi', len(frasi)); sys.exit(1)

d = os.path.join(ROOT, 'libreria', 'voci', sett); os.makedirs(d, exist_ok=True)
vj_path = os.path.join(ROOT, 'libreria', 'voci', 'voci.json'); vj = json.load(open(vj_path, encoding='utf-8'))
lista = vj['settimane'].setdefault(sett, [])
fx = 'highpass=f=90,equalizer=f=3200:t=q:w=1.2:g=4,aecho=0.8:0.5:7:0.18,lowpass=f=10000,loudnorm=I=-16:TP=-1.5'
for k, ((a, b), testo) in enumerate(zip(trovati, frasi)):
    n = primo + k; nome = f'{n:02d}.mp3'
    a = max(0, a - 0.06); b = min(len(x) / sr, b + 0.12)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{a:.3f}', '-to', f'{b:.3f}', '-i', w, '-af', fx,
                    '-ar', '24000', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '64k', os.path.join(d, nome)], check=True)
    f = f'voci/{sett}/{nome}'
    lista[:] = [v for v in lista if v['file'] != f and v['testo'] != testo]
    lista.append({'testo': testo, 'file': f})
    print(nome, f'{b - a:.2f}s', testo)
lista.sort(key=lambda v: v['file'])
json.dump(vj, open(vj_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
