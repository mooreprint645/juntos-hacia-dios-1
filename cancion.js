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

function names(items) {
  return (items || []).map((item) => item?.name || item?.title || "").filter(Boolean).join(" · ");
}

async function loadSongRelations(id) {
  const [artistRes, categoryRes, linksRes] = await Promise.all([
    client.from("song_artists").select("artists(id, name, artist_type)").eq("song_id", id),
    client.from("song_categories").select("categories(id, name, song_type, slug)").eq("song_id", id),
    client.from("song_links").select("*").eq("song_id", id).order("sort_order", { ascending: true })
  ]);

  return {
    artists: (artistRes.data || []).map((row) => row.artists).filter(Boolean),
    categories: (categoryRes.data || []).map((row) => row.categories).filter(Boolean),
    links: linksRes.data || []
  };
}

function renderMeta(song, relations) {
  const items = [
    song.song_type || song.type,
    names(relations.categories),
    song.tone || song.key,
    names(relations.artists)
  ].filter(Boolean);
  const meta = $("#songMeta");
  if (!meta) return;
  meta.innerHTML = items.length ? items.map((item) => `<span class="filter-btn">${escapeHTML(item)}</span>`).join("") : "<span class='filter-btn'>Sin metadatos</span>";
}

function renderLinks(relations) {
  const container = $("#songLinks");
  if (!container) return;
  const links = relations.links || [];
  if (!links.length) {
    container.innerHTML = "<article class='quick-card'><h3>Sin recursos</h3><p>Aún no hay enlaces disponibles para esta canción.</p></article>";
    return;
  }
  container.innerHTML = links.map((link) => {
    const title = escapeHTML(link.title || link.link_type || "Recurso");
    const label = escapeHTML([link.platform, link.link_type].filter(Boolean).join(" · ") || "Abrir recurso");
    const url = escapeHTML(link.url || "#");
    return `<a class="quick-card" href="${url}" target="_blank" rel="noopener"><h3>${title}</h3><p>${label}</p></a>`;
  }).join("");
}

function renderSong(song, relations) {
  const title = song.title || song.name || "Canción sin título";
  const type = song.song_type || song.type || "Canción";
  const artistText = names(relations.artists) || song.artist || song.artist_name || "";
  const lyrics = song.lyrics || song.letter || song.content || "Letra no disponible.";
  document.title = `${title} | Juntos Hacia Dios`;
  $("#songType").textContent = type;
  $("#songTitle").textContent = title;
  $("#songSubtitle").textContent = artistText ? `Por ${artistText}` : "Canción del cancionero.";
  $("#songLyrics").textContent = lyrics;
  renderMeta(song, relations);
  renderLinks(relations);
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
  const relations = await loadSongRelations(songId);
  renderSong(data, relations);
}

initNavigation();
loadSong();
