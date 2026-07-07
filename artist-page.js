(() => {
  const db = window.supabaseClient;
  const $ = (selector) => document.querySelector(selector);
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  const slug = params.get("slug");
  const PAGE_SIZE = 24;

  let artist = null;
  let summary = { song_count: 0, album_count: 0, collaboration_count: 0, categories: [] };
  let page = 0;
  let totalSongs = 0;
  let visibleSongs = [];
  let loading = false;
  let requestVersion = 0;
  let searchTimer = 0;

  const esc = (value) => String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const norm = (value) => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const type = (value) => ({ catolico: "Católico", cristiano: "Cristiano", mixto: "Mixto" }[norm(value)] || value || "Artista");
  const initials = (value) => String(value || "JHD").trim().split(/\s+/).slice(0, 2).map((item) => item[0] || "").join("").toUpperCase();
  const songMeta = (song) => [type(song.song_type), song.tone ? `Tono ${song.tone}` : "", song.difficulty || ""].filter(Boolean).join(" · ") || "Canto disponible";

  const jsonList = (value) => {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== "string") return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  };

  const legacy = (value) => {
    const raw = String(value || "");
    const match = raw.match(/<!--JHD_ARTIST_META:([\s\S]*?)-->\s*$/);
    let meta = {};
    try { meta = match ? JSON.parse(match[1]) : {}; } catch (_) {}
    return { bio: raw.replace(/<!--JHD_ARTIST_META:[\s\S]*?-->\s*$/, "").trim(), links: meta.links || {} };
  };

  function initNavigation() {
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

  function empty(message) {
    return `<div class="artist-empty">${esc(message)}</div>`;
  }

  function safeSocial(label, icon, value) {
    try {
      const url = new URL(value || "");
      return /^https?:$/.test(url.protocol) ? `<a class="artist-social-link" href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">${icon} ${label}</a>` : "";
    } catch (_) {
      return "";
    }
  }

  async function shareProfile(button, artistName) {
    const original = button.textContent;
    const url = location.href;
    button.disabled = true;
    try {
      if (navigator.share) {
        try {
          await navigator.share({ title: `${artistName} | Juntos Hacia Dios`, text: `Conoce los cantos de ${artistName} en Juntos Hacia Dios.`, url });
          return;
        } catch (error) {
          if (error?.name === "AbortError") return;
        }
      }
      await navigator.clipboard.writeText(url);
      button.textContent = "Enlace copiado";
      setTimeout(() => { button.textContent = original; }, 1800);
    } catch (_) {
      window.prompt("Copia este enlace:", url);
    } finally {
      button.disabled = false;
    }
  }

  function songRow(song) {
    const categories = (song._categories || []).map((item) => item.name).filter(Boolean).join(" · ");
    const otherArtists = (song._artists || []).filter((item) => String(item.id) !== String(artist?.id)).map((item) => item.name).filter(Boolean).join(" · ");
    const extra = [songMeta(song), categories ? `Categorías: ${categories}` : "", otherArtists ? `Con ${otherArtists}` : ""].filter(Boolean).join(" · ");
    return `<a class="artist-song-row profile-song" href="cancion.html?id=${encodeURIComponent(song.id)}"><div><h3>${esc(song.title || "Canto sin título")}</h3><p>${esc(extra)}</p></div><span class="artist-row-icon" aria-hidden="true">›</span></a>`;
  }

  function renderSongs() {
    const list = $("#artistSongsList");
    const totalLabel = $("#artistSongsTotal");
    const button = $("#artistSongsLoadMore");
    if (totalLabel) totalLabel.textContent = `${totalSongs} en total`;
    if (list) list.innerHTML = visibleSongs.length ? visibleSongs.map(songRow).join("") : empty("Este artista aún no tiene cantos.");
    if (button) {
      const hasMore = visibleSongs.length < totalSongs;
      button.hidden = !hasMore;
      button.disabled = loading;
      button.textContent = loading ? "Cargando…" : "Cargar más canciones";
    }
  }

  function rpcErrorMessage(error) {
    const detail = String(error?.message || "");
    if (error?.code === "PGRST202" || /search_artist_songs_catalog|get_artist_profile_summary/i.test(detail)) {
      return "Falta activar el perfil escalable. Ejecuta supabase-artist-profile-scale.sql en Supabase.";
    }
    return detail || "Revisa la conexión e inténtalo de nuevo.";
  }

  async function fetchSongs(append = false) {
    if (!db || !artist || (append && loading)) return;
    const token = ++requestVersion;
    const currentPage = append ? page + 1 : 0;
    loading = true;
    if (!append) {
      page = 0;
      totalSongs = 0;
      visibleSongs = [];
      const list = $("#artistSongsList");
      if (list) list.innerHTML = '<div class="artist-empty">Buscando canciones…</div>';
    }
    renderSongs();

    try {
      const { data, error } = await db.rpc("search_artist_songs_catalog", {
        p_artist_id: artist.id,
        p_query: String($("#artistSearch")?.value || "").trim() || null,
        p_limit: PAGE_SIZE,
        p_offset: currentPage * PAGE_SIZE
      });
      if (error) throw error;
      if (token !== requestVersion) return;

      const rows = (data || []).map((row) => ({ ...row, _artists: jsonList(row.artists), _categories: jsonList(row.categories), _albums: jsonList(row.albums) }));
      const serverTotal = rows.length ? Number(rows[0].total_count || 0) : 0;
      page = currentPage;
      totalSongs = append ? (rows.length ? serverTotal : visibleSongs.length) : serverTotal;
      visibleSongs = append ? [...visibleSongs, ...rows] : rows;
      loading = false;
      renderSongs();
    } catch (error) {
      if (token !== requestVersion) return;
      loading = false;
      const list = $("#artistSongsList");
      if (list) list.innerHTML = empty(rpcErrorMessage(error));
      const button = $("#artistSongsLoadMore");
      if (button) button.hidden = true;
    } finally {
      if (token === requestVersion && loading) {
        loading = false;
        renderSongs();
      }
    }
  }

  function renderProfile(featuredSongs, albums) {
    const box = $("#artistProfile");
    if (!box || !artist) return;
    const old = legacy(artist.description);
    const bio = artist.bio || old.bio;
    const links = {
      youtube: artist.youtube_url || old.links.youtube,
      spotify: artist.spotify_url || old.links.spotify,
      instagram: artist.instagram_url || old.links.instagram,
      facebook: artist.facebook_url || old.links.facebook
    };
    const socials = [
      ["YouTube", "▶", links.youtube],
      ["Spotify", "♫", links.spotify],
      ["Instagram", "◎", links.instagram],
      ["Facebook", "f", links.facebook]
    ].map(([label, icon, url]) => safeSocial(label, icon, url)).join("");
    const categoryCards = (summary.categories || []).map((category) => `<a class="artist-category-card" href="canciones.html?categoria=${encodeURIComponent(category.slug || category.name || "")}"><strong>${esc(category.name)}</strong><small>${Number(category.song_count || 0)} canto${Number(category.song_count || 0) === 1 ? "" : "s"}</small></a>`).join("");
    const featuredRows = featuredSongs.length ? featuredSongs.map((song) => `<a class="artist-song-row" href="cancion.html?id=${encodeURIComponent(song.id)}"><div><h3>${esc(song.title || "Canto")}</h3><p>${esc(songMeta(song))}</p></div><span class="artist-row-icon" aria-hidden="true">♪</span></a>`).join("") : empty("No hay canciones destacadas todavía.");
    const albumRows = albums.length ? albums.map((album) => `<a class="artist-song-row" href="albumes.html?album=${encodeURIComponent(album.slug || album.id)}"><div><h3>${esc(album.title || "Álbum")}</h3><p>${esc(album.description || album.year || "Colección registrada")}</p></div><span class="artist-row-icon" aria-hidden="true">♪</span></a>`).join("") : empty("Este artista aún no tiene álbumes.");

    box.innerHTML = `<section class="artist-hero-card"><div class="artist-avatar-public">${esc(initials(artist.name))}</div><div><p class="hero-kicker">${esc(type(artist.artist_type))}</p><h1>${esc(artist.name || "Sin nombre")}</h1><p>${esc(bio || "Ministerio o artista registrado.")}</p><div class="artist-profile-stats"><span>${Number(summary.song_count || 0)} canto${Number(summary.song_count || 0) === 1 ? "" : "s"}</span><span>${Number(summary.album_count || 0)} álbum${Number(summary.album_count || 0) === 1 ? "" : "es"}</span><span>${Number(summary.collaboration_count || 0)} colaboración${Number(summary.collaboration_count || 0) === 1 ? "" : "es"}</span></div>${socials ? `<div class="artist-socials">${socials}</div>` : ""}<nav class="artist-profile-actions" aria-label="Secciones del perfil"><a href="#destacadasArtista">Destacadas</a><a href="#cancionesArtista">Canciones</a><a href="#albumesArtista">Álbumes</a><a href="#categoriasArtista">Categorías</a><button class="artist-share-profile" type="button" id="shareArtistProfile">Compartir perfil</button></nav></div></section><section class="artist-profile-section" id="destacadasArtista"><div class="artist-profile-section-header"><div><p class="hero-kicker">Para comenzar</p><h2>Canciones destacadas</h2></div></div><div class="artist-song-list">${featuredRows}</div></section><section class="artist-profile-section" id="cancionesArtista"><div class="artist-profile-section-header"><div><p class="hero-kicker">Cancionero</p><h2>Cantos de este artista</h2></div><p id="artistSongsTotal">${Number(summary.song_count || 0)} en total</p></div><label for="artistSearch">Buscar canciones de este artista</label><input class="artist-search" id="artistSearch" type="search" placeholder="Buscar por título, tono o categoría..."><div class="artist-song-list" id="artistSongsList"><div class="artist-empty">Cargando canciones…</div></div><div class="catalog-load-more"><button class="song-btn secondary" id="artistSongsLoadMore" type="button" hidden>Cargar más canciones</button></div></section><section class="artist-profile-section" id="albumesArtista"><div class="artist-profile-section-header"><div><p class="hero-kicker">Discografía</p><h2>Álbumes</h2></div></div><div class="artist-song-list">${albumRows}</div></section><section class="artist-profile-section" id="categoriasArtista"><div class="artist-profile-section-header"><div><p class="hero-kicker">Dónde aparece</p><h2>Categorías</h2></div></div><div class="artist-category-grid">${categoryCards || empty("Todavía no hay categorías asignadas.")}</div></section>`;

    $("#shareArtistProfile")?.addEventListener("click", (event) => shareProfile(event.currentTarget, artist.name || "este artista"));
    $("#artistSongsLoadMore")?.addEventListener("click", () => fetchSongs(true));
    $("#artistSearch")?.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => fetchSongs(false), 260);
    });
  }

  async function loadFeaturedSongs() {
    const result = await db.from("artist_featured_songs").select("song_id,sort_order").eq("artist_id", artist.id).order("sort_order").limit(6);
    if (result.error || !(result.data || []).length) return [];
    const ids = result.data.map((row) => row.song_id).filter(Boolean);
    const songs = await db.from("songs").select("id,title,tone,song_type,difficulty").in("id", ids);
    if (songs.error) return [];
    const byId = new Map((songs.data || []).map((song) => [String(song.id), song]));
    return ids.map((songId) => byId.get(String(songId))).filter(Boolean);
  }

  async function load() {
    const box = $("#artistProfile");
    if (!box || !db || (!id && !slug)) {
      if (box) box.innerHTML = empty("Artista no encontrado.");
      return;
    }

    let artistQuery = db.from("artists").select("*");
    artistQuery = id ? artistQuery.eq("id", id) : artistQuery.eq("slug", slug);
    const { data, error } = await artistQuery.maybeSingle();
    if (error || !data) {
      box.innerHTML = empty("Este artista no existe o fue eliminado.");
      return;
    }
    artist = data;
    document.title = `${artist.name || "Artista"} | Juntos Hacia Dios`;

    const [summaryRes, featuredSongs, albumsRes] = await Promise.all([
      db.rpc("get_artist_profile_summary", { p_artist_id: artist.id }),
      loadFeaturedSongs(),
      db.rpc("search_albums_catalog", { p_query: null, p_artist_id: artist.id, p_limit: 24, p_offset: 0 })
    ]);
    if (summaryRes.error) {
      box.innerHTML = empty(rpcErrorMessage(summaryRes.error));
      return;
    }
    summary = summaryRes.data?.[0] || summary;
    summary.categories = jsonList(summary.categories);
    renderProfile(featuredSongs, albumsRes.error ? [] : (albumsRes.data || []));
    fetchSongs(false);
  }

  document.addEventListener("DOMContentLoaded", () => {
    initNavigation();
    load();
    const year = $("#year");
    if (year) year.textContent = new Date().getFullYear();
  });
})();
