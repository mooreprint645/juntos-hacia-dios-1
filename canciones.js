const client = window.supabaseClient;
const songsGrid = document.querySelector("#songsGrid");
const searchInput = document.querySelector("#songSearch");
const filterButtons = [...document.querySelectorAll(".filter-btn")];
let categoryParam = "";
let albumParam = "";
let allSongs = [];
let activeType = "";

const escapeHTML = (value) => String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
function initNavigation() {
  const menuButton = document.querySelector("#menuToggle");
  const menu = document.querySelector("#navMenu");
  const themeButton = document.querySelector("#themeToggle");
  menuButton?.addEventListener("click", () => menu?.classList.toggle("open"));
  if (localStorage.getItem("jhd-theme") === "light") { document.body.classList.add("light-mode"); if (themeButton) themeButton.textContent = "☀️"; }
  themeButton?.addEventListener("click", () => { document.body.classList.toggle("light-mode"); const light = document.body.classList.contains("light-mode"); localStorage.setItem("jhd-theme", light ? "light" : "dark"); themeButton.textContent = light ? "☀️" : "🌙"; });
}
function normalize(value) { return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
function getSongType(song) { return normalize(song.song_type || song.type || song.religion || ""); }
function names(items) { return (items || []).map((item) => item?.name || item?.title || "").filter(Boolean).join(" · "); }
function songCategory(song) { return normalize([song.category, song.category_name, names(song._categories)].join(" ")); }
function songAlbum(song) { return normalize([song.album, song.album_name, names(song._albums)].join(" ")); }

function readRoute() {
  const params = new URLSearchParams(location.search);
  categoryParam = params.get("categoria") || "";
  albumParam = params.get("album") || "";
  activeType = normalize(params.get("tipo") || "");
  if (searchInput) searchInput.value = params.get("buscar") || "";
  filterButtons.forEach((button) => button.classList.toggle("active", normalize(button.dataset.type) === activeType));
}

function saveRoute(mode = "replace") {
  const url = new URL(location.href);
  url.searchParams.delete("tipo");
  url.searchParams.delete("buscar");
  if (activeType) url.searchParams.set("tipo", activeType);
  const search = String(searchInput?.value || "").trim();
  if (search) url.searchParams.set("buscar", search);
  const state = { ...(history.state || {}), jhdSongsRoute: { type: activeType, search } };
  if (mode === "push") history.pushState(state, "", `${url.pathname}${url.search}${url.hash}`);
  else history.replaceState(state, "", `${url.pathname}${url.search}${url.hash}`);
}

async function loadRelations(songs) {
  const ids = songs.map((song) => song.id).filter(Boolean);
  if (!ids.length) return songs;
  const [artistRes, categoryRes, albumRes] = await Promise.all([
    client.from("song_artists").select("song_id,artists(id,name,artist_type)").in("song_id", ids),
    client.from("song_categories").select("song_id,categories(id,name,song_type,slug)").in("song_id", ids),
    client.from("album_songs").select("song_id,albums(id,title,slug)").in("song_id", ids)
  ]);
  const artistsBySong = new Map(), categoriesBySong = new Map(), albumsBySong = new Map();
  (artistRes.data || []).forEach((row) => { if (!artistsBySong.has(row.song_id)) artistsBySong.set(row.song_id, []); if (row.artists) artistsBySong.get(row.song_id).push(row.artists); });
  (categoryRes.data || []).forEach((row) => { if (!categoriesBySong.has(row.song_id)) categoriesBySong.set(row.song_id, []); if (row.categories) categoriesBySong.get(row.song_id).push(row.categories); });
  (albumRes.data || []).forEach((row) => { if (!albumsBySong.has(row.song_id)) albumsBySong.set(row.song_id, []); if (row.albums) albumsBySong.get(row.song_id).push(row.albums); });
  return songs.map((song) => ({ ...song, _artists: artistsBySong.get(song.id) || [], _categories: categoriesBySong.get(song.id) || [], _albums: albumsBySong.get(song.id) || [] }));
}

function renderSongs() {
  const query = normalize(searchInput?.value);
  const categoryQuery = normalize(categoryParam);
  const albumQuery = normalize(albumParam);
  const filtered = allSongs.filter((song) => {
    const artistText = names(song._artists);
    const categoryText = names(song._categories);
    const albumText = names(song._albums);
    const haystack = normalize([song.title, song.name, artistText, categoryText, albumText, song.tone, song.key].join(" "));
    const matchesSearch = !query || haystack.includes(query);
    const matchesType = !activeType || getSongType(song).includes(activeType) || normalize(categoryText).includes(activeType);
    const matchesCategory = !categoryQuery || songCategory(song).includes(categoryQuery);
    const matchesAlbum = !albumQuery || songAlbum(song).includes(albumQuery);
    return matchesSearch && matchesType && matchesCategory && matchesAlbum;
  });
  if (!songsGrid) return;
  if (!filtered.length) { songsGrid.innerHTML = "<article class='song-card'><h3>Sin resultados</h3><p>Prueba otra búsqueda o filtro.</p></article>"; return; }
  songsGrid.innerHTML = filtered.map((song) => {
    const title = escapeHTML(song.title || song.name || "Canción sin título");
    const type = escapeHTML(song.song_type || song.type || "Canción");
    const artistText = escapeHTML(names(song._artists) || song.artist || song.artist_name || "Sin artista");
    const categoryText = escapeHTML(names(song._categories) || song.category || song.category_name || "");
    const albumText = escapeHTML(names(song._albums) || song.album || song.album_name || "");
    const tone = escapeHTML(song.tone || song.key || "");
    const id = encodeURIComponent(song.id || "");
    return `<article class="song-card"><h3>${title}</h3><p>${artistText}</p><p>${type}${categoryText ? ` · ${categoryText}` : ""}${albumText ? ` · ${albumText}` : ""}</p>${tone ? `<p><strong>Tono:</strong> ${tone}</p>` : ""}<a class="song-btn" href="cancion.html?id=${id}">Ver canción</a></article>`;
  }).join("");
}

async function loadSongs() {
  readRoute();
  saveRoute("replace");
  if ((categoryParam || albumParam) && searchInput && !searchInput.value) searchInput.placeholder = `Mostrando: ${categoryParam || albumParam}`;
  if (!client) { songsGrid.innerHTML = "<article class='song-card'><h3>Sin conexión</h3><p>No se pudo iniciar Supabase.</p></article>"; return; }
  const { data, error } = await client.from("songs").select("*").order("title", { ascending: true });
  if (error) { songsGrid.innerHTML = "<article class='song-card'><h3>Error al cargar</h3><p>Revisa la conexión o los nombres de las tablas.</p></article>"; return; }
  allSongs = await loadRelations(data || []);
  renderSongs();
}

searchInput?.addEventListener("input", () => { saveRoute("replace"); renderSongs(); });
filterButtons.forEach((button) => button.addEventListener("click", () => {
  activeType = normalize(button.dataset.type);
  filterButtons.forEach((item) => item.classList.toggle("active", item === button));
  saveRoute("push");
  renderSongs();
}));
window.addEventListener("popstate", () => { readRoute(); renderSongs(); });
initNavigation();
loadSongs();
