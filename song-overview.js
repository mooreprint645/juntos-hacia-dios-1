(() => {
  if (window.__jhdSongOverview) return;
  window.__jhdSongOverview = true;

  function install() {
    const shell = document.querySelector(".song-reader-shell");
    const toolbar = document.getElementById("songReaderToolbar");
    const lyrics = document.getElementById("songLyrics");
    if (!shell || !toolbar || !lyrics) return false;

    if (!document.getElementById("songReaderOverview")) {
      const type = document.getElementById("songType")?.textContent?.trim() || "Canción";
      const title = document.getElementById("songTitle")?.textContent?.trim() || "";
      const subtitle = document.getElementById("songSubtitle")?.textContent?.trim() || "";
      const overview = document.createElement("section");
      overview.id = "songReaderOverview";
      overview.className = "song-reader-overview";
      overview.innerHTML = `<div class="song-reader-overview-copy"><p class="hero-kicker">${type}</p><h2>Letra y acordes</h2><p>${subtitle || (title ? `Consulta ${title} y prepara tu interpretación.` : "Prepara tu interpretación con letra, acordes y ajustes de tono.")}</p></div><div class="song-reader-overview-actions"><a class="song-btn secondary" href="#songLyrics">Ir a la letra</a><a class="song-btn secondary" href="#relatedSongsSection">Relacionadas</a></div>`;
      toolbar.before(overview);
    }

    if (!document.getElementById("songLyricsHeading")) {
      const heading = document.createElement("div");
      heading.id = "songLyricsHeading";
      heading.className = "song-lyrics-heading";
      heading.innerHTML = "<div><p class='hero-kicker'>Cancionero</p><h2>Letra y acordes</h2><p>Ajusta el tono, capo y tamaño de letra desde los controles.</p></div>";
      lyrics.before(heading);
    }

    const links = document.getElementById("songLinks");
    if (links && !document.getElementById("songResourcesHeading")) {
      const observer = new MutationObserver(() => {
        if (links.hidden || !links.children.length) return;
        const heading = document.createElement("h3");
        heading.id = "songResourcesHeading";
        heading.className = "song-resource-heading";
        heading.textContent = "Recursos";
        links.before(heading);
        observer.disconnect();
      });
      observer.observe(links, { childList: true, attributes: true, attributeFilter: ["hidden"] });
    }

    return true;
  }

  if (install()) return;
  const observer = new MutationObserver(() => {
    if (install()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
