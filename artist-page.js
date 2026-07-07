(() => {
  const db = window.supabaseClient;
  const $ = (selector) => document.querySelector(selector);
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  const slug = params.get("slug");
  const esc = (value) => String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const norm = (value) => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const type = (value) => ({ catolico: "Católico", cristiano: "Cristiano", mixto: "Mixto" }[norm(value)] || "Artista");
  const initials = (value) => String(value || "JHD").trim().split(/\s+/).slice(0, 2).map((item) => item[0] || "").join("").toUpperCase();
  const legacy = (value) => {
    const raw = String(value || "");
    const match = raw.match(/<!--JHD_ARTIST_META:([\s\S]*?)-->\s*$/);
    let meta = {};
    try { meta = match ? JSON.parse(match[1]) : {}; } catch (_) {}
    return { bio: raw.replace(/<!--JHD_ARTIST_META:[\s\S]*?-->\s*$/, "").trim(), links: meta.links || {}, featured: meta.featuredSongIds || [] };
  };
  const songMeta = (song) => [type(song.song_type), song.tone ? `Tono ${song.tone}` : "", song.difficulty || ""].filter(Boolean).join(" · ") || "Canto disponible";

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

  function songRows(songs, categories, extra) {
    return songs.map((song) => {
      const songCategories = (categories.get(String(song.id)) || []).map((item) => item.name).filter(Boolean);
      const search = norm([song.title, song.tone, song.song_type, song.difficulty, songCategories.join(" "), extra?.(song) || ""].join(" "));
      return `<a class="artist-song-row profile-song" data-search="${esc(search)}" href="cancion.html?id=${encodeURIComponent(song.id)}"><div><h3>${esc(song.title || "Canto sin título")}</h3><p>${esc(extra?.(song) || songMeta(song))}</p></div><span class="artist-row-icon" aria-hidden="true">›</span></a>`;
    }).join("");
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

  function addShareButton(name) {
    const actions = $(".artist-profile-actions");
    if (!actions || actions.querySelector("[data-share-artist-profile]")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "artist-share-profile";
    button.dataset.shareArtistProfile = "true";
    button.textContent = "Compartir perfil";
    button.setAttribute("aria-label", `Compartir perfil de ${name}`);
    button.addEventListener("click", () => shareProfile(button, name));
    actions.append(button);
  }

  async function load() {
    const box = $("#artistProfile");
    if (!box || !db || (!id && !slug)) {
      if (box) box.innerHTML = empty("Artista no encontrado.");
      return;
    }

    let query = db.from("artists").select("*");
    query = id ? query.eq("id", id) : query.eq("slug", slug);
    const { data: artist, error } = await query.maybeSingle();
    if (error || !artist) {
      box.innerHTML = empty("Este artista no existe o fue eliminado.");
      return;
    }

    const old = legacy(artist.description);
    const bio = artist.bio || old.bio;
    const links = {
      youtube: artist.youtube_url || old.links.youtube,
      spotify: artist.spotify_url || old.links.spotify,
      instagram: artist.instagram_url || old.links.instagram,
      facebook: artist.facebook_url || old.links.facebook
    };
    document.title = `${artist.name || "Artista"} | Juntos Hacia Dios`;

    const own = await db.from("song_artists").select("song_id").eq("artist_id", artist.id);
    if (own.error) {
      box.innerHTML = empty("No se pudieron cargar las canciones.");
      return;
    }

    const ids = [...new Set((own.data || []).map((row) => row.song_id).filter(Boolean))];
    const [songsRes, relationsRes, albumsRes, categoriesRes, featuredRes] = await Promise.all([
      ids.length ? db.from("songs").select("*").in("id", ids) : Promise.resolve({ data: [], error: null }),
      ids.length ? db.from("song_artists").select("song_id,artist_id,artists(id,name)").in("song_id", ids) : Promise.resolve({ data: [], error: null }),
      db.from("albums").select("*").eq("artist_id", artist.id).order("title"),
      ids.length ? db.from("song_categories").select("song_id,categories(id,name)").in("song_id", ids) : Promise.resolve({ data: [], error: null }),
      db.from("artist_featured_songs").select("song_id,sort_order").eq("artist_id", artist.id).order("sort_order")
    ]);
    if (songsRes.error || relationsRes.error || albumsRes.error || categoriesRes.error) {
      box.innerHTML = empty("No se pudo completar el perfil.");
      return;
    }

    const songs = (songsRes.data || []).slice().sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), "es"));
    const byId = new Map(songs.map((song) => [String(song.id), song]));
    const featuredIds = !featuredRes.error && (featuredRes.data || []).length ? (featuredRes.data || []).map((row) => String(row.song_id)) : old.featured;
    const featured = featuredIds.map((item) => byId.get(String(item))).filter(Boolean);
    const categories = new Map();
    (categoriesRes.data || []).forEach((row) => {
      if (!categories.has(String(row.song_id))) categories.set(String(row.song_id), []);
      if (row.categories) categories.get(String(row.song_id)).push(row.categories);
    });
    const relations = new Map();
    (relationsRes.data || []).forEach((row) => {
      if (!relations.has(String(row.song_id))) relations.set(String(row.song_id), []);
      if (row.artists) relations.get(String(row.song_id)).push(row.artists);
    });
    const collaborations = songs.filter((song) => (relations.get(String(song.id)) || []).some((person) => String(person.id) !== String(artist.id)));
    const collaborators = (song) => (relations.get(String(song.id)) || []).filter((person) => String(person.id) !== String(artist.id)).map((person) => person.name).filter(Boolean).join(" · ");
    const categoryCount = new Map();
    categories.forEach((list) => list.forEach((category) => categoryCount.set(String(category.id), { name: category.name, count: (categoryCount.get(String(category.id))?.count || 0) + 1 })));
    const social = [
      ["YouTube", "▶", links.youtube],
      ["Spotify", "♫", links.spotify],
      ["Instagram", "◎", links.instagram],
      ["Facebook", "f", links.facebook]
    ].map(([label, icon, url]) => safeSocial(label, icon, url)).join("");

    box.innerHTML = `<section class="artist-hero-card"><div class="artist-avatar-public">${esc(initials(artist.name))}</div><div><p class="hero-kicker">${esc(type(artist.artist_type))}</p><h1>${esc(artist.name || "Sin nombre")}</h1><p>${esc(bio || "Ministerio o artista registrado.")}</p><div class="artist-profile-stats"><span>${songs.length} canto${songs.length === 1 ? "" : "s"}</span><span>${albumsRes.data?.length || 0} álbum${(albumsRes.data?.length || 0) === 1 ? "" : "es"}</span><span>${collaborations.length} colaboración${collaborations.length === 1 ? "" : "es"}</span></div>${social ? `<div class="artist-socials">${social}</div>` : ""}<nav class="artist-profile-actions" aria-label="Secciones del perfil"><a href="#destacadasArtista">Destacadas</a><a href="#cancionesArtista">Canciones</a><a href="#albumesArtista">Álbumes</a><a href="#colaboracionesArtista">Colaboraciones</a><a href="#categoriasArtista">Categorías</a></nav></div></section><section class="artist-profile-section"><label for="artistSearch">Buscar canciones de este artista</label><input class="artist-search" id="artistSearch" type="search" placeholder="Buscar por título, tono o categoría..."></section><section class="artist-profile-section" id="destacadasArtista"><div class="artist-profile-section-header"><div><p class="hero-kicker">Para comenzar</p><h2>Canciones destacadas</h2><p>${featured.length ? "Selección elegida desde el perfil del artista." : "Las más recientes que se han agregado a este perfil."}</p></div></div><div class="artist-song-list">${songRows(featured.length ? featured : songs.slice(0, 3), categories) || empty("Este artista aún no tiene cantos.")}</div></section><section class="artist-profile-section" id="cancionesArtista"><div class="artist-profile-section-header"><div><p class="hero-kicker">Cancionero</p><h2>Cantos de este artista</h2></div><p>${songs.length} en total</p></div><div class="artist-song-list">${songRows(songs, categories) || empty("Este artista aún no tiene cantos.")}</div></section><section class="artist-profile-section" id="albumesArtista"><div class="artist-profile-section-header"><div><p class="hero-kicker">Discografía</p><h2>Álbumes</h2></div></div><div class="artist-song-list">${(albumsRes.data || []).map((album) => `<a class="artist-song-row" href="albumes.html?album=${encodeURIComponent(album.slug || album.title || album.id)}"><div><h3>${esc(album.title || "Álbum")}</h3><p>${esc(album.description || "Álbum registrado")}</p></div><span class="artist-row-icon" aria-hidden="true">♪</span></a>`).join("") || empty("Este artista aún no tiene álbumes.")}</div></section><section class="artist-profile-section" id="colaboracionesArtista"><div class="artist-profile-section-header"><div><p class="hero-kicker">Juntos en canción</p><h2>Colaboraciones</h2></div></div><div class="artist-song-list">${songRows(collaborations, categories, (song) => collaborators(song) ? `Con ${collaborators(song)} · ${songMeta(song)}` : songMeta(song)) || empty("Aún no hay colaboraciones registradas.")}</div></section><section class="artist-profile-section" id="categoriasArtista"><div class="artist-profile-section-header"><div><p class="hero-kicker">Dónde aparece</p><h2>Categorías</h2></div></div><div class="artist-category-grid">${[...categoryCount.values()].sort((a, b) => b.count - a.count).map((category) => `<a class="artist-category-card" href="canciones.html?categoria=${encodeURIComponent(category.name)}"><strong>${esc(category.name)}</strong><small>${category.count} canto${category.count === 1 ? "" : "s"}</small></a>`).join("") || empty("Todavía no hay categorías asignadas.")}</div></section>`;

    addShareButton(artist.name || "este artista");
    $("#artistSearch")?.addEventListener("input", (event) => {
      const queryText = norm(event.target.value);
      document.querySelectorAll(".profile-song").forEach((row) => { row.style.display = !queryText || (row.dataset.search || "").includes(queryText) ? "" : "none"; });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initNavigation();
    load();
    const year = $("#year");
    if (year) year.textContent = new Date().getFullYear();
  });
})();
