(() => {
  const JHD = window.JHD;
  if (!JHD) return;

  const installHomeSearchStyle = () => {
    if (document.getElementById("homeSearchResultsStyle")) return;
    const style = document.createElement("style");
    style.id = "homeSearchResultsStyle";
    style.textContent = `
      .home-discovery-search{position:relative;z-index:30}
      .home-search-results{grid-column:1/-1;display:grid;gap:12px;max-height:430px;overflow:auto;padding:4px;background:var(--card);border:1px solid var(--border);border-radius:18px;box-shadow:var(--shadow)}
      .home-search-results[hidden]{display:none}
      .home-search-group{display:grid;gap:7px}
      .home-search-group-title{margin:4px 6px 0;color:var(--gold);font-size:.75rem;letter-spacing:.12em;font-weight:900;text-transform:uppercase}
      .home-search-result{display:flex;align-items:center;gap:11px;padding:12px;border:1px solid transparent;border-radius:14px;color:var(--text);text-decoration:none;background:rgba(255,255,255,.025)}
      .home-search-result:hover,.home-search-result:focus-visible{border-color:var(--gold);background:rgba(246,196,83,.08);outline:none}
      .home-search-result-icon{display:grid;place-items:center;flex:0 0 32px;width:32px;height:32px;border-radius:10px;background:rgba(246,196,83,.16);color:var(--gold);font-weight:900}
      .home-search-result-copy{display:grid;gap:1px;min-width:0}
      .home-search-result-copy strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .home-search-result-copy small{color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .home-search-empty{padding:11px;color:var(--muted);font-size:.94rem}
      @media(max-width:560px){.home-search-results{grid-column:1;max-height:390px}.home-search-result{padding:11px}.home-search-result-copy small{white-space:normal}}
    `;
    document.head.append(style);
  };

  const installHomeSearch = () => {
    if (JHD.page() !== "index.html" || document.getElementById("homeSongSearch")) return;
    const actions = document.querySelector(".hero .hero-actions");
    if (!actions) return;

    installHomeSearchStyle();
    const form = document.createElement("form");
    form.className = "home-discovery-search";
    form.innerHTML = '<label for="homeSongSearch">Buscar un canto o artista</label><input id="homeSongSearch" type="search" placeholder="Buscar canción, artista, tono o categoría..." autocomplete="off"><button class="song-btn" type="submit">Buscar</button><div id="homeSearchResults" class="home-search-results" hidden></div>';
    actions.before(form);

    const input = form.querySelector("#homeSongSearch");
    const results = form.querySelector("#homeSearchResults");
    let timer = 0;
    let requestNumber = 0;

    const hideResults = () => {
      results.hidden = true;
      results.innerHTML = "";
    };

    const songLink = (song, relatedToArtist = false) => {
      const href = `cancion.html?slug=${encodeURIComponent(song.slug || JHD.slugify(song.title))}`;
      const meta = relatedToArtist ? "Canción del artista" : JHD.songMeta(song);
      return `<a class="home-search-result" href="${href}"><span class="home-search-result-icon">♫</span><span class="home-search-result-copy"><strong>${JHD.esc(song.title || "Canción")}</strong><small>${JHD.esc(meta || "Ver letra y acordes")}</small></span></a>`;
    };

    const artistLink = (artist) => {
      const href = `artista.html?slug=${encodeURIComponent(artist.slug || JHD.slugify(artist.name))}`;
      return `<a class="home-search-result" href="${href}"><span class="home-search-result-icon">✝</span><span class="home-search-result-copy"><strong>${JHD.esc(artist.name || "Artista")}</strong><small>${JHD.esc(artist.description || "Ver artista y sus cantos")}</small></span></a>`;
    };

    const renderResults = (artists, songs, relatedSongIds, query) => {
      const artistHtml = artists.length ? artists.map(artistLink).join("") : '<p class="home-search-empty">No hay artistas que coincidan.</p>';
      const songHtml = songs.length ? songs.map((song) => songLink(song, relatedSongIds.has(String(song.id)))).join("") : '<p class="home-search-empty">No hay canciones que coincidan.</p>';
      results.innerHTML = `<div class="home-search-group"><p class="home-search-group-title">Artistas</p>${artistHtml}</div><div class="home-search-group"><p class="home-search-group-title">Canciones</p>${songHtml}</div>`;
      results.hidden = false;
      results.dataset.query = query;
    };

    const search = async () => {
      const query = input.value.trim();
      if (query.length < 2) {
        hideResults();
        return;
      }
      if (!JHD.sb) return;

      const currentRequest = ++requestNumber;
      results.hidden = false;
      results.innerHTML = '<p class="home-search-empty">Buscando artistas y canciones...</p>';

      try {
        const [artistsRes, titleSongsRes] = await Promise.all([
          JHD.sb.from("artists").select("id,name,slug,description").ilike("name", `%${query}%`).order("name", { ascending: true }).limit(4),
          JHD.sb.from("songs").select("id,title,slug,song_type,tone,difficulty").ilike("title", `%${query}%`).order("title", { ascending: true }).limit(6)
        ]);
        if (currentRequest !== requestNumber) return;

        const artists = artistsRes.data || [];
        const directSongs = titleSongsRes.data || [];
        let artistSongs = [];
        let relatedSongIds = new Set();
        const artistIds = artists.map((artist) => artist.id).filter(Boolean);

        if (artistIds.length) {
          const relationsRes = await JHD.sb.from("song_artists").select("song_id").in("artist_id", artistIds);
          if (currentRequest !== requestNumber) return;
          const songIds = [...new Set((relationsRes.data || []).map((row) => row.song_id).filter(Boolean))];
          if (songIds.length) {
            const artistSongsRes = await JHD.sb.from("songs").select("id,title,slug,song_type,tone,difficulty").in("id", songIds).order("title", { ascending: true }).limit(6);
            if (currentRequest !== requestNumber) return;
            artistSongs = artistSongsRes.data || [];
            relatedSongIds = new Set(artistSongs.map((song) => String(song.id)));
          }
        }

        const songMap = new Map();
        [...artistSongs, ...directSongs].forEach((song) => songMap.set(String(song.id), song));
        renderResults(artists, [...songMap.values()].slice(0, 6), relatedSongIds, query);
      } catch (_) {
        if (currentRequest !== requestNumber) return;
        results.innerHTML = '<p class="home-search-empty">No se pudo realizar la búsqueda. Intenta otra vez.</p>';
        results.hidden = false;
      }
    };

    input.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(search, 260);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") hideResults();
    });
    input.addEventListener("blur", () => setTimeout(hideResults, 180));
    input.addEventListener("focus", () => {
      if (input.value.trim().length >= 2) search();
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const query = input.value.trim();
      location.href = `canciones.html${query ? `?buscar=${encodeURIComponent(query)}` : ""}`;
    });
  };

  const renderGroups = (categories) => {
    const old = document.getElementById("homeFaithAccess");
    if (old) old.remove();
    const hero = document.querySelector(".hero");
    if (!hero) return;

    const group = (type, title, description) => {
      const typed = (categories || []).filter((item) => JHD.normalize(item.song_type) === type);
      let roots = typed.filter((item) => !item.parent_id);
      const generic = type === "catolico" ? ["catolico", "catolica"] : ["cristiano", "cristiana"];
      if (roots.length === 1 && generic.includes(JHD.normalize(roots[0].name))) {
        const children = typed.filter((item) => String(item.parent_id) === String(roots[0].id));
        if (children.length) roots = children;
      }
      roots = roots.sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)).slice(0, 8);
      const cards = roots.map((item) => `<a class="home-access-card" href="categorias.html?tipo=${type}&carpeta=${encodeURIComponent(item.slug || item.id)}"><strong>${JHD.esc(item.name || "Categoría")}</strong><small>Ver cantos</small></a>`).join("");
      return `<article class="home-access-group"><div class="home-access-group-heading"><span class="home-access-symbol">✝</span><div><h3>${title}</h3><p>${description}</p></div></div>${cards ? `<div class="home-access-grid">${cards}</div>` : '<p class="home-access-empty">Aún no hay categorías disponibles.</p>'}<div class="home-access-footer"><a class="text-link" href="categorias.html?tipo=${type}">Ver todas</a></div></article>`;
    };

    const section = document.createElement("section");
    section.id = "homeFaithAccess";
    section.className = "section home-faith-access";
    section.innerHTML = `<div class="section-heading"><p class="hero-kicker">Encuentra rápido</p><h2>¿Para qué necesitas un canto?</h2></div><div class="home-access-groups">${group("catolico", "Católico", "Misa, tiempos litúrgicos y devociones.")}${group("cristiano", "Cristiano", "Alabanza, oración y ministerios.")}</div>`;
    hero.insertAdjacentElement("afterend", section);
  };

  JHD.loadHome = async () => {
    if (JHD.page() !== "index.html") return;
    installHomeSearch();
    const songsBox = JHD.$("#homeSongsGrid");
    const artistsBox = JHD.$("#homeArtistsGrid");
    if (!JHD.sb) {
      if (songsBox) songsBox.innerHTML = JHD.errorCard("Sin conexión", "No se pudo iniciar la biblioteca de canciones.");
      if (artistsBox) artistsBox.innerHTML = JHD.errorCard("Sin conexión", "No se pudo iniciar la biblioteca de artistas.");
      renderGroups([]);
      return;
    }

    const [songsRes, artistsRes, categoriesRes] = await Promise.all([
      JHD.sb.from("songs").select("id,title,slug,song_type,tone,difficulty").order("title", { ascending: true }).limit(6),
      JHD.sb.from("artists").select("id,name,slug,description,artist_type").order("name", { ascending: true }).limit(6),
      JHD.sb.from("categories").select("id,name,slug,parent_id,song_type,sort_order").order("sort_order", { ascending: true }).order("name", { ascending: true })
    ]);

    if (songsBox) {
      if (songsRes.error) songsBox.innerHTML = JHD.errorCard("Error al cargar canciones", songsRes.error.message);
      else {
        const cards = (songsRes.data || []).map((song) => {
          const href = `cancion.html?slug=${encodeURIComponent(song.slug || JHD.slugify(song.title))}`;
          return `<a class="song-card song-link-card" href="${href}"><h3>${JHD.esc(song.title || "Canción sin título")}</h3><p>${JHD.esc(JHD.songMeta(song))}</p></a>`;
        });
        songsBox.innerHTML = cards.length ? cards.join("") : JHD.errorCard("Sin canciones", "Aún no hay canciones publicadas.");
      }
    }

    if (artistsBox) {
      if (artistsRes.error) artistsBox.innerHTML = JHD.errorCard("Error al cargar artistas", artistsRes.error.message);
      else {
        const cards = (artistsRes.data || []).map(JHD.artistCard);
        artistsBox.innerHTML = cards.length ? cards.join("") : JHD.errorCard("Sin artistas", "Aún no hay artistas publicados.");
      }
    }

    renderGroups(categoriesRes.data || []);
  };

  document.addEventListener("click", (event) => {
    const link = event.target.closest('a[href^="artista.html?slug="]');
    if (!link) return;
    event.preventDefault();
    const url = new URL(link.href);
    location.href = `artistas.html?slug=${encodeURIComponent(url.searchParams.get("slug") || "")}`;
  });
})();
