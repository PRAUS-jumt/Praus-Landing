# PRAUS — Landing de captação de beta

Landing page de pré-launch da **PRAUS**, infraestrutura de *skill-based matchmaking* para o gaming brasileiro. O jogador escolhe o jogo, encontra rival do seu nível, disputa o pote e recebe no PIX — com KYC e escrow em cada partida.

Objetivo único da página: **entrada na waitlist do beta** (captura de e-mail).

## Stack

**Front:** HTML, CSS e JavaScript puros — sem build, sem framework. Fontes via
Google Fonts, vídeos originais na hero e prévias ilustrativas em HTML/CSS.

**Back:** serviço Node/Express em `server/`, PostgreSQL para os e-mails da
waitlist e Resend para a notificação. Em produção o nginx serve os estáticos e
faz proxy de `/api` no mesmo domínio.

## Estrutura

```
praus-landing/
├── index.html        # estrutura e conteúdo
├── styles.css        # design system (cores, tipografia, layout, animações)
├── script.js         # waitlist, vídeos, etapas, lobby e menu mobile
├── termos.html       # minuta dos termos de uso
├── regras.html       # minuta das regras da plataforma
├── privacidade.html  # minuta da política de privacidade
├── favicon.ico
├── assets/
│   ├── brand/        # logo do handoff da plataforma + favicons
│   ├── video/        # clipes originais da hero + teaser legado
│   └── games/        # capas dos jogos + logo mestre
├── tools/
│   └── gerar-marca.py    # regera assets/brand/ a partir do logo mestre
├── server/           # API da waitlist (ver server/README.md)
└── deploy/
    ├── nginx.conf
    └── praus-landing-api.service
```

## Seções

1. **Herói** — vídeos originais, headline e captura de e-mail
2. **Vantagens** — habilidade, comunidade, bônus e PIX
3. **Como funciona** — etapas interativas com prévia das telas (lobby → partida → PIX)
4. **Jogos** — CS2 e Dota 2 previstos no beta; Valorant e Fortnite em breve
5. **Segurança** — KYC, conta-garantia, validação e saque
6. **FAQ** — perguntas sobre a proposta e o beta
7. **CTA final** — segunda captura de e-mail
8. **Rodapé** — links às minutas legais

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

- Identidade adaptada do handoff do painel: base escura `#14110F`, superfícies `#1B1714`,
  acento `#F4501E`, cabeçalho e CTA escuros. Space Grotesk nos títulos,
  Inter Tight no texto e Geist Mono nos rótulos.
- `assets/brand/praus-platform-logo.png` preserva o logo original da referência;
  o recorte para navegação e rodapé é feito em CSS. O gerador de marca legado
  continua disponível, mas não gera esse arquivo.
- Menu, etapas e seleções do lobby têm navegação por teclado. Conteúdo e FAQ
  permanecem legíveis sem JavaScript; os formulários precisam de JavaScript.
- Os dois clipes originais alternam sem som na hero. O controle permite pausar
  a reprodução; com movimento reduzido, ela aguarda uma ação do visitante.
- Documentos legais (Termos/Regras/Privacidade) são tratados como minuta em consolidação.
- A waitlist grava no Postgres e notifica `MAIL_TO` por e-mail. O cadastro é
  gravado **antes** da notificação: se o Resend cair, o lead não se perde —
  fica com `notified_at NULL`. Detalhes em [`server/README.md`](server/README.md).
- As telas e os prêmios da demonstração são **ilustrativos**; não representam
  taxas, resultados ou condições definitivas do beta.
