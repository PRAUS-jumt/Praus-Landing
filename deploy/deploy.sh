#!/usr/bin/env bash
# Deploy da landing PRAUS na VPS. Roda como `praus`, de dentro do clone.
#
#   ./deploy/deploy.sh
#
# NÃO toca na stack da plataforma: só constrói e sobe o compose da landing.
# A troca do Caddyfile é um passo separado e explícito (deploy/aplicar-caddy.sh),
# porque é o único momento que afeta o que já está no ar.
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
cd "$RAIZ"

[ -f .env ] || { echo "!! .env ausente. Rode ./deploy/gen-secrets.sh primeiro."; exit 1; }

# shellcheck disable=SC1091
set -a; . ./.env; set +a

REDE="${PLATAFORMA_NETWORK:-praus-homolog_default}"
if ! docker network inspect "$REDE" >/dev/null 2>&1; then
  echo "!! rede '$REDE' não existe. A stack da plataforma está no ar?"
  echo "   docker network ls | grep praus"
  exit 1
fi

if [ -z "${RESEND_API_KEY:-}" ]; then
  echo "!! aviso: RESEND_API_KEY vazia — inscrições serão GRAVADAS mas não"
  echo "   notificadas por e-mail (notified_at fica NULL para reenvio)."
  echo
fi

echo "== conferindo que o DNS do banco nao colide com a plataforma =="
if grep -qE '@postgres:5432' docker-compose.yml; then
  echo "!! docker-compose.yml aponta para 'postgres', nome que tambem existe na"
  echo "   rede da plataforma — o DNS resolveria para o banco errado."
  exit 1
fi

echo "== construindo imagem =="
docker compose --env-file .env build

echo "== subindo =="
docker compose --env-file .env up -d

echo "== aguardando health =="
for i in $(seq 1 40); do
  cid=$(docker compose --env-file .env ps -q landing)
  estado=$(docker inspect -f '{{.State.Health.Status}}' "$cid" 2>/dev/null || echo starting)
  [ "$estado" = "healthy" ] && { echo "landing saudável"; break; }
  [ "$i" = "40" ] && { echo "!! não ficou saudável em 80s. Logs:"; docker compose --env-file .env logs landing --tail 40; exit 1; }
  sleep 2
done

echo "== verificação interna (de dentro da rede) =="
docker compose --env-file .env exec -T landing node -e "
fetch('http://127.0.0.1:'+(process.env.PORT||4100)+'/api/waitlist/status')
  .then(r=>r.json()).then(d=>{console.log('status:',JSON.stringify(d));process.exit(0)})
  .catch(e=>{console.error(e.message);process.exit(1)})"

echo
echo "== o Caddy enxerga a landing? =="
if docker exec praus-homolog-caddy-1 wget -qO- --timeout=5 http://landing:4100/api/health 2>/dev/null; then
  echo "  ^ sim"
else
  echo "  !! o Caddy NÃO alcança 'landing:4100' — confira se ambos estão na rede $REDE"
fi

echo
echo "PRONTO. A landing responde na rede interna."
echo "Para colocá-la no domínio, rode: ./deploy/aplicar-caddy.sh"
