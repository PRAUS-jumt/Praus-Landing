/* PRAUS — cadastro e prévias da landing. Sem framework ou dependência no front. */
(function () {
  "use strict";
  document.documentElement.classList.add("js");

  /* Os clipes originais alternam no CSS; o controle pausa vídeo e alternância. */
  (function videoDaHero() {
    var hero = document.querySelector(".hero");
    var videos = Array.from(document.querySelectorAll(".hero__vid"));
    var toggle = document.querySelector(".hero__motion");
    if (!hero || !videos.length || !toggle) return;
    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    var playing = false;
    var pending = false;
    toggle.hidden = false;
    videos.forEach(function (video) { video.muted = true; });

    function pause() {
      videos.forEach(function (video) { video.pause(); });
      playing = false;
      hero.classList.add("is-video-paused");
      toggle.textContent = "Reproduzir vídeo";
    }
    function play() {
      if (pending) return;
      pending = true;
      Promise.all(videos.map(function (video) { return video.play(); }))
        .then(function () {
          playing = true;
          hero.classList.remove("is-video-paused");
          toggle.textContent = "Pausar vídeo";
        })
        .catch(pause)
        .finally(function () { pending = false; });
    }
    toggle.addEventListener("click", function () { if (playing) pause(); else play(); });
    if (reduced.addEventListener) reduced.addEventListener("change", function (event) { if (event.matches) pause(); });
    if (!reduced.matches) play();
  })();

  var API = document.documentElement.getAttribute("data-api") || "/api";
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var esgotado = false;

  function utms() {
    var q = new URLSearchParams(location.search);
    return {
      utm_source: q.get("utm_source") || undefined,
      utm_medium: q.get("utm_medium") || undefined,
      utm_campaign: q.get("utm_campaign") || undefined,
    };
  }

  function aplicaEsgotado() {
    if (esgotado) return;
    esgotado = true;
    document.querySelectorAll(".waitlist").forEach(function (form) {
      var input = form.querySelector('input[type="email"]');
      var button = form.querySelector('button[type="submit"]');
      var micro = form.querySelector(".waitlist__micro");
      var error = form.querySelector(".waitlist__error");
      if (input) { input.disabled = true; input.placeholder = "Fila encerrada"; }
      if (button) {
        button.disabled = true;
        button.classList.add("btn--esgotado");
        button.textContent = "Acessos esgotados";
      }
      if (error) error.hidden = true;
      if (micro) micro.textContent = "As vagas desta etapa do beta foram preenchidas. Acompanhe as próximas novidades da PRAUS.";
    });
    document.querySelectorAll('a[href="#waitlist"]').forEach(function (link) {
      link.classList.add("btn--esgotado");
      link.setAttribute("aria-disabled", "true");
      link.removeAttribute("href");
      link.tabIndex = -1;
      link.textContent = "Acessos esgotados";
    });
  }

  /* O POST continua sendo a fonte da verdade se a consulta inicial falhar. */
  fetch(API + "/waitlist/status", { headers: { Accept: "application/json" } })
    .then(function (r) { return r.json(); })
    .then(function (d) { if (d && d.ok && d.esgotado) aplicaEsgotado(); })
    .catch(function () {});

  document.querySelectorAll(".waitlist").forEach(function (form) {
    var input = form.querySelector('input[type="email"]');
    var button = form.querySelector('button[type="submit"]');
    var field = form.querySelector(".waitlist__field");
    var micro = form.querySelector(".waitlist__micro");
    var success = form.querySelector(".waitlist__success");
    var error = form.querySelector(".waitlist__error");
    if (!input || !button) return;
    var label = button.innerHTML;
    var enviando = false;

    function mostraErro(msg) {
      if (error) { error.textContent = msg; error.hidden = false; }
    }
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (enviando || esgotado) return;
      var email = input.value.trim();
      if (!EMAIL_RE.test(email) || email.length > 254) {
        input.classList.add("invalid");
        input.setAttribute("aria-invalid", "true");
        input.focus();
        mostraErro("Confere o e-mail — parece que falta alguma coisa.");
        return;
      }
      input.classList.remove("invalid");
      input.removeAttribute("aria-invalid");
      if (error) error.hidden = true;
      enviando = true;
      form.setAttribute("aria-busy", "true");
      button.disabled = true;
      button.textContent = "Enviando…";
      var body = utms();
      body.email = email;
      body.source = form.getAttribute("data-source") || "desconhecida";
      fetch(API + "/waitlist", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      })
        .then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (d) {
            if (!r.ok || !d.ok) {
              var err = new Error(d.erro || "Não consegui registrar agora. Tente de novo.");
              err.daApi = true;
              err.esgotado = Boolean(d.esgotado);
              throw err;
            }
            return d;
          });
        })
        .then(function () {
          /* Duplicata também é sucesso, conforme o contrato da API. */
          if (field) field.hidden = true;
          if (micro) micro.hidden = true;
          if (success) success.hidden = false;
          form.removeAttribute("aria-busy");
        })
        .catch(function (err) {
          enviando = false;
          form.removeAttribute("aria-busy");
          if (err.esgotado) { aplicaEsgotado(); return; }
          mostraErro(err.daApi ? err.message : "Sem conexão com o servidor. Confere a internet e tenta de novo.");
          button.disabled = false;
          button.innerHTML = label;
        });
    });
    input.addEventListener("input", function () {
      input.classList.remove("invalid");
      input.removeAttribute("aria-invalid");
      if (error) error.hidden = true;
    });
  });

  /* Etapas manuais: uma parada de Tab; setas, Home e End navegam. */
  (function flowStepper() {
    var flow = document.querySelector(".flow");
    if (!flow) return;
    var steps = Array.from(flow.querySelectorAll(".flow__step"));
    var panels = steps.map(function (step) { return document.getElementById(step.getAttribute("aria-controls")); });
    if (!steps.length || panels.includes(null)) return;
    function select(index, focus) {
      index = (index + steps.length) % steps.length;
      steps.forEach(function (step, i) {
        var active = i === index;
        step.classList.toggle("is-active", active);
        step.setAttribute("aria-selected", String(active));
        step.tabIndex = active ? 0 : -1;
        panels[i].hidden = !active;
      });
      if (focus) steps[index].focus();
    }
    steps.forEach(function (step, i) {
      step.addEventListener("click", function () { select(i, false); });
      step.addEventListener("keydown", function (ev) {
        var index;
        if (ev.key === "ArrowRight" || ev.key === "ArrowDown") index = i + 1;
        else if (ev.key === "ArrowLeft" || ev.key === "ArrowUp") index = i - 1;
        else if (ev.key === "Home") index = 0;
        else if (ev.key === "End") index = steps.length - 1;
        else return;
        ev.preventDefault();
        select(index, true);
      });
    });
    select(0, false);
  })();

  /* Demonstração do lobby: a tabela existente é ilustrativa, não uma taxa real. */
  (function lobbyInterativo() {
    var screen = document.getElementById("screen-1");
    if (!screen) return;
    var output = screen.querySelector("[data-premio]");
    var prizes = { "25": "R$ 47,50", "50": "R$ 95", "100": "R$ 190" };
    function premio() {
      var entry = screen.querySelector('[data-grupo="entrada"] .chip--on');
      if (!output || !entry) return;
      var value = prizes[entry.getAttribute("data-valor")];
      if (value) output.textContent = value;
    }
    screen.querySelectorAll(".chips[data-grupo]").forEach(function (group) {
      var chips = Array.from(group.querySelectorAll(".chip"));
      function select(i, focus) {
        i = (i + chips.length) % chips.length;
        chips.forEach(function (chip, index) {
          var active = index === i;
          chip.classList.toggle("chip--on", active);
          chip.setAttribute("aria-checked", String(active));
          chip.tabIndex = active ? 0 : -1;
        });
        if (focus) chips[i].focus();
        premio();
      }
      chips.forEach(function (chip, i) {
        chip.tabIndex = chip.classList.contains("chip--on") ? 0 : -1;
        chip.addEventListener("click", function () { select(i, false); });
        chip.addEventListener("keydown", function (ev) {
          var index;
          if (ev.key === "ArrowRight" || ev.key === "ArrowDown") index = i + 1;
          else if (ev.key === "ArrowLeft" || ev.key === "ArrowUp") index = i - 1;
          else if (ev.key === "Home") index = 0;
          else if (ev.key === "End") index = chips.length - 1;
          else return;
          ev.preventDefault(); select(index, true);
        });
      });
    });
    premio();
  })();

  (function ctaMaisPerto() {
    var trigger = document.querySelector("[data-perto]");
    var forms = Array.from(document.querySelectorAll(".waitlist"));
    if (!trigger || !forms.length) return;
    trigger.addEventListener("click", function (ev) {
      ev.preventDefault();
      if (esgotado) return;
      var available = forms.filter(function (form) {
        var field = form.querySelector(".waitlist__field");
        return field && !field.hidden;
      });
      if (!available.length) return;
      var center = window.innerHeight / 2;
      var target = available.reduce(function (nearest, form) {
        return Math.abs(form.getBoundingClientRect().top - center) < Math.abs(nearest.getBoundingClientRect().top - center) ? form : nearest;
      });
      var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
      window.setTimeout(function () { target.querySelector('input[type="email"]').focus({ preventScroll: true }); }, reduced ? 0 : 420);
    });
  })();

  (function menuMobile() {
    var button = document.querySelector(".nav__abrir");
    var menu = document.getElementById("menu-principal");
    if (!button || !menu) return;
    var desktop = window.matchMedia("(min-width: 880px)");
    function define(open) {
      menu.hidden = !desktop.matches && !open;
      button.setAttribute("aria-expanded", String(open));
      button.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
    }
    button.addEventListener("click", function () { define(button.getAttribute("aria-expanded") !== "true"); });
    menu.addEventListener("click", function (ev) { if (ev.target.closest("a")) define(false); });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && button.getAttribute("aria-expanded") === "true") { define(false); button.focus(); }
    });
    document.addEventListener("click", function (ev) {
      if (!menu.contains(ev.target) && !button.contains(ev.target)) define(false);
    });
    var resized = function () { define(false); };
    if (desktop.addEventListener) desktop.addEventListener("change", resized);
    else desktop.addListener(resized);
    define(false);
  })();
})();
