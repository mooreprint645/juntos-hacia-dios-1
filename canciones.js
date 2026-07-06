const client = window.supabaseClient;
const songsGrid = document.querySelector("#songsGrid");
const searchInput = document.querySelector("#songSearch");
const filterButtons = [...document.querySelectorAll(".filter-btn")];
const params = new URLSearchParams(window.location.search);
const categoryParam = params.get("categoria") || "";
let allSongs = [];
let activeType = "";

const escapeHTML = (value) => String(value || "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function initNavigation() {
  const menuButton = document.querySelector("#menuToggle");
  const menu = document.querySelector("#navMenu");
  const themeButton = document.querySelector("#themeToggle");

  menuButton?.addEventListener("click", () => menu?.classList.toggle("open"));

  if (localStorage.getItem("jhd-theme") === "light") {
    document.body.classList.add("light-mode");
    if (themeButton) themeButton.textContent = "☀️";
  }

  themeButton?.addEventListener("click", () => {
    document.body.classList.toggle("light-mode");
    const light = document.body.classList.contains("light-mode");
    localStorage.setItem("jhd-theme", light ? "light" : "dark");
    themeButton.textContent = light ? "☀️" : "🌙";
  });
}

function normalize(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function getSongType(song) {
  return normalize(song.type || song.song_type || song.religion || "");
}

function songCategory(song) {
  return normalize(song.category || song.category_name || "");
}

function renderSongs() {
  const query = normalize(searchInput?.value);
  const categoryQuery = normalize(categoryParam);
  const filtered = allSongs.filter((song) => {
    const haystack = normalize([song.title, song.name, song.artist, song.tone, song.key, song.category, song.category_name].join(" "));
    const matchesSearch = !query || haystack.includes(query);
    const matchesType = !activeType || getSongType(song).includes(activeType);
    const matchesCategory = !categoryQuery || songCategory(song).includes(categoryQuery);
    return matchesSearch && matchesType && matchesCategory;
  });

  if (!songsGrid) return;
  if (!filtered.length) {
    songsGrid.innerHTML = "<article class='song-card'><h3>Sin resultados</h3><p>Prueba otra búsqueda o filtro.</p></article>";
    return;
  }

  songsGrid.innerHTML = filtered.map((song) => {
    const title = escapeHTML(song.title || song.name || "Canción sin título");
    const type = escapeHTML(song.type || song.song_type || "Canción");
    const category = escapeHTML(song.category || song.category_name || "");
    const tone = escapeHTML(song.tone || song.key || "");
    const id = encodeURIComponent(song.id || "");
    return `<article class="song-card"><h3>${title}</h3><p>${type}${category ? ` · ${category}` : ""}</p>${tone ? `<p><strong>Tono:</strong> ${tone}</p>` : ""}<a class="song-btn" href="cancion.html?id=${id}">Ver canción</a></article>`;
  }).join("");
}

async function loadSongs() {
  if (categoryParam && searchInput && !searchInput.value) {
    searchInput.placeholder = `Mostrando categoría: ${categoryParam}`;
  }

  if (!client) {
    songsGrid.innerHTML = "<article class='song-card'><h3>Sin conexión</h3><p>No se pudo iniciar Supabase.</p></article>";
    return;
  }

  const { data, error } = await client.from("songs").select("*").order("created_at", { ascending: false });
  if (error) {
    console.error(error);
    songsGrid.innerHTML = "<article class='song-card'><h3>Error al cargar</h3><p>Revisa la conexión o los nombres de las tablas.</p></article>";
    return;
  }

  allSongs = data || [];
  renderSongs();
}

searchInput?.addEventListener("input", renderSongs);
filterButtons.forEach((button) => button.addEventListener("click", () => {
  filterButtons.forEach((item) => item.classList.remove("active"));
  button.classList.add("active");
  activeType = normalize(button.dataset.type);
  renderSongs();
}));

initNavigation();
loadSongs();
