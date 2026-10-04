# Landing PRAUS — um único container serve o site estático E a API da waitlist.
# Assim o Caddy da plataforma só precisa terminar TLS e apontar para um alvo.

FROM node:22-alpine

# tini: PID 1 decente, para SIGTERM chegar ao Node e o encerramento ser limpo
RUN apk add --no-cache tini

WORKDIR /app

# dependências primeiro — camada reaproveitada quando só o conteúdo muda
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm ci --omit=dev --no-audit --no-fund

# código da API
COPY server/src ./server/src

# estáticos numa pasta isolada: o processo nunca enxerga server/.env
COPY index.html termos.html regras.html privacidade.html styles.css script.js favicon.ico ./public/
COPY assets ./public/assets

ENV NODE_ENV=production \
    SITE_ROOT=/app/public \
    PORT=4100

# roda sem privilégio (imagem node já traz o usuário `node`)
RUN chown -R node:node /app
USER node

EXPOSE 4100

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4100)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server/src/index.js"]
