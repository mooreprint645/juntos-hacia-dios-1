const AdminPro = window.supabaseClient;
const ap$ = (selector, root = document) => root.querySelector(selector);
const ap$$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const apEsc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const apNorm = (value) => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const apSlug = (value) => apNorm(value).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
const apId = (value) => String(value || "");
const apType = (value) => ({ catolico: "Católico", cristiano: "Cristiano", mixto: "Mixto" }[apNorm(value)] || "General");

const AP = {
  tab: "songs",
  user: null,
  artists: [],
  categories: [],
  albums: [],
  songs: [],
  donation: null,
  edits: { artist: null, category: null, album: null, song: null },
  filters: { artists: "", categories: "", albums: "", albumArtist: "", songs: "", songArtist: "", songCategory: "", songAlbum: "" },
  limits: { artists: 8, categories: 8, albums: 8, songs: 8 },
  draft: null,
  links: [],
  capos: []
};

function apNote(text, bad = false) {
  const box = ap$("#adminMessage");
  if (!box) return;
  box.textContent = text || "";
  box.style.color = bad ? "#ffb4b4" : "";
}
function apSetTheme() {
  const theme = ap$("#themeToggle");
  const light = localStorage.getItem("jhd-theme") === "light";
  document.body.classList.toggle("light-mode", light);
  if (theme) theme.textContent = light ? "☀️" : "🌙";
}
function apNav() {
  ap$("#menuToggle")?.addEventListener("click", () => ap$("#navMenu")?.classList.toggle("open"));
  apSetTheme();
  ap$("#themeToggle")?.addEventListener("click", () => {
    const on = !document.body.classList.contains("light-mode");
    localStorage.setItem("jhd-theme", on ? "light" : "dark");
    apSetTheme();
  });
}
function apOptions(rows, valueKey, label) {
  return (rows || []).map((row) => `<option value="${apEsc(row[valueKey || "id"])}">${apEsc(label ? label(row) : (row.name || row.title || "Sin nombre"))}</option>`).join("");
}
function apEmpty(text) { return `<div class="admin-empty">${apEsc(text)}</div>`; }
function apSortRows(rows, label) { return [...(rows || [])].sort((a, b) => String(label(a)).localeCompare(String(label(b)), "es")); }

function apResetDraft(song) {
  const source = song || {};
  const links = source._links || [];
  const capos = source._capos || [];
  const artistLinks = [...(source._artistLinks || [])].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
  const principal = artistLinks.find((row) => apNorm(row.role) === "principal") || artistLinks[0];
  AP.edits.song = song?.id || null;
  AP.draft = {
    title: source.title || "",
    song_type: source.song_type || "catolico",
    main_artist_id: principal?.artist_id || "",
    collaborators: artistLinks.filter((row) => apId(row.artist_id) !== apId(principal?.artist_id)).map((row) => apId(row.artist_id)),
    category_id: source._categories?.[0]?.id || "",
    album_id: source._albums?.[0]?.id || "",
    tone: source.tone || "",
    difficulty: source.difficulty || "",
    capo_position: String(source.capo_position || 0),
    capo_key: source.capo_key || "",
    lyrics: source.lyrics || "",
    collaborator_query: "",
    new_link_title: "",
    new_link_type: "Tutorial",
    new_link_platform: "YouTube",
    new_link_url: "",
    new_capo_label: "",
    new_capo_position: "0",
    new_capo_key: ""
  };
  AP.links = links.map((row, index) => ({ title: row.title || "", link_type: row.link_type || "Tutorial", platform: row.platform || "", url: row.url || "", sort_order: index }));
  AP.capos = capos.map((row, index) => ({ label: row.label || "", capo_position: Number(row.capo_position || 0), capo_key: row.capo_key || "", sort_order: index }));
}
function apCaptureSongDraft() {
  const form = ap$("#songAdminForm");
  if (!form || !AP.draft) return;
  const data = Object.fromEntries(new FormData(form).entries());
  AP.draft = Object.assign({}, AP.draft, data, {
    collaborators: ap$$("input[name='collaborator']:checked", form).map((input) => input.value)
  });
}
function apDraftValue(key) { return AP.draft?.[key] ?? ""; }
function apCategoryPath(item) {
  const parts = [];
  let current = item;
  const seen = new Set();
  while (current && !seen.has(apId(current.id))) {
    seen.add(apId(current.id));
    parts.unshift(current.name || "Categoría");
    current = AP.categories.find((row) => apId(row.id) === apId(current.parent_id));
  }
  return parts.join(" › ");
}
function apCategoryDescendants(id) {
  const out = new Set([apId(id)]);
  let added = true;
  while (added) {
    added = false;
    AP.categories.forEach((row) => {
      if (out.has(apId(row.parent_id)) && !out.has(apId(row.id))) { out.add(apId(row.id)); added = true; }
    });
  }
  return out;
}
function apFlatCategories() { return apSortRows(AP.categories, apCategoryPath); }
function apSongArtists(song) { return (song._artists || []).map((row) => row.name).filter(Boolean).join(" · ") || "Sin artista"; }
function apSongCategories(song) { return (song._categories || []).map((row) => row.name).filter(Boolean).join(" · "); }
function apSongAlbums(song) { return (song._albums || []).map((row) => row.title).filter(Boolean).join(" · "); }

