"""Voce di Gennarino GRATIS (niente Google, niente chiavi): registra le battute che mancano in un piano della settimana.

    python3 automatico/voci.py claude/settimana-2026-W45.json          # tutte le frasi senza voce
    python3 automatico/voci.py claude/settimana-2026-W45.json --prova  # 3 frasi in una cartella temporanea

    python3 automatico/voci.py claude/settimana-2026-W45.json --rifai  # rifà TUTTE le frasi della settimana (es. dopo aver cambiato accento)

Per ogni frase:
  1. due voci italiane open source la leggono in più versioni: Kokoro-82M «if_sara» (Apache-2.0) e Piper «paola» (MIT),
     con l'inflessione napoletana messa sui fonemi (napoletano(): «sc» davanti a consonante, «nd»/«mb» dopo n e m,
     vocali finali smorzate, cantilena a fine frase; livello in SPINTA_ACCENTO, predefinito 2);
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


# ---- inflessione napoletana (richiesta di Sam, 25 ottobre): si cambia la pronuncia, non le parole del copione ----
# livello 0 = italiano neutro; 1 = leggera (solo s davanti a consonante e fine frase); 2 = media; 3 = forte
ACCENTO = int(os.environ.get('SPINTA_ACCENTO', '2'))
VOCALI = 'aeiouɛɔəɪʊ'


def napoletano(ipa, livello=ACCENTO):
    """Pronuncia con l'inflessione napoletana, sui fonemi IPA che le voci leggono:
    - «s» davanti a consonante sorda → «sc» (ʃtasera, aʃpettate, ʃkrivete), davanti a sonora → ʒ (ʒmonta);
    - dopo n e m le consonanti sorde diventano sonore (tando, cambo, bangariello);
    - dal livello 2 le vocali finali senza accento si smorzano in «ə» (tranne la «a»; al livello 3 anche la «a»);
    - l'ultima vocale accentata della frase si allunga, come nella cantilena napoletana.
    Il livello 1 (solo «sc» e cantilena) si usa per i nomi delle idee, che devono capirsi bene."""
    if livello <= 0: return ipa
    t = re.sub(r's(?=[ˈˌ]?[tpkf])', 'ʃ', ipa)
    t = re.sub(r'z(?=[ˈˌ]?[bdɡgmnlrvɾ])', 'ʒ', t)
    if livello >= 2:
        t = re.sub(r'n([ˈˌ]?)tʃ', r'n\1dʒ', t)
        t = re.sub(r'n([ˈˌ]?)ts', r'n\1dz', t)
        t = re.sub(r'n([ˈˌ]?)t', r'n\1d', t)
        t = re.sub(r'm([ˈˌ]?)p', r'm\1b', t)
        t = re.sub(r'[nŋ]([ˈˌ]?)k', r'ŋ\1ɡ', t)
    pezzi = re.split(r'(\s+)', t)
    parole_i = [k for k, w in enumerate(pezzi) if w.strip()]
    for n, k in enumerate(parole_i):
        w = pezzi[k]; m = re.match(r'^(.*?)([,.;:!?…»"]*)$', w); corpo, punt = m.group(1), m.group(2)
        fine_frase = bool(punt) or n == len(parole_i) - 1
        if not corpo or 'ˈ' not in corpo: pezzi[k] = w; continue                  # parole senza accento (articoli, «di», «la»): restano
        accento = corpo.rfind('ˈ'); coda = corpo[accento + 1:]
        if not any(c in VOCALI for c in coda[1:]) and len([c for c in coda if c in VOCALI]) <= 1:
            pezzi[k] = w; continue                                               # tronche come «mercoledì», «guagliù», «blu»
        ultima = corpo[-1]
        dopo_vocale = len(corpo) > 1 and corpo[-2] in VOCALI                     # «nei», «mia»: dittonghi e iati restano
        riduci = livello >= 2 and not dopo_vocale and ultima in 'eioɪʊ' + ('a' if livello >= 3 else '')   # livello 1: niente vocali smorzate
        if riduci: corpo = corpo[:-1] + 'ə'
        if fine_frase:   # la vocale accentata dell'ultima parola si allunga, se la sillaba è aperta (sˈeːrə, ma ɡaribˈaldə)
            i = accento + 1
            while i < len(corpo) and corpo[i] not in VOCALI: i += 1
            j = i + 1; cons = 0
            while j < len(corpo) and corpo[j] not in VOCALI:
                if corpo[j] == 'ː': cons += 1
                elif corpo[j] not in 'ˈˌ': cons += 1
                j += 1
            if i < len(corpo) and cons <= 1 and (i + 1 >= len(corpo) or corpo[i + 1] != 'ː'): corpo = corpo[:i + 1] + 'ː' + corpo[i + 1:]
        pezzi[k] = corpo + punt
    return ''.join(pezzi)


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

    def sorgente(self, voce, testo, vel, accento=None):
        accento = ACCENTO if accento is None else accento
        if voce == 'sara':
            fon = napoletano(self.kokoro.tokenizer.phonemize(da_leggere(testo), 'it'), accento)
            s, sr = self.kokoro.create(fon, voice='if_sara', speed=vel, lang='it', is_phonemes=True)
        else:
            from piper import SynthesisConfig
            cfg = SynthesisConfig(length_scale=1 / vel); parti = []
            for frase in self.piper.phonemize(da_leggere(testo)):
                fon = [c for c in napoletano(''.join(frase), accento) if c in self.piper.config.phoneme_id_map]
                parti.append(np.asarray(self.piper.phoneme_ids_to_audio(self.piper.phonemes_to_ids(fon), cfg), np.float32))
            s = np.concatenate(parti); sr = self.piper.config.sample_rate
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

    def battuta(self, testo, nomi=()):
        """Prova le VERSIONI e restituisce (audio 16 kHz, punteggio 0-1, trascrizione, versione).
        I nomi delle idee («A: Cosa scade nel frigo.», «Ecco Innaffia le piante.») si devono capire bene: lì l'accento è leggero.
        Se una frase con l'accento pieno si capisce poco (Whisper sotto 0,6), si prova anche con l'accento più leggero e si tiene
        quella più chiara, ma l'accento pieno vince se si capisce quasi uguale."""
        acc = min(ACCENTO, 1) if (re.match(r'^[ABC]\s*:', testo) or any(vkey(n) in vkey(testo) for n in nomi if n)) else ACCENTO
        def prova(livello):
            m = None
            for v in VERSIONI:
                y = self.gennarino(self.sorgente(v[0], testo, v[1], livello), v[2])
                h = self.ascolta(y); s = somiglianza(testo, h)
                if m is None or s > m[1] + 1e-9: m = (y, s, h, v + (livello,))
                if s >= (0.999 if livello <= 0 else 0.9): break     # con l'accento Whisper (italiano neutro) capisce un po' meno: basta così
            return m
        migliore = prova(acc)
        if migliore[1] < 0.6 and acc > 1:
            altra = prova(acc - 1)
            if altra[1] > migliore[1] + 0.15: migliore = altra
        return migliore


