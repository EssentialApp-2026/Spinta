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
- `puntate`: ogni puntata ha `id`, `tipo` (presentazione, idee, risultato, regalo, libera), `giorno`, `titolo`, `copione` (5-9 frasi, la prima è l'hook).
  Le puntate `risultato` e `regalo` ci sono per A, B e C, con `vince`: nell'app si sceglie chi ha vinto.
  Nelle puntate `idee` le tre idee stanno su righe che iniziano con «A:», «B:», «C:» (così compare la scheda di voto).
- `storico.json` tiene idee, hook e parti già usate, per non ripetersi.

Prima di pubblicare: `python3 claude/controlla.py`.
