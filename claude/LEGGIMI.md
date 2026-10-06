# Puntate scritte da Claude

Ogni lunedì Claude scrive qui le puntate della settimana di 'O Bancariello e il creatore video di Spinta le carica da solo
(pulsanti «📬 Puntate scritte da Claude» nella finestra Crea con Gennarino).

## Il formato della serie
- Ogni settimana Gennarino propone tre idee di app: A, B e C.
- Si vota scrivendo la lettera nei commenti, fino a mercoledì sera.
- Il venerdì l'app più votata va sul banco, gratis per tutti, senza registrazione e senza pubblicità.
- Niente batteria e niente richieste di like: l'invito finale è a votare o a scrivere nei commenti.
- Gennarino parla italiano semplice con poche parole in napoletano (tipo «Uè guagliù»).

## `settimana.json`
- `settimana`, `dal`, `al`: la settimana (lunedì-domenica); `voto_fino_a` è il mercoledì, `regalo` il venerdì.
- `idee`: le tre idee `A`, `B`, `C`.
- `puntate`: ogni puntata ha `id`, `tipo` (presentazione, idee, risultato, regalo, risposta, libera), `giorno`, `titolo`, `copione` (5-9 frasi, la prima è l'hook).
  Le puntate `risposta` solo con un commento vero che Sam ha mandato: campi `commento` (il testo) e `utente` (il nome, senza @); nel video compare la bolla del commento.
  Le puntate `risultato` e `regalo` ci sono per A, B e C, con `vince`: nell'app si sceglie chi ha vinto.
  Nelle puntate `idee` le tre idee stanno su righe che iniziano con «A:», «B:», «C:» (così compare la scheda di voto).
- `storico.json` tiene idee, hook e parti già usate, per non ripetersi.

Prima di pubblicare: `python3 claude/controlla.py`.

## La pagina del bancariello e il regalo del venerdì
La pagina della serie è https://essentialapp-2026.github.io/bancariello/ (repository EssentialApp-2026/bancariello, tutto in `index.html`, dati nel blocco `DATI`; il README spiega i campi).

**Lunedì**, dopo le puntate:
- in `DATI.voto`: le tre idee nuove in `opzioni` (con voti a 0), `chiude` il mercoledì alle 23:59, `uscita` il venerdì alle 19:00, `conteggio` e `vince` vuoti; una riga nel `diario`;
- programma con send_later il promemoria del giovedì alle 9 (contare i voti, costruire l'app vincente e metterla sul banco).

**Giovedì**: a voto chiuso (i voti li manda Sam dal conta-voti di Spinta con «Copia per Claude»), l'app vincente va in `regali/<nome>/` del repository bancariello (un file `index.html` con `manifest.webmanifest`, `sw.js` e icone, gratis, senza registrazione e senza pubblicità, dati solo sul telefono) e in `DATI.prodotti` con `esce` = `voto.uscita`: la pagina la mostra «In arrivo» e la apre da sola venerdì alle 19.

`regali-pronti/` tiene le app già costruite, pronte da mettere sul banco (questa settimana tutte e tre: A `dividi-cunto`, B `timer-moka`, C `lista-spesa`); un'idea che non vince può tornare al voto più avanti.

Finché il repository bancariello non è scrivibile da Claude (push rifiutato: Sam deve aggiungerlo all'app Claude su GitHub), la pagina aggiornata aspetta nel ramo `bancariello-in-attesa` di questo repository e il regalo si apre da qui: `https://essentialapp-2026.github.io/Spinta/claude/regali-pronti/<nome>/`.

