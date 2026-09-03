# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

HTML, CSS e JavaScript puros (sem build, sem framework) para o front. Fontes via Google Fonts; vídeo de fundo do herói e embed do YouTube para o clipe de campeonato. Back-end em Node/Express (`server/`), PostgreSQL para os e-mails da waitlist, Resend para notificação por e-mail. Em produção, nginx serve os estáticos e faz proxy de `/api` no mesmo domínio.

## Users

Dois públicos primários:
- **Jogadores competitivos** de CS2 e Dota2 (Valorant e Fortnite em breve) que querem disputar partidas por dinheiro contra rivais do seu próprio nível de habilidade, e chegam à landing para entrar na waitlist do beta.
- **Organizadores de comunidade** (donos de comunidades, streamers) que trariam grupos de jogadores para a plataforma.

## Product Purpose

PRAUS é uma infraestrutura de skill-based matchmaking para o gaming brasileiro: o jogador escolhe o jogo, encontra um rival do seu nível, disputa o pote e recebe via PIX. O objetivo único desta landing page é converter visitantes em cadastros na waitlist do beta (captura de e-mail).

## Positioning

O diferencial é a combinação de confiança e segurança financeira, matchmaking por habilidade e facilidade de saques/depósitos/resolução de disputas — não apenas o pareamento em si. Um concorrente não poderia copiar de verdade a combinação de: parear por skill real, movimentação de dinheiro simples e rápida (PIX), e um processo de disputa/saque/depósito confiável e sem fricção.

## Operating Context

Produto pré-lançamento (fase de captação de waitlist para o beta). Ranking exibido na landing é ilustrativo até o beta. Jogos ativos hoje: CS2 e Dota2; Valorant e Fortnite estão "em breve".

## Capabilities and Constraints

- **Não existe árbitro ao vivo** nas partidas — funcionalidade descartada. Todas as menções no site (`index.html`) e no `README.md` já foram removidas/reescritas; não reintroduzir em material futuro.
- Confiança/segurança é resolvida via KYC e escrow, não via arbitragem humana.
- Anticheat: o mecanismo real ainda não foi confirmado pelo usuário. O FAQ atual usa linguagem genérica ("comportamento suspeito é analisado antes do pagamento sair") para não inventar um método específico — perguntar ao usuário antes de detalhar mais.
- Sem alegações de clientes, números reais ou depoimentos — produto ainda não lançado.
- **Bônus de primeiro depósito:** deposite R$ 100,00 e receba 100% de bônus, válido só no primeiro depósito. **Confirmado pelo usuário em 2026-09-03, substituindo o valor de R$ 50,00 registrado em 2026-08-26.** A divergência foi pega por uma crítica de design: a página já dizia R$ 100,00 e este documento ainda dizia R$ 50,00. Implica que existe uma carteira/saldo na plataforma, não só entry fee por partida. Fora do site, ainda não documentado em nenhum outro material.
- **Programa de indicação:** usuário ganha recompensa por cada amigo indicado. Mecânica exata (valor, condições) ainda não definida — texto atual é propositalmente genérico.

## Evidence on Hand

- `README.md` do projeto descreve estrutura, stack e seções atuais da landing.
- Ranking/leaderboard existente no site: dados ilustrativos, não reais.
- Seção de segurança cobre KYC e escrow (Asaas para PIX/escrow, Idwall para KYC); a antiga terceira entrada de parceiro ("Árbitro PRAUS") foi removida.

## Product Principles

1. Confiança e segurança financeira vêm antes de qualquer apelo estético — é o que resolve a maior objeção do público (medo de calote/golpe em apostas peer-to-peer).
2. Matchmaking por skill real é a promessa central: a comunicação deve deixar claro que o jogador disputa contra alguém do seu nível, não contra qualquer um.
3. Fricção zero em dinheiro (PIX, saques, depósitos, disputas) é parte do produto, não um detalhe técnico — deve aparecer como benefício, não como rodapé.
4. Produto pré-lançamento: nunca fabricar prova social, números ou depoimentos que ainda não existem.
