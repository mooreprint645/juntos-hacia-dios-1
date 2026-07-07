(() => {
  if (window.__jhdSongOverview) return;
  window.__jhdSongOverview = true;

  const text = (value) => String(value || "");

  function install() {
    const shell = document.querySelector(".song-reader-shell");
    const toolbar = document.getElementById("songReaderToolbar");
    const lyrics = document.getElementById("songLyrics");
    if (!shell || !toolbar || !lyrics) return false;

    if (!document.getElementById("songReaderOverview")) {
      const type = text(document.getElementById("songType")?.textContent).trim() || "Canción";
      const title = text(document.getElementById("songTitle")?.textContent).trim();
      const subtitle = text(document.getElementById("songSubtitle")?.textContent).trim();
      const overview = document.createElement("section");
      overview.id = "songReaderOverview";
      overview.className = "song-reader-overview";

      const copy = document.createElement("div");
      copy.className = "song-reader-overview-copy";
      const kicker = document.createElement("p");
      kicker.className = "hero-kicker";
      kicker.textContent = type;
      const heading = document.createElement("h2");
      heading.textContent = "Letra y acordes";
      const description = document.createElement("p");
      description.textContent = subtitle || (title ? `Consulta ${title} y prepara tu interpretación.` : "Prepara tu interpretación con letra, acordes y ajustes de tono.");
      copy.append(kicker, heading, description);

      const actions = document.createElement("div");
      actions.className = "song-reader-overview-actions";
      actions.innerHTML = '<a class="song-btn secondary" href="#songLyrics">Ir a la letra</a><a class="song-btn secondary" href="#relatedSongsSection">Relacionadas</a>';
      overview.append(copy, actions);
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