async function apLoadData() {
  const [songsRes, artistsRes, categoriesRes, albumsRes, artistJoinRes, categoryJoinRes, albumJoinRes, linksRes, capoRes, donationRes] = await Promise.all([
    AdminPro.from("songs").select("*").order("title", { ascending: true }),
    AdminPro.from("artists").select("*").order("name", { ascending: true }),
    AdminPro.from("categories").select("*").order("sort_order", { ascending: true }).order("name", { ascending: true }),
    AdminPro.from("albums").select("*").order("sort_order", { ascending: true }).order("title", { ascending: true }),
    AdminPro.from("song_artists").select("id,song_id,artist_id,role,sort_order,artists(id,name,slug,artist_type)").order("sort_order", { ascending: true }),
    AdminPro.from("song_categories").select("id,song_id,category_id,categories(id,name,slug,song_type,parent_id,sort_order)"),
    AdminPro.from("album_songs").select("id,song_id,album_id,sort_order,albums(id,title,slug,artist_id,description)").order("sort_order", { ascending: true }),
    AdminPro.from("song_links").select("*").order("sort_order", { ascending: true }),
    AdminPro.from("song_capo_versions").select("*").order("sort_order", { ascending: true }),
    AdminPro.from("donation_settings").select("*").order("updated_at", { ascending: false }).limit(1).maybeSingle()
  ]);
  const error = [songsRes, artistsRes, categoriesRes, albumsRes, artistJoinRes, categoryJoinRes, albumJoinRes, linksRes, capoRes].find((item) => item.error)?.error;
  if (error) throw error;
  AP.artists = artistsRes.data || [];
  AP.categories = categoriesRes.data || [];
  AP.albums = albumsRes.data || [];
  AP.donation = donationRes.data || null;
  const artistMap = new Map(), categoryMap = new Map(), albumMap = new Map(), linksMap = new Map(), capoMap = new Map();
  (artistJoinRes.data || []).forEach((row) => { const id = apId(row.song_id); if (!artistMap.has(id)) artistMap.set(id, []); artistMap.get(id).push({ ...row, artist: row.artists }); });
  (categoryJoinRes.data || []).forEach((row) => { const id = apId(row.song_id); if (!categoryMap.has(id)) categoryMap.set(id, []); if (row.categories) categoryMap.get(id).push({ ...row.categories, _joinId: row.id, _categoryId: row.category_id }); });
  (albumJoinRes.data || []).forEach((row) => { const id = apId(row.song_id); if (!albumMap.has(id)) albumMap.set(id, []); if (row.albums) albumMap.get(id).push({ ...row.albums, _joinId: row.id, _albumId: row.album_id }); });
  (linksRes.data || []).forEach((row) => { const id = apId(row.song_id); if (!linksMap.has(id)) linksMap.set(id, []); linksMap.get(id).push(row); });
  (capoRes.data || []).forEach((row) => { const id = apId(row.song_id); if (!capoMap.has(id)) capoMap.set(id, []); capoMap.get(id).push(row); });
  AP.songs = (songsRes.data || []).map((song) => ({ ...song, _artistLinks: artistMap.get(apId(song.id)) || [], _artists: (artistMap.get(apId(song.id)) || []).map((row) => row.artist).filter(Boolean), _categories: categoryMap.get(apId(song.id)) || [], _albums: albumMap.get(apId(song.id)) || [], _links: linksMap.get(apId(song.id)) || [], _capos: capoMap.get(apId(song.id)) || [] }));
}

function apRenderShell() {
  const workspace = ap$("#adminWorkspace");
  if (!workspace) return;
  const tabs = [["artists", "Artistas"], ["categories", "Categorías"], ["albums", "Álbumes"], ["songs", "Canciones"], ["donations", "Donaciones"]];
  workspace.innerHTML = `<div class="admin-shell"><div class="admin-topbar"><p class="muted-text">Sesión activa: <strong>${apEsc(AP.user?.email || "Administrador")}</strong></p><button class="song-btn small-btn secondary" id="adminLogout" type="button">Cerrar sesión</button></div><div class="admin-tabs">${tabs.map(([id, label]) => `<button class="admin-tab ${AP.tab === id ? "active" : ""}" type="button" data-admin-tab="${id}">${label}</button>`).join("")}</div><div id="adminView"></div><p class="admin-message" id="adminMessage"></p></div>`;
  ap$$("[data-admin-tab]", workspace).forEach((button) => button.addEventListener("click", () => {
    if (AP.tab === "songs") apCaptureSongDraft();
    AP.tab = button.dataset.adminTab;
    apRenderView();
  }));
  ap$("#adminLogout")?.addEventListener("click", async () => { await AdminPro.auth.signOut(); });
  apRenderView();
}
function apRenderView() {
  const view = ap$("#adminView");
  if (!view) return;
  if (AP.tab === "artists") view.innerHTML = apArtistsHTML();
  if (AP.tab === "categories") view.innerHTML = apCategoriesHTML();
  if (AP.tab === "albums") view.innerHTML = apAlbumsHTML();
  if (AP.tab === "songs") view.innerHTML = apSongsHTML();
  if (AP.tab === "donations") view.innerHTML = apDonationsHTML();
  if (AP.tab === "artists") apBindArtists();
  if (AP.tab === "categories") apBindCategories();
  if (AP.tab === "albums") apBindAlbums();
  if (AP.tab === "songs") apBindSongs();
  if (AP.tab === "donations") apBindDonations();
}
function apSectionHead(kicker, title, count) { return `<div class="admin-section-heading"><div><p class="hero-kicker">${apEsc(kicker)}</p><h2>${apEsc(title)}</h2></div><p class="admin-count">${apEsc(count)}</p></div>`; }
function apShowMore(kind, total, shown) { return total > shown ? `<button class="song-btn secondary" type="button" data-show-more="${kind}">Ver más</button>` : ""; }