def frasi_mancanti(piano, vj):
    """Le frasi del piano che non hanno ancora la voce IN QUESTA settimana: così ogni video usa una voce sola
    (Spinta prende la settimana che copre tutte le frasi del video, vedi crVociPick in crea.js)."""
    pronte = {vkey(x['testo']) for x in vj['settimane'].get(piano['settimana'], [])}
    out = []
    for p in piano.get('puntate', []):
        for r in p.get('copione', []):
            if vkey(r) not in pronte and vkey(r) not in {vkey(f) for f in out}: out.append(r)
    return out


def registra(piano_path, prova=False, rifai=False):
    """rifai=True: registra di nuovo TUTTE le frasi della settimana (per esempio dopo aver cambiato l'accento); i file nuovi
    prendono il posto dei vecchi solo alla fine, così se qualcosa va storto la settimana resta com'era."""
    import soundfile as sf
    piano = json.load(open(piano_path, encoding='utf-8')); sett = piano['settimana']
    vj_path = os.path.join(ROOT, 'libreria', 'voci', 'voci.json'); vj = json.load(open(vj_path, encoding='utf-8'))
    if rifai:
        frasi = []
        for p in piano.get('puntate', []):
            for r in p.get('copione', []):
                if vkey(r) not in {vkey(f) for f in frasi}: frasi.append(r)
    else:
        frasi = frasi_mancanti(piano, vj)
    if prova: frasi = frasi[:3]
    if not frasi: print('tutte le frasi hanno già la voce'); return []
    print(len(frasi), 'frasi da registrare per', sett, '(accento napoletano livello', ACCENTO, ')', flush=True)
    m = Motore()
    finale = os.path.join(ROOT, 'libreria', 'voci', sett)
    out_dir = tempfile.mkdtemp() if (prova or rifai) else finale
    os.makedirs(out_dir, exist_ok=True)
    lista = [] if rifai else vj['settimane'].setdefault(sett, [])
    usati = [int(os.path.basename(v['file'])[:2]) for v in lista if re.match(r'\d\d\.mp3$', os.path.basename(v['file']))]
    n = max(usati, default=0) + 1
    tmp = tempfile.mkdtemp(); rapporto = []
    nomi = list((piano.get('idee') or {}).values())
    for testo in frasi:
        t0 = time.time(); y, s, h, v = m.battuta(testo, nomi)
        w = os.path.join(tmp, 'v.wav'); sf.write(w, y, SR)
        nome = f'{n:02d}.mp3'; n += 1
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', w, '-af', EFFETTO, '-ar', '24000', '-ac', '1',
                        '-c:a', 'libmp3lame', '-b:a', '64k', os.path.join(out_dir, nome)], check=True)
        print(f'{nome} {len(y) / SR:.2f}s capito {s:.2f} {v[0]}{v[1]}k{v[2]} accento {v[3]} ({time.time() - t0:.0f}s) | {testo} | {h}', flush=True)
        rapporto.append({'file': nome, 'testo': testo, 'capito': round(s, 2), 'sentito': h})
        if not prova:
            f = f'voci/{sett}/{nome}'
            lista[:] = [x for x in lista if vkey(x['testo']) != vkey(testo)]
            lista.append({'testo': testo, 'file': f})
    shutil.rmtree(tmp, ignore_errors=True)
    if prova: print('prova in', out_dir); return rapporto
    if rifai:   # tutto registrato: la cartella nuova prende il posto della vecchia
        shutil.rmtree(finale, ignore_errors=True); shutil.move(out_dir, finale)
        vj['settimane'][sett] = lista
    vj.setdefault('accento', {})[sett] = ACCENTO
    lista.sort(key=lambda x: x['file'])
    vj['voce'] = ("Gennarino nuovo: W42-W43 Gemini TTS «Mako» con effetto robot; dalla W44 lo stesso timbro rifatto gratis da automatico/voci.py "
                  "(Kokoro/Piper italiano con la pronuncia napoletana sui fonemi + kNN-VC dalle battute Mako grezze, scelta della versione più chiara con Whisper); "
                  "«accento»: livello di inflessione napoletana di ogni settimana (0 neutro, 2 napoletana, 3 forte)")
    json.dump(vj, open(vj_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('media capito', round(float(np.mean([r['capito'] for r in rapporto])), 2))
    return rapporto


if __name__ == '__main__':
    registra(sys.argv[1], prova='--prova' in sys.argv, rifai='--rifai' in sys.argv)
