"""La voce «Mako» di Gennarino (quella delle settimane W42-W43, fatta con Gemini), rifatta gratis con un modello che copia le voci.

    python3 automatico/voce_mako.py prova                 # prove: le battute del sabato W43 e della domenica W46 -> claude/voci/prove/
    python3 automatico/voce_mako.py claude/settimana-2026-W46.json --rifai   # tutte le battute di una settimana

Chatterbox Multilingual (Resemble AI, licenza MIT, italiano compreso) ascolta una decina di secondi delle battute Mako originali
(claude/voci/grezze/mako-w43s-*.wav: voce sintetica di Gemini, nessuna persona vera) e legge le frasi nuove con la stessa voce
e lo stesso tono vivace. Le battute che Mako aveva già detto (W42-W43) si prendono così come sono. Poi lo stesso effetto robot
delle W43. Gira su GitHub (serve Hugging Face per scaricare il modello).
"""
import os, sys, json, re, glob, subprocess, tempfile, time, shutil
import numpy as np

QUI = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(QUI)
sys.path.insert(0, QUI)
import voci as V

GREZZE = sorted(glob.glob(os.path.join(ROOT, 'claude', 'voci', 'grezze', 'mako-w43s-*.wav')))
PROVE = os.path.join(ROOT, 'claude', 'voci', 'prove')
SR_OUT = 24000


def riferimento(secondi=9.5):
    """Una decina di secondi di battute Mako originali, pulite, per far sentire al modello la voce da copiare."""
    import librosa, soundfile as sf
    pezzi, tot = [], 0.0
    for f in GREZZE:
        x, _ = librosa.load(f, sr=V.SR)
        for a, b in V.segmenti(x, th=0.02, minsil=0.3, minlen=1.2):
            pezzi += [x[max(0, a - 400):b + 400], np.zeros(int(0.25 * V.SR), np.float32)]; tot += (b - a) / V.SR + 0.3
            if tot >= secondi: break
        if tot >= secondi: break
    p = os.path.join(tempfile.mkdtemp(), 'mako-riferimento.wav')
    sf.write(p, np.concatenate(pezzi), V.SR)
    print('riferimento Mako:', round(tot, 1), 's da', os.path.basename(GREZZE[0]), flush=True)
    return p


class Clona:
    def __init__(self, vivacita=0.6, cfg=0.5):
        import torch
        torch.set_num_threads(max(1, os.cpu_count() or 1))
        from chatterbox.mtl_tts import ChatterboxMultilingualTTS
        t0 = time.time()
        self.m = ChatterboxMultilingualTTS.from_pretrained(device='cpu')
        self.rif = riferimento(); self.vivacita, self.cfg = vivacita, cfg
        self.m.prepare_conditionals(self.rif, exaggeration=vivacita)
        print('modello pronto in', round(time.time() - t0), 's', flush=True)

    def battuta(self, testo):
        import torch
        with torch.inference_mode():
            w = self.m.generate(V.da_leggere(testo), language_id='it', exaggeration=self.vivacita, cfg_weight=self.cfg)
        return w.squeeze(0).cpu().numpy().astype(np.float32), self.m.sr


def salva_mp3(y, sr, dest):
    import soundfile as sf
    w = tempfile.mktemp(suffix='.wav'); sf.write(w, y, sr)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', w, '-af', V.EFFETTO, '-ar', str(SR_OUT), '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '64k', dest], check=True)
    os.remove(w)


def unisci(files, dest, pausa=0.45):
    lista = tempfile.mktemp(suffix='.txt'); silenzio = tempfile.mktemp(suffix='.mp3')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-t', str(pausa), '-i', f'anullsrc=r={SR_OUT}:cl=mono', '-c:a', 'libmp3lame', '-b:a', '64k', silenzio], check=True)
    open(lista, 'w').write(''.join(f"file '{f}'\nfile '{silenzio}'\n" for f in files))
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lista, '-c:a', 'libmp3lame', '-b:a', '64k', '-ar', str(SR_OUT), dest], check=True)


def prova():
    os.makedirs(PROVE, exist_ok=True)
    sabato = json.load(open(os.path.join(ROOT, 'claude', 'settimana-2026-W43.json'), encoding='utf-8'))
    sab = next(p for p in sabato['puntate'] if p['id'] == 'smontaggio')['copione']
    dom = json.load(open(os.path.join(ROOT, 'claude', 'settimana-2026-W46.json'), encoding='utf-8'))['puntate'][0]['copione']
    for viv, cfg, nome in ((0.6, 0.5, 'vivace'), (0.85, 0.35, 'molto-vivace')):
        c = Clona(viv, cfg)
        for righe, cosa in ((sab, 'sabato-W43'), (dom, 'domenica-8-novembre')):
            tmp = tempfile.mkdtemp(); files = []
            for k, t in enumerate(righe):
                t0 = time.time(); y, sr = c.battuta(t); f = os.path.join(tmp, f'{k:02d}.mp3'); salva_mp3(y, sr, f); files.append(f)
                print(f'{nome} {cosa} {k:02d} {len(y) / sr:.1f}s ({time.time() - t0:.0f}s) | {t}', flush=True)
            unisci(files, os.path.join(PROVE, f'mako-gratis-{nome}-{cosa}.mp3'))
    print('prove in', PROVE, flush=True)


if __name__ == '__main__':
    if sys.argv[1:2] == ['prova']: prova()
    else: raise SystemExit('per ora solo: python3 automatico/voce_mako.py prova')
