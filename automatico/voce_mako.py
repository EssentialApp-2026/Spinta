"""La voce «Mako» di Gennarino (quella vera delle settimane W42-W43, fatta con Gemini), rifatta GRATIS con un modello aperto che copia le voci.

    python3 automatico/voce_mako.py scegli                                    # sceglie i 10 secondi di Mako da far copiare -> claude/voci/mako-riferimento.wav
    python3 automatico/voce_mako.py settimana claude/settimana-2026-W44.json  # le battute della settimana -> claude/voci/prove/2026-W44/
    python3 automatico/voce_mako.py settimana claude/settimana-2026-W44.json --solo piazza-nuova    # solo le battute di quella puntata
    python3 automatico/voce_mako.py installa 2026-W44 [--parziale]            # le battute preparate vanno in libreria/voci (le usa Spinta)
    python3 automatico/voce_mako.py prova                                     # prove: sabato W43 e domenica W46 -> claude/voci/prove/

Come lavora (tutto gratis; gira su GitHub, perché il modello si scarica da Hugging Face):
  1. Chatterbox Multilingual (Resemble AI, licenza MIT, sa l'italiano) ascolta 10 secondi di Mako vera (claude/voci/grezze:
     voce sintetica di Gemini, nessuna persona vera) e legge le frasi nuove con quella voce e quel tono;
     «scegli» prova i pezzi di Mako grezza e tiene quello con cui la copia somiglia di più;
  2. per ogni frase fa più versioni: Whisper small (MIT) controlla che si capisca, due «impronte della voce» (CAM++ di WeSpeaker
     e ERes2Net di 3D-Speaker, Apache-2.0) misurano quanto somiglia alla Mako vera; si tiene la migliore;
  3. TUTTE le frasi con la copia, anche quelle che Mako aveva già detto: una voce sola (Sam, 25 ottobre: «il mix vecchio nuovo
     non mi piace»); con SPINTA_ORIGINALI=si quelle frasi si prenderebbero invece dagli originali W42-W43;
  4. lo stesso effetto robot delle W43 (voci.EFFETTO), MP3 24 kHz mono 64k.
Vivacità e cfg: SPINTA_VIVACITA e SPINTA_CFG (0,6 e 0,5 = «vivace»; 0,85 e 0,35 = «molto vivace»).
Pacchetti: torch==2.6.0 torchaudio==2.6.0 (CPU) chatterbox-tts==0.1.7 sherpa-onnx soundfile librosa
"""
import os, sys, json, re, glob, subprocess, tempfile, time, shutil
import numpy as np

QUI = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(QUI)
sys.path.insert(0, QUI)
import voci as V

CACHE = V.CACHE
GREZZE = sorted(glob.glob(os.path.join(ROOT, 'claude', 'voci', 'grezze', 'mako-*.wav')))
RIF = os.path.join(ROOT, 'claude', 'voci', 'mako-riferimento.wav')          # i 10 secondi scelti da «scegli»
RIF_INFO = os.path.join(ROOT, 'claude', 'voci', 'mako-riferimento.json')
PROVE = os.path.join(ROOT, 'claude', 'voci', 'prove')
LIB = os.path.join(ROOT, 'libreria', 'voci')
SETTIMANE_MAKO = ('2026-W42', '2026-W43')       # le battute dette dalla Mako vera
ORIGINALI = os.environ.get('SPINTA_ORIGINALI', 'no') == 'si'   # no: una voce sola, la copia anche dove c'è l'originale (scelta di Sam)
SR, SR_OUT = V.SR, 24000
VIVACITA = float(os.environ.get('SPINTA_VIVACITA') or 0.6)
CFG = float(os.environ.get('SPINTA_CFG') or 0.5)
IMPRONTE = {'campp': 'wespeaker_en_voxceleb_CAM++.onnx', 'eres2net': '3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx'}
URL_IMPRONTE = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-recongition-models/'
FRASI_PROVA = ['Venerdì la più votata è sul banco, gratis.', 'Uè guagliù, il bancariello si è spostato in Piazza Bellini!',
               'Domani piazza nuova e tre idee nuove da votare.']


