(() => {
  if (window.__jhdCatalogAudit) return;
  window.__jhdCatalogAudit = true;

  const db = window.supabaseClient;
  let installed = false;

  const esc = (value) => String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const norm = (value) => String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const titleFor = (song) => song?.title || "Canción sin título";
  const sample = (items, format = (item) => item) => {
    const rows = (items || []).slice(0, 12).map((item) => `<li>${esc(format(item))}</li>`).join("");
    const extra = (items || []).length > 12 ? `<li>Y ${(items || []).length - 12} más.</li>` : "";
    return `<ul>${rows}${extra}</ul>`;
  };

  function setTabActive(button) {
    const tabs = button?.closest(".admin-tabs");
    tabs?.querySelectorAll(".admin-tab").forEach((item) => item.classList.toggle("active", item === button));
  }

  function issue(title, details, items, severity = "warning") {
    return { title, details, items: items || [], severity };
  }

  async function runAudit() {
    if (!db) throw new Error("No se pudo iniciar la conexión con el catálogo.");
    const [songsRes, artistsRes, categoriesRes, albumsRes, songArtistsRes, songCategoriesRes, albumSongsRes, linksRes, caposRes] = await Promise.all([
      db.from("songs").select("id,title,lyrics,tone,song_type,slug"),
      db.from("artists").select("id,name"),
      db.from("categories").select("id,name,parent_id"),
      db.from("albums").select("id,title,artist_id"),
      db.from("song_artists").select("song_id,artist_id"),
      db.from("song_categories").select("song_id,category_id"),
      db.from("album_songs").select("song_id,album_id"),
      db.from("song_links").select("song_id,title,url,link_type"),
      db.from("song_capo_versions").select("song_id,label,capo_position,capo_key")
    ]);
    const error = [songsRes, artistsRes, categoriesRes, albumsRes, songArtistsRes, songCategoriesRes, albumSongsRes, linksRes, caposRes].find((result) => result.error)?.error;
    if (error) throw error;

    const songs = songsRes.data || [];
    const artists = artistsRes.data || [];
    const categories = categoriesRes.data || [];
    const albums = albumsRes.data || [];
    const songArtists = songArtistsRes.data || [];
    const songCategories = songCategoriesRes.data || [];
    const albumSongs = albumSongsRes.data || [];
    const links = linksRes.data || [];
    const capos = caposRes.data || [];

    const songById = new Map(songs.map((row) => [String(row.id), row]));
    const artistById = new Map(artists.map((row) => [String(row.id), row]));
    const categoryById = new Map(categories.map((row) => [String(row.id), row]));
    const albumById = new Map(albums.map((row) => [String(row.id), row]));
    const artistLinksBySong = new Map();
    const categoryLinksBySong = new Map();
    const songLinksByArtist = new Map();
    const songLinksByCategory = new Map();
    const songLinksByAlbum = new Map();

    songArtists.forEach((row) => {
      const songId = String(row.song_id || "");
      const artistId = String(row.artist_id || "");
      if (!artistLinksBySong.has(songId)) artistLinksBySong.set(songId, []);
      artistLinksBySong.get(songId).push(artistId);
      if (!songLinksByArtist.has(artistId)) songLinksByArtist.set(artistId, new Set());
      if (songId) songLinksByArtist.get(artistId).add(songId);
    });
    songCategories.forEach((row) => {
      const songId = String(row.song_id || "");
      const categoryId = String(row.category_id || "");
      if (!categoryLinksBySong.has(songId)) categoryLinksBySong.set(songId, []);
      categoryLinksBySong.get(songId).push(categoryId);
      if (!songLinksByCategory.has(categoryId)) songLinksByCategory.set(categoryId, new Set());
      if (songId) songLinksByCategory.get(categoryId).add(songId);
    });
    albumSongs.forEach((row) => {
      const albumId = String(row.album_id || "");
      const songId = String(row.song_id || "");
      if (!songLinksByAlbum.has(albumId)) songLinksByAlbum.set(albumId, new Set());
      if (songId) songLinksByAlbum.get(albumId).add(songId);
    });

    const missingTitle = songs.filter((song) => !String(song.title || "").trim());
    const missingLyrics = songs.filter((song) => !String(song.lyrics || "").trim());
    const missingArtist = songs.filter((song) => !(artistLinksBySong.get(String(song.id)) || []).length);
    const missingCategory = songs.filter((song) => !(categoryLinksBySong.get(String(song.id)) || []).length);
    const missingTone = songs.filter((song) => !String(song.tone || "").trim());

    const duplicateMap = new Map();
    songs.forEach((song) => {
      const key = norm(song.title);
      if (!key) return;
      if (!duplicateMap.has(key)) duplicateMap.set(key, []);
      duplicateMap.get(key).push(song);
    });
    const duplicateTitles = [...duplicateMap.values()].filter((rows) => rows.length > 1).flat();

    const brokenArtistLinks = songArtists.filter((row) => !songById.has(String(row.song_id)) || !artistById.has(String(row.artist_id)));
    const brokenCategoryLinks = songCategories.filter((row) => !songById.has(String(row.song_id)) || !categoryById.has(String(row.category_id)));
    const brokenAlbumLinks = albumSongs.filter((row) => !songById.has(String(row.song_id)) || !albumById.has(String(row.album_id)));
    const brokenLinkRows = links.filter((row) => !songById.has(String(row.song_id)) || !String(row.url || "").trim() || !String(row.title || row.link_type || "").trim());
    const invalidCapos = capos.filter((row) => !songById.has(String(row.song_id)) || Number(row.capo_position) < 0 || Number(row.capo_position) > 12 || Number.isNaN(Number(row.capo_position)));

    const artistsWithoutSongs = artists.filter((artist) => !(songLinksByArtist.get(String(artist.id)) || new Set()).size);
    const categoriesWithoutSongs = categories.filter((category) => !(songLinksByCategory.get(String(category.id)) || new Set()).size);
    const albumsWithoutSongs = albums.filter((album) => !(songLinksByAlbum.get(String(album.id)) || new Set()).size);

    const issues = [
      issue("Canciones sin título", "No se pueden encontrar correctamente en búsquedas ni compartirlas.", missingTitle, "critical"),
      issue("Canciones sin letra", "Conviene completar la letra antes de considerarlas listas.", missingLyrics, "critical"),
      issue("Canciones sin artista", "No tienen un artista o ministerio relacionado.", missingArtist, "warning"),
      issue("Canciones sin categoría", "No aparecerán al explorar por momentos o temas.", missingCategory, "warning"),
      issue("Canciones sin tono", "Revisa si la canción necesita tono para músicos o coro.", missingTone, "info"),
      issue("Títulos posiblemente duplicados", "Se encontraron títulos iguales. Confirma si son versiones distintas o registros repetidos.", duplicateTitles, "warning"),
      issue("Relaciones de artista rotas", "Hay enlaces a artistas o canciones que ya no existen.", brokenArtistLinks, "critical"),
      issue("Relaciones de categoría rotas", "Hay enlaces a categorías o canciones que ya no existen.", brokenCategoryLinks, "critical"),
      issue("Relaciones de álbum rotas", "Hay enlaces a álbumes o canciones que ya no existen.", brokenAlbumLinks, "critical"),
      issue("Enlaces de canción incompletos", "Falta la URL, el título o la canción relacionada ya no existe.", brokenLinkRows, "warning"),
      issue("Versiones de capo inválidas", "La posición de capo debe estar entre 0 y 12 y la canción debe existir.", invalidCapos, "warning"),
      issue("Artistas sin cantos", "Son perfiles registrados sin canciones asociadas.", artistsWithoutSongs, "info"),
      issue("Categorías vacías", "No tienen canciones asociadas todavía.", categoriesWithoutSongs, "info"),
      issue("Álbumes vacíos", "No tienen canciones asociadas todavía.", albumsWithoutSongs, "info")
    ].filter((entry) => entry.items.length);

    return {
      totals: { songs: songs.length, artists: artists.length, categories: categories.length, albums: albums.length },
      attention: issues.filter((entry) => entry.severity === "critical" || entry.severity === "warning").reduce((total, entry) => total + entry.items.length, 0),
      issues
    };
  }

  function formatItem(entry, item) {
    if (entry.title.includes("Canciones") || entry.title.includes("Títulos")) return titleFor(item);
    if (entry.title.includes("Artistas")) return item.name || "Artista sin nombre";
    if (entry.title.includes("Categorías")) return item.name || "Categoría sin nombre";
    if (entry.title.includes("Álbumes")) return item.title || "Álbum sin título";
    if (entry.title.includes("Enlaces")) return `${item.title || item.link_type || "Enlace sin título"} · ${songByMaybe(item.song_id)}`;
    if (entry.title.includes("capo")) return `${item.label || `Capo ${item.capo_position}`} · ${songByMaybe(item.song_id)}`;
    return `Relación: canción ${item.song_id || "sin ID"}`;
  }

  function songByMaybe(id) {
    return id ? `canción ${String(id).slice(0, 8)}` : "sin canción";
  }

  function renderAudit(data) {
    const view = document.getElementById("adminView");
    if (!view) return;
    const issueHtml = data.issues.length
      ? `<div class="jhd-audit-list">${data.issues.map((entry) => `<details class="jhd-audit-issue is-${entry.severity}" ${entry.severity === "critical" ? "open" : ""}><summary><span class="jhd-audit-badge">${entry.items.length}</span><span>${esc(entry.title)}</span></summary><div class="jhd-audit-detail"><p>${esc(entry.details)}</p>${sample(entry.items, (item) => formatItem(entry, item))}</div></details>`).join("")}</div>`
      : '<div class="jhd-audit-good"><strong>Todo se ve bien.</strong><br>No se detectaron registros pendientes en la revisión automática.</div>';

    view.innerHTML = `<section class="admin-section"><div class="admin-section-heading"><div><p class="hero-kicker">Mantenimiento</p><h2>Revisión del catálogo</h2></div><p class="admin-count">${data.attention ? `${data.attention} por revisar` : "Sin alertas"}</p></div><div class="jhd-audit-toolbar"><p>Busca canciones incompletas, relaciones rotas, duplicados y secciones vacías.</p><button class="song-btn small-btn" type="button" id="jhdRunCatalogAudit">Reanalizar</button></div><div class="jhd-audit-grid"><article class="jhd-audit-stat"><strong>${data.totals.songs}</strong><span>Canciones</span></article><article class="jhd-audit-stat"><strong>${data.totals.artists}</strong><span>Artistas</span></article><article class="jhd-audit-stat"><strong>${data.totals.categories}</strong><span>Categorías</span></article><article class="jhd-audit-stat"><strong>${data.totals.albums}</strong><span>Álbumes</span></article></div>${issueHtml}</section>`;
    document.getElementById("jhdRunCatalogAudit")?.addEventListener("click", openAudit);
  }

  async function openAudit(event) {
    const button = event?.currentTarget || document.querySelector("[data-jhd-audit-tab]");
    setTabActive(button);
    const view = document.getElementById("adminView");
    if (!view) return;
    view.innerHTML = '<section class="admin-section"><div class="admin-empty">Revisando el catálogo…</div></section>';
    try {
      renderAudit(await runAudit());
    } catch (error) {
      view.innerHTML = `<section class="admin-section"><div class="admin-empty">No se pudo revisar el catálogo: ${esc(error?.message || "Error desconocido.")}</div></section>`;
    }
  }

  function install() {
    const tabs = document.querySelector("#adminWorkspace .admin-tabs");
    if (!tabs || tabs.querySelector("[data-jhd-audit-tab]")) return false;
    const button = document.createElement("button");
    button.className = "admin-tab";
    button.type = "button";
    button.dataset.jhdAuditTab = "true";
    button.textContent = "Revisión";
    button.addEventListener("click", openAudit);
    tabs.append(button);
    tabs.querySelectorAll(".admin-tab:not([data-jhd-audit-tab])").forEach((tab) => tab.addEventListener("click", () => button.classList.remove("active")));
    installed = true;
    return true;
  }

  const observer = new MutationObserver(() => install());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();