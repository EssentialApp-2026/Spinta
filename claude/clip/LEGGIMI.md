# Clip di Gennarino fatte da Claude

`clipgen.js` disegna le clip della libreria con lo stesso stile delle puntate: usa le funzioni di `crea.js` (sfondo, bancarella, Gennarino) e aggiunge pose, inquadrature ed effetti (coriandoli, portatile, nuvoletta, pioggia).

Come si rifanno: si apre Spinta in un browser senza finestra (Playwright), si carica il creatore (`creaApri()`), si aggiunge `clipgen.js`, si chiama `G.init()` e poi `G.frame(nome, secondi)` per ogni fotogramma (24 al secondo, 720x1280 in JPG). I fotogrammi diventano MP4 con ffmpeg (H.264, `-crf 19 -pix_fmt yuv420p -movflags +faststart`, senza audio) e vanno in `libreria/`, con poster 360x640 e una voce in `libreria.json`.

Scene: `festeggia` (6 s, nella libreria `gennarino-evviva`), `lavora` (6 s), `pensa` (6 s), `triste` (5 s), e con gli occhioni (`gOcchioni`: occhi grandi e lucidi con pupille e riflessi): `meraviglia` (5 s), `ascolta` (6 s), `indica` (5 s), `regalo` (6 s), `ciao` (5 s).
Inquadrature: `cyInsegna(z)` tiene l'insegna dove sta nelle puntate, così i sottotitoli restano sotto; in alto lasciare libere le zone dei bollini (y 106-242).
