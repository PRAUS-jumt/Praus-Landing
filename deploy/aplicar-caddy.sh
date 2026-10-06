#!/usr/bin/env bash
# Troca o Caddyfile da plataforma para colocar a landing no apex e mover o
# player-web para app.{$PRAUS_DOMAIN}.
#
# ESTE é o único passo que mexe no que já está no ar. Por isso ele:
#   - faz backup com timestamp antes de qualquer coisa;
#   - valida a configuração ANTES de aplicar;
#   - usa `reload` (não `restart`), que troca a config sem derrubar conexões;
#   - reverte sozinho se a validação falhar.
#
#   ./deploy/aplicar-caddy.sh            aplica
#   ./deploy/aplicar-caddy.sh --reverter volta o backup mais recente
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
INFRA="${PRAUS_INFRA:-/home/praus/praus/infra}"
ALVO="$INFRA/Caddyfile"
NOVO="$RAIZ/deploy/Caddyfile"
CADDY_CT="${CADDY_CONTAINER:-praus-homolog-caddy-1}"

[ -f "$ALVO" ] || { echo "!! não achei $ALVO"; exit 1; }

recarrega() {
  docker exec -w /etc/caddy "$CADDY_CT" caddy reload --config /etc/caddy/Caddyfile
}

if [ "${1:-}" = "--reverter" ]; then
  ULTIMO=$(ls -t "$ALVO".bak.* 2>/dev/null | head -1)
  [ -n "$ULTIMO" ] || { echo "!! nenhum backup encontrado"; exit 1; }
  cp "$ULTIMO" "$ALVO"
  recarrega && echo "revertido para $ULTIMO"
  exit 0
fi

BACKUP="$ALVO.bak.$(date +%Y%m%d-%H%M%S)"
cp "$ALVO" "$BACKUP"
echo "backup: $BACKUP"

echo "== diferença que será aplicada =="
diff -u "$ALVO" "$NOVO" || true
echo

cp "$NOVO" "$ALVO"

echo "== validando a nova configuração =="
if ! docker exec "$CADDY_CT" caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile; then
  echo "!! configuração inválida — revertendo"
  cp "$BACKUP" "$ALVO"
  exit 1
fi

echo "== recarregando (sem derrubar conexões) =="
if ! recarrega; then
  echo "!! reload falhou — revertendo"
  cp "$BACKUP" "$ALVO"
  recarrega || true
  exit 1
fi

echo
echo "aplicado. O Caddy vai emitir o certificado de app.<dominio> na primeira"
echo "visita (Let's Encrypt, alguns segundos)."
echo
echo "Confira:"
echo "  curl -sI https://\$PRAUS_DOMAIN        # deve servir a landing"
echo "  curl -sI https://app.\$PRAUS_DOMAIN    # deve servir o player"
echo
echo "Reverter:  ./deploy/aplicar-caddy.sh --reverter"