function apArtistsHTML() {
  const query = apNorm(AP.filters.artists);
  const rows = AP.artists.filter((row) => !query || apNorm([row.name, row.description, row.artist_type].join(" ")).includes(query));
  const edit = AP.artists.find((row) => apId(row.id) === apId(AP.edits.artist)) || {};
  const shown = rows.slice(0, AP.limits.artists);
  return `<section class="admin-section">${apSectionHead("Artistas", "Artistas y ministerios", `${AP.artists.length} registrados`)}<div class="admin-layout"><div class="admin-card"><div class="admin-editor-head"><h3>${AP.edits.artist ? "Editar artista" : "Agregar artista"}</h3>${AP.edits.artist ? `<button class="song-btn small-btn secondary" data-cancel-artist type="button">Cancelar</button>` : ""}</div><form class="admin-form" id="artistAdminForm"><label>Nombre<input name="name" required value="${apEsc(edit.name || "")}" placeholder="Ejemplo: Athenas"></label><label>Tipo<select name="artist_type"><option value="">Sin tipo</option><option value="catolico" ${apNorm(edit.artist_type) === "catolico" ? "selected" : ""}>Católico</option><option value="cristiano" ${apNorm(edit.artist_type) === "cristiano" ? "selected" : ""}>Cristiano</option><option value="mixto" ${apNorm(edit.artist_type) === "mixto" ? "selected" : ""}>Mixto</option></select></label><label>Descripción<textarea name="description" rows="4" placeholder="Breve descripción">${apEsc(edit.description || "")}</textarea></label><button class="song-btn" type="submit">${AP.edits.artist ? "Guardar cambios" : "Guardar artista"}</button></form></div><div><div class="admin-filter-row"><input class="admin-filter-input" id="artistFilter" type="search" value="${apEsc(AP.filters.artists)}" placeholder="Buscar por nombre, tipo o descripción"></div><div class="admin-list">${shown.length ? shown.map((row) => `<article class="admin-list-item"><h4>${apEsc(row.name || "Sin nombre")}</h4><p>${apEsc(apType(row.artist_type))}${row.description ? ` · ${apEsc(row.description)}` : ""}</p><div class="admin-actions"><button class="song-btn small-btn" type="button" data-edit-artist="${apEsc(row.id)}">Editar</button><button class="song-btn small-btn secondary" type="button" data-delete-artist="${apEsc(row.id)}">Eliminar</button></div></article>`).join("") : apEmpty("No hay artistas que coincidan.")}</div>${apShowMore("artists", rows.length, shown.length)}</div></div></section>`;
}
function apCategoriesHTML() {
  const query = apNorm(AP.filters.categories);
  const rows = apFlatCategories().filter((row) => !query || apNorm([row.name, row.description, row.song_type, apCategoryPath(row)].join(" ")).includes(query));
  const edit = AP.categories.find((row) => apId(row.id) === apId(AP.edits.category)) || {};
  const blocked = AP.edits.category ? apCategoryDescendants(AP.edits.category) : new Set();
  const parents = apFlatCategories().filter((row) => !blocked.has(apId(row.id)));
  const shown = rows.slice(0, AP.limits.categories);
  return `<section class="admin-section">${apSectionHead("Categorías", "Categorías y carpetas", `${AP.categories.length} registradas`)}<div class="admin-layout"><div class="admin-card"><div class="admin-editor-head"><h3>${AP.edits.category ? "Editar categoría" : "Agregar categoría"}</h3>${AP.edits.category ? `<button class="song-btn small-btn secondary" data-cancel-category type="button">Cancelar</button>` : ""}</div><form class="admin-form" id="categoryAdminForm"><label>Nombre<input name="name" required value="${apEsc(edit.name || "")}" placeholder="Ejemplo: Adviento, María, Alabanza"></label><div class="admin-form-grid"><label>Tipo<select name="song_type"><option value="">General</option><option value="catolico" ${apNorm(edit.song_type) === "catolico" ? "selected" : ""}>Católico</option><option value="cristiano" ${apNorm(edit.song_type) === "cristiano" ? "selected" : ""}>Cristiano</option><option value="mixto" ${apNorm(edit.song_type) === "mixto" ? "selected" : ""}>Mixto</option></select></label><label>Dentro de<select name="parent_id"><option value="">Categoría principal</option>${apOptions(parents, "id", (row) => apCategoryPath(row)).replace(`value=\"${apEsc(edit.parent_id || "")}\"`, `value=\"${apEsc(edit.parent_id || "")}\" selected`)}</select></label></div><label>Orden<input name="sort_order" type="number" min="0" value="${apEsc(edit.sort_order ?? 0)}"></label><label>Descripción<textarea name="description" rows="4" placeholder="Breve descripción">${apEsc(edit.description || "")}</textarea></label><button class="song-btn" type="submit">${AP.edits.category ? "Guardar cambios" : "Guardar categoría"}</button></form></div><div><div class="admin-filter-row"><input class="admin-filter-input" id="categoryFilter" type="search" value="${apEsc(AP.filters.categories)}" placeholder="Buscar categoría o carpeta"></div><div class="admin-list">${shown.length ? shown.map((row) => `<article class="admin-list-item"><h4>📁 ${apEsc(row.name || "Sin nombre")}</h4><p>${apEsc(apType(row.song_type))} · ${apEsc(apCategoryPath(row))}</p>${row.description ? `<p>${apEsc(row.description)}</p>` : ""}<div class="admin-actions"><button class="song-btn small-btn" type="button" data-edit-category="${apEsc(row.id)}">Editar</button><button class="song-btn small-btn secondary" type="button" data-delete-category="${apEsc(row.id)}">Eliminar</button></div></article>`).join("") : apEmpty("No hay categorías que coincidan.")}</div>${apShowMore("categories", rows.length, shown.length)}</div></div></section>`;
}
function apAlbumsHTML() {
  const query = apNorm(AP.filters.albums), artistId = apId(AP.filters.albumArtist);
  const rows = AP.albums.filter((row) => (!query || apNorm([row.title, row.description, AP.artists.find((person) => apId(person.id) === apId(row.artist_id))?.name].join(" ")).includes(query)) && (!artistId || apId(row.artist_id) === artistId));
  const edit = AP.albums.find((row) => apId(row.id) === apId(AP.edits.album)) || {};
  const shown = rows.slice(0, AP.limits.albums);
  return `<section class="admin-section">${apSectionHead("Álbumes / carpetas", "Álbumes por artista", `${AP.albums.length} registrados`)}<div class="admin-layout"><div class="admin-card"><div class="admin-editor-head"><h3>${AP.edits.album ? "Editar álbum" : "Agregar álbum"}</h3>${AP.edits.album ? `<button class="song-btn small-btn secondary" data-cancel-album type="button">Cancelar</button>` : ""}</div><form class="admin-form" id="albumAdminForm"><label>Artista<select name="artist_id" required><option value="">Selecciona artista</option>${apOptions(AP.artists, "id", (row) => row.name).replace(`value=\"${apEsc(edit.artist_id || "")}\"`, `value=\"${apEsc(edit.artist_id || "")}\" selected`)}</select></label><label>Nombre del álbum / carpeta<input name="title" required value="${apEsc(edit.title || "")}" placeholder="Ejemplo: Alabanzas"></label><label>Orden<input name="sort_order" type="number" min="0" value="${apEsc(edit.sort_order ?? 0)}"></label><label>Descripción<textarea name="description" rows="4" placeholder="Breve descripción">${apEsc(edit.description || "")}</textarea></label><button class="song-btn" type="submit">${AP.edits.album ? "Guardar cambios" : "Guardar álbum"}</button></form></div><div><div class="admin-filter-row"><input class="admin-filter-input" id="albumFilter" type="search" value="${apEsc(AP.filters.albums)}" placeholder="Buscar álbum"><select id="albumArtistFilter"><option value="">Todos los artistas</option>${apOptions(AP.artists, "id", (row) => row.name).replace(`value=\"${apEsc(AP.filters.albumArtist || "")}\"`, `value=\"${apEsc(AP.filters.albumArtist || "")}\" selected`)}</select></div><div class="admin-list">${shown.length ? shown.map((row) => { const person = AP.artists.find((item) => apId(item.id) === apId(row.artist_id)); return `<article class="admin-list-item"><h4>📁 ${apEsc(row.title || "Sin título")}</h4><p>${apEsc(person?.name || "Sin artista")}</p>${row.description ? `<p>${apEsc(row.description)}</p>` : ""}<div class="admin-actions"><button class="song-btn small-btn" type="button" data-edit-album="${apEsc(row.id)}">Editar</button><button class="song-btn small-btn secondary" type="button" data-delete-album="${apEsc(row.id)}">Eliminar</button></div></article>`; }).join("") : apEmpty("No hay álbumes que coincidan.")}</div>${apShowMore("albums", rows.length, shown.length)}</div></div></section>`;
}
function apSongLinksDraft() { return AP.links.length ? AP.links.map((link, index) => `<div class="admin-mini-item"><div><strong>${apEsc(link.title || "Enlace")}</strong><br><small>${apEsc([link.platform, link.link_type].filter(Boolean).join(" · "))}</small></div><button class="song-btn small-btn secondary" type="button" data-remove-link="${index}">Quitar</button></div>`).join("") : `<p class="admin-note">Aún no hay enlaces en esta canción.</p>`; }
function apCaposDraft() { return AP.capos.length ? AP.capos.map((item, index) => `<div class="admin-mini-item"><div><strong>${apEsc(item.label || `Capo ${item.capo_position}`)}</strong><br><small>Capo ${apEsc(item.capo_position)}${item.capo_key ? ` · Figuras en ${apEsc(item.capo_key)}` : ""}</small></div><button class="song-btn small-btn secondary" type="button" data-remove-capo="${index}">Quitar</button></div>`).join("") : `<p class="admin-note">Aún no hay versiones alternativas.</p>`; }
function apSongPreview() {
  const draft = AP.draft || {};
  return `<article class="admin-preview-card"><h3>Vista previa</h3><p class="hero-kicker">${apEsc(apType(draft.song_type))}</p><h2>${apEsc(draft.title || "Título del canto")}</h2><div class="admin-preview-meta"><span>${apEsc(draft.tone || "Tono")}</span>${draft.capo_position && Number(draft.capo_position) > 0 ? `<span>Capo ${apEsc(draft.capo_position)}${draft.capo_key ? ` · ${apEsc(draft.capo_key)}` : ""}</span>` : ""}${draft.difficulty ? `<span>${apEsc(draft.difficulty)}</span>` : ""}</div><pre class="admin-preview-lyrics">${apEsc(draft.lyrics || "Aquí se verá la letra con los acordes entre paréntesis, por ejemplo: (C) Señor, aquí estoy.")}</pre></article>`;
}
function apSongsHTML() {
  if (!AP.draft) apResetDraft();
  const draft = AP.draft;
  const query = apNorm(AP.filters.songs), artistId = apId(AP.filters.songArtist), categoryId = apId(AP.filters.songCategory), albumId = apId(AP.filters.songAlbum);
  const rows = AP.songs.filter((song) => {
    const text = apNorm([song.title, song.tone, song.song_type, song.difficulty, apSongArtists(song), apSongCategories(song), apSongAlbums(song)].join(" "));
    return (!query || text.includes(query)) && (!artistId || song._artists.some((artist) => apId(artist.id) === artistId)) && (!categoryId || song._categories.some((category) => apId(category.id) === categoryId)) && (!albumId || song._albums.some((album) => apId(album.id) === albumId));
  });
  const shown = rows.slice(0, AP.limits.songs);
  const collaborators = new Set(draft.collaborators || []);
  const filteredArtists = AP.artists.filter((row) => !apNorm(draft.collaborator_query).trim() || apNorm([row.name, row.artist_type].join(" ")).includes(apNorm(draft.collaborator_query)));
  const albumOptions = AP.albums.filter((row) => !draft.main_artist_id || apId(row.artist_id) === apId(draft.main_artist_id));
  return `<section class="admin-section">${apSectionHead("Cancionero", "Canciones", `${AP.songs.length} registradas`)}<div class="admin-filter-row"><input class="admin-filter-input" id="songFilter" type="search" value="${apEsc(AP.filters.songs)}" placeholder="Buscar título, tono, artista, categoría o álbum"><select id="songArtistFilter"><option value="">Todos los artistas</option>${apOptions(AP.artists, "id", (row) => row.name).replace(`value=\"${apEsc(AP.filters.songArtist || "")}\"`, `value=\"${apEsc(AP.filters.songArtist || "")}\" selected`)}</select><select id="songCategoryFilter"><option value="">Todas las categorías</option>${apOptions(apFlatCategories(), "id", (row) => apCategoryPath(row)).replace(`value=\"${apEsc(AP.filters.songCategory || "")}\"`, `value=\"${apEsc(AP.filters.songCategory || "")}\" selected`)}</select><select id="songAlbumFilter"><option value="">Todos los álbumes</option>${apOptions(AP.albums, "id", (row) => row.title).replace(`value=\"${apEsc(AP.filters.songAlbum || "")}\"`, `value=\"${apEsc(AP.filters.songAlbum || "")}\" selected`)}</select></div><div class="admin-layout"><div class="admin-card"><div class="admin-editor-head"><h3>${AP.edits.song ? "Editar canción" : "Agregar canción"}</h3>${AP.edits.song ? `<button class="song-btn small-btn secondary" data-cancel-song type="button">Cancelar</button>` : ""}</div><form class="admin-form" id="songAdminForm"><label>Título<input name="title" required value="${apEsc(draft.title)}" placeholder="Ejemplo: Caminar contigo María"></label><div class="admin-form-grid"><label>Tipo<select name="song_type"><option value="catolico" ${apNorm(draft.song_type) === "catolico" ? "selected" : ""}>Católico</option><option value="cristiano" ${apNorm(draft.song_type) === "cristiano" ? "selected" : ""}>Cristiano</option><option value="mixto" ${apNorm(draft.song_type) === "mixto" ? "selected" : ""}>Mixto</option></select></label><label>Artista principal<select name="main_artist_id" id="songMainArtist"><option value="">Selecciona artista</option>${apOptions(AP.artists, "id", (row) => row.name).replace(`value=\"${apEsc(draft.main_artist_id || "")}\"`, `value=\"${apEsc(draft.main_artist_id || "")}\" selected`)}</select></label></div><label>Buscar colaboradores<input name="collaborator_query" id="collaboratorSearch" value="${apEsc(draft.collaborator_query)}" placeholder="Buscar por nombre"></label><div class="admin-check-list" id="collaboratorList">${filteredArtists.map((artist) => `<label class="admin-check-item"><input type="checkbox" name="collaborator" value="${apEsc(artist.id)}" ${collaborators.has(apId(artist.id)) ? "checked" : ""} ${apId(artist.id) === apId(draft.main_artist_id) ? "disabled" : ""}><span>${apEsc(artist.name)} <small>${apEsc(apType(artist.artist_type))}</small></span></label>`).join("") || "<p class='admin-note'>No se encontraron artistas.</p>"}</div><div class="admin-form-grid"><label>Categoría<select name="category_id"><option value="">Sin categoría</option>${apOptions(apFlatCategories(), "id", (row) => apCategoryPath(row)).replace(`value=\"${apEsc(draft.category_id || "")}\"`, `value=\"${apEsc(draft.category_id || "")}\" selected`)}</select></label><label>Álbum / carpeta<select name="album_id"><option value="">Sin álbum</option>${apOptions(albumOptions, "id", (row) => row.title).replace(`value=\"${apEsc(draft.album_id || "")}\"`, `value=\"${apEsc(draft.album_id || "")}\" selected`)}</select></label></div><div class="admin-form-grid three"><label>Tono original<input name="tone" value="${apEsc(draft.tone)}" placeholder="Ejemplo: C"></label><label>Dificultad<select name="difficulty"><option value="">Sin dificultad</option><option value="Fácil" ${draft.difficulty === "Fácil" ? "selected" : ""}>Fácil</option><option value="Intermedio" ${draft.difficulty === "Intermedio" ? "selected" : ""}>Intermedio</option><option value="Avanzado" ${draft.difficulty === "Avanzado" ? "selected" : ""}>Avanzado</option></select></label><label>Capo principal<select name="capo_position"><option value="0" ${String(draft.capo_position) === "0" ? "selected" : ""}>Sin capo</option>${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${String(draft.capo_position) === String(i + 1) ? "selected" : ""}>Capo ${i + 1}</option>`).join("")}</select></label></div><label>Figuras con capo<input name="capo_key" value="${apEsc(draft.capo_key)}" placeholder="Ejemplo: G"></label><div class="admin-resource-grid"><div class="admin-resource-draft"><h4>Versiones con capo</h4><div class="admin-form-grid"><input name="new_capo_label" value="${apEsc(draft.new_capo_label)}" placeholder="Ejemplo: Capo 2 · E"><select name="new_capo_position"><option value="0">Capo</option>${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${String(draft.new_capo_position) === String(i + 1) ? "selected" : ""}>Capo ${i + 1}</option>`).join("")}</select></div><input name="new_capo_key" value="${apEsc(draft.new_capo_key)}" placeholder="Figuras"><button class="song-btn small-btn" type="button" id="addCapoDraft">Agregar versión</button><div class="admin-mini-list">${apCaposDraft()}</div></div><div class="admin-resource-draft"><h4>Tutoriales y enlaces</h4><input name="new_link_title" value="${apEsc(draft.new_link_title)}" placeholder="Título"><div class="admin-form-grid"><select name="new_link_type"><option value="Tutorial">Tutorial</option><option value="Video">Video</option><option value="Canal">Canal</option><option value="Cover">Cover</option><option value="Acordes">Acordes</option></select><select name="new_link_platform"><option value="YouTube">YouTube</option><option value="TikTok">TikTok</option><option value="Instagram">Instagram</option><option value="Facebook">Facebook</option><option value="Spotify">Spotify</option><option value="Sitio web">Sitio web</option></select></div><input name="new_link_url" type="url" value="${apEsc(draft.new_link_url)}" placeholder="https://..."><button class="song-btn small-btn" type="button" id="addLinkDraft">Agregar enlace</button><div class="admin-mini-list">${apSongLinksDraft()}</div></div></div><label>Letra con acordes</label><div class="admin-section-buttons"><button class="song-btn small-btn" type="button" data-add-section="Intro">Intro</button><button class="song-btn small-btn" type="button" data-add-section="Verso 1">Verso 1</button><button class="song-btn small-btn" type="button" data-add-section="Coro">Coro</button><button class="song-btn small-btn" type="button" data-add-section="Puente">Puente</button><button class="song-btn small-btn" type="button" data-add-section="Final">Final</button></div><textarea name="lyrics" id="songLyricsField" rows="16" placeholder="[Intro]\n(C)Aquí empieza la letra">${apEsc(draft.lyrics)}</textarea><div class="admin-actions"><button class="song-btn" type="submit">${AP.edits.song ? "Guardar cambios" : "Guardar canción"}</button><button class="song-btn secondary" type="button" id="newSongDraft">Nueva canción</button></div></form></div>${apSongPreview()}</div><div class="admin-list" style="margin-top:18px">${shown.length ? shown.map((song) => `<article class="admin-list-item"><h4>${apEsc(song.title || "Sin título")}</h4><p>${apEsc(apSongArtists(song))}</p><p>${apEsc(apType(song.song_type))}${song.tone ? ` · Tono ${apEsc(song.tone)}` : ""}${apSongCategories(song) ? ` · ${apEsc(apSongCategories(song))}` : ""}${apSongAlbums(song) ? ` · ${apEsc(apSongAlbums(song))}` : ""}</p><div class="admin-actions"><button class="song-btn small-btn" type="button" data-edit-song="${apEsc(song.id)}">Editar</button><button class="song-btn small-btn secondary" type="button" data-delete-song="${apEsc(song.id)}">Eliminar</button></div></article>`).join("") : apEmpty("No hay canciones que coincidan.")}</div>${apShowMore("songs", rows.length, shown.length)}</section>`;
}
function apDonationsHTML() {
  const data = AP.donation || {};
  return `<section class="admin-section">${apSectionHead("Apoyo", "Datos de donaciones", data.id ? "Configuración activa" : "Sin configurar")}<div class="admin-layout"><div class="admin-card"><h3>Información visible en Donaciones</h3><form class="admin-form" id="donationAdminForm"><label>Banco<input name="bank_name" value="${apEsc(data.bank_name || "")}" placeholder="Nombre del banco"></label><label>Titular<input name="account_holder" value="${apEsc(data.account_holder || "")}" placeholder="Nombre del titular"></label><div class="admin-form-grid"><label>Cuenta<input name="account_number" value="${apEsc(data.account_number || "")}" placeholder="Número de cuenta"></label><label>Tipo de cuenta<input name="account_type" value="${apEsc(data.account_type || "")}" placeholder="Ejemplo: Débito"></label></div><label>Nota<textarea name="note" rows="5" placeholder="Mensaje para las personas que apoyan">${apEsc(data.note || "")}</textarea></label><button class="song-btn" type="submit">Guardar datos</button></form></div><div class="admin-preview-card"><h3>Vista previa</h3><div class="admin-preview-meta">${data.bank_name ? `<span>${apEsc(data.bank_name)}</span>` : ""}${data.account_type ? `<span>${apEsc(data.account_type)}</span>` : ""}</div><p><strong>Titular:</strong> ${apEsc(data.account_holder || "Sin información")}</p><p><strong>Cuenta:</strong> ${apEsc(data.account_number || "Sin información")}</p><p class="admin-note">${apEsc(data.note || "Aquí aparecerá la nota de apoyo.")}</p></div></div></section>`;
}

