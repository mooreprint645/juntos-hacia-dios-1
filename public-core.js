const JHD = window.JHD || {};
window.JHD = JHD;

JHD.sb = window.supabaseClient;
JHD.$ = (selector, root = document) => root.querySelector(selector);
JHD.$$ = (selector, root = document) => [...root.querySelectorAll(selector)];
JHD.page = () => (location.pathname.split("/").pop() || "index.html").toLowerCase();
JHD.param = (name) => new URLSearchParams(location.search).get(name) || "";
JHD.esc = (value) => String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
JHD.normalize = (value) => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
JHD.slugify = (value) => JHD.normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
JHD.typeLabel = (value) => ({ catolico: "Católico", cristiano: "Cristiano", mixto: "Mixto" }[JHD.normalize(value)] || "General");
JHD.state = JHD.state || { songs: [], artists: [], categories: [], albums: [], songType: "", categorySongLinks: [] };

JHD.initCommon = () => {
  const menu = JHD.$("#navMenu");
  const button = JHD.$("#menuToggle");
  button?.setAttribute("aria-expanded", "false");
  button?.addEventListener("click", () => {
    const open = Boolean(menu?.classList.toggle("open"));
    button.setAttribute("aria-expanded", String(open));
  });
  JHD.$$("#navMenu a").forEach((link) => link.addEventListener("click", () => {
    menu?.classList.remove("open");
    button?.setAttribute("aria-expanded", "false");
  }));
};

JHD.errorCard = (title, text) => `<article class="song-card"><h3>${JHD.esc(title)}</h3><p>${JHD.esc(text)}</p></article>`;
JHD.fetchArtists = async () => JHD.sb
  ? JHD.sb.from("artists").select("*").order("name", { ascending: true })
  : { data: [], error: new Error("Sin conexión con Supabase.") };
JHD.fetchCategories = async () => JHD.sb
  ? JHD.sb.from("categories").select("*").order("sort_order", { ascending: true }).order("name", { ascending: true })
  : { data: [], error: new Error("Sin conexión con Supabase.") };
JHD.fetchAlbums = async () => JHD.sb
  ? JHD.sb.from("albums").select("*").order("sort_order", { ascending: true }).order("title", { ascending: true })
  : { data: [], error: new Error("Sin conexión con Supabase.") };

JHD.attachSongRelations = async (songs) => {
  const songIds = (songs || []).map((song) => song.id).filter(Boolean);
  if (!songIds.length) return { data: songs || [], error: null };

  const [artistRes, categoryRes, albumRes, linksRes, capoRes] = await Promise.all([
    JHD.sb.from("song_artists").select("song_id,role,sort_order,artists(id,name,slug,description,artist_type)").in("song_id", songIds).order("sort_order", { ascending: true }),
    JHD.sb.from("song_categories").select("song_id,categories(id,name,slug,description,song_type,parent_id,sort_order)").in("song_id", songIds),
    JHD.sb.from("album_songs").select("song_id,sort_order,albums(id,title,slug,description,artist_id)").in("song_id", songIds).order("sort_order", { ascending: true }),
    JHD.sb.from("song_links").select("*").in("song_id", songIds).order("sort_order", { ascending: true }),
    JHD.sb.from("song_capo_versions").select("*").in("song_id", songIds).order("sort_order", { ascending: true })
  ]);
  const relationError = artistRes.error || categoryRes.error || albumRes.error || linksRes.error || capoRes.error;
  if (relationError) return { data: [], error: relationError };

  const mapRows = (rows, field) => {
    const map = new Map();
    (rows || []).forEach((row) => {
      if (!map.has(row.song_id)) map.set(row.song_id, []);
      if (row[field]) map.get(row.song_id).push(row[field]);
    });
    return map;
  };
  const artists = mapRows(artistRes.data, "artists");
  const categories = mapRows(categoryRes.data, "categories");
  const albums = mapRows(albumRes.data, "albums");
  const links = new Map();
  const capos = new Map();

  (linksRes.data || []).forEach((row) => {
    if (!links.has(row.song_id)) links.set(row.song_id, []);
    links.get(row.song_id).push(row);
  });
  (capoRes.data || []).forEach((row) => {
    if (!capos.has(row.song_id)) capos.set(row.song_id, []);
    capos.get(row.song_id).push(row);
  });

  return {
    data: (songs || []).map((song) => ({
      ...song,
      _artists: artists.get(song.id) || [],
      _categories: categories.get(song.id) || [],
      _albums: albums.get(song.id) || [],
      _links: links.get(song.id) || [],
      _capoVersions: capos.get(song.id) || []
    })),
    error: null
  };
};

