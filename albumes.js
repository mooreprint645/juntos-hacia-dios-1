const db = window.supabaseClient;
const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const norm = (value) => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const params = new URLSearchParams(location.search);
const selected = params.get("album") || params.get("id") || "";
const PAGE_SIZE = 24;

let page = 0;
let totalResults = 0;
let visibleAlbums = [];
let loading = false;
let requestVersion = 0;
let searchTimer = 0;
let currentAlbum = null;
let currentOwner = null;
let songPage = 0;
let songTotal = 0;
let visibleSongs = [];
let songLoading = false;
let songRequestVersion = 0;

function nav() {
  const button = $("#menuToggle");
  const menu = $("#navMenu");
  button?.setAttribute("aria-expanded", "false");
  button?.addEventListener("click", () => {
    const open = Boolean(menu?.classList.toggle("open"));
    button.setAttribute("aria-expanded", String(open));
  });
  document.querySelectorAll("#navMenu a").forEach((link) => link.addEventListener("click", () => {
    menu?.classList.remove("open");
    button?.setAttribute("aria-expanded", "false");
  }));
}

function countLabel(count) {
  return `${count} ${count === 1 ? "canto" : "cantos"}`;
}

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

function names(items) {
  return (items || []).map((item) => item?.name || item?.title || "").filter(Boolean).join(" · ");
}

function card(album) {
  const key = album.slug || album.id;
  const count = Number(album.song_count || 0);
  const description = album.description || album.year || "Colección de cantos disponible en el cancionero.";
  return `<a class="artist-card catalog-album-card" href="albumes.html?album=${encodeURIComponent(key)}" aria-label="Ver álbum ${esc(album.title || "Álbum")}"><div class="catalog-card-heading"><span class="catalog-album-disc" aria-hidden="true">◉</span><div><p class="catalog-card-kicker">${esc(album.artist_name || "Colección")}</p><h3>${esc(album.title || "Álbum")}</h3></div><span class="catalog-card-arrow" aria-hidden="true">→</span></div><p class="catalog-card-description">${esc(description)}</p><div class="catalog-card-footer"><span class="catalog-card-count"><span aria-hidden="true">♫</span> ${esc(countLabel(count))}</span><strong>Ver álbum →</strong></div></a>`;
}

function setStatus(message) {
  const status = $("#albumResultsStatus");
  if (status) status.textContent = message;
}

function ensureListLoadMore() {
  let button = $("#albumsLoadMore");
  if (button) return button;
  const grid = $("#albumsGrid");
  if (!grid) return null;
  const wrap = document.createElement("div");
  wrap.className = "catalog-load-more";
  wrap.innerHTML = '<button class="song-btn secondary" id="albumsLoadMore" type="button" hidden>Cargar más álbumes</button>';
  grid.after(wrap);
  button = $("#albumsLoadMore");
  button?.addEventListener("click", () => fetchAlbums(true));
  return button;
}

function updateListLoadMore() {
  const button = ensureListLoadMore();
  if (!button) return;
  const hasMore = visibleAlbums.length < totalResults;
  button.hidden = !hasMore;
  button.disabled = loading;
  button.textContent = loading ? "Cargando…" : "Cargar más álbumes";
}

function renderAlbums() {
  const grid = $("#albumsGrid");
  if (!grid) return;
  setStatus(`${totalResults} ${totalResults === 1 ? "álbum encontrado" : "álbumes encontrados"}`);
  grid.className = "artists-grid";
  grid.innerHTML = visibleAlbums.length
    ? visibleAlbums.map(card).join("")
    : "<article class='artist-card'><h3>Sin álbumes</h3><p>Aún no hay álbumes que coincidan con la búsqueda.</p></article>";
  updateListLoadMore();
}

