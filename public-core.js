const JHD = window.JHD || {};
window.JHD = JHD;
JHD.sb = window.supabaseClient;
JHD.$ = (selector) => document.querySelector(selector);
JHD.$$ = (selector) => [...document.querySelectorAll(selector)];
JHD.page = () => (location.pathname.split("/").pop() || "index.html").toLowerCase();
JHD.param = (name) => new URLSearchParams(location.search).get(name) || "";
JHD.esc = (value) => String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
JHD.normalize = (value) => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
JHD.slugify = (value) => JHD.normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
JHD.typeLabel = (value) => ({ catolico: "Católico", cristiano: "Cristiano", mixto: "Mixto" }[JHD.normalize(value)] || "General");
JHD.state = JHD.state || { songs: [], artists: [], categories: [], albums: [], songType: "" };

JHD.initCommon = () => {
  const menu = JHD.$("#navMenu"), button = JHD.$("#menuToggle"), theme = JHD.$("#themeToggle");
  button?.addEventListener("click", () => { const open = menu?.classList.toggle("open"); button.setAttribute("aria-expanded", open ? "true" : "false"); });
  JHD.$$("#navMenu a").forEach((link) => link.addEventListener("click", () => menu?.classList.remove("open")));
  const light = localStorage.getItem("jhd-theme") === "light";
  document.body.classList.toggle("light-mode", light);
  if (theme) theme.textContent = light ? "☀️" : "🌙";
  theme?.addEventListener("click", () => { const enabled = document.body.classList.toggle("light-mode"); localStorage.setItem("jhd-theme", enabled ? "light" : "dark"); theme.textContent = enabled ? "☀️" : "🌙"; });
};

JHD.errorCard = (title, text) => `<article class="song-card"><h3>${JHD.esc(title)}</h3><p>${JHD.esc(text)}</p></article>`;
JHD.fetchArtists = async () => JHD.sb ? JHD.sb.from("artists").select("*").order("name", { ascending: true }) : { data: [], error: new Error("Sin conexión con Supabase.") };
JHD.fetchCategories = async () => JHD.sb ? JHD.sb.from("categories").select("*").order("sort_order", { ascending: true }).order("name", { ascending: true }) : { data: [], error: new Error("Sin conexión con Supabase.") };
JHD.fetchAlbums = async () => JHD.sb ? JHD.sb.from("albums").select("*").order("sort_order", { ascending: true }).order("title", { ascending: true }) : { data: [], error: new Error("Sin conexión con Supabase.") };

JHD.fetchSongsWithRelations = async (ids) => {
  if (!JHD.sb) return { data: [], error: new Error("Sin conexión con Supabase.") };
  let query = JHD.sb.from("songs").select("*").order("title", { ascending: true });
  if (Array.isArray(ids)) { if (!ids.length) return { data: [], error: null }; query = query.in("id", ids); }
  const { data: songs, error } = await query;
  if (error) return { data: [], error };
  const songIds = (songs || []).map((song) => song.id).filter(Boolean);
  if (!songIds.length) return { data: [], error: null };
  const [artistRes, categoryRes, albumRes, linksRes, capoRes] = await Promise.all([
    JHD.sb.from("song_artists").select("song_id,role,sort_order,artists(id,name,slug,description,artist_type)").in("song_id", songIds).order("sort_order", { ascending: true }),
    JHD.sb.from("song_categories").select("song_id,categories(id,name,slug,description,song_type,parent_id,sort_order)").in("song_id", songIds),
    JHD.sb.from("album_songs").select("song_id,sort_order,albums(id,title,slug,description,artist_id)").in("song_id", songIds).order("sort_order", { ascending: true }),
    JHD.sb.from("song_links").select("*").in("song_id", songIds).order("sort_order", { ascending: true }),
    JHD.sb.from("song_capo_versions").select("*").in("song_id", songIds).order("sort_order", { ascending: true })
  ]);
  const relationError = artistRes.error || categoryRes.error || albumRes.error || linksRes.error || capoRes.error;
  if (relationError) return { data: [], error: relationError };
  const makeMap = (rows, field) => {
    const map = new Map();
    (rows || []).forEach((row) => { if (!map.has(row.song_id)) map.set(row.song_id, []); if (row[field]) map.get(row.song_id).push(row[field]); });
    return map;
  };
  const artists = makeMap(artistRes.data, "artists"), categories = makeMap(categoryRes.data, "categories"), albums = makeMap(albumRes.data, "albums");
  const links = new Map(), capos = new Map();
  (linksRes.data || []).forEach((row) => { if (!links.has(row.song_id)) links.set(row.song_id, []); links.get(row.song_id).push(row); });
  (capoRes.data || []).forEach((row) => { if (!capos.has(row.song_id)) capos.set(row.song_id, []); capos.get(row.song_id).push(row); });
  return { data: (songs || []).map((song) => ({ ...song, _artists: artists.get(song.id) || [], _categories: categories.get(song.id) || [], _albums: albums.get(song.id) || [], _links: links.get(song.id) || [], _capoVersions: capos.get(song.id) || [] })), error: null };
};

