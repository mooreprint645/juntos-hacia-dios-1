const client = window.supabaseClient;
const artistsGrid = document.querySelector("#artistsGrid");
const searchInput = document.querySelector("#artistSearch");
let allArtists = [];

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

function renderArtists() {
  const query = normalize(searchInput?.value);
  const filtered = allArtists.filter((artist) => {
    const text = normalize([artist.name, artist.type, artist.artist_type, artist.description].join(" "));
    return !query || text.includes(query);
  });

  if (!artistsGrid) return;
  if (!filtered.length) {
    artistsGrid.innerHTML = "<article class='artist-card'><h3>Sin resultados</h3><p>Prueba con otro nombre.</p></article>";
    return;
  }

  artistsGrid.innerHTML = filtered.map((artist) => {
    const name = escapeHTML(artist.name || "Artista sin nombre");
    const type = escapeHTML(artist.type || artist.artist_type || "Ministerio");
    const description = escapeHTML(artist.description || "Artista o ministerio del cancionero.");
    return `<article class="artist-card"><h3>${name}</h3><p><strong>${type}</strong></p><p>${description}</p></article>`;
  }).join("");
}

async function loadArtists() {
  if (!client) {
    artistsGrid.innerHTML = "<article class='artist-card'><h3>Sin conexión</h3><p>No se pudo iniciar Supabase.</p></article>";
    return;
  }

  const { data, error } = await client.from("artists").select("*").order("created_at", { ascending: false });
  if (error) {
    console.error(error);
    artistsGrid.innerHTML = "<article class='artist-card'><h3>Error al cargar</h3><p>Revisa la conexión o la tabla artists.</p></article>";
    return;
  }

  allArtists = data || [];
  renderArtists();
}

searchInput?.addEventListener("input", renderArtists);
initNavigation();
loadArtists();