function beginAlbumLoad() {
  page = 0;
  totalResults = 0;
  visibleAlbums = [];
  const grid = $("#albumsGrid");
  if (grid) grid.innerHTML = "<article class='artist-card shimmer-card'><h3>Buscando álbumes…</h3><p>Un momento por favor.</p></article>";
  setStatus("Buscando álbumes…");
  const button = ensureListLoadMore();
  if (button) {
    button.hidden = true;
    button.disabled = true;
    button.textContent = "Cargar más álbumes";
  }
}

function rpcErrorMessage(error, functionName, label) {
  const detail = String(error?.message || "");
  if (error?.code === "PGRST202" || detail.includes(functionName)) {
    return `Falta activar la búsqueda escalable de ${label}. Ejecuta supabase-albums-categories-scale.sql en Supabase.`;
  }
  return detail || "Revisa la conexión e inténtalo de nuevo.";
}

async function fetchAlbums(append = false) {
  if (!db || (append && loading)) return;
  const token = ++requestVersion;
  const currentPage = append ? page + 1 : 0;
  loading = true;
  if (!append) beginAlbumLoad();
  else updateListLoadMore();

  try {
    const { data, error } = await db.rpc("search_albums_catalog", {
      p_query: String($("#albumSearch")?.value || "").trim() || null,
      p_artist_id: null,
      p_limit: PAGE_SIZE,
      p_offset: currentPage * PAGE_SIZE
    });
    if (error) throw error;
    if (token !== requestVersion) return;

    const rows = data || [];
    const serverTotal = rows.length ? Number(rows[0].total_count || 0) : 0;
    page = currentPage;
    totalResults = append ? (rows.length ? serverTotal : visibleAlbums.length) : serverTotal;
    visibleAlbums = append ? [...visibleAlbums, ...rows] : rows;
    loading = false;
    renderAlbums();
  } catch (error) {
    if (token !== requestVersion) return;
    totalResults = 0;
    visibleAlbums = [];
    loading = false;
    const grid = $("#albumsGrid");
    if (grid) grid.innerHTML = `<article class='artist-card'><h3>No se pudieron cargar los álbumes</h3><p>${esc(rpcErrorMessage(error, "search_albums_catalog", "álbumes"))}</p></article>`;
    setStatus("No se pudieron cargar los álbumes.");
    const button = ensureListLoadMore();
    if (button) button.hidden = true;
  } finally {
    if (token === requestVersion && loading) {
      loading = false;
      renderAlbums();
    }
  }
}

function songRow(song) {
  const artists = names(song._artists);
  const type = song.song_type || "Canción";
  const tone = song.tone ? ` · Tono ${song.tone}` : "";
  return `<a class="category-song-card" href="cancion.html?id=${encodeURIComponent(song.id)}"><div><p class="eyebrow">${esc(artists || type)}</p><h3>${esc(song.title || "Canción")}</h3><p>${esc(artists ? `${type}${tone}` : song.tone ? `Tono ${song.tone}` : "Ver letra y acordes")}</p></div><span aria-hidden="true">›</span></a>`;
}

function renderAlbumDetail() {
  const grid = $("#albumsGrid");
  if (!grid || !currentAlbum) return;
  const title = currentAlbum.title || "Álbum";
  const description = currentAlbum.description || "Canciones de esta colección.";
  const artistLink = currentOwner ? `<a class="filter-btn" href="artista.html?slug=${encodeURIComponent(currentOwner.slug || currentOwner.id)}">${esc(currentOwner.name)}</a>` : "";
  const rows = visibleSongs.length
    ? visibleSongs.map(songRow).join("")
    : "<p class='muted-text'>Este álbum todavía no tiene cantos asignados.</p>";
  const hasMore = visibleSongs.length < songTotal;
  grid.className = "";
  grid.innerHTML = `<article class="intro-card album-detail"><p class="hero-kicker">${esc(currentAlbum.year || "Álbum")}</p><h2>${esc(title)}</h2><p>${esc(description)}</p><p class="muted-text">${esc(countLabel(songTotal))}</p><div class="song-filters">${artistLink}</div><a class="song-btn secondary" href="albumes.html">← Volver a álbumes</a></article><div class="category-songs-view"><div class="category-songs-header"><p class="hero-kicker">Cantos del álbum</p><h2>${esc(title)}</h2></div><div class="category-songs-list">${rows}</div><div class="catalog-load-more"><button class="song-btn secondary" id="albumSongsLoadMore" type="button" ${hasMore ? "" : "hidden"}>${songLoading ? "Cargando…" : "Cargar más canciones"}</button></div></div>`;
  $("#albumSongsLoadMore")?.addEventListener("click", () => fetchAlbumSongs(true));
}