def carica(f):
    """Qualsiasi file audio -> 16 kHz mono float32, come lo sentono Whisper e le impronte."""
    out = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(out, np.float32).copy()


def scrivi_wav(x, sr, p=None):
    import soundfile as sf
    p = p or tempfile.mktemp(suffix='.wav'); sf.write(p, x, sr); return p


def taglia(y, sr):
    """Via il silenzio prima e dopo la frase."""
    a = np.abs(y); idx = np.where(a > 0.02 * (a.max() + 1e-9))[0]
    return y[max(0, idx[0] - int(0.04 * sr)):min(len(y), idx[-1] + int(0.12 * sr))] if len(idx) else y


def salva_mp3(y, sr, dest):
    w = scrivi_wav(y, sr)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', w, '-af', V.EFFETTO, '-ar', str(SR_OUT), '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '64k', dest], check=True)
    os.remove(w)


def unisci(files, dest, pausa=0.45):
    lista = tempfile.mktemp(suffix='.txt'); silenzio = tempfile.mktemp(suffix='.mp3')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-t', str(pausa), '-i', f'anullsrc=r={SR_OUT}:cl=mono', '-c:a', 'libmp3lame', '-b:a', '64k', silenzio], check=True)
    open(lista, 'w').write(''.join(f"file '{f}'\nfile '{silenzio}'\n" for f in files))
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lista, '-c:a', 'libmp3lame', '-b:a', '64k', '-ar', str(SR_OUT), dest], check=True)


def battute_mako():
    """vkey del testo -> mp3 originale della Mako vera (W42-W43, con l'effetto robot)."""
    vj = json.load(open(os.path.join(LIB, 'voci.json'), encoding='utf-8')); out = {}
    for s in SETTIMANE_MAKO:
        for x in vj['settimane'].get(s, []): out.setdefault(V.vkey(x['testo']), os.path.join(ROOT, 'libreria', x['file']))
    return out


# ---------------------------------------------------------------- chi giudica: si capisce? somiglia alla Mako vera?
def scarica_giudice():
    d = os.path.join(CACHE, 'speaker'); os.makedirs(d, exist_ok=True)
    for n in IMPRONTE.values():
        p = os.path.join(d, n)
        if not (os.path.exists(p) and os.path.getsize(p) > 1e6):
            subprocess.run(['curl', '-sSL', '--retry', '3', '-m', '1800', '-o', p + '.part', URL_IMPRONTE + n], check=True); os.replace(p + '.part', p)
    w = 'sherpa-onnx-whisper-small'
    if not os.path.isdir(os.path.join(CACHE, w)):
        a = os.path.join(CACHE, w + '.tar.bz2')
        subprocess.run(['curl', '-sSL', '--retry', '3', '-m', '3600', '-o', a, V.ARCHIVI[w]], check=True)
        subprocess.run(['tar', 'xjf', a, '-C', CACHE], check=True); os.remove(a)


