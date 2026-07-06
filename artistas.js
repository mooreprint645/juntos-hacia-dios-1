const db = window.supabaseClient;
const grid = document.querySelector("#artistsGrid");
const input = document.querySelector("#artistSearch");
const params = new URLSearchParams(location.search);
const selectedKey = params.get("slug") || params.get("id") || "";
let people = [];

const norm = (value) => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const slugify = (value) => norm(value).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
const esc = (value) => String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

function nav() {
  const button = document.querySelector("#menuToggle");
  const menu = document.querySelector("#navMenu");
  const theme = document.querySelector("#themeToggle");
  button?.addEventListener("click", () => menu?.classList.toggle("open"));
  if (localStorage.getItem("jhd-theme") === "light") { document.body.classList.add("light-mode"); if (theme) theme.textContent = "☀️"; }
  theme?.addEventListener("click", () => { document.body.classList.toggle("light-mode"); const on = document.body.classList.contains("light-mode"); localStorage.setItem("jhd-theme", on ? "light" : "dark"); theme.textContent = on ? "☀️" : "🌙"; });
}

function card(person) {
  const key = person.slug || slugify(person.name);
  return `<a class="artist-card" href="artistas.html?slug=${encodeURIComponent(key)}"><h3>${esc(person.name || "Ministerio")}</h3><p><strong>${esc(person.artist_type || person.type || "Ministerio")}</strong></p><p>${esc(person.description || "Artista o ministerio del cancionero.")}</p></a>`;
}

function drawList() {
  if (!grid) return;
  const query = norm(input?.value);
  const list = people.filter((person) => !query || norm([person.name, person.description, person.type, person.artist_type].join(" ")).includes(query));
  grid.innerHTML = list.length ? list.map(card).join("") : "<article class='artist-card'><h3>Sin resultados</h3><p>Prueba con otro nombre.</p></article>";
}

async function drawProfile(person) {
  if (!grid) return;
  document.title = `${person.name || "Artista"} | Juntos Hacia Dios`;
  const heroTitle = document.querySelector(".hero h1");
  const heroText = document.querySelector(".hero .hero-content > p:last-child");
  if (heroTitle) heroTitle.textContent = person.name || "Artista";
  if (heroText) heroText.textContent = person.description || "Ministerio o artista del cancionero.";
  input?.closest(".search-container")?.classList.add("hidden");
  const [songsRes, relationRes] = await Promise.all([
    db.from("songs").select("*").order("title", { ascending: true }),
    db.from("song_artists").select("song_id,artist_id")
  ]);
  const ids = new Set((relationRes.data || []).filter((row) => String(row.artist_id) === String(person.id)).map((row) => String(row.song_id)));
  const songs = (songsRes.data || []).filter((song) => ids.has(String(song.id)));
  const initials = String(person.name || "JHD").split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase();
  const rows = songs.length ? songs.map((song) => `<a class="song-card song-link-card" href="cancion.html?id=${encodeURIComponent(song.id)}"><p class="artists-line">${esc(song.song_type || "Canción")}</p><h3>${esc(song.title || "Canción")}</h3><p>${esc(song.tone ? `Tono ${song.tone}` : "Ver letra y acordes")}</p></a>`).join("") : "<article class='song-card'><h3>Sin canciones</h3><p>Aún no hay canciones relacionadas.</p></article>";
  grid.innerHTML = `<article class="intro-card"><div class="artist-mini-avatar">${esc(initials)}</div><h2>${esc(person.name || "Ministerio")}</h2><p>${esc(person.description || "Artista o ministerio del cancionero.")}</p><p class="muted-text">${songs.length} ${songs.length === 1 ? "canción" : "canciones"} relacionadas</p><a class="song-btn secondary" href="artistas.html">← Volver a artistas</a></article><div class="songs-grid">${rows}</div>`;
}

async function start() {
  if (!db || !grid) return;
  const result = await db.from("artists").select("*").order("name", { ascending: true });
  if (result.error) { grid.innerHTML = "<article class='artist-card'><h3>Error al cargar</h3><p>Revisa la conexión con Supabase.</p></article>"; return; }
  people = result.data || [];
  const chosen = people.find((person) => String(person.id) === selectedKey || norm(person.slug) === norm(selectedKey) || slugify(person.name) === norm(selectedKey));
  if (selectedKey && chosen) { await drawProfile(chosen); return; }
  if (selectedKey && !chosen) { grid.innerHTML = "<article class='artist-card'><h3>Artista no encontrado</h3><p>Vuelve al listado e intenta nuevamente.</p></article>"; return; }
  drawList();
}

input?.addEventListener("input", drawList);
nav();
start();
