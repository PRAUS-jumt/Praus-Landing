import "dotenv/config";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import rateLimit from "express-rate-limit";
import { pool, migrate, insertSignup, marcarNotificado, contar, listarTodos, situacao } from "./db.js";
import { notificarInscricao, mailerConfigurado } from "./mailer.js";

const app = express();
const PORT = Number(process.env.PORT || 4100);
/* Teto de vagas do beta. 0 desliga o limite. */
const LIMITE = Number(process.env.WAITLIST_LIMIT ?? 1200);

/* Atrás do nginx o IP real vem no X-Forwarded-For. "1" = confia só no primeiro
   proxy — confiar em todos deixaria o rate limit burlável por header forjado. */
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(express.json({ limit: "8kb" }));

/* CORS só é necessário se a landing for servida de outra origem. Com o nginx
   fazendo proxy de /api no mesmo domínio (o arranjo recomendado), deixe
   CORS_ORIGIN vazio e nenhum header é emitido. */
const origensPermitidas = (process.env.CORS_ORIGIN || "")
  .split(",").map((s) => s.trim()).filter(Boolean);
app.use((req, res, next) => {
  const origem = req.headers.origin;
  if (origem && origensPermitidas.includes(origem)) {
    res.setHeader("Access-Control-Allow-Origin", origem);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

/* ---------------------------------------------------------------------------
   Link curto de parceiro: praus.online/p/<slug> redireciona para a landing
   com UTMs preenchidas — o cadastro sai vinculado ao parceiro nas colunas
   utm_* da waitlist. Slug inválido cai na home sem UTM.
   --------------------------------------------------------------------------- */
app.get("/p/:parceiro", (req, res) => {
  const slug = String(req.params.parceiro || "").toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{0,59}$/.test(slug)) return res.redirect(302, "/");
  const q = new URLSearchParams({ utm_source: slug, utm_medium: "parceiro", utm_campaign: "beta" });
  res.redirect(302, "/?" + q.toString() + "#waitlist");
});

/* ---------------------------------------------------------------------------
   Arquivos estáticos da landing.
   Este mesmo processo serve o site e a API: o container fica autossuficiente e
   o Caddy só precisa terminar TLS e fazer proxy para um alvo. Em produção o
   Dockerfile aponta SITE_ROOT para um diretório que contém SÓ os estáticos.
   --------------------------------------------------------------------------- */
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = path.resolve(process.env.SITE_ROOT || path.join(AQUI, "..", ".."));

/* Defesa em profundidade: mesmo que SITE_ROOT aponte para a raiz do repositório
   (é o caso em desenvolvimento), estes diretórios nunca podem ser servidos —
   server/ contém o .env com as chaves. */
const PROIBIDOS = /^\/(server|tools|deploy|node_modules)(\/|$)|(^|\/)\.[^/]/i;
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  if (PROIBIDOS.test(decodeURIComponent(req.path))) return res.sendStatus(404);
  next();
});

if (fs.existsSync(path.join(SITE_ROOT, "index.html"))) {
  app.use(
    express.static(SITE_ROOT, {
      index: "index.html",
      dotfiles: "deny",
      setHeaders(res, arquivo) {
        if (/\.(html|css|js)$/i.test(arquivo)) res.setHeader("Cache-Control", "no-cache");
        else res.setHeader("Cache-Control", "public, max-age=2592000, immutable");
      },
    })
  );
  console.log(`[praus-api] servindo estáticos de ${SITE_ROOT}`);
} else {
  console.warn(`[praus-api] SITE_ROOT sem index.html (${SITE_ROOT}) — servindo só a API`);
}

/* Mesma regra do front, propositalmente conservadora. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ORIGENS_VALIDAS = new Set(["hero", "cta", "footer", "desconhecida"]);

const limiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT || 12),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { ok: false, erro: "Muitas tentativas. Tente de novo em alguns minutos." },
});

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, db: "up", mailer: mailerConfigurado() ? "configurado" : "ausente" });
  } catch (err) {
    res.status(503).json({ ok: false, db: "down", erro: err.message });
  }
});

/* Situação das vagas — o front consulta no carregamento para já pintar os
   botões de esgotado, sem esperar o visitante tentar enviar. */
app.get("/api/waitlist/status", async (_req, res) => {
  try {
    const s = await situacao(LIMITE);
    res.set("Cache-Control", "no-store");
    res.json({ ok: true, ...s });
  } catch (err) {
    console.error("[waitlist] status falhou:", err.message);
    /* Em caso de erro assume NÃO esgotado: melhor deixar tentar e falhar no
       POST do que bloquear a conversão por uma indisponibilidade do banco. */
    res.status(503).json({ ok: false, esgotado: false, erro: "indisponível" });
  }
});