function apBindShowMore() { ap$$("[data-show-more]").forEach((button) => button.addEventListener("click", () => { AP.limits[button.dataset.showMore] += 8; apRenderView(); })); }
function apBindArtists() {
  ap$("#artistAdminForm")?.addEventListener("submit", apSaveArtist);
  ap$("#artistFilter")?.addEventListener("input", (event) => { AP.filters.artists = event.target.value; AP.limits.artists = 8; apRenderView(); });
  ap$("[data-cancel-artist]")?.addEventListener("click", () => { AP.edits.artist = null; apRenderView(); });
  ap$$("[data-edit-artist]").forEach((button) => button.addEventListener("click", () => { AP.edits.artist = button.dataset.editArtist; apRenderView(); }));
  ap$$("[data-delete-artist]").forEach((button) => button.addEventListener("click", () => apDeleteArtist(button.dataset.deleteArtist)));
  apBindShowMore();
}
function apBindCategories() {
  ap$("#categoryAdminForm")?.addEventListener("submit", apSaveCategory);
  ap$("#categoryFilter")?.addEventListener("input", (event) => { AP.filters.categories = event.target.value; AP.limits.categories = 8; apRenderView(); });
  ap$("[data-cancel-category]")?.addEventListener("click", () => { AP.edits.category = null; apRenderView(); });
  ap$$("[data-edit-category]").forEach((button) => button.addEventListener("click", () => { AP.edits.category = button.dataset.editCategory; apRenderView(); }));
  ap$$("[data-delete-category]").forEach((button) => button.addEventListener("click", () => apDeleteCategory(button.dataset.deleteCategory)));
  apBindShowMore();
}
function apBindAlbums() {
  ap$("#albumAdminForm")?.addEventListener("submit", apSaveAlbum);
  ap$("#albumFilter")?.addEventListener("input", (event) => { AP.filters.albums = event.target.value; AP.limits.albums = 8; apRenderView(); });
  ap$("#albumArtistFilter")?.addEventListener("change", (event) => { AP.filters.albumArtist = event.target.value; AP.limits.albums = 8; apRenderView(); });
  ap$("[data-cancel-album]")?.addEventListener("click", () => { AP.edits.album = null; apRenderView(); });
  ap$$("[data-edit-album]").forEach((button) => button.addEventListener("click", () => { AP.edits.album = button.dataset.editAlbum; apRenderView(); }));
  ap$$("[data-delete-album]").forEach((button) => button.addEventListener("click", () => apDeleteAlbum(button.dataset.deleteAlbum)));
  apBindShowMore();
}
function apBindSongs() {
  const form = ap$("#songAdminForm");
  form?.addEventListener("submit", apSaveSong);
  form?.addEventListener("input", (event) => { if (event.target.name !== "collaborator_query") apCaptureSongDraft(); if (event.target.id === "songLyricsField") apUpdatePreview(); });
  ap$("#songMainArtist")?.addEventListener("change", () => { apCaptureSongDraft(); AP.draft.collaborators = (AP.draft.collaborators || []).filter((id) => apId(id) !== apId(AP.draft.main_artist_id)); AP.draft.album_id = ""; apRenderView(); });
  ap$("#collaboratorSearch")?.addEventListener("input", () => { apCaptureSongDraft(); apRenderView(); });
  ap$("#addLinkDraft")?.addEventListener("click", apAddLinkDraft);
  ap$("#addCapoDraft")?.addEventListener("click", apAddCapoDraft);
  ap$$("[data-remove-link]").forEach((button) => button.addEventListener("click", () => { apCaptureSongDraft(); AP.links.splice(Number(button.dataset.removeLink), 1); apRenderView(); }));
  ap$$("[data-remove-capo]").forEach((button) => button.addEventListener("click", () => { apCaptureSongDraft(); AP.capos.splice(Number(button.dataset.removeCapo), 1); apRenderView(); }));
  ap$$("[data-add-section]").forEach((button) => button.addEventListener("click", () => apInsertSection(button.dataset.addSection)));
  ap$("#newSongDraft")?.addEventListener("click", () => { apResetDraft(); apRenderView(); });
  ap$("[data-cancel-song]")?.addEventListener("click", () => { apResetDraft(); apRenderView(); });
  ap$("#songFilter")?.addEventListener("input", (event) => { AP.filters.songs = event.target.value; AP.limits.songs = 8; apRenderView(); });
  ap$("#songArtistFilter")?.addEventListener("change", (event) => { AP.filters.songArtist = event.target.value; AP.limits.songs = 8; apRenderView(); });
  ap$("#songCategoryFilter")?.addEventListener("change", (event) => { AP.filters.songCategory = event.target.value; AP.limits.songs = 8; apRenderView(); });
  ap$("#songAlbumFilter")?.addEventListener("change", (event) => { AP.filters.songAlbum = event.target.value; AP.limits.songs = 8; apRenderView(); });
  ap$$("[data-edit-song]").forEach((button) => button.addEventListener("click", () => { const song = AP.songs.find((row) => apId(row.id) === apId(button.dataset.editSong)); apResetDraft(song); apRenderView(); window.scrollTo({ top: 0, behavior: "smooth" }); }));
  ap$$("[data-delete-song]").forEach((button) => button.addEventListener("click", () => apDeleteSong(button.dataset.deleteSong)));
  apBindShowMore();
}
function apBindDonations() { ap$("#donationAdminForm")?.addEventListener("submit", apSaveDonation); }
function apUpdatePreview() { apCaptureSongDraft(); const preview = ap$(".admin-preview-card"); if (!preview) return; const replacement = document.createElement("div"); replacement.innerHTML = apSongPreview(); preview.replaceWith(replacement.firstElementChild); }
function apInsertSection(name) { const textarea = ap$("#songLyricsField"); if (!textarea) return; const start = textarea.selectionStart ?? textarea.value.length; const end = textarea.selectionEnd ?? start; const text = `\n[${name}]\n`; textarea.value = textarea.value.slice(0, start) + text + textarea.value.slice(end); textarea.focus(); textarea.setSelectionRange(start + text.length, start + text.length); apCaptureSongDraft(); apUpdatePreview(); }
function apAddLinkDraft() { apCaptureSongDraft(); const draft = AP.draft; if (!draft.new_link_title || !draft.new_link_url) { apNote("Escribe título y URL para el enlace.", true); return; } AP.links.push({ title: draft.new_link_title, link_type: draft.new_link_type || "Tutorial", platform: draft.new_link_platform || "", url: draft.new_link_url, sort_order: AP.links.length }); Object.assign(AP.draft, { new_link_title: "", new_link_url: "" }); apRenderView(); }
function apAddCapoDraft() { apCaptureSongDraft(); const draft = AP.draft, position = Number(draft.new_capo_position || 0); if (position < 1 || !draft.new_capo_key) { apNote("Indica una posición válida y las figuras de la versión de capo.", true); return; } AP.capos.push({ label: draft.new_capo_label || `Capo ${position} · ${draft.new_capo_key}`, capo_position: position, capo_key: draft.new_capo_key, sort_order: AP.capos.length }); Object.assign(AP.draft, { new_capo_label: "", new_capo_position: "0", new_capo_key: "" }); apRenderView(); }