async function fetchAlbumSongs(append = false) {
  if (!db || !currentAlbum || (append && songLoading)) return;
  const token = ++songRequestVersion;
  const currentPage = append ? songPage + 1 : 0;
  songLoading = true;
  if (!append) {
    songPage = 0;
    songTotal = 0;
    visibleSongs = [];
    const grid = $("#albumsGrid");
    if (grid) grid.innerHTML = "<article class='artist-card shimmer-card'><h3>Cargando canciones…</h3><p>Un momento por favor.</p></article>";
  } else {
    renderAlbumDetail();
  }

  try {
    const { data, error } = await db.rpc("search_songs_catalog", {
      p_query: null,
      p_song_type: null,
      p_category_id: null,
      p_album_id: currentAlbum.id,
      p_limit: PAGE_SIZE,
      p_offset: currentPage * PAGE_SIZE
    });
    if (error) throw error;
    if (token !== songRequestVersion) return;

    const rows = (data || []).map((row) => ({ ...row, _artists: jsonList(row.artists), _categories: jsonList(row.categories), _albums: jsonList(row.albums) }));
    const serverTotal = rows.length ? Number(rows[0].total_count || 0) : 0;
    songPage = currentPage;
    songTotal = append ? (rows.length ? serverTotal : visibleSongs.length) : serverTotal;
    visibleSongs = append ? [...visibleSongs, ...rows] : rows;
    songLoading = false;
    renderAlbumDetail();
  } catch (error) {
    if (token !== songRequestVersion) return;
    songLoading = false;
    const grid = $("#albumsGrid");
    if (grid) grid.innerHTML = `<article class='artist-card'><h3>No se pudieron cargar las canciones</h3><p>${esc(rpcErrorMessage(error, "search_songs_catalog", "canciones"))}</p></article>`;
  }
}

async function openDetail() {
  const grid = $("#albumsGrid");
  if (!db || !grid) return;
  $("#albumSearchBox")?.classList.add("hidden");
  let query = db.from("albums").select("*");
  query = params.get("id") ? query.eq("id", selected) : query.eq("slug", selected);
  const { data: album, error } = await query.maybeSingle();
  if (error || !album) {
    grid.innerHTML = "<article class='artist-card'><h3>Álbum no encontrado</h3><p>Vuelve al listado e intenta nuevamente.</p></article>";
    return;
  }
  currentAlbum = album;
  if (album.artist_id) {
    const owner = await db.from("artists").select("id,name,slug").eq("id", album.artist_id).maybeSingle();
    currentOwner = owner.data || null;
  }
  $("#albumsTitle").textContent = album.title || "Álbum";
  $("#albumsSubtitle").textContent = album.description || "Canciones de esta colección.";
  await fetchAlbumSongs(false);
}

function start() {
  nav();
  if (!db) {
    const grid = $("#albumsGrid");
    if (grid) grid.innerHTML = "<article class='artist-card'><h3>Sin conexión</h3><p>No se pudo iniciar Supabase.</p></article>";
    return;
  }
  if (selected) {
    openDetail();
    return;
  }
  ensureListLoadMore();
  fetchAlbums(false);
  $("#albumSearch")?.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => fetchAlbums(false), 260);
  });
}

start();
