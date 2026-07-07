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
const names = (items) => (Array.isArray(items) ? items : []).map((item) => item?.name || item?.title || "").filter(Boolean).join(" · ");

function jsonList(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

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

async function getCategories() {
  if (categoriesCache) return categoriesCache;
  const { data, error } = await client.from("categories").select("id,name,slug");
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

function findRecord(items, value, nameField) {
  const key = normalize(value);
  return (items || []).find((item) => String(item.id) === String(value) || normalize(item.slug) === key || normalize(item[nameField]) === key) || null;
}

async function resolveRouteFilters() {
  const filters = { categoryId: null, albumId: null, empty: false };
  if (categoryParam) {
    const category = findRecord(await getCategories(), categoryParam, "name");
    if (!category) filters.empty = true;
    else filters.categoryId = category.id;
  }
  if (albumParam) {
    const album = findRecord(await getAlbums(), albumParam, "title");
    if (!album) filters.empty = true;
    else filters.albumId = album.id;
  }
  return filters;
}

function setStatus(message) {
  if (resultsStatus) resultsStatus.textContent = message;
}

function updateLoadMore() {
  if (!loadMoreButton) return;
  const hasMore = visibleSongs.length < totalResults;
  loadMoreButton.hidden = !hasMore;
  loadMoreButton.disabled = loading;
  loadMoreButton.textContent = loading ? "Cargando…" : "Cargar más canciones";
}

function renderSongs() {
  if (!songsGrid) return;
  setStatus(`${totalResults} ${totalResults === 1 ? "canción encontrada" : "canciones encontradas"}`);

  if (!visibleSongs.length) {
    songsGrid.innerHTML = "<article class='song-card'><h3>Sin resultados</h3><p>Prueba otro nombre, artista, tono o filtro.</p></article>";
    if (loadMoreButton) {
      loadMoreButton.hidden = true;
      loadMoreButton.disabled = false;
      loadMoreButton.textContent = "Cargar más canciones";
    }
    return;
  }

  songsGrid.innerHTML = visibleSongs.map((song) => {
    const title = escapeHTML(song.title || "Canción sin título");
    const type = escapeHTML(song.song_type || "Canción");
    const artistText = escapeHTML(names(song._artists) || "Sin artista");
    const categoryText = escapeHTML(names(song._categories));
    const albumText = escapeHTML(names(song._albums));
    const tone = escapeHTML(song.tone || "");
    const href = `cancion.html?id=${encodeURIComponent(song.id || "")}`;
    return `<article class="song-card song-preview-card"><div class="song-preview-main"><h3>${title}</h3><p>${artistText}</p><p>${type}${categoryText ? ` · ${categoryText}` : ""}${albumText ? ` · ${albumText}` : ""}</p>${tone ? `<p><strong>Tono:</strong> ${tone}</p>` : ""}</div><div class="song-card-actions"><a class="song-btn small-btn" href="${href}">Ver canción</a><button class="song-btn small-btn secondary" type="button" data-share-title="${title}" data-share-url="${href}" aria-label="Compartir ${title}">Compartir</button></div></article>`;
  }).join("");

  songsGrid.querySelectorAll("[data-share-url]").forEach((button) => {
    button.addEventListener("click", () => shareSong(button.dataset.shareTitle || "Canción", new URL(button.dataset.shareUrl, location.href).href, button));
  });
  updateLoadMore();
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

function beginFreshLoad() {
  visibleSongs = [];
  totalResults = 0;
  page = 0;
  if (songsGrid) songsGrid.innerHTML = "<article class='song-card shimmer-card'><h3>Buscando canciones…</h3><p>Un momento por favor.</p></article>";
  setStatus("Buscando canciones…");
  if (loadMoreButton) {
    loadMoreButton.hidden = true;
    loadMoreButton.disabled = true;
    loadMoreButton.textContent = "Cargar más canciones";
  }
}

function rowToSong(row) {
  return {
    ...row,
    _artists: jsonList(row.artists),
    _categories: jsonList(row.categories),
    _albums: jsonList(row.albums)
  };
}

function rpcErrorMessage(error) {
  const detail = String(error?.message || "");
  if (error?.code === "PGRST202" || /search_songs_catalog/i.test(detail)) {
    return "Falta activar la búsqueda escalable. Ejecuta el archivo supabase-song-catalog-search.sql en Supabase y vuelve a abrir esta página.";
  }
  return detail || "Revisa la conexión e inténtalo de nuevo.";
}

async function fetchSongs(append = false) {
  if (!client || (append && loading)) return;
  const token = ++requestVersion;
  const currentPage = append ? page + 1 : 0;
  loading = true;
  if (!append) beginFreshLoad();
  else updateLoadMore();

  try {
    const filters = await resolveRouteFilters();
    if (token !== requestVersion) return;
    if (filters.empty) {
      page = 0;
      totalResults = 0;
      visibleSongs = [];
      loading = false;
      renderSongs();
      return;
    }

    const { data, error } = await client.rpc("search_songs_catalog", {
      p_query: String(searchInput?.value || "").trim() || null,
      p_song_type: activeType || null,
      p_category_id: filters.categoryId,
      p_album_id: filters.albumId,
      p_limit: PAGE_SIZE,
      p_offset: currentPage * PAGE_SIZE
    });
    if (error) throw error;
    if (token !== requestVersion) return;

    const rows = (data || []).map(rowToSong);
    const serverTotal = rows.length ? Number(rows[0].total_count || 0) : 0;
    page = currentPage;
    totalResults = append ? (rows.length ? serverTotal : visibleSongs.length) : serverTotal;
    visibleSongs = append ? [...visibleSongs, ...rows] : rows;
    loading = false;
    renderSongs();
  } catch (error) {
    if (token !== requestVersion) return;
    totalResults = 0;
    visibleSongs = [];
    loading = false;
    if (songsGrid) songsGrid.innerHTML = `<article class='song-card'><h3>Error al cargar</h3><p>${escapeHTML(rpcErrorMessage(error))}</p></article>`;
    setStatus("No se pudieron cargar las canciones.");
    if (loadMoreButton) {
      loadMoreButton.hidden = true;
      loadMoreButton.disabled = false;
      loadMoreButton.textContent = "Cargar más canciones";
    }
  } finally {
    if (token === requestVersion && loading) {
      loading = false;
      renderSongs();
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