JHD.fetchSongsWithRelations = async (ids, options = {}) => {
  if (!JHD.sb) return { data: [], error: new Error("Sin conexión con Supabase.") };
  const values = Array.isArray(ids) ? [...new Set(ids.filter(Boolean))] : null;
  if (values && !values.length) return { data: [], error: null };

  let query = JHD.sb.from("songs").select(options.columns || "*");
  if (values) query = query.in("id", values);
  query = query.order(options.orderBy || "title", { ascending: options.ascending !== false });
  if (Number.isFinite(options.limit) && options.limit > 0) query = query.limit(options.limit);

  const { data: songs, error } = await query;
  if (error) return { data: [], error };
  return JHD.attachSongRelations(songs || []);
};

JHD.artistNames = (song) => (song?._artists || []).map((artist) => artist.name).filter(Boolean).join(" · ") || "Sin artista";
JHD.categoryNames = (song) => (song?._categories || []).map((category) => category.name).filter(Boolean).join(" · ");
JHD.songMeta = (song) => [JHD.typeLabel(song.song_type || song.type), song.tone ? `Tono ${song.tone}` : "", song.difficulty || ""].filter(Boolean).join(" · ");

JHD.songCard = (song) => {
  const href = `cancion.html?slug=${encodeURIComponent(song.slug || JHD.slugify(song.title))}`;
  const title = song.title || "Canción sin título";
  return `<article class="song-card song-preview-card"><a class="song-preview-main" href="${href}"><p class="artists-line">${JHD.esc(JHD.artistNames(song))}</p><h3>${JHD.esc(title)}</h3><p>${JHD.esc(JHD.songMeta(song))}${JHD.categoryNames(song) ? ` · ${JHD.esc(JHD.categoryNames(song))}` : ""}</p></a><div class="song-card-actions"><a class="song-btn small-btn" href="${href}">Ver canción</a><button class="song-btn small-btn secondary" type="button" data-share-song="${JHD.esc(href)}" data-share-title="${JHD.esc(title)}" aria-label="Compartir ${JHD.esc(title)}">Compartir</button></div></article>`;
};

JHD.artistCard = (artist) => {
  const initials = String(artist.name || "JHD").split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase();
  return `<a class="artist-card" href="artista.html?slug=${encodeURIComponent(artist.slug || JHD.slugify(artist.name))}"><div class="artist-mini-avatar">${JHD.esc(initials)}</div><h3>${JHD.esc(artist.name || "Artista")}</h3><p>${JHD.esc(artist.description || `${JHD.typeLabel(artist.artist_type)} · Ver canciones y álbumes.`)}</p></a>`;
};

JHD.descendantIds = (categoryId, categories = JHD.state.categories) => {
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

JHD.categorySongCount = (categoryId, categories = JHD.state.categories, links = JHD.state.categorySongLinks) => {
  const ids = JHD.descendantIds(categoryId, categories);
  return new Set((links || []).filter((row) => ids.has(String(row.category_id))).map((row) => String(row.song_id))).size;
};

JHD.loadSongs = async () => {
  if (JHD.page() !== "canciones.html") return;
  const grid = JHD.$("#songsGrid");
  const [songsRes, categoriesRes] = await Promise.all([JHD.fetchSongsWithRelations(), JHD.fetchCategories()]);
  if (songsRes.error) {
    if (grid) grid.innerHTML = JHD.errorCard("Error al cargar canciones", songsRes.error.message);
    return;
  }
  JHD.state.songs = songsRes.data || [];
  JHD.state.categories = categoriesRes.data || [];
};

JHD.loadArtists = async () => {
  if (JHD.page() !== "artistas.html") return;
  const grid = JHD.$("#artistsGrid");
  const result = await JHD.fetchArtists();
  if (result.error && grid) grid.innerHTML = JHD.errorCard("Error al cargar artistas", result.error.message);
};

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-share-song]");
  if (!button) return;
  const href = new URL(button.dataset.shareSong || "canciones.html", location.href).href;
  const title = button.dataset.shareTitle || "Canción";
  const text = `Te comparto “${title}” en Juntos Hacia Dios.`;
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url: href });
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(href);
    const original = button.textContent;
    button.textContent = "Enlace copiado";
    setTimeout(() => { button.textContent = original; }, 1800);
  } catch (_) {
    window.prompt("Copia este enlace:", href);
  }
});

document.addEventListener("DOMContentLoaded", () => {
  JHD.initCommon();
  JHD.loadSongs();
  JHD.loadArtists();
});