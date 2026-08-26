/* PRAUS — interações da landing */
(function () {
  "use strict";

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
     Pinta de cinza e desativa TODOS os CTAs da waitlist: os dois botões de
     envio e os links que apontam para #waitlist (nav, ranking, rodapé). */
  var ROTULO_ESGOTADO = "Acessos Esgotados";
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
      if (micro) micro.textContent = "As 1.200 vagas do beta foram preenchidas. Fique de olho nas nossas redes para a próxima leva.";
    });

    /* Links viram estado inerte: sem href, para não navegarem nem receberem foco
       como se ainda fossem acionáveis. */
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
      if (button) { button.disabled = true; button.textContent = "ENVIANDO..."; }

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
        });
    });

    input.addEventListener("input", function () {
      input.classList.remove("invalid");
      if (error) error.hidden = true;
    });
  }
  document.querySelectorAll(".waitlist").forEach(bindForm);

  /* ---------- Nav fundo ao rolar ---------- */
  var nav = document.querySelector(".nav");
  function onScroll() {
    if (window.scrollY > 40) nav.classList.add("is-stuck");
    else nav.classList.remove("is-stuck");
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------- Reveal on scroll ---------- */
  var reveals = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    reveals.forEach(function (el) { el.classList.add("in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    reveals.forEach(function (el) { io.observe(el); });
  }

  /* Stagger leve dentro de grupos de cards */
  document.querySelectorAll(".games, .partners, .perks").forEach(function (group) {
    group.querySelectorAll(".reveal").forEach(function (el, i) {
      el.style.transitionDelay = (i % 4) * 70 + "ms";
    });
  });

  /* Stagger dos próprios cards de vantagens (não têm .reveal individual —
     o grupo inteiro entra junto, só o delay de cada card e de cada linha
     do pôster varia, criando a cascata de entrada). */
  document.querySelectorAll(".perks .perk").forEach(function (el, i) {
    el.style.transitionDelay = i * 90 + "ms";
    el.querySelectorAll(".line").forEach(function (line, l) {
      line.style.transitionDelay = (i * 90 + l * 90) + "ms";
    });
  });

  /* ---------- Vantagens: contagem do "100%" do bônus ---------- */
  (function bonusCountUp() {
    var perks = document.querySelector(".perks");
    var stat = document.querySelector("[data-count-to]");
    if (!perks || !stat) return;
    var target = parseInt(stat.getAttribute("data-count-to"), 10) || 0;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function run() {
      if (reduce) { stat.textContent = target; return; }
      var start = null;
      var duration = 900;
      function tick(ts) {
        if (start === null) start = ts;
        var p = Math.min((ts - start) / duration, 1);
        stat.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }

    if ("IntersectionObserver" in window) {
      var ioStat = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) { run(); ioStat.unobserve(entry.target); }
        });
      }, { threshold: 0.4 });
      ioStat.observe(perks);
    } else {
      run();
    }
  })();

  /* ---------- Como funciona: stepper interativo ---------- */
  (function flowStepper() {
    var flow = document.querySelector(".flow");
    if (!flow) return;

    var steps = Array.prototype.slice.call(flow.querySelectorAll(".flow__step"));
    var screens = Array.prototype.slice.call(flow.querySelectorAll(".screen"));
    if (!steps.length) return;

    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var interval = parseInt(flow.getAttribute("data-autoplay"), 10) || 4800;
    flow.style.setProperty("--fill", interval + "ms");

    var current = 0;
    var timer = null;
    var inView = false;

    function restartFill(step) {
      var bar = step.querySelector(".flow__step-bar i");
      if (!bar) return;
      bar.style.animation = "none";
      void bar.offsetWidth; // reflow
      bar.style.animation = "";
    }

    function activate(i, fromUser) {
      current = (i + steps.length) % steps.length;
      steps.forEach(function (s, idx) {
        var on = idx === current;
        s.classList.toggle("is-active", on);
        s.setAttribute("aria-selected", on ? "true" : "false");
        if (on && !reduce) restartFill(s);
      });
      screens.forEach(function (sc, idx) { sc.hidden = idx !== current; });
      if (fromUser) resetTimer();
    }

    function next() { activate(current + 1, false); }

    function resetTimer() {
      if (timer) { clearInterval(timer); timer = null; }
      if (!reduce && inView) timer = setInterval(next, interval);
    }

    steps.forEach(function (s, i) {
      s.addEventListener("click", function () { activate(i, true); });
      s.addEventListener("keydown", function (e) {
        if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); steps[(i + 1) % steps.length].focus(); activate(i + 1, true); }
        if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); steps[(i - 1 + steps.length) % steps.length].focus(); activate(i - 1, true); }
      });
    });

    flow.addEventListener("mouseenter", function () { if (timer) { clearInterval(timer); timer = null; } });
    flow.addEventListener("mouseleave", resetTimer);

    /* só roda o autoplay quando a seção está visível */
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          inView = en.isIntersecting;
          if (inView) { if (!reduce) restartFill(steps[current]); resetTimer(); }
          else if (timer) { clearInterval(timer); timer = null; }
        });
      }, { threshold: 0.4 }).observe(flow);
    } else { inView = true; resetTimer(); }

    activate(0, false);
  })();

  /* ---------- Ranking: abas Jogadores / Times ---------- */
  (function rankTabs() {
    var wrap = document.querySelector(".rank__tabs");
    if (!wrap) return;

    var tabs = Array.prototype.slice.call(wrap.querySelectorAll(".rank__tab"));
    var panels = tabs.map(function (t) {
      return document.getElementById(t.getAttribute("aria-controls"));
    });
    if (!tabs.length || panels.indexOf(null) !== -1) return;

    function select(i, moveFocus) {
      i = (i + tabs.length) % tabs.length;
      tabs.forEach(function (t, idx) {
        var on = idx === i;
        t.classList.toggle("is-active", on);
        t.setAttribute("aria-selected", on ? "true" : "false");
        /* roving tabindex: só a aba ativa fica no fluxo do Tab */
        t.tabIndex = on ? 0 : -1;
        panels[idx].hidden = !on;
      });
      if (moveFocus) tabs[i].focus();
    }

    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { select(i, false); });
      t.addEventListener("keydown", function (e) {
        if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); select(i + 1, true); }
        else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); select(i - 1, true); }
        else if (e.key === "Home") { e.preventDefault(); select(0, true); }
        else if (e.key === "End") { e.preventDefault(); select(tabs.length - 1, true); }
      });
    });

    select(0, false);
  })();
})();