app.post("/api/waitlist", limiter, async (req, res) => {
  const bruto = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  if (!bruto || bruto.length > 254 || !EMAIL_RE.test(bruto)) {
    return res.status(400).json({ ok: false, erro: "E-mail inválido." });
  }

  const sourceBruta = String(req.body?.source || "desconhecida");
  const source = ORIGENS_VALIDAS.has(sourceBruta) ? sourceBruta : "desconhecida";
  const emailNorm = bruto.toLowerCase();

  let gravado;
  try {
    gravado = await insertSignup(
      {
        email: bruto,
        emailNorm,
        source,
        referer: (req.headers.referer || "").slice(0, 500) || null,
        userAgent: (req.headers["user-agent"] || "").slice(0, 500) || null,
        ip: req.ip,
        utmSource: campo(req.body?.utm_source),
        utmMedium: campo(req.body?.utm_medium),
        utmCampaign: campo(req.body?.utm_campaign),
      },
      LIMITE
    );
  } catch (err) {
    console.error("[waitlist] falha ao gravar:", err.message);
    return res.status(500).json({ ok: false, erro: "Não consegui registrar agora. Tente de novo." });
  }

  /* Vagas esgotadas: 403 com a flag `esgotado` para o front pintar os botões. */
  if (gravado.full) {
    return res.status(403).json({
      ok: false,
      esgotado: true,
      erro: "Acessos esgotados. As vagas do beta acabaram.",
    });
  }

  /* O cadastro já está salvo. A notificação é best-effort: se o Resend falhar,
     o lead NÃO é perdido — fica com notified_at NULL para reenvio posterior. */
  if (!gravado.duplicate) {
    const total = await contar().catch(() => null);
    notificarInscricao({
      email: bruto,
      source,
      total,
      ip: req.ip,
      referer: req.headers.referer || null,
      quando: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    })
      .then((r) => {
        if (r.ok) return marcarNotificado(gravado.id);
        console.error("[waitlist] notificação falhou:", r.erro);
      })
      .catch((err) => console.error("[waitlist] notificação lançou:", err.message));
  }

  /* Duplicado responde 200 de propósito: para o visitante, reenviar o mesmo
     e-mail deve parecer sucesso, não erro. */
  res.json({ ok: true, duplicate: gravado.duplicate });
});

/* Exportação — protegida por token no header. Sem token configurado, a rota
   fica desligada em vez de aberta. */
app.get("/api/waitlist/export", async (req, res) => {
  const esperado = process.env.EXPORT_TOKEN;
  if (!esperado) return res.status(404).json({ ok: false, erro: "Exportação desabilitada." });

  const enviado = req.get("x-export-token") || "";
  if (!seguroIgual(enviado, esperado)) {
    return res.status(401).json({ ok: false, erro: "Token inválido." });
  }

  const linhas = await listarTodos();
  if (req.query.format === "json") return res.json({ ok: true, total: linhas.length, linhas });

  const cab = ["id", "email", "source", "referer", "utm_source", "utm_medium", "utm_campaign", "notified_at", "created_at"];
  const csv = [
    cab.join(","),
    ...linhas.map((l) => cab.map((c) => csvCampo(l[c])).join(",")),
  ].join("\r\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="praus-waitlist.csv"`);
  res.send("﻿" + csv); // BOM para o Excel abrir acentos corretamente
});

app.use((_req, res) => res.status(404).json({ ok: false, erro: "Rota não encontrada." }));

function campo(v) {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, 120) : null;
}

/* Escapa para CSV e neutraliza injeção de fórmula: uma célula começando com
   = + - @ é executada como fórmula ao abrir no Excel/Sheets. */
function csvCampo(v) {
  if (v === null || v === undefined) return "";
  let s = v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

/* Comparação em tempo constante, para o token não vazar por timing. */
function seguroIgual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  let dif = 0;
  for (let i = 0; i < ba.length; i++) dif |= ba[i] ^ bb[i];
  return dif === 0;
}

const server = app.listen(PORT, async () => {
  try {
    await migrate();
    console.log(`[praus-api] ouvindo na porta ${PORT} · migração ok`);
    console.log(`[praus-api] mailer: ${mailerConfigurado() ? "configurado" : "NÃO configurado (leads seguem sendo gravados)"}`);
  } catch (err) {
    console.error("[praus-api] migração falhou:", err.message);
    process.exit(1);
  }
});

for (const sinal of ["SIGTERM", "SIGINT"]) {
  process.on(sinal, () => {
    console.log(`[praus-api] ${sinal} recebido, encerrando...`);
    server.close(() => pool.end().then(() => process.exit(0)));
  });
}

export default app;