class Giudice:
    def __init__(self):
        scarica_giudice()
        import sherpa_onnx
        th = max(1, os.cpu_count() or 1); W = os.path.join(CACHE, 'sherpa-onnx-whisper-small')
        self.asr = sherpa_onnx.OfflineRecognizer.from_whisper(encoder=os.path.join(W, 'small-encoder.int8.onnx'), decoder=os.path.join(W, 'small-decoder.int8.onnx'),
                                                              tokens=os.path.join(W, 'small-tokens.txt'), language='it', task='transcribe', num_threads=th)
        self.ex = {k: sherpa_onnx.SpeakerEmbeddingExtractor(sherpa_onnx.SpeakerEmbeddingExtractorConfig(model=os.path.join(CACHE, 'speaker', n), num_threads=th))
                   for k, n in IMPRONTE.items()}
        vj = json.load(open(os.path.join(LIB, 'voci.json'), encoding='utf-8'))
        audio = [np.concatenate([np.concatenate([carica(os.path.join(ROOT, 'libreria', x['file'])), np.zeros(int(0.3 * SR), np.float32)])
                                 for x in vj['settimane'][s][:80]]) for s in SETTIMANE_MAKO]
        self.mako = {}
        for k in self.ex:
            m = np.mean([self.impronta(k, a) for a in audio], 0); self.mako[k] = m / np.linalg.norm(m)

    def impronta(self, k, x):
        e = self.ex[k]; s = e.create_stream(); s.accept_waveform(SR, x); s.input_finished()
        v = np.array(e.compute(s)); return v / (np.linalg.norm(v) + 1e-9)

    def ascolta(self, x):
        x = np.concatenate([np.zeros(8000, np.float32), x[:28 * SR], np.zeros(16000, np.float32)])
        s = self.asr.create_stream(); s.accept_waveform(SR, x); self.asr.decode_stream(s)
        return s.result.text.strip()

    def somiglia(self, x):
        return float(np.mean([self.impronta(k, x) @ self.mako[k] for k in self.ex]))

    def voto(self, x, testo):
        h = self.ascolta(x)
        return V.somiglianza(testo, h), self.somiglia(x), h


