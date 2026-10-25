"""Voce di Gennarino GRATIS (niente Google, niente chiavi): registra le battute che mancano in un piano della settimana.

    python3 automatico/voci.py claude/settimana-2026-W45.json          # tutte le frasi senza voce
    python3 automatico/voci.py claude/settimana-2026-W45.json --prova  # 3 frasi in una cartella temporanea

Per ogni frase:
  1. due voci italiane open source la leggono in più versioni: Kokoro-82M «if_sara» (Apache-2.0) e Piper «paola» (MIT);
  2. kNN-VC (MIT, WavLM-Large + HiFi-GAN) dà a ogni versione il timbro di Gennarino, preso dalle battute Mako
     grezze di claude/voci/grezze (W42-W43, circa 6 minuti);
  3. Whisper small (MIT, sherpa-onnx) riascolta ogni versione e si tiene quella che si capisce meglio;
  4. effetto robot delle battute W43 (presenza +6 dB a 3,5 kHz, eco 6 ms, passa-basso 9 kHz), -16,5 LUFS,
     MP3 24 kHz mono 64k -> libreria/voci/<settimana>/NN.mp3 e libreria/voci/voci.json.
Tutti i modelli si scaricano gratis da GitHub la prima volta (~2,3 GB) in $SPINTA_MODELLI (predefinito ~/.cache/spinta-modelli).
Pacchetti: torch torchaudio kokoro-onnx piper-tts sherpa-onnx soundfile librosa
"""
import os, sys, json, glob, re, subprocess, unicodedata, warnings, tempfile, shutil, difflib, time
warnings.filterwarnings('ignore')
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.environ.get('SPINTA_MODELLI', os.path.expanduser('~/.cache/spinta-modelli'))
GH = 'https://github.com'
FILE = {
    'kokoro-v1.0.onnx': f'{GH}/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx',
    'voices-v1.0.bin': f'{GH}/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin',
    'prematch_g_02500000.pt': f'{GH}/bshall/knn-vc/releases/download/v0.1/prematch_g_02500000.pt',
    'WavLM-Large.pt': f'{GH}/bshall/knn-vc/releases/download/v0.1/WavLM-Large.pt',
}
ARCHIVI = {  # cartella -> archivio .tar.bz2
    'vits-piper-it_IT-paola-medium': f'{GH}/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-it_IT-paola-medium.tar.bz2',
    'sherpa-onnx-whisper-small': f'{GH}/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-small.tar.bz2',
}
# versioni provate per ogni frase: (voce, velocità, vicini kNN)
VERSIONI = [('sara', 1.02, 4), ('sara', 0.95, 4), ('sara', 1.02, 8), ('paola', 1.0, 4), ('paola', 1.1, 4)]
EFFETTO = 'highpass=f=100,equalizer=f=3500:t=o:w=2:g=6,aecho=0.8:0.8:6:0.3,lowpass=f=9000,loudnorm=I=-16.5:TP=-1.5:LRA=11'
RIFERIMENTI = sorted(glob.glob(os.path.join(ROOT, 'claude', 'voci', 'grezze', 'mako-w4[23]*.wav')))
LETTERE = {'A': 'A', 'B': 'Bi', 'C': 'Ci'}
NUMERI = {'0': 'zero', '1': 'uno', '2': 'due', '3': 'tre', '4': 'quattro', '5': 'cinque', '6': 'sei', '7': 'sette', '8': 'otto', '9': 'nove', '10': 'dieci'}
SR = 16000


def vkey(t):  # stessa chiave di Spinta (crVKey) e di controlla.py
    return ' '.join(''.join(ch if ch.isalnum() else ' ' for ch in unicodedata.normalize('NFC', str(t).lower())).split())


def da_leggere(t):
    """Il testo del piano resta quello; qui si aggiusta solo la lettura (lettere A/B/C, «Uè»)."""
    t = re.sub(r'\b([ABC])\b', lambda m: LETTERE[m.group(1)], t)
    return t.replace('Uè ', 'Uè, ').replace(',,', ',')


def parole(t):
    t = ''.join(c for c in unicodedata.normalize('NFD', str(t).lower()) if unicodedata.category(c) != 'Mn')
    t = re.sub(r'\b(bi|be)\b', 'b', re.sub(r'\b(ci)\b', 'c', t))
    return [NUMERI.get(w, w) for w in re.sub(r'[^\w\s]', ' ', t).split()]


def somiglianza(a, b):
    return difflib.SequenceMatcher(None, parole(a), parole(b)).ratio()


