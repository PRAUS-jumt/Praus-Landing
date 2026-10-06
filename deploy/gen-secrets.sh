#!/usr/bin/env bash
# Gera o .env da landing NO SERVIDOR — segredos fortes, nunca no repositório.
# Mesmo princípio do infra/scripts/gen-secrets.sh da plataforma.
#
# Uso:  ./deploy/gen-secrets.sh
#
# As chaves de terceiro (Resend) ficam VAZIAS de propósito: quem as tem é você.
# Preencha depois com  nano .env
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$RAIZ/.env"

if [ -f "$OUT" ]; then
  echo "!! $OUT já existe. Apague ou renomeie antes de gerar de novo."
  echo "   (regerar trocaria a senha do banco e o container perderia acesso"
  echo "    ao volume existente)"
  exit 1
fi

sen() { openssl rand -hex 32; }

cat > "$OUT" <<EOF
# Gerado por deploy/gen-secrets.sh em $(date -Iseconds)
# NUNCA comitar este arquivo.

COMPOSE_PROJECT_NAME=praus-landing

# Rede do Caddy da plataforma (confira com: docker network ls | grep praus)
PLATAFORMA_NETWORK=praus-homolog_default

# --- Banco (isolado da plataforma) ---
POSTGRES_USER=praus_landing
POSTGRES_PASSWORD=$(sen)
POSTGRES_DB=praus_landing

# --- Notificação de nova inscrição ---
# Sem domínio verificado no Resend, MAIL_FROM só pode ser onboarding@resend.dev
# e a entrega fica restrita ao e-mail dono da conta Resend.
RESEND_API_KEY=
# as aspas são obrigatórias: < e > são redirecionamento quando o deploy.sh
# faz `source` deste arquivo
MAIL_FROM="PRAUS <onboarding@resend.dev>"
MAIL_TO=jumtcompetition@gmail.com

# --- Exportação dos e-mails (header x-export-token) ---
EXPORT_TOKEN=$(sen)

# --- Vagas do beta ---
WAITLIST_LIMIT=1200
RATE_LIMIT=12
EOF

chmod 600 "$OUT"
echo "criado: $OUT (chmod 600)"
echo
echo "FALTA PREENCHER:  RESEND_API_KEY"
echo "  nano $OUT"
echo
echo "Guarde uma cópia deste arquivo no seu cofre de senhas — a senha do"
echo "Postgres não é recuperável e o volume depende dela."
