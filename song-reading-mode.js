(() => {
  if (window.__jhdSongReadingMode) return;
  window.__jhdSongReadingMode = true;

  let statusTimer;
  let scrollFrame = 0;
  const origins = new Map();

  const isMobile = () => window.matchMedia?.("(max-width: 700px)").matches;
  const $ = (selector) => document.querySelector(selector);

  const ensureAssistiveControls = () => {
    let progress = $("#songReadingProgress");
    let topButton = $("#songReadingTop");

    if (!progress) {
      progress = document.createElement("div");
      progress.id = "songReadingProgress";
      progress.setAttribute("aria-hidden", "true");
      progress.innerHTML = "<span></span>";
      document.body.append(progress);
    }

    if (!topButton) {
      topButton = document.createElement("button");
      topButton.id = "songReadingTop";
      topButton.type = "button";
      topButton.textContent = "↑ Arriba";
      topButton.setAttribute("aria-label", "Volver al inicio de la canción");
      topButton.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
      document.body.append(topButton);
    }

    return { progress, topButton };
  };

  const updateReadingProgress = () => {
    scrollFrame = 0;
    const { progress, topButton } = ensureAssistiveControls();
    const active = document.body.classList.contains("song-reading-mode") && isMobile();
    const lyrics = $("#songLyrics");

    if (!active || !lyrics) {
      progress.style.setProperty("--jhd-reading-progress", "0%");
      topButton.classList.remove("is-visible");
      return;
    }

    const start = window.scrollY + lyrics.getBoundingClientRect().top;
    const readableHeight = Math.max(1, lyrics.offsetHeight - window.innerHeight * 0.45);
    const progressValue = Math.max(0, Math.min(1, (window.scrollY - start + window.innerHeight * 0.28) / readableHeight));
    progress.style.setProperty("--jhd-reading-progress", `${Math.round(progressValue * 100)}%`);
    topButton.classList.toggle("is-visible", window.scrollY > start + 360);
  };

  const requestProgressUpdate = () => {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(updateReadingProgress);
  };

  const rememberOrigin = (element) => {
    if (!element || origins.has(element)) return;
    origins.set(element, { parent: element.parentElement, next: element.nextSibling });
  };

  const restoreElement = (element) => {
    const origin = origins.get(element);
    if (!element || !origin?.parent) return;
    if (origin.next && origin.next.parentNode === origin.parent) origin.parent.insertBefore(element, origin.next);
    else origin.parent.append(element);
  };

  const ensureSettingsPanel = () => {
    let panel = $("#songReadingSettingsPanel");
    let backdrop = $("#songReadingSettingsBackdrop");

    if (!panel) {
      panel = document.createElement("aside");
      panel.id = "songReadingSettingsPanel";
      panel.className = "song-reading-settings-panel";
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-modal", "true");
      panel.setAttribute("aria-label", "Ajustar lectura");
      panel.setAttribute("aria-hidden", "true");
      panel.innerHTML = `<div class="song-reading-sheet-handle" aria-hidden="true"></div><header class="song-reading-sheet-header"><div><p>LECTURA</p><h2>Ajustar lectura</h2></div><button class="song-reading-sheet-close" id="songReadingSettingsClose" type="button" aria-label="Cerrar ajustes">Cerrar</button></header><div class="song-reading-sheet-body"><section class="song-reading-sheet-section" id="songReadingToneSection"><h3>Tono y capo</h3></section><section class="song-reading-sheet-section" id="songReadingViewSection"><h3>Vista</h3></section><section class="song-reading-sheet-section" id="songReadingMoreSection"><h3>Más opciones</h3><div class="song-reading-sheet-utilities" id="songReadingUtilities"></div></section></div>`;
      document.body.append(panel);
      panel.querySelector("#songReadingSettingsClose")?.addEventListener("click", () => setSettingsOpen(false));
    }

    if (!backdrop) {
      backdrop = document.createElement("button");
      backdrop.id = "songReadingSettingsBackdrop";
      backdrop.type = "button";
      backdrop.tabIndex = -1;
      backdrop.setAttribute("aria-label", "Cerrar ajustes de lectura");
      backdrop.addEventListener("click", () => setSettingsOpen(false));
      document.body.append(backdrop);
    }

    return { panel, backdrop };
  };

  const moveSettingsToSheet = () => {
    if (!isMobile() || !document.body.classList.contains("song-reading-mode")) return;
    const toolbar = $("#songReaderToolbar");
    if (!toolbar) return;

    const { panel } = ensureSettingsPanel();
    const toneSection = panel.querySelector("#songReadingToneSection");
    const viewSection = panel.querySelector("#songReadingViewSection");
    const utilities = panel.querySelector("#songReadingUtilities");
    const controls = toolbar.querySelector(":scope > .song-reader-controls");
    const preferences = toolbar.querySelector(":scope > #songReaderPreferences");
    const share = $("#songShare");
    const print = $("#songPrint");
    const status = $("#songActionStatus");

    if (controls && controls.parentElement !== toneSection) {
      rememberOrigin(controls);
      toneSection.append(controls);
    }
    if (preferences && preferences.parentElement !== viewSection) {
      rememberOrigin(preferences);
      viewSection.append(preferences);
    }
    [share, print, status].forEach((element) => {
      if (!element || element.parentElement === utilities) return;
      rememberOrigin(element);
      utilities.append(element);
    });
  };

  const restoreSettingsFromSheet = () => {
    const toolbar = $("#songReaderToolbar");
    if (!toolbar) return;

    const controls = $("#songReadingToneSection .song-reader-controls");
    const preferences = $("#songReadingViewSection #songReaderPreferences");
    const share = $("#songShare");
    const print = $("#songPrint");
    const status = $("#songActionStatus");

    [controls, preferences, share, print, status].forEach(restoreElement);
    origins.clear();
  };

  const syncModeButtons = () => {
    const active = document.body.classList.contains("song-reading-mode");
    const settingsOpen = document.body.classList.contains("song-reading-settings-open");
    const readingButton = $("#songReadingMode");
    const settingsButton = $("#songReadingSettings");

    if (readingButton) {
      readingButton.textContent = active && isMobile() ? "Salir" : active ? "Salir de lectura" : "Modo lectura";
      readingButton.setAttribute("aria-pressed", String(active));
      readingButton.setAttribute("aria-label", active ? "Salir del modo lectura" : "Activar modo lectura");
    }

    if (settingsButton) {
      settingsButton.textContent = settingsOpen ? "Cerrar" : "Ajustes";
      settingsButton.setAttribute("aria-expanded", String(settingsOpen));
      settingsButton.setAttribute("aria-label", settingsOpen ? "Cerrar ajustes de lectura" : "Abrir ajustes de lectura");
    }
  };

  const setSettingsOpen = (active) => {
    const canOpen = active && document.body.classList.contains("song-reading-mode") && isMobile();
    const { panel, backdrop } = ensureSettingsPanel();
    if (canOpen) moveSettingsToSheet();
    document.body.classList.toggle("song-reading-settings-open", canOpen);
    panel.setAttribute("aria-hidden", String(!canOpen));
    backdrop.setAttribute("aria-hidden", String(!canOpen));
    syncModeButtons();
    if (canOpen) requestAnimationFrame(() => panel.querySelector(".song-reading-sheet-close")?.focus());
  };

  const setMode = (active) => {
    document.body.classList.toggle("song-reading-mode", active);
    setSettingsOpen(false);

    if (active && isMobile()) {
      moveSettingsToSheet();
      requestAnimationFrame(() => {
        $("#songLyrics")?.scrollIntoView({ behavior: "smooth", block: "start" });
        requestProgressUpdate();
      });
    } else if (!active || !isMobile()) {
      restoreSettingsFromSheet();
    }

    syncModeButtons();
    requestProgressUpdate();
  };

  const toggleSettings = () => {
    if (!document.body.classList.contains("song-reading-mode")) return;
    setSettingsOpen(!document.body.classList.contains("song-reading-settings-open"));
  };

  const showStatus = (message) => {
    const status = $("#songActionStatus");
    if (!status) return;
    status.textContent = message;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => { status.textContent = ""; }, 2600);
  };

  const shareSong = async () => {
    const title = $("#songTitle")?.textContent?.trim() || "Canción";
    const url = window.location.href;
    const text = `Te comparto “${title}” en Juntos Hacia Dios.`;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      showStatus("Enlace copiado.");
    } catch (_) {
      window.prompt("Copia este enlace:", url);
    }
  };

  const install = () => {
    const toolbar = $("#songReaderToolbar");
    if (!toolbar) return false;
    if ($("#songReaderActions")) return true;

    const actions = document.createElement("div");
    actions.id = "songReaderActions";
    actions.className = "song-reader-actions";
    actions.innerHTML = [
      '<button class="song-btn small-btn secondary" id="songReadingMode" type="button" aria-pressed="false">Modo lectura</button>',
      '<button class="song-btn small-btn secondary" id="songReadingSettings" type="button" aria-expanded="false">Ajustes</button>',
      '<button class="song-btn small-btn secondary" id="songShare" type="button">Compartir</button>',
      '<button class="song-btn small-btn secondary" id="songPrint" type="button">Imprimir</button>',
      '<span class="song-action-status" id="songActionStatus" aria-live="polite"></span>'
    ].join("");

    toolbar.insertBefore(actions, toolbar.querySelector(".song-reader-controls") || null);
    actions.querySelector("#songReadingMode")?.addEventListener("click", () => setMode(!document.body.classList.contains("song-reading-mode")));
    actions.querySelector("#songReadingSettings")?.addEventListener("click", toggleSettings);
    actions.querySelector("#songShare")?.addEventListener("click", shareSong);
    actions.querySelector("#songPrint")?.addEventListener("click", () => window.print());
    ensureAssistiveControls();
    syncModeButtons();
    return true;
  };

  window.addEventListener("scroll", requestProgressUpdate, { passive: true });
  window.addEventListener("resize", () => {
    if (document.body.classList.contains("song-reading-mode")) {
      if (isMobile()) moveSettingsToSheet();
      else {
        setSettingsOpen(false);
        restoreSettingsFromSheet();
      }
    }
    syncModeButtons();
    requestProgressUpdate();
  }, { passive: true });

  const observer = new MutationObserver(() => {
    install();
    if (document.body.classList.contains("song-reading-mode") && isMobile()) moveSettingsToSheet();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  install();
})();