def scarica():
    os.makedirs(CACHE, exist_ok=True)
    for n, u in FILE.items():
        p = os.path.join(CACHE, n)
        if not os.path.exists(p) or os.path.getsize(p) < 1000:
            print('scarico', n, flush=True); subprocess.run(['curl', '-sSL', '--retry', '3', '-m', '3600', '-o', p, u], check=True)
    for d, u in ARCHIVI.items():
        if not os.path.isdir(os.path.join(CACHE, d)):
            print('scarico', d, flush=True)
            a = os.path.join(CACHE, d + '.tar.bz2')
            subprocess.run(['curl', '-sSL', '--retry', '3', '-m', '3600', '-o', a, u], check=True)
            subprocess.run(['tar', 'xjf', a, '-C', CACHE], check=True); os.remove(a)
    if not os.path.exists(os.path.join(CACHE, 'knn-vc', 'hubconf.py')):
        subprocess.run(['git', 'clone', '-q', '--depth', '1', f'{GH}/bshall/knn-vc.git', os.path.join(CACHE, 'knn-vc')], check=True)


def segmenti(x, th=0.02, minsil=0.3, minlen=0.4):
    fr = int(SR * 0.02); e = np.array([np.abs(x[i:i + fr]).max() for i in range(0, len(x) - fr, fr)])
    on = e > th; out = []; s = None; sil = 0
    for i, v in enumerate(on):
        if v:
            if s is None: s = i
            sil = 0
        elif s is not None:
            sil += 1
            if sil * 0.02 >= minsil: out.append((s, i - sil + 1)); s = None; sil = 0
    if s is not None: out.append((s, len(on)))
    return [(a * fr, b * fr) for a, b in out if (b - a) * 0.02 >= minlen]


class Motore:
    def __init__(self):
        scarica()
        import torch, librosa
        self.torch, self.librosa = torch, librosa
        sys.path.insert(0, os.path.join(CACHE, 'knn-vc'))
        orig = torch.hub.load_state_dict_from_url
        def carica(url, map_location=None, progress=True, **kw):
            n = url.rsplit('/', 1)[-1]
            return torch.load(os.path.join(CACHE, n), map_location=map_location, weights_only=False) if n in FILE else orig(url, map_location=map_location, progress=progress, **kw)
        torch.hub.load_state_dict_from_url = carica
        import hubconf
        torch.set_num_threads(max(1, os.cpu_count() or 1))
        self.vc = hubconf.knn_vc(pretrained=True, progress=False, prematched=True, device='cpu')
        pezzi = []
        for f in RIFERIMENTI:
            x, _ = librosa.load(f, sr=SR)
            for a, b in segmenti(x): pezzi.append(torch.tensor(x[max(0, a - 800):b + 800], dtype=torch.float32)[None])
        with torch.inference_mode(): self.pool = self.vc.get_matching_set(pezzi, vad_trigger_level=0)
        print('timbro di Gennarino da', len(RIFERIMENTI), 'file,', round(sum(p.shape[-1] for p in pezzi) / SR / 60, 1), 'minuti', flush=True)
        from kokoro_onnx import Kokoro
        self.kokoro = Kokoro(os.path.join(CACHE, 'kokoro-v1.0.onnx'), os.path.join(CACHE, 'voices-v1.0.bin'))
        from piper import PiperVoice
        P = os.path.join(CACHE, 'vits-piper-it_IT-paola-medium')
        self.piper = PiperVoice.load(os.path.join(P, 'it_IT-paola-medium.onnx'), config_path=os.path.join(P, 'it_IT-paola-medium.onnx.json'))
        import sherpa_onnx
        W = os.path.join(CACHE, 'sherpa-onnx-whisper-small')
        self.asr = sherpa_onnx.OfflineRecognizer.from_whisper(encoder=os.path.join(W, 'small-encoder.int8.onnx'), decoder=os.path.join(W, 'small-decoder.int8.onnx'),
                                                              tokens=os.path.join(W, 'small-tokens.txt'), language='it', task='transcribe', num_threads=max(1, os.cpu_count() or 1))

    def sorgente(self, voce, testo, vel):
        if voce == 'sara':
            s, sr = self.kokoro.create(da_leggere(testo), voice='if_sara', speed=vel, lang='it')
        else:
            from piper import SynthesisConfig
            ch = list(self.piper.synthesize(da_leggere(testo), syn_config=SynthesisConfig(length_scale=1 / vel)))
            s = np.concatenate([c.audio_float_array for c in ch]); sr = ch[0].sample_rate
        x = self.librosa.resample(np.asarray(s, np.float32), orig_sr=sr, target_sr=SR)
        return np.concatenate([np.zeros(800, np.float32), x, np.zeros(800, np.float32)])

    def gennarino(self, x, k):
        torch = self.torch
        with torch.inference_mode():
            q = self.vc.get_features(torch.tensor(x)[None], vad_trigger_level=0)
            y = self.vc.match(q, self.pool, topk=k, tgt_loudness_db=None).cpu().numpy()
        a = np.abs(y); idx = np.where(a > 0.02 * a.max())[0]
        return y[max(0, idx[0] - int(0.04 * SR)):min(len(y), idx[-1] + int(0.10 * SR))] if len(idx) else y

    def ascolta(self, y):
        x = np.concatenate([np.zeros(8000, np.float32), y.astype(np.float32), np.zeros(16000, np.float32)])
        s = self.asr.create_stream(); s.accept_waveform(SR, x); self.asr.decode_stream(s)
        return s.result.text.strip()

    def battuta(self, testo):
        """Prova le VERSIONI e restituisce (audio 16 kHz, punteggio 0-1, trascrizione, versione)."""
        migliore = None
        for v in VERSIONI:
            y = self.gennarino(self.sorgente(v[0], testo, v[1]), v[2])
            h = self.ascolta(y); s = somiglianza(testo, h)
            if migliore is None or s > migliore[1] + 1e-9: migliore = (y, s, h, v)
            if s >= 0.999: break
        return migliore