async function apSaveArtist(event) { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget).entries()); if (!String(data.name || "").trim()) return; const payload = { name: String(data.name).trim(), slug: apSlug(data.name), artist_type: String(data.artist_type || "").trim() || null, description: String(data.description || "").trim() || null }; const result = AP.edits.artist ? await AdminPro.from("artists").update(payload).eq("id", AP.edits.artist) : await AdminPro.from("artists").insert([payload]); if (result.error) { apNote(`Error: ${result.error.message}`, true); return; } AP.edits.artist = null; await apRefresh("Artista guardado."); }
async function apSaveCategory(event) { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget).entries()); const payload = { name: String(data.name || "").trim(), slug: apSlug(data.name), song_type: String(data.song_type || "").trim() || null, parent_id: String(data.parent_id || "").trim() || null, sort_order: Number(data.sort_order || 0), description: String(data.description || "").trim() || null }; if (!payload.name) return; const result = AP.edits.category ? await AdminPro.from("categories").update(payload).eq("id", AP.edits.category) : await AdminPro.from("categories").insert([payload]); if (result.error) { apNote(`Error: ${result.error.message}`, true); return; } AP.edits.category = null; await apRefresh("Categoría guardada."); }
async function apSaveAlbum(event) { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget).entries()); const payload = { artist_id: data.artist_id, title: String(data.title || "").trim(), slug: apSlug(data.title), sort_order: Number(data.sort_order || 0), description: String(data.description || "").trim() || null }; if (!payload.artist_id || !payload.title) { apNote("Selecciona artista y escribe el nombre del álbum.", true); return; } const result = AP.edits.album ? await AdminPro.from("albums").update(payload).eq("id", AP.edits.album) : await AdminPro.from("albums").insert([payload]); if (result.error) { apNote(`Error: ${result.error.message}`, true); return; } AP.edits.album = null; await apRefresh("Álbum guardado."); }
async function apOptionalSongWrite(payload, id) { const optional = ["difficulty", "capo_position", "capo_key"]; let patch = { ...payload }; for (let attempt = 0; attempt <= optional.length; attempt++) { const query = id ? AdminPro.from("songs").update(patch).eq("id", id).select("id").single() : AdminPro.from("songs").insert([patch]).select("id").single(); const result = await query; if (!result.error) return result; const key = optional.find((field) => String(result.error.message || "").toLowerCase().includes(field.toLowerCase())); if (!key || !(key in patch)) return result; delete patch[key]; } return { error: { message: "No se pudo guardar la canción." } }; }
async function apSaveSong(event) {
  event.preventDefault(); apCaptureSongDraft(); const draft = AP.draft; const main = apId(draft.main_artist_id); const artists = [...new Set([main, ...(draft.collaborators || []).map(apId)].filter(Boolean))];
  if (!String(draft.title || "").trim()) { apNote("Escribe el título de la canción.", true); return; }
  if (!String(draft.tone || "").trim()) { apNote("Escribe el tono original.", true); return; }
  if (!artists.length) { apNote("Selecciona al menos un artista.", true); return; }
  if (Number(draft.capo_position || 0) > 0 && !String(draft.capo_key || "").trim()) { apNote("Si usas capo principal, escribe las figuras.", true); return; }
  const payload = { title: String(draft.title).trim(), slug: apSlug(draft.title), song_type: draft.song_type || "catolico", tone: String(draft.tone).trim(), lyrics: String(draft.lyrics || ""), difficulty: String(draft.difficulty || "").trim() || null, capo_position: Number(draft.capo_position || 0), capo_key: Number(draft.capo_position || 0) > 0 ? String(draft.capo_key || "").trim() : "" };
  const saved = await apOptionalSongWrite(payload, AP.edits.song);
  if (saved.error || !saved.data) { apNote(`Error: ${saved.error?.message || "No se pudo guardar."}`, true); return; }
  const songId = saved.data.id;
  const clearResults = await Promise.all([AdminPro.from("song_artists").delete().eq("song_id", songId), AdminPro.from("song_categories").delete().eq("song_id", songId), AdminPro.from("album_songs").delete().eq("song_id", songId), AdminPro.from("song_links").delete().eq("song_id", songId), AdminPro.from("song_capo_versions").delete().eq("song_id", songId)]);
  const clearError = clearResults.find((row) => row.error)?.error; if (clearError) { apNote(`Error al actualizar relaciones: ${clearError.message}`, true); return; }
  const writes = [];
  writes.push(AdminPro.from("song_artists").insert(artists.map((artistId, index) => ({ song_id: songId, artist_id: artistId, role: index === 0 ? "principal" : "colaborador", sort_order: index }))));
  if (draft.category_id) writes.push(AdminPro.from("song_categories").insert([{ song_id: songId, category_id: draft.category_id }]));
  if (draft.album_id) writes.push(AdminPro.from("album_songs").insert([{ song_id: songId, album_id: draft.album_id, sort_order: 0 }]));
  if (AP.links.length) writes.push(AdminPro.from("song_links").insert(AP.links.map((row, index) => ({ song_id: songId, title: row.title || "Enlace", link_type: row.link_type || "Tutorial", platform: row.platform || "", url: row.url || "", sort_order: index }))));
  if (AP.capos.length) writes.push(AdminPro.from("song_capo_versions").insert(AP.capos.map((row, index) => ({ song_id: songId, label: row.label || "", capo_position: Number(row.capo_position || 0), capo_key: row.capo_key || "", sort_order: index }))));
  const writeResults = await Promise.all(writes); const writeError = writeResults.find((row) => row.error)?.error; if (writeError) { apNote(`La canción se guardó, pero una relación falló: ${writeError.message}`, true); return; }
  apResetDraft(); await apRefresh("Canción guardada.");
}
async function apDeleteArtist(id) { const usedSongs = AP.songs.some((song) => song._artists.some((artist) => apId(artist.id) === apId(id))); const usedAlbums = AP.albums.some((album) => apId(album.artist_id) === apId(id)); if (usedSongs || usedAlbums) { apNote("No se puede eliminar: este artista tiene canciones o álbumes relacionados.", true); return; } if (!confirm("¿Eliminar este artista?")) return; const { error } = await AdminPro.from("artists").delete().eq("id", id); if (error) { apNote(`Error: ${error.message}`, true); return; } await apRefresh("Artista eliminado."); }
async function apDeleteCategory(id) { if (AP.categories.some((row) => apId(row.parent_id) === apId(id))) { apNote("No se puede eliminar una categoría con subcategorías.", true); return; } if (AP.songs.some((song) => song._categories.some((category) => apId(category.id) === apId(id)))) { apNote("No se puede eliminar: hay canciones relacionadas.", true); return; } if (!confirm("¿Eliminar esta categoría?")) return; const { error } = await AdminPro.from("categories").delete().eq("id", id); if (error) { apNote(`Error: ${error.message}`, true); return; } await apRefresh("Categoría eliminada."); }
async function apDeleteAlbum(id) { if (!confirm("¿Eliminar este álbum? Las canciones no se eliminarán.")) return; const removed = await AdminPro.from("album_songs").delete().eq("album_id", id); if (removed.error) { apNote(`Error: ${removed.error.message}`, true); return; } const { error } = await AdminPro.from("albums").delete().eq("id", id); if (error) { apNote(`Error: ${error.message}`, true); return; } await apRefresh("Álbum eliminado."); }
async function apDeleteSong(id) { if (!confirm("¿Eliminar esta canción y sus relaciones?")) return; const results = await Promise.all([AdminPro.from("song_artists").delete().eq("song_id", id), AdminPro.from("song_categories").delete().eq("song_id", id), AdminPro.from("album_songs").delete().eq("song_id", id), AdminPro.from("song_links").delete().eq("song_id", id), AdminPro.from("song_capo_versions").delete().eq("song_id", id)]); const relationError = results.find((row) => row.error)?.error; if (relationError) { apNote(`Error: ${relationError.message}`, true); return; } const { error } = await AdminPro.from("songs").delete().eq("id", id); if (error) { apNote(`Error: ${error.message}`, true); return; } await apRefresh("Canción eliminada."); }
async function apSaveDonation(event) { event.preventDefault(); const raw = Object.fromEntries(new FormData(event.currentTarget).entries()); const payload = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, String(value || "").trim() || null])); const result = AP.donation?.id ? await AdminPro.from("donation_settings").update(payload).eq("id", AP.donation.id) : await AdminPro.from("donation_settings").insert([payload]); if (result.error) { apNote(`Error: ${result.error.message}`, true); return; } await apRefresh("Datos de donación guardados."); }
async function apRefresh(message) { try { await apLoadData(); apRenderShell(); apNote(message); } catch (error) { apNote(`Error: ${error.message || "No se pudo actualizar."}`, true); } }

