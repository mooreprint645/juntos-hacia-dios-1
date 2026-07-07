(() => {
  if (window.__jhdSongReadingMode) return;
  window.__jhdSongReadingMode = true;

  let statusTimer;

  const setMode = (active) => {
    document.body.classList.toggle("song-reading-mode", active);
    const button = document.getElementById("songReadingMode");
    if (!button) return;
    button.textContent = active ? "Salir de lectura" : "Modo lectura";
    button.setAttribute("aria-pressed", String(active));
    if (active) requestAnimationFrame(() => document.getElementById("songLyrics")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const showStatus = (message) => {
    const status = document.getElementById("songActionStatus");
    if (!status) return;
    status.textContent = message;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => { status.textContent = ""; }, 2600);
  };

  const shareSong = async () => {
    const title = document.getElementById("songTitle")?.textContent?.trim() || "Canción";
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
    const toolbar = document.getElementById("songReaderToolbar");
    if (!toolbar) return false;
    if (document.getElementById("songReaderActions")) return true;

    const actions = document.createElement("div");
    actions.id = "songReaderActions";
    actions.className = "song-reader-actions";
    actions.innerHTML = [
      '<button class="song-btn small-btn secondary" id="songReadingMode" type="button" aria-pressed="false">Modo lectura</button>',
      '<button class="song-btn small-btn secondary" id="songShare" type="button">Compartir</button>',
      '<button class="song-btn small-btn secondary" id="songPrint" type="button">Imprimir</button>',
      '<span class="song-action-status" id="songActionStatus" aria-live="polite"></span>'
    ].join("");

    toolbar.insertBefore(actions, toolbar.querySelector(".song-reader-controls") || null);
    actions.querySelector("#songReadingMode")?.addEventListener("click", () => setMode(!document.body.classList.contains("song-reading-mode")));
    actions.querySelector("#songShare")?.addEventListener("click", shareSong);
    actions.querySelector("#songPrint")?.addEventListener("click", () => window.print());
    return true;
  };

  if (install()) return;
  const observer = new MutationObserver(() => {
    if (install()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
