# Puntate scritte da Claude

Ogni lunedì Claude scrive qui le puntate della settimana di 'O Bancariello e il creatore video di Spinta le carica da solo
(pulsanti «📬 Puntate scritte da Claude» nella finestra Crea con Gennarino).

## Il formato della serie
- Il programma di Sam (dal 11 ottobre 2026): **domenica** la bancarella si sposta in una piazza nuova e Gennarino lancia le tre idee; **lunedì e martedì** promemoria; **mercoledì** si chiude il voto; **giovedì** il risultato; **venerdì** il regalo; **sabato** dietro le quinte in officina.
- La domenica Spinta usa già il file della settimana che comincia il lunedì dopo (`settimana-<settimana dopo>.json`): la puntata della domenica sta lì, con `giorno: "domenica"` e `data` (il giorno preciso, così non torna fuori la domenica dopo). `dal` del file è quella domenica.
- Ogni settimana Gennarino propone tre idee di app: A, B e C.
- Si vota scrivendo la lettera nei commenti, fino a mercoledì sera: si contano le lettere e decide quella con più voti.
- Il venerdì l'app più votata va sul banco, gratis per tutti, senza registrazione e senza pubblicità.
- Se non vota nessuno, quella settimana non esce nessuna app: il giovedì Gennarino fa una puntata in cui dice che gli dispiace e invita a votare la settimana dopo.
- Niente batteria e niente richieste di like: l'invito finale è a votare o a scrivere nei commenti.
- Gennarino parla italiano semplice con poche parole in napoletano (tipo «Uè guagliù»).

## `settimana.json`
- `settimana`, `dal`, `al`: la settimana (lunedì-domenica); `voto_fino_a` è il mercoledì, `regalo` il venerdì.
- `idee`: le tre idee `A`, `B`, `C`.
- `puntate`: ogni puntata ha `id`, `tipo` (presentazione, idee, risultato, regalo, risposta, libera), `giorno`, `titolo`, `copione` (5-9 frasi, la prima è l'hook); facoltativo `data` (AAAA-MM-GG) se vale solo quel giorno.
  Le puntate `risposta` solo con un commento vero che Sam ha mandato: campi `commento` (il testo) e `utente` (il nome, senza @); nel video compare la bolla del commento.
  Le puntate `risultato` e `regalo` ci sono per A, B e C, con `vince`: nell'app si sceglie chi ha vinto.
  C'è sempre anche una puntata `nessuno` (giovedì): si usa solo se nessuno ha votato, e Gennarino dice che gli dispiace ma questa settimana niente app.
  Nelle puntate `idee` le tre idee stanno su righe che iniziano con «A:», «B:», «C:» (così compare la scheda di voto).
- `storico.json` tiene idee, hook e parti già usate, per non ripetersi.

## Settimane preparate in anticipo
- Ogni settimana ha anche il suo file `settimana-<settimana>.json` (per esempio `settimana-2026-W42.json`), che Claude può scrivere in anticipo: Spinta usa da solo quello della settimana in corso (se manca, `settimana.json`). Il lunedì `settimana.json` diventa una copia di quello della settimana.
- Il lunedì, se il file della settimana c'è già: controllarlo con `python3 claude/controlla.py claude/settimana-<settimana>.json`, copiarlo anche in `settimana.json`, e avvisare Sam con le tre idee (niente da riscrivere). `storico.json` ha già la settimana.
- La pagina del bancariello ha la stessa cosa in `DATI.prossimo` (vedi sotto).
- Il promemoria del giovedì 15 ottobre (settimana 2026-W42) è già programmato: prima di programmarne un altro controllare con list_triggers.

Prima di pubblicare: `python3 claude/controlla.py`.

## La pagina del bancariello e il regalo del venerdì
La pagina della serie è https://essentialapp-2026.github.io/bancariello/ (repository EssentialApp-2026/bancariello, tutto in `index.html`, dati nel blocco `DATI`; il README spiega i campi).

**In anticipo**: `DATI.prossimo` = `{ dal, voto, diario }` con la settimana dopo; da `dal` (lunedì a mezzanotte) la pagina usa quel voto e aggiunge quelle righe al diario. Il lunedì Claude sposta `prossimo.voto` in `voto`, le righe del diario in `diario`, e svuota `prossimo`.

Le app regalo della settimana dopo si possono costruire prima, ma restano solo in locale (`claude/regali-pronti/`, esclusa da git) fino al giovedì; se la cartella non c'è più si ricostruisce solo quella vincente.

**Lunedì**, dopo le puntate:
- in `DATI.voto`: le tre idee nuove in `opzioni` (con voti a 0), `chiude` il mercoledì alle 23:59, `uscita` il venerdì alle 19:00, `conteggio` e `vince` vuoti; una riga nel `diario`;
- programma con send_later il promemoria del giovedì alle 9 (contare i voti, costruire l'app vincente e metterla sul banco).

**Giovedì**: se nessuno ha votato, niente app: sulla pagina `voto.vince` diventa `"nessuno"` (niente in `prodotti`) e una riga nel `diario`. Altrimenti, a voto chiuso (i voti li manda Sam dal conta-voti di Spinta con «Copia per Claude»), Claude costruisce l'app vincente e la mette in `regali/<nome>/` del repository bancariello (un file `index.html` con `manifest.webmanifest`, `sw.js` e icone, gratis, senza registrazione e senza pubblicità, dati solo sul telefono) e in `DATI.prodotti` con `esce` = `voto.uscita`: la pagina la mostra «In arrivo» e la apre da sola venerdì alle 19.

Le app regalo non vanno su nessun sito prima dell'uscita: si mettono nel repository bancariello solo il giovedì, e solo quella vincente.

Se il repository bancariello non fosse scrivibile (push rifiutato), Sam deve aggiungerlo all'app Claude su GitHub: https://github.com/apps/claude/installations/select_target