JHD.artistNames = (song) => (song?._artists || []).map((artist) => artist.name).filter(Boolean).join(" · ") || "Sin artista";
JHD.categoryNames = (song) => (song?._categories || []).map((category) => category.name).filter(Boolean).join(" · ");
JHD.songMeta = (song) => [JHD.typeLabel(song.song_type || song.type), song.tone ? `Tono ${song.tone}` : "", song.difficulty || ""].filter(Boolean).join(" · ");
JHD.songCard = (song) => `<a class="song-card song-link-card" href="cancion.html?slug=${encodeURIComponent(song.slug || JHD.slugify(song.title))}"><p class="artists-line">${JHD.esc(JHD.artistNames(song))}</p><h3>${JHD.esc(song.title || "Canción sin título")}</h3><p>${JHD.esc(JHD.songMeta(song))}${JHD.categoryNames(song) ? ` · ${JHD.esc(JHD.categoryNames(song))}` : ""}</p></a>`;
JHD.artistCard = (artist) => {
  const initials = String(artist.name || "JHD").split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase();
  return `<a class="artist-card" href="artista.html?slug=${encodeURIComponent(artist.slug || JHD.slugify(artist.name))}"><div class="artist-mini-avatar">${JHD.esc(initials)}</div><h3>${JHD.esc(artist.name || "Artista")}</h3><p>${JHD.esc(artist.description || `${JHD.typeLabel(artist.artist_type)} · Ver canciones y álbumes.`)}</p></a>`;
};

JHD.loadHome = async () => {
  if (JHD.page() !== "index.html") return;
  const songsBox = JHD.$("#homeSongsGrid"), artistsBox = JHD.$("#homeArtistsGrid");
  const [songsRes, artistsRes] = await Promise.all([JHD.fetchSongsWithRelations(), JHD.fetchArtists()]);
  if (songsBox) {
    if (songsRes.error) songsBox.innerHTML = JHD.errorCard("Error al cargar canciones", songsRes.error.message);
    else { const items = (songsRes.data || []).slice().sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 6); songsBox.innerHTML = items.length ? items.map(JHD.songCard).join("") : JHD.errorCard("Sin canciones", "Aún no hay canciones publicadas."); }
  }
  if (artistsBox) {
    if (artistsRes.error) artistsBox.innerHTML = JHD.errorCard("Error al cargar artistas", artistsRes.error.message);
    else { const items = (artistsRes.data || []).slice().sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 6); artistsBox.innerHTML = items.length ? items.map(JHD.artistCard).join("") : JHD.errorCard("Sin artistas", "Aún no hay artistas publicados."); }
  }
};

JHD.renderSongs = () => {
  const grid = JHD.$("#songsGrid"), count = JHD.$("#songCountText"), query = JHD.normalize(JHD.$("#songSearch")?.value);
  const wanted = JHD.param("categoria"), category = JHD.state.categories.find((item) => String(item.id) === wanted || JHD.normalize(item.slug) === JHD.normalize(wanted) || JHD.normalize(item.name) === JHD.normalize(wanted));
  const ids = category ? JHD.descendantIds(category.id) : null;
  const items = JHD.state.songs.filter((song) => {
    const text = JHD.normalize([song.title, song.tone, song.difficulty, song.song_type, JHD.artistNames(song), JHD.categoryNames(song), (song._albums || []).map((album) => album.title).join(" ")].join(" "));
    return (!JHD.state.songType || JHD.normalize(song.song_type || song.type) === JHD.state.songType) && (!query || text.includes(query)) && (!ids || (song._categories || []).some((item) => ids.has(String(item.id))));
  });
  if (count) count.textContent = `${items.length} ${items.length === 1 ? "canción encontrada" : "canciones encontradas"}`;
  if (grid) grid.innerHTML = items.length ? items.map(JHD.songCard).join("") : JHD.errorCard("Sin resultados", "Prueba otro nombre, artista, tono o filtro.");
  const notice = JHD.$("#songsCategoryNotice"); if (notice) notice.textContent = category ? `Mostrando: ${category.name} y sus subcategorías.` : "";
};
JHD.descendantIds = (categoryId) => {
  const ids = new Set([String(categoryId)]); let changed = true;
  while (changed) { changed = false; JHD.state.categories.forEach((category) => { const id = String(category.id || ""); if (category.parent_id && ids.has(String(category.parent_id)) && !ids.has(id)) { ids.add(id); changed = true; } }); }
  return ids;
};
JHD.loadSongs = async () => {
  if (JHD.page() !== "canciones.html") return;
  const grid = JHD.$("#songsGrid"), [songsRes, categoriesRes] = await Promise.all([JHD.fetchSongsWithRelations(), JHD.fetchCategories()]);
  if (songsRes.error) { if (grid) grid.innerHTML = JHD.errorCard("Error al cargar canciones", songsRes.error.message); return; }
  JHD.state.songs = songsRes.data || []; JHD.state.categories = categoriesRes.data || [];
  JHD.$("#songSearch")?.addEventListener("input", JHD.renderSongs);
  JHD.$$('[data-song-type]').forEach((button) => button.addEventListener("click", () => { JHD.state.songType = JHD.normalize(button.dataset.songType); JHD.$$('[data-song-type]').forEach((item) => item.classList.toggle("active", item === button)); JHD.renderSongs(); }));
  JHD.renderSongs();
};

JHD.loadArtists = async () => {
  if (JHD.page() !== "artistas.html") return;
  const grid = JHD.$("#artistsGrid"), result = await JHD.fetchArtists();
  if (result.error) { if (grid) grid.innerHTML = JHD.errorCard("Error al cargar artistas", result.error.message); return; }
  JHD.state.artists = result.data || [];
  const render = () => { const query = JHD.normalize(JHD.$("#artistSearch")?.value); const items = JHD.state.artists.filter((artist) => !query || JHD.normalize([artist.name, artist.description, artist.artist_type].join(" ")).includes(query)); if (grid) grid.innerHTML = items.length ? items.map(JHD.artistCard).join("") : JHD.errorCard("Sin resultados", "Prueba con otro nombre."); };
  JHD.$("#artistSearch")?.addEventListener("input", render); render();
};

document.addEventListener("DOMContentLoaded", () => { JHD.initCommon(); JHD.loadHome(); JHD.loadSongs(); JHD.loadArtists(); });
