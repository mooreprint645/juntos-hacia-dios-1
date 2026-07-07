const db = window.supabaseClient;
const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const norm = (value) => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const slugify = (value) => norm(value).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
const params = new URLSearchParams(location.search);
const selected = params.get("album") || params.get("id") || "";

let albums = [];
let artists = [];

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

function owner(album) {
  return artists.find((item) => String(item.id) === String(album.artist_id));
}

function countLabel(count) {
  return `${count} ${count === 1 ? "canto" : "cantos"}`;
}

function card(album) {
  const person = owner(album);
  const key = album.slug || slugify(album.title) || album.id;
  const count = Number(album.song_count || 0);
  const description = album.description || album.year || "Colección de cantos disponible en el cancionero.";
  return `<a class="artist-card catalog-album-card" href="albumes.html?album=${encodeURIComponent(key)}" aria-label="Ver álbum ${esc(album.title || "Álbum")}"><div class="catalog-card-heading"><span class="catalog-album-disc" aria-hidden="true">◉</span><div><p class="catalog-card-kicker">${esc(person?.name || "Colección")}</p><h3>${esc(album.title || "Álbum")}</h3></div><span class="catalog-card-arrow" aria-hidden="true">→</span></div><p class="catalog-card-description">${esc(description)}</p><div class="catalog-card-footer"><span class="catalog-card-count"><span aria-hidden="true">♫</span> ${esc(countLabel(count))}</span><strong>Ver álbum →</strong></div></a>`;
}

function drawList() {
  const grid = $("#albumsGrid");
  const query = norm($("#albumSearch")?.value);
  const status = $("#albumResultsStatus");
  if (!grid) return;
  const visible = albums.filter((album) => !query || norm([album.title, album.description, album.year, owner(album)?.name].join(" ")).includes(query));
  if (status) status.textContent = `${visible.length} ${visible.length === 1 ? "álbum encontrado" : "álbumes encontrados"}`;
  grid.className = "artists-grid";
  grid.innerHTML = visible.length
    ? visible.map(card).join("")
    : "<article class='artist-card'><h3>Sin álbumes</h3><p>Aún no hay álbumes que coincidan con la búsqueda.</p></article>";
}

async function drawDetail(album) {
  const grid = $("#albumsGrid");
  const person = owner(album);
  if (!grid) return;
  $("#albumsTitle").textContent = album.title || "Álbum";
  $("#albumsSubtitle").textContent = album.description || "Canciones de esta colección.";
  $("#albumSearchBox")?.classList.add("hidden");
  grid.className = "";
  grid.innerHTML = "<article class='artist-card shimmer-card'><h3>Cargando canciones…</h3><p>Un momento por favor.</p></article>";

  const joinsRes = await db.from("album_songs").select("song_id").eq("album_id", album.id).order("sort_order", { ascending: true });
  if (joinsRes.error) {
    grid.innerHTML = `<article class='artist-card'><h3>No se pudo cargar el álbum</h3><p>${esc(joinsRes.error.message)}</p></article>`;
    return;
  }
  const songIds = [...new Set((joinsRes.data || []).map((row) => row.song_id).filter(Boolean))];
  const songsRes = songIds.length
    ? await db.from("songs").select("id,title,slug,tone,song_type").in("id", songIds).order("title", { ascending: true })
    : { data: [], error: null };
  if (songsRes.error) {
    grid.innerHTML = `<article class='artist-card'><h3>No se pudieron cargar las canciones</h3><p>${esc(songsRes.error.message)}</p></article>`;
    return;
  }

  const list = songsRes.data || [];
  const artistLink = person ? `<a class="filter-btn" href="artistas.html?slug=${encodeURIComponent(person.slug || slugify(person.name))}">${esc(person.name)}</a>` : "";
  const songCards = list.length
    ? list.map((song) => `<a class="song-card song-link-card" href="cancion.html?id=${encodeURIComponent(song.id)}"><p class="artists-line">${esc(song.song_type || "Canción")}</p><h3>${esc(song.title || "Canción")}</h3><p>${esc(song.tone ? `Tono ${song.tone}` : "Ver letra y acordes")}</p></a>`).join("")
    : "<article class='song-card'><h3>Sin canciones</h3><p>Aún no hay canciones asignadas a este álbum.</p></article>";

  grid.innerHTML = `<article class="intro-card"><p class="hero-kicker">${esc(album.year || "Álbum")}</p><h2>${esc(album.title || "Álbum")}</h2><p>${esc(album.description || "Colección registrada en el cancionero.")}</p><p class="muted-text">${esc(countLabel(list.length))}</p><div class="song-filters">${artistLink}</div><a class="song-btn secondary" href="albumes.html">← Volver a álbumes</a></article><div class="songs-grid">${songCards}</div>`;
}

async function start() {
  nav();
  const grid = $("#albumsGrid");
  if (!db) {
    if (grid) grid.innerHTML = "<article class='artist-card'><h3>Sin conexión</h3><p>No se pudo iniciar Supabase.</p></article>";
    return;
  }

  const [albumRes, artistRes, songRes] = await Promise.all([
    db.from("albums").select("*").order("title", { ascending: true }),
    db.from("artists").select("id,name,slug").order("name", { ascending: true }),
    db.from("album_songs").select("album_id,song_id")
  ]);
  if (albumRes.error) {
    if (grid) grid.innerHTML = `<article class='artist-card'><h3>No se pudieron cargar los álbumes</h3><p>${esc(albumRes.error.message)}</p></article>`;
    return;
  }

  const countByAlbum = new Map();
  if (!songRes.error) {
    (songRes.data || []).forEach((row) => {
      const albumId = String(row.album_id || "");
      if (!albumId || !row.song_id) return;
      if (!countByAlbum.has(albumId)) countByAlbum.set(albumId, new Set());
      countByAlbum.get(albumId).add(String(row.song_id));
    });
  }
  albums = (albumRes.data || []).map((album) => ({ ...album, song_count: countByAlbum.get(String(album.id))?.size || 0 }));
  artists = artistRes.data || [];
  const picked = albums.find((album) => String(album.id) === selected || norm(album.slug) === norm(selected) || slugify(album.title) === norm(selected));
  if (selected && picked) await drawDetail(picked);
  else if (selected && grid) grid.innerHTML = "<article class='artist-card'><h3>Álbum no encontrado</h3><p>Vuelve al listado e intenta nuevamente.</p></article>";
  else drawList();

  $("#albumSearch")?.addEventListener("input", drawList);
}

start();