# ---------------------------------------------------------------- chi parla: la copia di Mako
def pezzi_di_mako(secondi=10.0, minimo=6.5):
    """Da ogni file di Mako grezza il primo pezzo di parlato naturale (pause comprese, nessuna parola tagliata) lungo 6,5-10 secondi."""
    import librosa
    out = []
    for f in GREZZE:
        x, _ = librosa.load(f, sr=SR_OUT); x16 = librosa.resample(x, orig_sr=SR_OUT, target_sr=SR)
        seg = [(a * SR_OUT // SR, b * SR_OUT // SR) for a, b in V.segmenti(x16, th=0.02, minsil=0.25, minlen=0.3)]
        for i in range(len(seg)):
            j = i
            while j + 1 < len(seg) and (seg[j + 1][1] - seg[i][0]) / SR_OUT <= secondi: j += 1
            if (seg[j][1] - seg[i][0]) / SR_OUT >= minimo:
                a, b = max(0, seg[i][0] - int(0.05 * SR_OUT)), min(len(x), seg[j][1] + int(0.1 * SR_OUT))
                out.append((f'{os.path.basename(f)[5:-4]}@{seg[i][0] / SR_OUT:.1f}s', x[a:b])); break
    return out


class Clona:
    def __init__(self, vivacita=VIVACITA, cfg=CFG, rif=None):
        import torch
        torch.set_num_threads(max(1, os.cpu_count() or 1)); self.torch = torch
        from chatterbox.mtl_tts import ChatterboxMultilingualTTS
        t0 = time.time()
        self.m = ChatterboxMultilingualTTS.from_pretrained(device='cpu')
        self.vivacita, self.cfg = vivacita, cfg
        if not rif and not os.path.exists(RIF):
            rif = scrivi_wav(pezzi_di_mako()[0][1], SR_OUT)
        self.usa(rif or RIF)
        print('modello pronto in', round(time.time() - t0), 's; vivacità', vivacita, 'cfg', cfg, flush=True)

    def usa(self, rif):
        self.m.prepare_conditionals(rif, exaggeration=self.vivacita)

    def battuta(self, testo, seme=0):
        self.torch.manual_seed(seme); np.random.seed(seme)
        with self.torch.inference_mode():
            w = self.m.generate(V.da_leggere(testo), language_id='it', exaggeration=self.vivacita, cfg_weight=self.cfg)
        return taglia(w.squeeze(0).cpu().numpy().astype(np.float32), self.m.sr), self.m.sr


def versione(c, g, testo, cartella, seme=0):
    """Una versione della frase, già con l'effetto robot: (file mp3, capito, somiglia, sentito, secondi)."""
    t0 = time.time(); y, sr = c.battuta(testo, seme)
    f = os.path.join(cartella, f'{V.vkey(testo)[:40].replace(" ", "-")}-{seme}.mp3'); salva_mp3(y, sr, f)
    capito, som, h = g.voto(carica(f), testo)
    return f, capito, som, h, round(time.time() - t0)


def migliore(c, g, testo, cartella, k=2, extra=2):
    """k versioni (e fino a «extra» in più se nessuna si capisce bene); vince chi si capisce e somiglia di più."""
    prove = []
    for seme in range(k + extra):
        if seme >= k and max(p[1] for p in prove) >= 0.7: break
        f, capito, som, h, s = versione(c, g, testo, cartella, seme)
        prove.append((f, capito, som, h, seme))
        print(f'   seme {seme}: capito {capito:.2f} somiglia {som:.3f} ({s}s) | {h}', flush=True)
    return max(prove, key=lambda p: min(p[1], 0.95) + p[2])


def scegli():
    """Prova i pezzi di Mako grezza come riferimento e tiene quello con cui la copia somiglia di più alla Mako vera."""
    pezzi = pezzi_di_mako(); print(len(pezzi), 'pezzi di Mako da provare', flush=True)
    g = Giudice(); tmp = tempfile.mkdtemp()
    c = Clona(rif=scrivi_wav(pezzi[0][1], SR_OUT, os.path.join(tmp, 'primo.wav')))
    voti = []
    for nome, x in pezzi:
        p = scrivi_wav(x, SR_OUT, os.path.join(tmp, re.sub(r'[^\w.@-]', '_', nome) + '.wav')); c.usa(p)
        _, capito, som, h, s = versione(c, g, FRASI_PROVA[0], tmp)
        voti.append({'pezzo': nome, 'file': p, 'secondi': round(len(x) / SR_OUT, 1), 'somiglia': [round(som, 3)], 'capito': [round(capito, 2)]})
        print(f'{nome:26s} somiglia {som:.3f} capito {capito:.2f} ({s}s) | {h}', flush=True)
    voto = lambda v: float(np.mean(v['somiglia'])) + 0.3 * min(float(np.mean(v['capito'])), 0.9)
    finalisti = sorted(voti, key=lambda v: -voto(v))[:3]
    for v in finalisti:
        c.usa(v['file'])
        for t in FRASI_PROVA[1:]:
            _, capito, som, h, s = versione(c, g, t, tmp); v['somiglia'].append(round(som, 3)); v['capito'].append(round(capito, 2))
            print(f'  finale {v["pezzo"]:26s} somiglia {som:.3f} capito {capito:.2f} ({s}s) | {h}', flush=True)
    vince = max(finalisti, key=voto)
    shutil.copy(vince['file'], RIF)
    json.dump({'pezzo': vince['pezzo'], 'secondi': vince['secondi'], 'somiglia': round(float(np.mean(vince['somiglia'])), 3),
               'capito': round(float(np.mean(vince['capito'])), 2), 'vivacita': VIVACITA, 'cfg': CFG,
               'provati': [{k: v[k] for k in ('pezzo', 'secondi', 'somiglia', 'capito')} for v in voti]},
              open(RIF_INFO, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('riferimento scelto:', vince['pezzo'], 'somiglia', round(float(np.mean(vince['somiglia'])), 3), flush=True)


def rif_nome():
    try: return json.load(open(RIF_INFO, encoding='utf-8'))['pezzo']
    except Exception: return 'primo pezzo'


# ---------------------------------------------------------------- le battute di una settimana
def settimana(piano_path, solo=(), k=2):
    """Prepara in claude/voci/prove/<settimana>/ le battute che mancano (si può riprendere: quelle già fatte restano)."""
    piano = json.load(open(piano_path, encoding='utf-8')); sett = piano['settimana']
    dest = os.path.join(PROVE, sett); os.makedirs(dest, exist_ok=True); sp = os.path.join(dest, 'voci.json')
    stato = json.load(open(sp, encoding='utf-8')) if os.path.exists(sp) else {}
    impostazioni = {'vivacita': VIVACITA, 'cfg': CFG, 'riferimento': rif_nome()}
    if any(stato.get(x) != v for x, v in impostazioni.items()):       # cambiate le impostazioni: si ricomincia
        for f in glob.glob(os.path.join(dest, 'm*.mp3')): os.remove(f)
        stato = {}
    stato.update(settimana=sett, **impostazioni); stato.setdefault('battute', [])
    # i numeri dei file non si riusano mai (un telefono potrebbe avere in memoria la voce vecchia con lo stesso nome)
    numero = lambda f: int(m.group(1)) if (m := re.match(r'm(\d+)\.mp3$', os.path.basename(f))) else 0
    gia = os.listdir(os.path.join(LIB, sett)) if os.path.isdir(os.path.join(LIB, sett)) else []
    n = max([numero(b['file']) for b in stato['battute']] + [numero(f) for f in gia] + [stato.get('ultimo', 0)]) + 1
    if not ORIGINALI:     # una voce sola: le battute prese dagli originali si rifanno con la copia
        for b in [b for b in stato['battute'] if b['fonte'] != 'copia']:
            try: os.remove(os.path.join(dest, b['file']))
            except FileNotFoundError: pass
        stato['battute'] = [b for b in stato['battute'] if b['fonte'] == 'copia']
    fatte = {V.vkey(b['testo']) for b in stato['battute']}
    righe = []
    for p in piano.get('puntate', []):
        if solo and p['id'] not in solo: continue
        for r in p.get('copione', []):
            if V.vkey(r) not in fatte and V.vkey(r) not in {V.vkey(x) for x in righe}: righe.append(r)
    print(sett, len(righe), 'battute da fare', f'(riferimento {rif_nome()}, vivacità {VIVACITA}, cfg {CFG})', flush=True)
    mako = battute_mako() if ORIGINALI else {}; c = g = None; tmp = tempfile.mkdtemp()
    for testo in righe:
        nome = f'm{n:02d}.mp3'; stato['ultimo'] = n; n += 1
        if V.vkey(testo) in mako:
            shutil.copy(mako[V.vkey(testo)], os.path.join(dest, nome))
            b = {'file': nome, 'testo': testo, 'fonte': 'mako-originale'}
            print(nome, 'Mako originale |', testo, flush=True)
        else:
            c = c or Clona(); g = g or Giudice()
            print(nome, '|', testo, flush=True)
            f, capito, som, h, seme = migliore(c, g, testo, tmp, k)
            shutil.copy(f, os.path.join(dest, nome))
            b = {'file': nome, 'testo': testo, 'fonte': 'copia', 'capito': round(capito, 2), 'somiglia': round(som, 3), 'sentito': h, 'seme': seme}
        stato['battute'].append(b)
        json.dump(stato, open(sp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)     # salvato dopo ogni frase
    copie = [b for b in stato['battute'] if b['fonte'] == 'copia']
    if copie: print(f'{sett}: {len(stato["battute"])} battute, copie: capito {np.mean([b["capito"] for b in copie]):.2f}, somiglia {np.mean([b["somiglia"] for b in copie]):.3f}', flush=True)
    shutil.rmtree(tmp, ignore_errors=True)
    return stato


def installa(sett, parziale=False):
    """Le battute preparate in claude/voci/prove/<sett> prendono il posto delle stesse frasi in libreria/voci/<sett>.
    File con nomi nuovi (mNN.mp3), così nessun telefono si tiene in memoria la voce vecchia.
    Senza «parziale» lo fa solo se sono pronte tutte le frasi del piano (sennò nello stesso video si sentirebbero due voci)."""
    da = os.path.join(PROVE, sett); sp = os.path.join(da, 'voci.json')
    if not os.path.exists(sp): print(sett, ': nessuna battuta preparata', flush=True); return False
    stato = json.load(open(sp, encoding='utf-8'))
    piano = os.path.join(ROOT, 'claude', f'settimana-{sett}.json')
    if not parziale and os.path.exists(piano):
        p = json.load(open(piano, encoding='utf-8'))
        mancano = {V.vkey(r) for q in p.get('puntate', []) for r in q.get('copione', [])} - {V.vkey(b['testo']) for b in stato['battute']}
        if mancano: print(sett, f': mancano ancora {len(mancano)} battute, non la installo', flush=True); return False
    vj_path = os.path.join(LIB, 'voci.json'); vj = json.load(open(vj_path, encoding='utf-8'))
    finale = os.path.join(LIB, sett); os.makedirs(finale, exist_ok=True)
    nuove = {V.vkey(b['testo']): b for b in stato['battute']}
    lista = [x for x in vj['settimane'].get(sett, []) if V.vkey(x['testo']) not in nuove]
    for b in stato['battute']:
        shutil.copy(os.path.join(da, b['file']), os.path.join(finale, b['file'])); lista.append({'testo': b['testo'], 'file': f'voci/{sett}/{b["file"]}'})
    usati = {os.path.basename(x['file']) for x in lista}
    for f in os.listdir(finale):
        if f not in usati: os.remove(os.path.join(finale, f))
    vj['settimane'][sett] = sorted(lista, key=lambda x: x['file'])
    vj.setdefault('accento', {})[sett] = 0
    vj.setdefault('motore', {})[sett] = f'mako-copia (Chatterbox, vivacità {stato["vivacita"]}, cfg {stato["cfg"]})' if len(nuove) == len(lista) else 'misto'
    vj['voce'] = ("Gennarino: la voce «Mako» (W42-W43 Gemini TTS, effetto robot). Dalla W44 tutte le frasi sono la copia gratis di automatico/voce_mako.py "
                  "(una voce sola, scelta di Sam; Chatterbox Multilingual dai 10 secondi di claude/voci/mako-riferimento.wav, "
                  "scelta della versione più chiara e più somigliante con Whisper e le impronte della voce); «motore»: come è fatta ogni settimana")
    json.dump(vj, open(vj_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(sett, 'installata:', len(nuove), 'battute nuove,', len(lista), 'in tutto', flush=True)
    return True


def prova():
    """Il sabato W43 (stesse frasi del video di Sam) e la domenica W46, nelle due vivacità, per sentirle."""
    os.makedirs(PROVE, exist_ok=True)
    w43 = json.load(open(os.path.join(ROOT, 'claude', 'settimana-2026-W43.json'), encoding='utf-8'))
    sab = next(p for p in w43['puntate'] if p['id'] == 'smontaggio')['copione']
    dom = json.load(open(os.path.join(ROOT, 'claude', 'settimana-2026-W46.json'), encoding='utf-8'))['puntate'][0]['copione']
    g = Giudice()
    for viv, cfg, nome in ((0.6, 0.5, 'vivace'), (0.85, 0.35, 'molto-vivace')):
        c = Clona(viv, cfg)
        for righe, cosa in ((sab, 'sabato-W43'), (dom, 'domenica-8-novembre')):
            tmp = tempfile.mkdtemp()
            files = [migliore(c, g, t, tmp)[0] for t in righe]
            unisci(files, os.path.join(PROVE, f'mako-gratis-{nome}-{cosa}.mp3'))
    print('prove in', PROVE, flush=True)


if __name__ == '__main__':
    a = sys.argv[1:]
    if a[:1] == ['scegli']: scegli()
    elif a[:1] == ['settimana'] and len(a) > 1:
        settimana(a[1], solo=tuple(a[a.index('--solo') + 1].split(',')) if '--solo' in a else ())
    elif a[:1] == ['installa'] and len(a) > 1:
        esiti = [installa(s, parziale='--parziale' in a) for s in a[1:] if not s.startswith('--')]
        if not all(esiti): sys.exit(1)       # una settimana non installata: chi chiama (settimana.py) usa la voce di riserva
    elif a[:1] == ['prova']: prova()
    else: raise SystemExit(__doc__)
