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
     envio e os links que apontam para #waitlist (nav e rodapé). */
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

  /* ---------- Como funciona: stepper interativo ---------- */
  (function flowStepper() {
    var flow = document.querySelector(".flow");
    if (!flow) return;

    var steps = Array.prototype.slice.call(flow.querySelectorAll(".flow__step"));
    var screens = Array.prototype.slice.call(flow.querySelectorAll(".screen"));
    if (!steps.length) return;

    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var interval = parseInt(flow.getAttribute("data-autoplay"), 10) || 6000;
    var lista = flow.querySelector(".flow__steps");
    var dots = Array.prototype.slice.call(flow.querySelectorAll(".flow__dot"));

    /* o CSS usa isto para a duração do preenchimento do pontinho ativo */
    flow.style.setProperty("--fill", interval + "ms");

    var current = 0;
    var timer = null;
    /* Começa true de propósito. Antes começava false e só o IntersectionObserver
       podia liberar — uma otimização ("não gastar timer fora da tela") que virou
       pré-requisito: se o IO não dispusesse, o avanço jamais começava e não havia
       plano B. Agora o padrão é andar, e o IO apenas pausa quando a seção sai de
       vista. Na pior hipótese o timer roda fora da tela, o que é inofensivo. */
    var inView = true;
    /* Vira false quando o visitante assume o lobby (ver lobbyInterativo). */
    var auto = true;
    /* Pausa temporária: cursor sobre as etapas, ou foco de teclado nelas. */
    var pausado = false;

    function podeAndar() { return auto && !reduce && inView && !pausado; }

    function marcaEstado() {
      flow.classList.toggle("flow--parado", !auto || reduce);
    }

    function cancela() { if (timer) { clearTimeout(timer); timer = null; } }

    /* Um setTimeout que se reagenda a cada troca, em vez de setInterval: assim
       toda etapa recebe o intervalo inteiro, inclusive a que o visitante
       acabou de escolher no clique. */
    function agenda() {
      cancela();
      if (!podeAndar()) return;
      timer = setTimeout(function () { activate(current + 1); }, interval);
    }

    function sincronizaDots() {
      dots.forEach(function (d, idx) {
        d.classList.toggle("is-active", idx === current);
        d.classList.toggle("is-done", idx < current);
        if (idx === current) {
          var enche = d.querySelector("i");
          /* reinicia a animação de preenchimento do zero */
          if (enche) { enche.style.animation = "none"; void enche.offsetWidth; enche.style.animation = ""; }
        }
      });
    }

    function activate(i) {
      current = (i + steps.length) % steps.length;
      steps.forEach(function (s, idx) {
        var on = idx === current;
        s.classList.toggle("is-active", on);
        s.setAttribute("aria-selected", on ? "true" : "false");
      });
      screens.forEach(function (sc, idx) { sc.hidden = idx !== current; });
      sincronizaDots();
      agenda();
    }

    /* Assim que alguém mexe nos controles do lobby, o avanço automático morre:
       trocar a tela debaixo da mão de quem está interagindo é hostil. */
    flow.addEventListener("praus:assumiu", function () {
      auto = false; cancela(); marcaEstado();
    });

    steps.forEach(function (s, i) {
      s.addEventListener("click", function () {
        /* escolher uma etapa é assumir o comando: o ciclo automático para */
        auto = false; marcaEstado();
        activate(i);
      });
      s.addEventListener("keydown", function (e) {
        if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); steps[(i + 1) % steps.length].focus(); activate(i + 1); }
        if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); steps[(i - 1 + steps.length) % steps.length].focus(); activate(i - 1); }
      });
    });

    /* A pausa por hover vale só sobre a LISTA de etapas — o texto que a pessoa
       está lendo. Antes valia sobre `.flow` inteiro, que é o grid de ~950px
       cobrindo etapas e painel: bastava o cursor parar em qualquer lugar da
       seção (o que acontece sempre que se rola até ela) para o avanço morrer,
       e `mouseleave` só dispara movendo o mouse para fora. Na prática o
       automático quase nunca rodava. */
    /* Sem pausa por hover. O cursor parado sobre as etapas é o estado normal de
       quem está lendo a seção, então pausar ali equivalia a nunca avançar. O
       controle de pausa que a acessibilidade exige existe e é explícito: clicar
       numa etapa (ou mexer no lobby) assume o comando e encerra o automático.
       O foco de teclado ainda pausa — esse não dispara por acidente. */
    if (lista) {
      lista.addEventListener("focusin", function () { pausado = true; cancela(); });
      lista.addEventListener("focusout", function () { pausado = false; agenda(); });
    }

    /* só roda o autoplay quando a seção está visível. Limiar baixo: o bloco é
       alto (~950px) e em telas curtas nunca chegaria a 40% dentro da janela. */
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          inView = en.isIntersecting;
          if (inView) agenda(); else cancela();
        });
      }, { threshold: 0 }).observe(flow);
    }

    marcaEstado();
    activate(0);
  })();

  /* ---------- Lobby interativo (prévia do produto) ----------
     Os chips de MODALIDADE e ENTRY FEE passam a ser selecionáveis de verdade,
     com o prize pool respondendo à escolha. Padrão radiogroup: uma opção ativa
     por grupo, setas navegam, e só a ativa fica no fluxo do Tab (roving
     tabindex) — cinco paradas de Tab para escolher um valor seria hostil. */
  (function lobbyInterativo() {
    var tela = document.querySelector("#screen-1");
    if (!tela) return;

    var saidaPremio = tela.querySelector("[data-premio]");
    var grupos = Array.prototype.slice.call(tela.querySelectorAll(".chips[data-grupo]"));
    if (!grupos.length) return;

    /* PROVISÓRIO — aguardando a tabela real de retorno por valor.
       Os números abaixo apenas estendem, na mesma proporção, o único dado que
       o design já trazia (R$ 50 → R$ 95, ou seja 1,9x). Não são uma promessa
       comercial verificada: trocar aqui quando a tabela definitiva chegar, que
       é o único lugar do código onde esses valores existem. */
    var PREMIO_POR_ENTRADA = {
      "25":  "R$ 47,50",
      "50":  "R$ 95",
      "100": "R$ 190"
    };

    function entradaAtual() {
      var g = tela.querySelector('.chips[data-grupo="entrada"] .chip--on');
      return g ? g.getAttribute("data-valor") : null;
    }

    function atualizaPremio() {
      if (!saidaPremio) return;
      var v = PREMIO_POR_ENTRADA[entradaAtual()];
      if (v) saidaPremio.textContent = v;
    }

    function seleciona(grupo, chip, moverFoco) {
      var chips = Array.prototype.slice.call(grupo.querySelectorAll(".chip"));
      chips.forEach(function (c) {
        var on = c === chip;
        c.classList.toggle("chip--on", on);
        c.setAttribute("aria-checked", on ? "true" : "false");
        c.tabIndex = on ? 0 : -1;
      });
      if (moverFoco) chip.focus();
      atualizaPremio();
      /* o stepper ouve isto e desliga o avanço automático */
      tela.dispatchEvent(new CustomEvent("praus:assumiu", { bubbles: true }));
    }

    grupos.forEach(function (grupo) {
      var chips = Array.prototype.slice.call(grupo.querySelectorAll(".chip"));

      /* roving tabindex inicial */
      chips.forEach(function (c) {
        c.tabIndex = c.classList.contains("chip--on") ? 0 : -1;
      });

      chips.forEach(function (chip, i) {
        chip.addEventListener("click", function () { seleciona(grupo, chip, false); });
        chip.addEventListener("keydown", function (e) {
          var d = 0;
          if (e.key === "ArrowRight" || e.key === "ArrowDown") d = 1;
          else if (e.key === "ArrowLeft" || e.key === "ArrowUp") d = -1;
          else if (e.key === "Home") { e.preventDefault(); seleciona(grupo, chips[0], true); return; }
          else if (e.key === "End") { e.preventDefault(); seleciona(grupo, chips[chips.length - 1], true); return; }
          else return;
          e.preventDefault();
          seleciona(grupo, chips[(i + d + chips.length) % chips.length], true);
        });
      });
    });

    atualizaPremio();
  })();

  /* ---------- CTA do menu: leva ao formulário MAIS PRÓXIMO ---------- */
  /* O menu é position:fixed, então fica visível em qualquer rolagem. Apontá-lo
     para um destino fixo mandaria quem está no FAQ de volta ao topo, ou quem
     está no herói para longe de um formulário já visível. A escolha é feita na
     hora, pela distância. O foco no campo poupa um toque — e no celular abre o
     teclado, que é o que a pessoa quer depois de clicar "entrar na fila". */
  (function ctaMaisPerto() {
    var gatilho = document.querySelector("[data-perto]");
    var formularios = [document.getElementById("hero-form"),
                       document.getElementById("footer-form")].filter(Boolean);
    if (!gatilho || formularios.length < 2) return;

    gatilho.addEventListener("click", function (ev) {
      var meio = window.scrollY + window.innerHeight / 2;
      var alvo = formularios.reduce(function (perto, f) {
        var y = f.getBoundingClientRect().top + window.scrollY + f.offsetHeight / 2;
        var atual = perto.getBoundingClientRect().top + window.scrollY + perto.offsetHeight / 2;
        return Math.abs(y - meio) < Math.abs(atual - meio) ? f : perto;
      });
      ev.preventDefault();
      var reduz = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      alvo.scrollIntoView({ behavior: reduz ? "auto" : "smooth", block: "center" });
      var campo = alvo.querySelector('input[type="email"]');
      if (campo && !campo.disabled) {
        // espera a rolagem assentar antes de focar, senão o navegador cancela
        setTimeout(function () { campo.focus({ preventScroll: true }); }, reduz ? 0 : 420);
      }
    });
  })();
  /* ---------- Menu mobile ---------- */
  (function menuMobile() {
    var botao = document.querySelector(".nav__abrir");
    var painel = document.getElementById("menu-principal");
    if (!botao || !painel) return;

    function define(aberto) {
      painel.classList.toggle("aberto", aberto);
      botao.setAttribute("aria-expanded", aberto ? "true" : "false");
      botao.setAttribute("aria-label", aberto ? "Fechar menu" : "Abrir menu");
    }

    botao.addEventListener("click", function () {
      define(botao.getAttribute("aria-expanded") !== "true");
    });

    // clicar num destino fecha: o painel cobre o conteúdo para onde a pessoa vai
    painel.addEventListener("click", function (ev) {
      if (ev.target.closest("a")) define(false);
    });

    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && botao.getAttribute("aria-expanded") === "true") {
        define(false);
        botao.focus();
      }
    });

    // clicar fora fecha
    document.addEventListener("click", function (ev) {
      if (botao.getAttribute("aria-expanded") !== "true") return;
      if (painel.contains(ev.target) || botao.contains(ev.target)) return;
      define(false);
    });

    // voltar ao desktop com o painel aberto deixaria aria-expanded mentindo
    var largo = window.matchMedia("(min-width: 880px)");
    (largo.addEventListener ? largo.addEventListener.bind(largo, "change")
                            : largo.addListener.bind(largo))(function (e) {
      if (e.matches) define(false);
    });
  })();
})();
