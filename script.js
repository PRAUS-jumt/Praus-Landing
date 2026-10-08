/* PRAUS — interações da landing (redesign v2) */
(function () {
  "use strict";

  var reduzMovimento = window.matchMedia
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Waitlist (captura de e-mail) ---------- */
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var API = document.documentElement.getAttribute("data-api") || "/api";

  /* Repassa as UTMs da URL para a API, para saber de onde veio o lead.
     Captura no carregamento e guarda na sessão: se o visitante passear
     pelas páginas legais e voltar, o vínculo com o parceiro não se perde. */
  var UTMS = (function () {
    var q = new URLSearchParams(location.search);
    var u = {};
    ["utm_source", "utm_medium", "utm_campaign"].forEach(function (k) {
      var v = q.get(k);
      if (v) u[k] = v.slice(0, 120);
    });
    try {
      if (Object.keys(u).length) sessionStorage.setItem("praus_utms", JSON.stringify(u));
      else u = JSON.parse(sessionStorage.getItem("praus_utms")) || {};
    } catch (e) { /* storage bloqueado: segue só com a URL */ }
    return u;
  })();
  function utms() {
    return {
      utm_source: UTMS.utm_source || undefined,
      utm_medium: UTMS.utm_medium || undefined,
      utm_campaign: UTMS.utm_campaign || undefined,
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
