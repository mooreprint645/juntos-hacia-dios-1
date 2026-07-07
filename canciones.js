const client = window.supabaseClient;
const songsGrid = document.querySelector("#songsGrid");
const searchInput = document.querySelector("#songSearch");
const filterButtons = [...document.querySelectorAll(".filter-btn")];
const resultsStatus = document.querySelector("#songsResultsStatus");
const loadMoreButton = document.querySelector("#songsLoadMore");

const PAGE_SIZE = 24;
let categoryParam = "";
let albumParam = "";
let activeType = "";
let page = 0;
let totalResults = 0;
let visibleSongs = [];
let categoriesCache = null;
let albumsCache = null;
let searchTimer = 0;
let requestVersion = 0;
let loading = false;

const escapeHTML = (value) => String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const normalize = (value) => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const names = (items) => (items || []).map((item) => item?.name || item?.title || "").filter(Boolean).join(" · ");

function initNavigation() {
  const menuButton = document.querySelector("#menuToggle");
  const menu = document.querySelector("#navMenu");
  menuButton?.setAttribute("aria-expanded", "false");
  menuButton?.addEventListener("click", () => {
    const open = Boolean(menu?.classList.toggle("open"));
    menuButton.setAttribute("aria-expanded", String(open));
  });
  document.querySelectorAll("#navMenu a").forEach((link) => link.addEventListener("click", () => {
    menu?.classList.remove("open");
    menuButton?.setAttribute("aria-expanded", "false");
  }));
}