def frasi_mancanti(piano, vj):
    pronte = {vkey(x['testo']) for a in vj['settimane'].values() for x in a}
    out = []
    for p in piano.get('puntate', []):
        for r in p.get('copione', []):
            if vkey(r) not in pronte and vkey(r) not in {vkey(f) for f in out}: out.append(r)
    return out


def registra(piano_path, prova=False):
    import soundfile as sf
    piano = json.load(open(piano_path, encoding='utf-8')); sett = piano['settimana']
    vj_path = os.path.join(ROOT, 'libreria', 'voci', 'voci.json'); vj = json.load(open(vj_path, encoding='utf-8'))
    frasi = frasi_mancanti(piano, vj)
    if prova: frasi = frasi[:3]
    if not frasi: print('tutte le frasi hanno già la voce'); return []
    print(len(frasi), 'frasi da registrare per', sett, flush=True)
    m = Motore()
    out_dir = tempfile.mkdtemp() if prova else os.path.join(ROOT, 'libreria', 'voci', sett)
    os.makedirs(out_dir, exist_ok=True)
    lista = vj['settimane'].setdefault(sett, [])
    usati = [int(os.path.basename(v['file'])[:2]) for v in lista if re.match(r'\d\d\.mp3$', os.path.basename(v['file']))]
    n = max(usati, default=0) + 1
    tmp = tempfile.mkdtemp(); rapporto = []
    for testo in frasi:
        t0 = time.time(); y, s, h, v = m.battuta(testo)
        w = os.path.join(tmp, 'v.wav'); sf.write(w, y, SR)
        nome = f'{n:02d}.mp3'; n += 1
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', w, '-af', EFFETTO, '-ar', '24000', '-ac', '1',
                        '-c:a', 'libmp3lame', '-b:a', '64k', os.path.join(out_dir, nome)], check=True)
        print(f'{nome} {len(y) / SR:.2f}s capito {s:.2f} {v[0]}{v[1]}k{v[2]} ({time.time() - t0:.0f}s) | {testo} | {h}', flush=True)
        rapporto.append({'file': nome, 'testo': testo, 'capito': round(s, 2), 'sentito': h})
        if not prova:
            f = f'voci/{sett}/{nome}'
            lista[:] = [x for x in lista if vkey(x['testo']) != vkey(testo)]
            lista.append({'testo': testo, 'file': f})
    shutil.rmtree(tmp, ignore_errors=True)
    if prova: print('prova in', out_dir); return rapporto
    lista.sort(key=lambda x: x['file'])
    vj['voce'] = "Gennarino nuovo: W42-W43 Gemini TTS «Mako» con effetto robot; dalla W44 lo stesso timbro rifatto gratis da automatico/voci.py (Kokoro/Piper italiano + kNN-VC dalle battute Mako grezze, scelta della versione più chiara con Whisper)"
    json.dump(vj, open(vj_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('media capito', round(float(np.mean([r['capito'] for r in rapporto])), 2))
    return rapporto


if __name__ == '__main__':
    registra(sys.argv[1], prova='--prova' in sys.argv)