async function apSetSession(session) {
  AP.user = session?.user || null;
  ap$("#adminLoginSection")?.classList.toggle("admin-hidden", Boolean(AP.user));
  ap$("#adminWorkspace")?.classList.toggle("admin-hidden", !AP.user);
  if (!AP.user) return;
  try { await apLoadData(); if (!AP.draft) apResetDraft(); apRenderShell(); } catch (error) { apNote(`No se pudo cargar el panel: ${error.message || "Error desconocido"}`, true); }
}
function apBindLogin() {
  ap$("#adminLoginForm")?.addEventListener("submit", async (event) => {
    event.preventDefault(); const email = String(new FormData(event.currentTarget).get("email") || "").trim(); const box = ap$("#adminLoginMessage"); if (!email) return; if (box) box.textContent = "Enviando enlace de acceso..."; const { error } = await AdminPro.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.href } }); if (box) box.textContent = error ? error.message : "Revisa tu correo y abre el enlace para entrar.";
  });
}
async function apStart() {
  apNav(); apBindLogin();
  if (!AdminPro) { const box = ap$("#adminLoginMessage"); if (box) box.textContent = "No se pudo iniciar la conexión con Supabase."; return; }
  const { data } = await AdminPro.auth.getSession(); await apSetSession(data?.session);
  AdminPro.auth.onAuthStateChange((_event, session) => { apSetSession(session); });
}
apStart();
