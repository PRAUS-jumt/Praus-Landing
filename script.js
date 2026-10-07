/* PRAUS — interações da landing (redesign v2) */
(function () {
  "use strict";

  var reduzMovimento = window.matchMedia
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Waitlist (captura de e-mail) ---------- */
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var API = document.documentElement.getAttribute("data-api") || "/api";

  /* Repassa as UTMs da URL para a API, para saber de onde veio o lead. */
  function utms() {
    var q = new URLSearchParams(location.search);
    return {
      utm_source: q.get("utm_source") || undefined,
      utm_medium: q.get("utm_medium") || undefined,
      utm_campaign: q.get("utm_campaign") || undefined,
    };
  }

  /* ---------- Vagas esgotadas ----------
     Desativa os formulários e os CTAs que apontam para #waitlist. */
  var ROTULO_ESGOTADO = "Acessos esgotados";
  var esgotado = false;

  function aplicaEsgotado() {
    if (esgotado) return;
    esgotado = true;

    document.querySelectorAll(".waitlist").forEach(function (form) {
      var campo = form.querySelector(".waitlist__field");
      var input = form.querySelector('input[type="email"]');
      var botao = form.querySelector('button[type="submit"]');
      var micro = form.querySelector(".waitlist__micro");
      var erro = form.querySelector(".waitlist__error");

      if (campo) campo.hidden = false;
      if (input) { input.disabled = true; input.value = ""; input.placeholder = "Fila encerrada"; }
      if (botao) {
        botao.disabled = true;
        botao.classList.add("btn--esgotado");
        botao.textContent = ROTULO_ESGOTADO;
      }
      if (erro) erro.hidden = true;
      if (micro) micro.textContent = "As vagas desta etapa do beta foram preenchidas. Acompanhe as próximas novidades da Praus.";
    });

    /* Links viram estado inerte: sem href, para não navegarem nem receberem
       foco como se ainda fossem acionáveis. */
    document.querySelectorAll('a.btn[href="#waitlist"]').forEach(function (a) {
      a.classList.add("btn--esgotado");
      a.setAttribute("aria-disabled", "true");
      a.removeAttribute("href");
      a.textContent = ROTULO_ESGOTADO;
    });
  }

  /* Consulta no carregamento: se já estiver lotado, o visitante nem chega a
     digitar. Falha de rede aqui é ignorada de propósito — na dúvida, deixa
     tentar; o POST é a fonte da verdade. */
  fetch(API + "/waitlist/status", { headers: { Accept: "application/json" } })
    .then(function (r) { return r.json(); })
    .then(function (d) { if (d && d.esgotado) aplicaEsgotado(); })
    .catch(function () {});

  function bindForm(form) {
    var input = form.querySelector('input[type="email"]');
    var button = form.querySelector('button[type="submit"]');
    var success = form.querySelector(".waitlist__success");
    var error = form.querySelector(".waitlist__error");
    var field = form.querySelector(".waitlist__field");
    var micro = form.querySelector(".waitlist__micro");
    var source = form.getAttribute("data-source") || "desconhecida";
    var rotuloBotao = button ? button.innerHTML : "";
    var enviando = false;

    function mostraErro(msg) {
      if (!error) return;
      error.textContent = msg;
      error.hidden = false;
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (enviando || esgotado) return;

      var value = (input.value || "").trim();
      if (!EMAIL_RE.test(value)) {
        input.classList.add("invalid");
        input.focus();
        mostraErro("Confere o e-mail — parece que falta alguma coisa.");
        return;
      }

      input.classList.remove("invalid");
      if (error) error.hidden = true;
      enviando = true;
      if (button) { button.disabled = true; button.textContent = "Enviando…"; }

      var corpo = utms();
      corpo.email = value;
      corpo.source = source;

      fetch(API + "/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      })
        .then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (d) {
            if (!r.ok || !d.ok) {
              /* marcado para o catch saber que a mensagem veio da API e já
                 está em português — falha de rede cai na mensagem genérica */
              var e = new Error(d.erro || "Não consegui registrar agora. Tente de novo.");
              e.daApi = true;
              /* as vagas acabaram entre o carregamento e este envio */
              e.esgotado = Boolean(d.esgotado);
              throw e;
            }
            return d;
          });
        })
        .then(function () {
          if (field) field.hidden = true;
          if (micro) micro.hidden = true;
          if (success) success.hidden = false;
        })
        .catch(function (err) {
          enviando = false;
          if (err && err.esgotado) { aplicaEsgotado(); return; }
          mostraErro(err && err.daApi
            ? err.message
            : "Sem conexão com o servidor. Confere a internet e tenta de novo.");
          if (button) { button.disabled = false; button.innerHTML = rotuloBotao; }
          if (input) input.focus();
        });
    });

    input.addEventListener("input", function () {
      input.classList.remove("invalid");
      if (error) error.hidden = true;
    });
  }
  document.querySelectorAll(".waitlist").forEach(bindForm);

  /* ---------- Menu mobile ---------- */
  (function menuMobile() {
    var burger = document.querySelector(".nav__burger");
    var menu = document.getElementById("nav-menu");
    if (!burger || !menu) return;

    function fecha() {
      menu.classList.remove("is-open");
      burger.setAttribute("aria-expanded", "false");
      burger.setAttribute("aria-label", "Abrir menu");
    }
    burger.addEventListener("click", function () {
      var aberto = menu.classList.toggle("is-open");
      burger.setAttribute("aria-expanded", String(aberto));
      burger.setAttribute("aria-label", aberto ? "Fechar menu" : "Abrir menu");
    });
    menu.addEventListener("click", function (e) {
      if (e.target.tagName === "A") fecha();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") fecha();
    });
  })();

  /* ---------- Herói: vídeos em crossfade + botão de pausa ---------- */
  (function heroVideo() {
    var vids = Array.prototype.slice.call(document.querySelectorAll(".hero__vid"));
    var botao = document.querySelector(".hero__pause");
    if (!vids.length) return;

    var pausado = reduzMovimento;

    function aplica() {
      vids.forEach(function (v) {
        if (pausado) { v.pause(); }
        else { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
      });
      if (botao) {
        botao.textContent = pausado ? "▶" : "⏸";
        botao.setAttribute("aria-pressed", String(pausado));
        botao.setAttribute("aria-label", pausado ? "Reproduzir vídeo de fundo" : "Pausar vídeo de fundo");
      }
    }

    aplica();
    if (botao) botao.addEventListener("click", function () { pausado = !pausado; aplica(); });

    /* fora de tela os vídeos pausam: decoder rodando escondido é bateria */
    if ("IntersectionObserver" in window) {
      var hero = document.querySelector(".hero");
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (pausado) return;
          vids.forEach(function (v) {
            if (en.isIntersecting) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
            else v.pause();
          });
        });
      }, { threshold: 0 }).observe(hero);
    }
  })();

  /* ---------- Ranking ilustrativo ----------
     Regra do repositório: ranking é ilustrativo até o beta ter partidas
     validadas. Simulação no front com rótulo visível na seção; quando houver
     API, trocar por polling em /api/ranking/top. */
  (function rankingIlustrativo() {
    var podio = document.getElementById("podium");
    var cartao = document.getElementById("lastmatch");
    if (!podio || !cartao) return;

    var DIVISOES = [
      { nome: "Spray and Pray", min: 0,    img: "assets/ranks/1-spray-and-pray.webp" },
      { nome: "Bala Perdida",   min: 800,  img: "assets/ranks/2-bala-perdida.webp" },
      { nome: "Rei do Bait",    min: 1200, img: "assets/ranks/3-rei-do-bait.webp" },
      { nome: "Entry Brabo",    min: 1500, img: "assets/ranks/4-entry-brabo.webp" },
      { nome: "Casca Grossa",   min: 1800, img: "assets/ranks/5-casca-grossa.webp" },
      { nome: "One Tap",        min: 2000, img: "assets/ranks/6-one-tap.webp" },
      { nome: "Global Elite",   min: 2300, img: "assets/ranks/7-global-elite.webp" }
    ];
    var MODOS = ["Duelo 1x1", "Wingman 2x2", "Competitivo 5x5"];
    var jogadores = [
      ["fallenzin", 2462], ["coldzera_br", 2418], ["meira67", 2371], ["kz_smoke", 2305],
      ["nyx_ttv", 2264], ["tg_ice", 2198], ["vulto", 2140], ["juju_awp", 2071],
      ["b1t_br", 1996], ["rafinha_cs", 1934]
    ].map(function (par, i) { return { id: i, nick: par[0], rr: par[1], delta: 0, mudouEm: 0 }; });

    var slots = Array.prototype.slice.call(podio.querySelectorAll(".podium__col"));

    function divisao(rr) {
      for (var i = DIVISOES.length - 1; i >= 0; i--) if (rr >= DIVISOES[i].min) return DIVISOES[i];
      return DIVISOES[0];
    }
    function fmt(n) { return n.toLocaleString("pt-BR"); }

    function pinta() {
      var agora = Date.now();
      var ordem = jogadores.slice().sort(function (a, b) { return b.rr - a.rr; });
      slots.forEach(function (col) {
        var p = ordem[Number(col.getAttribute("data-slot"))];
        var d = divisao(p.rr);
        col.querySelector("[data-emblem]").style.backgroundImage = "url('" + d.img + "')";
        col.querySelector("[data-emblem]").setAttribute("role", "img");
        col.querySelector("[data-emblem]").setAttribute("aria-label", d.nome);
        col.querySelector("[data-nick]").textContent = p.nick;
        var rrEl = col.querySelector("[data-rr]");
        rrEl.textContent = fmt(p.rr) + " RR";
        var fresco = p.mudouEm && agora - p.mudouEm < 2600;
        rrEl.classList.toggle("up", fresco && p.delta > 0);
        rrEl.classList.toggle("down", fresco && p.delta < 0);
      });
    }

    function pintaCartao(f) {
      var p = jogadores[f.id];
      var d = divisao(p.rr);
      var ordem = jogadores.slice().sort(function (a, b) { return b.rr - a.rr; });
      var pos = ordem.indexOf(p) + 1;
      cartao.querySelector("[data-emblem]").style.backgroundImage = "url('" + d.img + "')";
      cartao.querySelector("[data-nick]").textContent = p.nick;
      cartao.querySelector("[data-tag]").textContent = "#" + pos;
      var dir = cartao.querySelector("[data-right]");
      dir.innerHTML = (f.delta > 0 ? "+" : "") + f.delta + " RR <i>agora</i>";
      dir.classList.toggle("up", f.delta > 0);
      dir.classList.toggle("down", f.delta < 0);
      cartao.querySelector("[data-line]").textContent =
        (f.venceu ? "Venceu" : "Perdeu") + " uma partida " + f.modo + " · " + d.nome + " · " + fmt(p.rr) + " RR";
      cartao.classList.toggle("up", f.delta > 0);
      cartao.classList.toggle("down", f.delta < 0);
      clearTimeout(pintaCartao._t);
      pintaCartao._t = setTimeout(function () { cartao.classList.remove("up", "down"); }, 2600);
    }

    function tick() {
      var p = jogadores[Math.floor(Math.random() * jogadores.length)];
      var venceu = Math.random() < 0.62;
      var delta = (venceu ? 1 : -1) * (12 + Math.floor(Math.random() * 13));
      p.rr = Math.max(1800, p.rr + delta);
      p.delta = delta;
      p.mudouEm = Date.now();
      pinta();
      pintaCartao({ id: p.id, delta: delta, venceu: venceu, modo: MODOS[Math.floor(Math.random() * 3)] });
    }

    pinta();
    var lider = jogadores.slice().sort(function (a, b) { return b.rr - a.rr; })[0];
    cartao.querySelector("[data-emblem]").style.backgroundImage = "url('" + divisao(lider.rr).img + "')";
    cartao.querySelector("[data-nick]").textContent = lider.nick;
    cartao.querySelector("[data-tag]").textContent = "#1";
    cartao.querySelector("[data-right]").innerHTML = fmt(lider.rr) + " <i>RR</i>";

    if (!reduzMovimento) setInterval(tick, 2800);
  })();

  /* ---------- CTA da nav: leva ao formulário mais próximo ---------- */
  (function ctaMaisPerto() {
    var cta = document.querySelector(".btn--nav");
    if (!cta) return;
    cta.addEventListener("click", function (e) {
      if (!cta.getAttribute("href")) return; // esgotado
      var forms = Array.prototype.slice.call(document.querySelectorAll(".waitlist"));
      if (!forms.length) return;
      e.preventDefault();
      var alvo = forms.reduce(function (melhor, f) {
        var d = Math.abs(f.getBoundingClientRect().top);
        return d < melhor.d ? { f: f, d: d } : melhor;
      }, { f: forms[0], d: Infinity }).f;
      alvo.scrollIntoView({ behavior: reduzMovimento ? "auto" : "smooth", block: "center" });
      var input = alvo.querySelector('input[type="email"]');
      if (input && !input.disabled) setTimeout(function () { input.focus({ preventScroll: true }); }, reduzMovimento ? 0 : 450);
    });
  })();
})();
