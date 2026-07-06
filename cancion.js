const client = window.supabaseClient;
const params = new URLSearchParams(window.location.search);
const songId = params.get("id");

const $ = (selector) => document.querySelector(selector);
const escapeHTML = (value) => String(value || "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function initNavigation() {
  const menuButton = $("#menuToggle");
  const menu = $("#navMenu");
  const themeButton = $("#themeToggle");

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

function setSongError(message) {
  $("#songTitle").textContent = "No se pudo cargar";
  $("#songSubtitle").textContent = message;
  $("#songLyrics").textContent = "Vuelve a la lista de canciones e intenta abrir el canto nuevamente.";
}

function renderMeta(song) {
  const items = [
    song.type || song.song_type,
    song.category || song.category_name,
    song.tone || song.key,
    song.artist || song.artist_name
  ].filter(Boolean);

  const meta = $("#songMeta");
  if (!meta) return;
  meta.innerHTML = items.length
    ? items.map((item) => `<span class="filter-btn">${escapeHTML(item)}</span>`).join("")
    : "<span class='filter-btn'>Sin metadatos</span>";
}

function renderLinks(song) {
  const links = [
    { label: "Video", url: song.video_url || song.youtube_url },
    { label: "Acordes", url: song.chords_url || song.acordes_url },
    { label: "PDF", url: song.pdf_url },
    { label: "Recurso", url: song.resource_url || song.link_url }
  ].filter((item) => item.url);

  const container = $("#songLinks");
  if (!container) return;

  if (!links.length) {
    container.innerHTML = "<article class='quick-card'><h3>Sin recursos</h3><p>Aún no hay enlaces disponibles para esta canción.</p></article>";
    return;
  }

  container.innerHTML = links.map((item) => `
    <a class="quick-card" href="${escapeHTML(item.url)}" target="_blank" rel="noopener">
      <h3>${escapeHTML(item.label)}</h3>
      <p>Abrir recurso en una pestaña nueva.</p>
    </a>
  `).join("");
}

function renderSong(song) {
  const title = song.title || song.name || "Canción sin título";
  const type = song.type || song.song_type || "Canción";
  const artist = song.artist || song.artist_name || "";
  const lyrics = song.lyrics || song.letter || song.content || "Letra no disponible.";

  document.title = `${title} | Juntos Hacia Dios`;
  $("#songType").textContent = type;
  $("#songTitle").textContent = title;
  $("#songSubtitle").textContent = artist ? `Por ${artist}` : "Canción del cancionero.";
  $("#songLyrics").textContent = lyrics;

  renderMeta(song);
  renderLinks(song);
}

async function loadSong() {
  if (!songId) {
    setSongError("No se encontró el identificador de la canción.");
    return;
  }

  if (!client) {
    setSongError("No se pudo iniciar la conexión con Supabase.");
    return;
  }

  const { data, error } = await client.from("songs").select("*").eq("id", songId).single();

  if (error || !data) {
    console.error(error);
    setSongError("La canción no existe o no pudo cargarse desde Supabase.");
    return;
  }

  renderSong(data);
}

initNavigation();
loadSong();
