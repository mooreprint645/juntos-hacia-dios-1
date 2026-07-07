(() => {
  if (window.__jhdSongReadingMode) return;
  window.__jhdSongReadingMode = true;

  const setMode = (active) => {
    document.body.classList.toggle("song-reading-mode", active);
    const button = document.getElementById("songReadingMode");
    if (!button) return;
    button.textContent = active ? "Salir de lectura" : "Modo lectura";
    button.setAttribute("aria-pressed", String(active));
    if (active) requestAnimationFrame(() => document.getElementById("songLyrics")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const install = () => {
    const toolbar = document.getElementById("songReaderToolbar");
    if (!toolbar || document.getElementById("songReadingMode")) return false;

    const actions = document.createElement("div");
    actions.className = "song-reader-actions";
    actions.innerHTML = '<button class="song-btn small-btn secondary" id="songReadingMode" type="button" aria-pressed="false">Modo lectura</button>';
    toolbar.insertBefore(actions, toolbar.querySelector(".song-reader-controls") || null);
    actions.querySelector("#songReadingMode")?.addEventListener("click", () => setMode(!document.body.classList.contains("song-reading-mode")));
    return true;
  };

  if (install()) return;
  const observer = new MutationObserver(() => {
    if (install()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
