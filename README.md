# PRAUS — Landing de captação de beta

Landing page de pré-launch da **PRAUS**, infraestrutura de *skill-based matchmaking* para o gaming brasileiro. O jogador escolhe o jogo, encontra rival do seu nível, disputa o pote e recebe no PIX — com KYC e escrow em cada partida.

Objetivo único da página: **entrada na waitlist do beta** (captura de e-mail).

## Stack

**Front:** HTML, CSS e JavaScript puros — sem build, sem framework. Fontes via
Google Fonts; clipe de campeonato via embed do YouTube.

**Back:** serviço Node/Express em `server/`, PostgreSQL para os e-mails da
waitlist e Resend para a notificação. Em produção o nginx serve os estáticos e
faz proxy de `/api` no mesmo domínio.

## Estrutura

```
praus-landing/
├── index.html        # estrutura e conteúdo
├── styles.css        # design system (cores, tipografia, layout, animações)
├── script.js         # waitlist, stepper, abas do ranking, reveals no scroll
├── favicon.ico
├── assets/
│   ├── brand/        # marca (cavalo) derivada + favicons
│   ├── video/        # vídeos de fundo do herói
│   └── games/        # capas dos jogos + logo mestre
├── tools/
│   └── gerar-marca.py    # regera assets/brand/ a partir do logo mestre
├── server/           # API da waitlist (ver server/README.md)
└── deploy/
    ├── nginx.conf
    └── praus-landing-api.service
```

## Seções

1. **Herói** — vídeo de fundo + headline + captura de e-mail
2. **Como funciona** — stepper interativo com prévia das telas (lobby → partida → PIX)
3. **Jogos** — CS2 e Dota 2 ativos; Valorant e Fortnite em breve
4. **Ranking** — leaderboard de jogadores e times *(dados ilustrativos até o beta)*
5. **Lances** — clipe de campeonato de Valorant
6. **Segurança** — KYC, escrow, parceiros
7. **CTA final** — `PRESS START. PLAY PRAUS.`
8. **FAQ**

## Rodar localmente

Página inteira, com a waitlist funcionando:

```bash
cd server
cp .env.example .env && npm install && npm run migrate
npm start          # terminal 1 — API na 4100
npm run dev:site   # terminal 2 — landing na 8080, com proxy de /api
```

Só o visual, sem backend (os formulários vão falhar de propósito):

```bash
python -m http.server 8080
```

## Notas

- Identidade visual conforme o brand system v0.1 (dark, laranja-brasa, tipografia stencil).
- Wordmark = marca do cavalo + letreiro `PRAUS` em Anton, na nav e no rodapé.
  Os arquivos de `assets/brand/` são derivados de `assets/games/logoPraus.png`
  (mestre 500×500 RGBA) pelo script de geração — reexecute-o se o mestre mudar.
- Documentos legais (Termos/Regras/Privacidade) são tratados como minuta em consolidação.
- A waitlist grava no Postgres e notifica `MAIL_TO` por e-mail. O cadastro é
  gravado **antes** da notificação: se o Resend cair, o lead não se perde —
  fica com `notified_at NULL`. Detalhes em [`server/README.md`](server/README.md).
- A tabela de ranking usa **dados ilustrativos** e está rotulada como prévia.
  Trocar pelo ranking real quando o beta tiver partidas validadas.
