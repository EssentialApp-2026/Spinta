#!/bin/bash
# Salva su main i file di questo lavoro anche se intanto altri lavori (in parallelo) hanno scritto: riprende main com'è adesso,
# ci rimette sopra i nostri file (e, se serve, installa le voci) e riprova finché il push riesce.
#   automatico/salva-git.sh "messaggio" percorso...
#   automatico/salva-git.sh "messaggio" --installa "2026-W44 2026-W45" [--parziale] percorso...
set -u
msg="$1"; shift
inst=""; parz=""
if [ "${1:-}" = "--installa" ]; then inst="$2"; shift 2; [ "${1:-}" = "--parziale" ] && { parz="--parziale"; shift; }; fi
tmp=$(mktemp -d)
for p in "$@"; do [ -e "$p" ] && cp -a --parents "$p" "$tmp"/; done
git config user.name "Spinta automatica"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
for i in 1 2 3 4 5 6; do
  git fetch -q origin main && git reset -q --hard origin/main
  cp -a "$tmp"/. ./
  # shellcheck disable=SC2086
  [ -n "$inst" ] && python3 automatico/voce_mako.py installa $inst $parz
  [ $# -gt 0 ] && git add -- "$@" 2>/dev/null
  [ -n "$inst" ] && git add libreria/voci
  git commit -q -m "$msg" || exit 0
  git push -q origin HEAD:main && exit 0
  sleep $((i * 7))
done
exit 1
