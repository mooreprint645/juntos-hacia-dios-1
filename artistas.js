const db = window.supabaseClient;
const grid = document.querySelector("#artistsGrid");
const input = document.querySelector("#artistSearch");
const params = new URLSearchParams(location.search);
const selectedKey = params.get("slug") || params.get("id") || "";
let people = [];
let activeType = "";

const norm = (value) => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const slugify = (value) => norm(value).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
const esc = (value) => String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const cleanDescription = (value) => String(value || "").replace(/<!--JHD_ARTIST_META:[\s\S]*?-->\s*$/, "").trim();
const biography = (person) => cleanDescription(person?.bio || person?.description);

function nav() {
  const button = document.querySelector("#menuToggle");
  const menu = document.querySelector("#navMenu");
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

function artistGroup(person) {
  const type = norm(person.artist_type || person.type);
  if (type.includes("catolico")) return "catolico";
  if (type.includes("cristiano")) return "cristiano";
  return "otros";
}

function typeLabel(person) {
  const group = artistGroup(person);
  if (group === "catolico") return "Católico";
  if (group === "cristiano") return "Cristiano";
  return person.artist_type || person.type || "General";
}

function card(person) {
  const key = person.slug || slugify(person.name);
  const description = biography(person);
  return `<a class="artist-card" href="artista.html?slug=${encodeURIComponent(key)}"><h3>${esc(person.name || "Ministerio")}</h3><p><strong>${esc(typeLabel(person))}</strong></p><p>${esc(description || "Artista o ministerio del cancionero.")}</p></a>`;
}

function mountFilters() {
  if (document.querySelector("#artistTypeFilters")) return;
  const searchBox = input?.closest(".search-container");
  if (!searchBox) return;
  const filters = document.createElement("div");
  filters.id = "artistTypeFilters";
  filters.className = "song-filters";
  filters.setAttribute("aria-label", "Filtrar artistas por tipo");
  filters.innerHTML = `<button class="filter-btn active" type="button" data-artist-type="" aria-pressed="true">Todas</button><button class="filter-btn" type="button" data-artist-type="catolico" aria-pressed="false">Católicos</button><button class="filter-btn" type="button" data-artist-type="cristiano" aria-pressed="false">Cristianos</button>`;
  searchBox.after(filters);
  filters.querySelectorAll("[data-artist-type]").forEach((button) => button.addEventListener("click", () => {
    activeType = button.dataset.artistType || "";
    filters.querySelectorAll("button").forEach((item) => {
      const selected = item === button;
      item.classList.toggle("active", selected);
      item.setAttribute("aria-pressed", String(selected));
    });
    drawList();
  }));
}

function drawList() {
  if (!grid) return;
  const query = norm(input?.value);
  const list = people.filter((person) => {
    const matchesSearch = !query || norm([person.name, biography(person), person.type, person.artist_type].join(" ")).includes(query);
    const matchesType = !activeType || artistGroup(person) === activeType;
    return matchesSearch && matchesType;
  });
  grid.className = "artists-grid";
  const status = document.querySelector("#artistResultsStatus");
  if (status) status.textContent = `${list.length} ${list.length === 1 ? "artista encontrado" : "artistas encontrados"}`;
  grid.innerHTML = list.length
    ? list.map(card).join("")
    : `<article class="artist-card"><h3>Sin resultados</h3><p>${activeType ? "No hay artistas de este tipo que coincidan con la búsqueda." : "Prueba con otro nombre."}</p></article>`;
}

async function drawProfile(person) {
  if (!grid) return;
  const description = biography(person);
  document.title = `${person.name || "Artista"} | Juntos Hacia Dios`;
  const heroTitle = document.querySelector(".hero h1");
  const heroText = document.querySelector(".hero .hero-content > p:last-child");
  if (heroTitle) heroTitle.textContent = person.name || "Artista";
  if (heroText) heroText.textContent = description || "Ministerio o artista del cancionero.";
  input?.closest(".search-container")?.classList.add("hidden");
  document.querySelector("#artistTypeFilters")?.classList.add("hidden");

  grid.className = "artists-grid";
  grid.innerHTML = "<article class='artist-card shimmer-card'><h3>Cargando perfil…</h3><p>Un momento por favor.</p></article>";

  const [relationsRes, albumsRes] = await Promise.all([
    db.from("song_artists").select("song_id").eq("artist_id", person.id),
    db.from("albums").select("*").eq("artist_id", person.id).order("title", { ascending: true })
  ]);
  const relationError = relationsRes.error || albumsRes.error;
  if (relationError) {
    grid.innerHTML = `<article class='artist-card'><h3>No se pudo cargar el perfil</h3><p>${esc(relationError.message)}</p></article>`;
    return;
  }

  const songIds = [...new Set((relationsRes.data || []).map((row) => row.song_id).filter(Boolean))];
  const songsRes = songIds.length
    ? await db.from("songs").select("id,title,slug,tone,song_type").in("id", songIds).order("title", { ascending: true })
    : { data: [], error: null };
  if (songsRes.error) {
    grid.innerHTML = `<article class='artist-card'><h3>No se pudieron cargar las canciones</h3><p>${esc(songsRes.error.message)}</p></article>`;
    return;
  }

  const songs = songsRes.data || [];
  const albums = albumsRes.data || [];
  const initials = String(person.name || "JHD").split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase();
  const rows = songs.length
    ? songs.map((song) => `<a class="song-card song-link-card" href="cancion.html?id=${encodeURIComponent(song.id)}"><p class="artists-line">${esc(song.song_type || "Canción")}</p><h3>${esc(song.title || "Canción")}</h3><p>${esc(song.tone ? `Tono ${song.tone}` : "Ver letra y acordes")}</p></a>`).join("")
    : "<article class='song-card'><h3>Sin canciones</h3><p>Aún no hay canciones relacionadas.</p></article>";
  const albumLinks = albums.length
    ? `<div class="song-filters">${albums.map((album) => `<a class="filter-btn" href="canciones.html?album=${encodeURIComponent(album.slug || album.title || "")}">${esc(album.title || "Álbum")}${album.year ? ` · ${esc(album.year)}` : ""}</a>`).join("")}</div>`
    : "";

  grid.innerHTML = `<article class="intro-card"><div class="artist-mini-avatar">${esc(initials)}</div><h2>${esc(person.name || "Ministerio")}</h2><p>${esc(description || "Artista o ministerio del cancionero.")}</p><p class="muted-text">${songs.length} ${songs.length === 1 ? "canción" : "canciones"} relacionadas</p>${albumLinks}<a class="song-btn secondary" href="artistas.html">← Volver a artistas</a></article><div class="songs-grid">${rows}</div>`;
}

async function start() {
  if (!db || !grid) return;
  mountFilters();
  const result = await db.from("artists").select("*").order("name", { ascending: true });
  if (result.error) {
    grid.innerHTML = "<article class='artist-card'><h3>Error al cargar</h3><p>Revisa la conexión con Supabase.</p></article>";
    return;
  }
  people = result.data || [];
  const chosen = people.find((person) => String(person.id) === selectedKey || norm(person.slug) === norm(selectedKey) || slugify(person.name) === norm(selectedKey));
  if (selectedKey && chosen) {
    await drawProfile(chosen);
    return;
  }
  if (selectedKey && !chosen) {
    grid.innerHTML = "<article class='artist-card'><h3>Artista no encontrado</h3><p>Vuelve al listado e intenta nuevamente.</p></article>";
    return;
  }
  drawList();
}

input?.addEventListener("input", drawList);
nav();
start();