(() => {
  const JHD = window.JHD;
  if (!JHD || JHD.page() !== "index.html") return;

  const CACHE_KEY = "jhd-home-search-index-v3";
  const CACHE_MAX_AGE = 10 * 60 * 1000;
  const esc = (value) => JHD.esc(value);
  const normalize = (value) => JHD.normalize(value);
  const cleanDescription = (value) => String(value || "").replace(/<!--JHD_ARTIST_META:[\s\S]*?-->\s*$/, "").trim();

  function readCache() {
    try {
      const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null");
      if (!cached?.savedAt || Date.now() - cached.savedAt > CACHE_MAX_AGE) return null;
      return cached.data;
    } catch (_) {
      return null;
    }
  }

  function writeCache(data) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data }));
    } catch (_) {}
  }

  async function buildSearchIndex() {
    const cached = readCache();
    if (cached) return cached;
    if (!JHD.sb) return { artists: [], songs: [] };

    const [artistsRes, songsRes, songArtistsRes, categoriesRes, songCategoriesRes] = await Promise.all([
      JHD.sb.from("artists").select("id,name,slug,description").order("name", { ascending: true }),
      JHD.sb.from("songs").select("id,title,slug,song_type,tone,difficulty").order("title", { ascending: true }),
      JHD.sb.from("song_artists").select("song_id,artist_id"),
      JHD.sb.from("categories").select("id,name"),
      JHD.sb.from("song_categories").select("song_id,category_id")
    ]);

    const artists = artistsRes.data || [];
    const songs = songsRes.data || [];
    const artistById = new Map(artists.map((artist) => [String(artist.id), artist]));
    const categoryById = new Map((categoriesRes.data || []).map((category) => [String(category.id), category]));
    const artistNamesBySong = new Map();
    const categoryNamesBySong = new Map();

    (songArtistsRes.data || []).forEach((row) => {
      const artist = artistById.get(String(row.artist_id));
      if (!artist) return;
      const id = String(row.song_id);
      if (!artistNamesBySong.has(id)) artistNamesBySong.set(id, []);
      artistNamesBySong.get(id).push(artist.name || "");
    });

    (songCategoriesRes.data || []).forEach((row) => {
      const category = categoryById.get(String(row.category_id));
      if (!category) return;
      const id = String(row.song_id);
      if (!categoryNamesBySong.has(id)) categoryNamesBySong.set(id, []);
      categoryNamesBySong.get(id).push(category.name || "");
    });

    const data = {
      artists: artists.map((artist) => {
        const description = cleanDescription(artist.description);
        return {
          id: artist.id,
          name: artist.name || "",
          slug: artist.slug || "",
          description,
          search: normalize([artist.name, artist.slug, description].join(" "))
        };
      }),
      songs: songs.map((song) => {
        const artistsForSong = artistNamesBySong.get(String(song.id)) || [];
        const categoriesForSong = categoryNamesBySong.get(String(song.id)) || [];
        return {
          id: song.id,
          title: song.title || "",
          slug: song.slug || "",
          song_type: song.song_type || "",
          tone: song.tone || "",
          difficulty: song.difficulty || "",
          artists: artistsForSong,
          categories: categoriesForSong,
          search: normalize([song.title, song.song_type, song.tone, song.difficulty, artistsForSong.join(" "), categoriesForSong.join(" ")].join(" "))
        };
      })
    };

    writeCache(data);
    return data;
  }

  function installSearch() {
    const actions = document.querySelector(".hero .hero-actions");
    if (!actions || document.getElementById("homeSongSearch")) return;

    const form = document.createElement("form");
    form.className = "home-discovery-search";
    form.setAttribute("role", "search");
    form.innerHTML = [
      '<label for="homeSongSearch">Buscar un canto, artista o categoría</label>',
      '<input id="homeSongSearch" type="search" placeholder="Buscar canción, artista, tono o categoría..." autocomplete="off" aria-describedby="homeSearchHelp">',
      '<button class="song-btn" type="submit">Buscar</button>',
      '<p id="homeSearchHelp" class="sr-only">Escribe al menos dos letras para ver sugerencias.</p>',
      '<div id="homeSearchResults" class="home-search-results" role="status" aria-live="polite" hidden></div>'
    ].join("");
    actions.before(form);

    const input = form.querySelector("#homeSongSearch");
    const results = form.querySelector("#homeSearchResults");
    let index = null;
    let preparing = false;
    let timer = 0;

    const hide = () => {
      results.hidden = true;
      results.innerHTML = "";
    };

    const artistItem = (artist) => `<a class="home-search-result" href="artista.html?slug=${encodeURIComponent(artist.slug || JHD.slugify(artist.name))}"><span class="home-search-result-icon" aria-hidden="true">✝</span><span class="home-search-result-copy"><strong>${esc(artist.name)}</strong><small>${esc(artist.description || "Ver artista y sus cantos")}</small></span></a>`;
    const songItem = (song) => {
      const meta = [song.artists.join(" · "), song.categories.join(" · "), song.song_type ? JHD.typeLabel(song.song_type) : "", song.tone ? `Tono ${song.tone}` : ""].filter(Boolean).join(" · ");
      return `<a class="home-search-result" href="cancion.html?slug=${encodeURIComponent(song.slug || JHD.slugify(song.title))}"><span class="home-search-result-icon" aria-hidden="true">♫</span><span class="home-search-result-copy"><strong>${esc(song.title)}</strong><small>${esc(meta || "Ver letra y acordes")}</small></span></a>`;
    };

    const render = (query) => {
      const key = normalize(query);
      if (key.length < 2) {
        hide();
        return;
      }
      if (!index) {
        results.hidden = false;
        results.innerHTML = '<p class="home-search-empty">Preparando búsqueda…</p>';
        return;
      }

      const artists = index.artists.filter((artist) => artist.search.includes(key)).slice(0, 4);
      const songs = index.songs.filter((song) => song.search.includes(key)).slice(0, 6);
      results.innerHTML = [
        '<div class="home-search-group"><p class="home-search-group-title">Artistas</p>',
        artists.length ? artists.map(artistItem).join("") : '<p class="home-search-empty">No hay artistas que coincidan.</p>',
        '</div>',
        '<div class="home-search-group"><p class="home-search-group-title">Canciones</p>',
        songs.length ? songs.map(songItem).join("") : '<p class="home-search-empty">No hay canciones que coincidan.</p>',
        '</div>'
      ].join("");
      results.hidden = false;
    };

    const prepare = async () => {
      if (index || preparing) return;
      preparing = true;
      try {
        index = await buildSearchIndex();
      } catch (_) {
        index = { artists: [], songs: [] };
      } finally {
        preparing = false;
        if (input.value.trim().length >= 2) render(input.value);
      }
    };

    input.addEventListener("focus", prepare, { once: true });
    input.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        prepare();
        render(input.value);
      }, 120);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") hide();
    });
    input.addEventListener("blur", () => setTimeout(hide, 180));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const query = input.value.trim();
      location.href = `canciones.html${query ? `?buscar=${encodeURIComponent(query)}` : ""}`;
    });

    setTimeout(prepare, 750);
  }

  function homeRoots(categories, type) {
    const typed = (categories || []).filter((category) => normalize(category.song_type) === type);
    let roots = typed.filter((category) => !category.parent_id);
    const generic = type === "catolico" ? ["catolico", "catolica"] : ["cristiano", "cristiana"];
    if (roots.length === 1 && generic.includes(normalize(roots[0].name))) {
      const children = typed.filter((category) => String(category.parent_id) === String(roots[0].id));
      if (children.length) roots = children;
    }
    return roots.sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.name || "").localeCompare(String(b.name || ""), "es"));
  }

  function renderFaithAccess(categories, songCategoryLinks) {
    document.getElementById("homeFaithAccess")?.remove();
    const hero = document.querySelector(".hero");
    if (!hero) return;

    const descendants = (categoryId) => {
      const ids = new Set([String(categoryId)]);
      let changed = true;
      while (changed) {
        changed = false;
        (categories || []).forEach((category) => {
          const id = String(category.id || "");
          if (category.parent_id && ids.has(String(category.parent_id)) && !ids.has(id)) {
            ids.add(id);
            changed = true;
          }
        });
      }
      return ids;
    };

    const countSongs = (categoryId) => {
      const ids = descendants(categoryId);
      return new Set((songCategoryLinks || []).filter((row) => ids.has(String(row.category_id))).map((row) => String(row.song_id))).size;
    };

    const group = (type, title, description, symbol) => {
      const cards = homeRoots(categories, type).slice(0, 8).map((category) => {
        const count = countSongs(category.id);
        const key = category.slug || category.id;
        return `<a class="home-access-card" href="categorias.html?tipo=${type}&carpeta=${encodeURIComponent(key)}"><strong>${esc(category.name || "Categoría")}</strong><small>${count} ${count === 1 ? "canto" : "cantos"}</small></a>`;
      }).join("");
      return `<article class="home-access-group"><div class="home-access-group-heading"><span class="home-access-symbol" aria-hidden="true">${symbol}</span><div><h3>${title}</h3><p>${description}</p></div></div>${cards ? `<div class="home-access-grid">${cards}</div>` : '<p class="home-access-empty">Las categorías aparecerán aquí cuando se agreguen.</p>'}<div class="home-access-footer"><a class="text-link" href="categorias.html?tipo=${type}">Ver todas</a></div></article>`;
    };

    const section = document.createElement("section");
    section.id = "homeFaithAccess";
    section.className = "section home-faith-access";
    section.innerHTML = `<div class="section-heading"><p class="hero-kicker">Encuentra rápido</p><h2>¿Para qué necesitas un canto?</h2></div><div class="home-access-groups">${group("catolico", "Católico", "Misa, tiempos litúrgicos y devociones.", "✝")}${group("cristiano", "Cristiano", "Alabanza, oración y ministerios.", "♫")}</div>`;
    hero.insertAdjacentElement("afterend", section);
  }

  async function loadHome() {
    const songsBox = document.querySelector("#homeSongsGrid");
    const artistsBox = document.querySelector("#homeArtistsGrid");
    installSearch();

    if (!JHD.sb) {
      if (songsBox) songsBox.innerHTML = JHD.errorCard("Sin conexión", "No se pudo iniciar la biblioteca de canciones.");
      if (artistsBox) artistsBox.innerHTML = JHD.errorCard("Sin conexión", "No se pudo iniciar la biblioteca de artistas.");
      renderFaithAccess([], []);
      return;
    }

    const [songsRes, artistsRes, categoriesRes, categoryLinksRes] = await Promise.all([
      JHD.fetchSongsWithRelations(null, { orderBy: "created_at", ascending: false, limit: 6 }),
      JHD.sb.from("artists").select("id,name,slug,description,artist_type,created_at").order("created_at", { ascending: false }).limit(6),
      JHD.sb.from("categories").select("id,name,slug,parent_id,song_type,sort_order").order("sort_order", { ascending: true }).order("name", { ascending: true }),
      JHD.sb.from("song_categories").select("song_id,category_id")
    ]);

    if (songsBox) {
      songsBox.innerHTML = songsRes.error
        ? JHD.errorCard("Error al cargar canciones", songsRes.error.message)
        : (songsRes.data || []).length
          ? (songsRes.data || []).map(JHD.songCard).join("")
          : JHD.errorCard("Sin canciones", "Aún no hay canciones publicadas.");
    }

    if (artistsBox) {
      artistsBox.innerHTML = artistsRes.error
        ? JHD.errorCard("Error al cargar artistas", artistsRes.error.message)
        : (artistsRes.data || []).length
          ? (artistsRes.data || []).map((artist) => JHD.artistCard({ ...artist, description: cleanDescription(artist.description) })).join("")
          : JHD.errorCard("Sin artistas", "Aún no hay artistas publicados.");
    }

    renderFaithAccess(categoriesRes.data || [], categoryLinksRes.data || []);
  }

  document.addEventListener("DOMContentLoaded", loadHome);
})();