function updateFilterState() {
  filterButtons.forEach((button) => {
    const selected = normalize(button.dataset.type) === activeType;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function readRoute() {
  const params = new URLSearchParams(location.search);
  categoryParam = params.get("categoria") || "";
  albumParam = params.get("album") || "";
  activeType = normalize(params.get("tipo") || "");
  if (searchInput) searchInput.value = params.get("buscar") || "";
  updateFilterState();
}

function saveRoute(mode = "replace") {
  const url = new URL(location.href);
  url.searchParams.delete("tipo");
  url.searchParams.delete("buscar");
  if (activeType) url.searchParams.set("tipo", activeType);
  const search = String(searchInput?.value || "").trim();
  if (search) url.searchParams.set("buscar", search);
  const state = { ...(history.state || {}), jhdSongsRoute: { type: activeType, search } };
  const next = `${url.pathname}${url.search}${url.hash}`;
  if (mode === "push") history.pushState(state, "", next);
  else history.replaceState(state, "", next);
}

async function loadRelations(songs) {
  const ids = songs.map((song) => song.id).filter(Boolean);
  if (!ids.length) return songs;
  const [artistRes, categoryRes, albumRes] = await Promise.all([
    client.from("song_artists").select("song_id,artists(id,name,artist_type)").in("song_id", ids),
    client.from("song_categories").select("song_id,categories(id,name,song_type,slug)").in("song_id", ids),
    client.from("album_songs").select("song_id,albums(id,title,slug)").in("song_id", ids)
  ]);
  const artistsBySong = new Map();
  const categoriesBySong = new Map();
  const albumsBySong = new Map();

  (artistRes.data || []).forEach((row) => {
    if (!artistsBySong.has(row.song_id)) artistsBySong.set(row.song_id, []);
    if (row.artists) artistsBySong.get(row.song_id).push(row.artists);
  });
  (categoryRes.data || []).forEach((row) => {
    if (!categoriesBySong.has(row.song_id)) categoriesBySong.set(row.song_id, []);
    if (row.categories) categoriesBySong.get(row.song_id).push(row.categories);
  });
  (albumRes.data || []).forEach((row) => {
    if (!albumsBySong.has(row.song_id)) albumsBySong.set(row.song_id, []);
    if (row.albums) albumsBySong.get(row.song_id).push(row.albums);
  });

  return songs.map((song) => ({
    ...song,
    _artists: artistsBySong.get(song.id) || [],
    _categories: categoriesBySong.get(song.id) || [],
    _albums: albumsBySong.get(song.id) || []
  }));
}

async function getCategories() {
  if (categoriesCache) return categoriesCache;
  const { data, error } = await client.from("categories").select("id,name,slug,parent_id");
  if (error) throw error;
  categoriesCache = data || [];
  return categoriesCache;
}

async function getAlbums() {
  if (albumsCache) return albumsCache;
  const { data, error } = await client.from("albums").select("id,title,slug");
  if (error) throw error;
  albumsCache = data || [];
  return albumsCache;
}

function descendantIds(categoryId, categories) {
  const ids = new Set([String(categoryId)]);
  let changed = true;
  while (changed) {
    changed = false;
    categories.forEach((category) => {
      const id = String(category.id || "");
      if (category.parent_id && ids.has(String(category.parent_id)) && !ids.has(id)) {
        ids.add(id);
        changed = true;
      }
    });
  }
  return ids;
}

async function songIdsFromJoin(table, column, ids) {
  if (!ids.length) return new Set();
  const { data, error } = await client.from(table).select("song_id").in(column, ids);
  if (error) throw error;
  return new Set((data || []).map((row) => String(row.song_id)).filter(Boolean));
}

function intersection(sets) {
  if (!sets.length) return null;
  const [first, ...rest] = sets;
  return new Set([...first].filter((id) => rest.every((set) => set.has(id))));
}

async function searchSongIds(query) {
  const term = String(query || "").trim();
  if (!term) return null;
  const pattern = `%${term}%`;

  const [titleRes, toneRes, difficultyRes, typeRes, artistsRes, categoriesRes, albumsRes] = await Promise.all([
    client.from("songs").select("id").ilike("title", pattern).limit(1000),
    client.from("songs").select("id").ilike("tone", pattern).limit(1000),
    client.from("songs").select("id").ilike("difficulty", pattern).limit(1000),
    client.from("songs").select("id").ilike("song_type", pattern).limit(1000),
    client.from("artists").select("id").ilike("name", pattern).limit(500),
    client.from("categories").select("id").ilike("name", pattern).limit(500),
    client.from("albums").select("id").ilike("title", pattern).limit(500)
  ]);
  const error = [titleRes, toneRes, difficultyRes, typeRes, artistsRes, categoriesRes, albumsRes].find((result) => result.error)?.error;
  if (error) throw error;

  const direct = new Set([
    ...(titleRes.data || []),
    ...(toneRes.data || []),
    ...(difficultyRes.data || []),
    ...(typeRes.data || [])
  ].map((row) => String(row.id)));

  const [artistSongs, categorySongs, albumSongs] = await Promise.all([
    songIdsFromJoin("song_artists", "artist_id", (artistsRes.data || []).map((row) => row.id)),
    songIdsFromJoin("song_categories", "category_id", (categoriesRes.data || []).map((row) => row.id)),
    songIdsFromJoin("album_songs", "album_id", (albumsRes.data || []).map((row) => row.id))
  ]);

  [artistSongs, categorySongs, albumSongs].forEach((ids) => ids.forEach((id) => direct.add(id)));
  return direct;
}

async function resolveSongIds() {
  const restrictions = [];
  const query = String(searchInput?.value || "").trim();

  if (categoryParam) {
    const categories = await getCategories();
    const key = normalize(categoryParam);
    const category = categories.find((item) => String(item.id) === String(categoryParam) || normalize(item.slug) === key || normalize(item.name) === key);
    if (!category) restrictions.push(new Set());
    else restrictions.push(await songIdsFromJoin("song_categories", "category_id", [...descendantIds(category.id, categories)]));
  }

  if (albumParam) {
    const albums = await getAlbums();
    const key = normalize(albumParam);
    const album = albums.find((item) => String(item.id) === String(albumParam) || normalize(item.slug) === key || normalize(item.title) === key);
    restrictions.push(album ? await songIdsFromJoin("album_songs", "album_id", [album.id]) : new Set());
  }

  if (query) restrictions.push(await searchSongIds(query));
  return intersection(restrictions);
}

function setStatus(message) {
  if (resultsStatus) resultsStatus.textContent = message;
}

function renderSongs() {
  if (!songsGrid) return;
  setStatus(`${totalResults} ${totalResults === 1 ? "canción encontrada" : "canciones encontradas"}`);

  if (!visibleSongs.length) {
    songsGrid.innerHTML = "<article class='song-card'><h3>Sin resultados</h3><p>Prueba otro nombre, artista, tono o filtro.</p></article>";
    if (loadMoreButton) loadMoreButton.hidden = true;
    return;
  }

  songsGrid.innerHTML = visibleSongs.map((song) => {
    const title = escapeHTML(song.title || song.name || "Canción sin título");
    const type = escapeHTML(song.song_type || song.type || "Canción");
    const artistText = escapeHTML(names(song._artists) || song.artist || song.artist_name || "Sin artista");
    const categoryText = escapeHTML(names(song._categories) || song.category || song.category_name || "");
    const albumText = escapeHTML(names(song._albums) || song.album || song.album_name || "");
    const tone = escapeHTML(song.tone || song.key || "");
    const href = `cancion.html?id=${encodeURIComponent(song.id || "")}`;
    return `<article class="song-card song-preview-card"><div class="song-preview-main"><h3>${title}</h3><p>${artistText}</p><p>${type}${categoryText ? ` · ${categoryText}` : ""}${albumText ? ` · ${albumText}` : ""}</p>${tone ? `<p><strong>Tono:</strong> ${tone}</p>` : ""}</div><div class="song-card-actions"><a class="song-btn small-btn" href="${href}">Ver canción</a><button class="song-btn small-btn secondary" type="button" data-share-title="${title}" data-share-url="${href}" aria-label="Compartir ${title}">Compartir</button></div></article>`;
  }).join("");

  songsGrid.querySelectorAll("[data-share-url]").forEach((button) => {
    button.addEventListener("click", () => shareSong(button.dataset.shareTitle || "Canción", new URL(button.dataset.shareUrl, location.href).href, button));
  });

  if (loadMoreButton) {
    loadMoreButton.hidden = visibleSongs.length >= totalResults;
    loadMoreButton.disabled = loading;
    loadMoreButton.textContent = loading ? "Cargando…" : "Cargar más canciones";
  }
}

async function shareSong(title, url, button) {
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
    const original = button.textContent;
    button.textContent = "Enlace copiado";
    setTimeout(() => { button.textContent = original; }, 1800);
  } catch (_) {
    window.prompt("Copia este enlace:", url);
  }
}

async function fetchSongs(append = false) {
  if (!client || loading) return;
  loading = true;
  const token = ++requestVersion;
  const currentPage = append ? page + 1 : 0;
  if (!append) {
    visibleSongs = [];
    totalResults = 0;
    if (songsGrid) songsGrid.innerHTML = "<article class='song-card shimmer-card'><h3>Buscando canciones…</h3><p>Un momento por favor.</p></article>";
    setStatus("Buscando canciones…");
  }
  if (loadMoreButton) loadMoreButton.disabled = true;

  try {
    const ids = await resolveSongIds();
    if (token !== requestVersion) return;
    if (ids && !ids.size) {
      page = 0;
      visibleSongs = [];
      totalResults = 0;
      renderSongs();
      return;
    }

    let query = client.from("songs").select("*", { count: "exact" }).order("title", { ascending: true });
    if (activeType) query = query.eq("song_type", activeType);
    if (ids) query = query.in("id", [...ids]);
    const start = currentPage * PAGE_SIZE;
    const { data, error, count } = await query.range(start, start + PAGE_SIZE - 1);
    if (error) throw error;
    if (token !== requestVersion) return;

    const hydrated = await loadRelations(data || []);
    if (token !== requestVersion) return;
    page = currentPage;
    totalResults = Number(count || 0);
    visibleSongs = append ? [...visibleSongs, ...hydrated] : hydrated;
    renderSongs();
  } catch (error) {
    if (token !== requestVersion) return;
    totalResults = 0;
    visibleSongs = [];
    if (songsGrid) songsGrid.innerHTML = `<article class='song-card'><h3>Error al cargar</h3><p>${escapeHTML(error?.message || "Revisa la conexión e inténtalo de nuevo.")}</p></article>`;
    setStatus("No se pudieron cargar las canciones.");
    if (loadMoreButton) loadMoreButton.hidden = true;
  } finally {
    if (token === requestVersion) {
      loading = false;
      if (loadMoreButton) loadMoreButton.disabled = false;
    }
  }
}

function resetAndFetch(mode = "replace") {
  saveRoute(mode);
  fetchSongs(false);
}

function start() {
  readRoute();
  if ((categoryParam || albumParam) && searchInput && !searchInput.value) searchInput.placeholder = `Mostrando: ${categoryParam || albumParam}`;
  if (!client) {
    if (songsGrid) songsGrid.innerHTML = "<article class='song-card'><h3>Sin conexión</h3><p>No se pudo iniciar Supabase.</p></article>";
    return;
  }
  fetchSongs(false);
}

searchInput?.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => resetAndFetch("replace"), 260);
});

filterButtons.forEach((button) => button.addEventListener("click", () => {
  activeType = normalize(button.dataset.type);
  updateFilterState();
  resetAndFetch("push");
}));

loadMoreButton?.addEventListener("click", () => fetchSongs(true));
window.addEventListener("popstate", () => {
  readRoute();
  fetchSongs(false);
});

initNavigation();
start();