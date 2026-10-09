# Libreria di Gennarino

**Dal 9 ottobre 2026 Spinta usa il Gennarino realistico** (file `vero-*.mp4`, fatti con Kling dall'immagine `claude/kling/partenza_app.jpg`: Gennarino al mercato con i telefoni delle tre app sul banco). In `libreria.json` c'è `tutteLeFrasi: true`: ogni frase della puntata ha una clip, così non compare più il Gennarino disegnato. Le clip disegnate sono ancora qui e in `elementi_disegnati`.

Clip realistiche: `vero-saluto`, `vero-commenti`, `vero-idee`, `vero-telefono`, `vero-festa`, `vero-lavora`, `vero-pensa`, `vero-ascolta`, `vero-mammamia`, `vero-ciao`, `vero-triste` (5 s ciascuna). Le grezze di Kling sono in `claude/kling/`; `claude/kling/prepara.py` rimette fermi i telefoni (Kling storpia le scritte) e le converte.

Clip e immagini che il creatore video di Spinta usa come **scene in più** tra una battuta e l'altra di Gennarino.

- Formati: MP4 o WebM (meglio H.264, verticali 9:16, senza testi sopra) e immagini JPG, PNG o WebP.
- Il nome del file fa da etichetta: `gennarino-felice-festa.mp4` viene scelto per le frasi che contengono "felice" o "festa".
- Puoi caricarle da GitHub (Add file → Upload files dentro questa cartella) oppure mandarle a Claude, che le converte e aggiorna `libreria.json`.

Se la libreria è vuota, Gennarino viene disegnato direttamente da Spinta.

## Clip presenti

- `gennarino-saluta.mp4` — Gennarino saluta dalla bancarella, la camera si avvicina al sorriso (dalla Parte 1, senza scritte). Entra sulle frasi di saluto e presentazione.
- `gennarino-idea.mp4` — Gennarino col dito alzato: ha un'idea e fa scegliere (dalla Parte 2, senza scritte). Entra sulle frasi con app, idea, voti, commenti, «che dite».
- `gennarino-evviva.mp4` — festeggia a braccia alzate tra i coriandoli. Entra sulle frasi di festa: vinto, evviva, grazie, il regalo è pronto, gratis.
- `gennarino-lavora.mp4` — scrive al portatile e alla fine compare la spunta verde. Entra quando si mette al lavoro: subito, lavoro, costruisco, notte, sistemo.
- `gennarino-pensa.mp4` — mano sul mento, nuvoletta col punto di domanda, poi la lampadina. Entra sulle domande: pensate, secondo voi, come la volete.
- `gennarino-triste.mp4` — nuvoletta di pioggia sulla testa. Entra solo sulle frasi tristi, per esempio nella puntata senza voti.

- `gennarino-indica.mp4` — con gli occhioni indica giù, nei commenti, e scendono le lettere A, B e C. Entra sugli inviti a scrivere e votare nei commenti.
- `gennarino-meraviglia.mp4` — occhioni, mani sulle guance e brillantini. Entra su «ecco», «guardate», novità e sorprese.
- `gennarino-ascolta.mp4` — occhioni e mano all'orecchio mentre arrivano i commenti. Entra su «ditemi», «scrivetemi», «fatemi sapere».
- `gennarino-regalo.mp4` — il pacco sul banco si apre e ne esce il telefono con l'app. Entra su regalo, «sul banco», «link nel profilo», «la trovate».
- `gennarino-ciao.mp4` — saluto da vicino con gli occhioni e i cuoricini. Entra sui saluti di fine puntata: «ci vediamo», «alla prossima».

- `gennarino-telefono.mp4` — alza il telefono e fa vedere l'app con le spunte. Entra su telefono, schermo, mappa, tocchi.
- `gennarino-condividi.mp4` — dal telefono volano su carrello, messaggi, cuori e condividi. Entra su «mandatela», amici, gruppo, famiglia.
- `gennarino-piazza.mp4` — la bancarella arriva su ruote in una piazza nuova e cade la puntina. Entra su piazza, spostato, domenica.
- `gennarino-mammamia.mp4` — mani in testa, poi ride. Entra su «mamma mia», dimenticate, scordo, succede.
- `gennarino-differenziata.mp4` — tre bidoni sul banco e il calendario «stasera». Entra su munnezza, differenziata, bidone, umido.
- `gennarino-parcheggio.mp4` — la macchinina corre sul banco e si ferma sotto la puntina. Entra su macchina, parcheggiato, sosta.
- `gennarino-fontanella.mp4` — la fontanella con l'acqua che scorre e la mappa con le gocce. Entra su fontanella, acqua, sete, borraccia.
- `gennarino-orologio.mp4` — la sveglia che trema: le ultime ore. Entra su ore, ultime, stasera, mancano.
- `gennarino-conta.mp4` — i foglietti A, B e C volano nell'urna e il contatore gira. Entra su contato, risultato, chiuso, voti.
- `gennarino-officina.mp4` — il sabato in officina: chiave inglese, scintille, ingranaggi. Entra su officina, sabato, bulloni, lampadine.

Tutte tranne le prime due le ha disegnate Claude con lo stesso stile delle puntate (il generatore è in `claude/clip/`).
L'ordine in `libreria.json` conta: a parità di parole in comune vince la clip che viene prima.
