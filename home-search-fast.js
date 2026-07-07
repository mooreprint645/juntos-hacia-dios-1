(() => {
  const JHD = window.JHD;
  if (!JHD || JHD.page() !== "index.html") return;

  const CACHE_KEY = "jhd-home-search-index-v2";
  const CACHE_MAX_AGE = 10 * 60 * 1000;
  const normalize = (value) => JHD.normalize(value);
  const esc = (value) => JHD.esc(value);
  const cleanDescription = (value) => String(value || "").replace(/<!--JHD_ARTIST_META:[\s\S]*?-->\s*$/, "").trim();

  JHD.artistCard = (artist) => {
    const initials = String(artist.name || "JHD").split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase();
    const description = cleanDescription(artist.description);
    return `<a class="artist-card" href="artista.html?slug=${encodeURIComponent(artist.slug || JHD.slugify(artist.name))}"><div class="artist-mini-avatar">${esc(initials)}</div><h3>${esc(artist.name || "Artista")}</h3><p>${esc(description || `${JHD.typeLabel(artist.artist_type)} · Ver canciones y álbumes.`)}</p></a>`;
  };

  const readCache = () => {
    try {
      const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null");
      if (!cached || !cached.savedAt || Date.now() - cached.savedAt > CACHE_MAX_AGE) return null;
      return cached.data;
    } catch (_) {
      return null;
    }
  };

  const writeCache = (data) => {
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data })); } catch (_) {}
  };

  const buildIndex = async () => {
    const cached = readCache();
    if (cached) return cached;
    if (!JHD.sb) return { artists: [], songs: [] };

    const [artistsRes, songsRes, relationsRes] = await Promise.all([
      JHD.sb.from("artists").select("id,name,slug,description").order("name", { ascending: true }),
      JHD.sb.from("songs").select("id,title,slug,song_type,tone,difficulty").order("title", { ascending: true }),
      JHD.sb.from("song_artists").select("song_id,artist_id")
    ]);

    const artists = artistsRes.data || [];
    const songs = songsRes.data || [];
    const artistById = new Map(artists.map((artist) => [String(artist.id), artist]));
    const artistNamesBySong = new Map();

    (relationsRes.data || []).forEach((relation) => {
      const artist = artistById.get(String(relation.artist_id));
      if (!artist) return;
      const songId = String(relation.song_id);
      if (!artistNamesBySong.has(songId)) artistNamesBySong.set(songId, []);
      artistNamesBySong.get(songId).push(artist.name || "");
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
        const artistNames = artistNamesBySong.get(String(song.id)) || [];
        return {
          id: song.id,
          title: song.title || "",
          slug: song.slug || "",
          song_type: song.song_type || "",
          tone: song.tone || "",
          difficulty: song.difficulty || "",
          artists: artistNames,
          search: normalize([song.title, song.song_type, song.tone, song.difficulty, artistNames.join(" ")].join(" "))
        };
      })
    };

    writeCache(data);
    return data;
  };

  const install = () => {
    const oldForm = document.querySelector(".home-discovery-search");
    if (!oldForm || oldForm.dataset.fastSearch === "true") return false;

    const form = oldForm.cloneNode(true);
    form.dataset.fastSearch = "true";
    oldForm.replaceWith(form);

    const input = form.querySelector("#homeSongSearch");
    const results = form.querySelector("#homeSearchResults");
    const button = form.querySelector("button");
    if (!input || !results || !button) return true;

    let index = null;
    let loading = false;
    let timer = 0;

    const hide = () => {
      results.hidden = true;
      results.innerHTML = "";
    };

    const artistItem = (artist) => `<a class="home-search-result" href="artista.html?slug=${encodeURIComponent(artist.slug || JHD.slugify(artist.name))}"><span class="home-search-result-icon">✝</span><span class="home-search-result-copy"><strong>${esc(artist.name)}</strong><small>${esc(artist.description || "Ver artista y sus cantos")}</small></span></a>`;
    const songItem = (song) => {
      const meta = [song.artists.join(" · "), song.song_type ? JHD.typeLabel(song.song_type) : "", song.tone ? `Tono ${song.tone}` : ""].filter(Boolean).join(" · ");
      return `<a class="home-search-result" href="cancion.html?slug=${encodeURIComponent(song.slug || JHD.slugify(song.title))}"><span class="home-search-result-icon">♫</span><span class="home-search-result-copy"><strong>${esc(song.title)}</strong><small>${esc(meta || "Ver letra y acordes")}</small></span></a>`;
    };

    const render = (query) => {
      const key = normalize(query);
      if (key.length < 2) {
        hide();
        return;
      }
      if (!index) {
        results.hidden = false;
        results.innerHTML = '<p class="home-search-empty">Preparando búsqueda...</p>';
        return;
      }

      const artists = index.artists.filter((artist) => artist.search.includes(key)).slice(0, 4);
      const songs = index.songs.filter((song) => song.search.includes(key)).slice(0, 6);
      const artistHtml = artists.length ? artists.map(artistItem).join("") : '<p class="home-search-empty">No hay artistas que coincidan.</p>';
      const songHtml = songs.length ? songs.map(songItem).join("") : '<p class="home-search-empty">No hay canciones que coincidan.</p>';
      results.innerHTML = `<div class="home-search-group"><p class="home-search-group-title">Artistas</p>${artistHtml}</div><div class="home-search-group"><p class="home-search-group-title">Canciones</p>${songHtml}</div>`;
      results.hidden = false;
    };

    const prepare = async () => {
      if (index || loading) return;
      loading = true;
      try { index = await buildIndex(); }
      catch (_) { index = { artists: [], songs: [] }; }
      finally {
        loading = false;
        if (input.value.trim().length >= 2) render(input.value);
      }
    };

    input.addEventListener("focus", prepare, { once: true });
    input.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        prepare();
        render(input.value);
      }, 80);
    });
    input.addEventListener("keydown", (event) => { if (event.key === "Escape") hide(); });
    input.addEventListener("blur", () => setTimeout(hide, 180));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const query = input.value.trim();
      location.href = `canciones.html${query ? `?buscar=${encodeURIComponent(query)}` : ""}`;
    });

    setTimeout(prepare, 700);
    return true;
  };

  const boot = () => {
    if (install()) return;
    const observer = new MutationObserver(() => {
      if (install()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
