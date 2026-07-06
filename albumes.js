const db = window.supabaseClient;
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const norm = (v) => String(v || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const slugify = (v) => norm(v).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
const params = new URLSearchParams(location.search);
const selected = params.get("album") || params.get("id") || "";
let albums = [], artists = [], songs = [], joins = [];

function nav() {
  const button = $("#menuToggle"), menu = $("#navMenu"), theme = $("#themeToggle");
  button?.addEventListener("click", () => menu?.classList.toggle("open"));
  const light = localStorage.getItem("jhd-theme") === "light";
  document.body.classList.toggle("light-mode", light);
  if (theme) theme.textContent = light ? "☀️" : "🌙";
  theme?.addEventListener("click", () => { const on = document.body.classList.toggle("light-mode"); localStorage.setItem("jhd-theme", on ? "light" : "dark"); theme.textContent = on ? "☀️" : "🌙"; });
}
function owner(album) { return artists.find((item) => String(item.id) === String(album.artist_id)); }
function card(album) {
  const person = owner(album);
  const key = album.slug || slugify(album.title) || album.id;
  return `<a class="artist-card" href="albumes.html?album=${encodeURIComponent(key)}"><p class="hero-kicker">${esc(person?.name || "Colección")}</p><h3>${esc(album.title || "Álbum")}</h3><p>${esc(album.description || album.year || "Ver canciones del álbum.")}</p></a>`;
}
function drawList() {
  const grid = $("#albumsGrid"), query = norm($("#albumSearch")?.value);
  if (!grid) return;
  const visible = albums.filter((album) => !query || norm([album.title, album.description, album.year, owner(album)?.name].join(" ")).includes(query));
  grid.innerHTML = visible.length ? visible.map(card).join("") : "<article class='artist-card'><h3>Sin álbumes</h3><p>Aún no hay álbumes que coincidan con la búsqueda.</p></article>";
}
function drawDetail(album) {
  const grid = $("#albumsGrid"), person = owner(album);
  if (!grid) return;
  $("#albumsTitle").textContent = album.title || "Álbum";
  $("#albumsSubtitle").textContent = album.description || "Canciones de esta colección.";
  $("#albumSearchBox")?.classList.add("hidden");
  const songIds = new Set(joins.filter((row) => String(row.album_id) === String(album.id)).map((row) => String(row.song_id)));
  const list = songs.filter((song) => songIds.has(String(song.id)));
  const artistLink = person ? `<a class="filter-btn" href="artistas.html?slug=${encodeURIComponent(person.slug || slugify(person.name))}">${esc(person.name)}</a>` : "";
  const songCards = list.length ? list.map((song) => `<a class="song-card song-link-card" href="cancion.html?id=${encodeURIComponent(song.id)}"><p class="artists-line">${esc(song.song_type || "Canción")}</p><h3>${esc(song.title || "Canción")}</h3><p>${esc(song.tone ? `Tono ${song.tone}` : "Ver letra y acordes")}</p></a>`).join("") : "<article class='song-card'><h3>Sin canciones</h3><p>Aún no hay canciones asignadas a este álbum.</p></article>";
  grid.className = "";
  grid.innerHTML = `<article class="intro-card"><p class="hero-kicker">${esc(album.year || "Álbum")}</p><h2>${esc(album.title || "Álbum")}</h2><p>${esc(album.description || "Colección registrada en el cancionero.")}</p><div class="song-filters">${artistLink}</div><a class="song-btn secondary" href="albumes.html">← Volver a álbumes</a></article><div class="songs-grid">${songCards}</div>`;
}
async function start() {
  nav();
  if (!db) { $("#albumsGrid").innerHTML = "<article class='artist-card'><h3>Sin conexión</h3><p>No se pudo iniciar Supabase.</p></article>"; return; }
  const [albumRes, artistRes, songRes, joinRes] = await Promise.all([
    db.from("albums").select("*").order("title", { ascending: true }),
    db.from("artists").select("id,name,slug").order("name", { ascending: true }),
    db.from("songs").select("id,title,slug,tone,song_type").order("title", { ascending: true }),
    db.from("album_songs").select("album_id,song_id").order("sort_order", { ascending: true })
  ]);
  if (albumRes.error) { $("#albumsGrid").innerHTML = `<article class='artist-card'><h3>No se pudieron cargar los álbumes</h3><p>${esc(albumRes.error.message)}</p></article>`; return; }
  albums = albumRes.data || []; artists = artistRes.data || []; songs = songRes.data || []; joins = joinRes.data || [];
  const picked = albums.find((album) => String(album.id) === selected || norm(album.slug) === norm(selected) || slugify(album.title) === norm(selected));
  if (selected && picked) drawDetail(picked); else if (selected) $("#albumsGrid").innerHTML = "<article class='artist-card'><h3>Álbum no encontrado</h3><p>Vuelve al listado e intenta nuevamente.</p></article>"; else drawList();
  $("#albumSearch")?.addEventListener("input", drawList);
}
start();
