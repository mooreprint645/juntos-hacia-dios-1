(() => {
  const esc = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const page = () => (location.pathname.split("/").pop() || "index.html").toLowerCase();
  const loadingText = /cargando|buscando|preparando|un momento/i;
  const stillLoading = (element) => Boolean(
    element && (element.querySelector(".shimmer-card") || loadingText.test(element.textContent || ""))
  );

  const errorCard = (title, message, className = "song-card") =>
    `<article class="${className}"><h3>${esc(title)}</h3><p>${esc(message)}</p></article>`;

  async function waitForClient(timeoutMs = 8000) {
    if (window.supabaseClient) return window.supabaseClient;

    if (window.jhdSupabaseReady) {
      try {
        const client = await Promise.race([
          window.jhdSupabaseReady,
          new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs))
        ]);
        if (client) return client;
      } catch (_) {}
    }

    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (window.supabaseClient) return window.supabaseClient;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return null;
  }

  function songHref(song) {
    const key = song.slug || song.id || "";
    const param = song.slug ? "slug" : "id";
    return `cancion.html?${param}=${encodeURIComponent(key)}`;
  }

  function renderSong(song) {
    const artists = Array.isArray(song.artists)
      ? song.artists.map((item) => item?.name).filter(Boolean).join(" · ")
      : "";
    const categories = Array.isArray(song.categories)
      ? song.categories.map((item) => item?.name).filter(Boolean).join(" · ")
      : "";
    const meta = [artists || "Sin artista", song.song_type || "Canción", categories, song.tone ? `Tono ${song.tone}` : ""]
      .filter(Boolean)
      .join(" · ");
    const href = songHref(song);
    return `<article class="song-card song-preview-card"><a class="song-preview-main" href="${href}"><h3>${esc(song.title || "Canción sin título")}</h3><p>${esc(meta)}</p></a><div class="song-card-actions"><a class="song-btn small-btn" href="${href}">Ver canción</a></div></article>`;
  }

  function renderArtist(artist) {
    const href = `artista.html?${artist.slug ? "slug" : "id"}=${encodeURIComponent(artist.slug || artist.id || "")}`;
    const initials = String(artist.name || "JHD").trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase();
    const count = Number(artist.song_count || 0);
    return `<a class="artist-card" href="${href}"><div class="artist-mini-avatar">${esc(initials)}</div><h3>${esc(artist.name || "Artista")}</h3><p>${esc(artist.description || `${count} ${count === 1 ? "canto" : "cantos"}`)}</p></a>`;
  }

  async function recoverHome(client) {
    const songsBox = document.querySelector("#homeSongsGrid");
    const artistsBox = document.querySelector("#homeArtistsGrid");
    if (!stillLoading(songsBox) && !stillLoading(artistsBox)) return;

    const [songsRes, artistsRes, relationsRes] = await Promise.all([
      client.from("songs").select("id,title,slug,song_type,tone").order("created_at", { ascending: false }).limit(6),
      client.from("artists").select("id,name,slug,description,artist_type").order("created_at", { ascending: false }).limit(6),
      client.from("song_artists").select("song_id,artist_id,artists(name)")
    ]);

    const namesBySong = new Map();
    const countsByArtist = new Map();
    (relationsRes.data || []).forEach((row) => {
      const songId = String(row.song_id || "");
      const artistId = String(row.artist_id || "");
      const relation = Array.isArray(row.artists) ? row.artists[0] : row.artists;
      if (relation?.name) {
        if (!namesBySong.has(songId)) namesBySong.set(songId, []);
        namesBySong.get(songId).push({ name: relation.name });
      }
      if (artistId) countsByArtist.set(artistId, (countsByArtist.get(artistId) || 0) + 1);
    });

    if (stillLoading(songsBox)) {
      if (songsRes.error) songsBox.innerHTML = errorCard("No se pudieron cargar las canciones", songsRes.error.message);
      else {
        const songs = (songsRes.data || []).map((song) => ({ ...song, artists: namesBySong.get(String(song.id)) || [] }));
        songsBox.innerHTML = songs.length ? songs.map(renderSong).join("") : errorCard("Sin canciones", "Aún no hay canciones publicadas.");
      }
    }

    if (stillLoading(artistsBox)) {
      if (artistsRes.error) artistsBox.innerHTML = errorCard("No se pudieron cargar los artistas", artistsRes.error.message, "artist-card");
      else {
        const artists = (artistsRes.data || []).map((artist) => ({ ...artist, song_count: countsByArtist.get(String(artist.id)) || 0 }));
        artistsBox.innerHTML = artists.length ? artists.map(renderArtist).join("") : errorCard("Sin artistas", "Aún no hay artistas publicados.", "artist-card");
      }
    }
  }

  async function recoverSongs(client) {
    const grid = document.querySelector("#songsGrid");
    if (!stillLoading(grid)) return;
    const params = new URLSearchParams(location.search);
    let result = await client.rpc("search_songs_catalog", {
      p_query: params.get("buscar") || null,
      p_song_type: params.get("tipo") || null,
      p_category_id: null,
      p_album_id: null,
      p_limit: 100,
      p_offset: 0
    });
    if (result.error) result = await client.from("songs").select("id,title,slug,song_type,tone").order("title", { ascending: true }).limit(100);
    if (!stillLoading(grid)) return;
    if (result.error) grid.innerHTML = errorCard("No se pudieron cargar las canciones", result.error.message);
    else grid.innerHTML = (result.data || []).length ? (result.data || []).map(renderSong).join("") : errorCard("Sin canciones", "No hay canciones disponibles.");
  }

  async function recoverArtists(client) {
    const grid = document.querySelector("#artistsGrid");
    if (!stillLoading(grid)) return;
    let result = await client.rpc("search_artists_catalog", {
      p_query: null,
      p_artist_type: null,
      p_limit: 100,
      p_offset: 0
    });
    if (result.error) result = await client.from("artists").select("id,name,slug,description,artist_type").order("name", { ascending: true }).limit(100);
    if (!stillLoading(grid)) return;
    if (result.error) grid.innerHTML = errorCard("No se pudieron cargar los artistas", result.error.message, "artist-card");
    else grid.innerHTML = (result.data || []).length ? (result.data || []).map(renderArtist).join("") : errorCard("Sin artistas", "No hay artistas disponibles.", "artist-card");
  }

  async function recoverCategories(client) {
    const grid = document.querySelector("#categoriesGrid");
    if (!stillLoading(grid)) return;
    const [categoriesRes, linksRes] = await Promise.all([
      client.from("categories").select("id,name,slug,parent_id,song_type,sort_order").order("sort_order", { ascending: true }).order("name", { ascending: true }),
      client.from("song_categories").select("song_id,category_id")
    ]);
    if (!stillLoading(grid)) return;
    if (categoriesRes.error) {
      grid.innerHTML = errorCard("No se pudieron cargar las categorías", categoriesRes.error.message, "quick-card");
      return;
    }
    const counts = new Map();
    (linksRes.data || []).forEach((row) => counts.set(String(row.category_id), (counts.get(String(row.category_id)) || 0) + 1));
    const categories = categoriesRes.data || [];
    grid.innerHTML = categories.length ? categories.map((category) => {
      const key = category.slug || category.id;
      const count = counts.get(String(category.id)) || 0;
      return `<a class="quick-card" href="canciones.html?categoria=${encodeURIComponent(key)}"><h3>${esc(category.name || "Categoría")}</h3><p>${count} ${count === 1 ? "canto" : "cantos"}</p></a>`;
    }).join("") : errorCard("Sin categorías", "No hay categorías disponibles.", "quick-card");
  }

  async function recoverAlbums(client) {
    const grid = document.querySelector("#albumsGrid");
    if (!stillLoading(grid)) return;
    const [albumsRes, artistsRes, linksRes] = await Promise.all([
      client.from("albums").select("id,title,slug,description,artist_id").order("title", { ascending: true }).limit(100),
      client.from("artists").select("id,name"),
      client.from("album_songs").select("album_id,song_id")
    ]);
    if (!stillLoading(grid)) return;
    if (albumsRes.error) {
      grid.innerHTML = errorCard("No se pudieron cargar los álbumes", albumsRes.error.message, "artist-card");
      return;
    }
    const artistNames = new Map((artistsRes.data || []).map((artist) => [String(artist.id), artist.name || ""]));
    const counts = new Map();
    (linksRes.data || []).forEach((row) => counts.set(String(row.album_id), (counts.get(String(row.album_id)) || 0) + 1));
    const albums = albumsRes.data || [];
    grid.innerHTML = albums.length ? albums.map((album) => {
      const count = counts.get(String(album.id)) || 0;
      const artist = artistNames.get(String(album.artist_id)) || "Sin artista";
      return `<a class="artist-card" href="canciones.html?album=${encodeURIComponent(album.slug || album.id || "")}"><h3>${esc(album.title || "Álbum")}</h3><p>${esc(artist)} · ${count} ${count === 1 ? "canto" : "cantos"}</p></a>`;
    }).join("") : errorCard("Sin álbumes", "No hay álbumes disponibles.", "artist-card");
  }

  async function recoverDonations(client) {
    const box = document.querySelector("#donationMethods");
    if (!stillLoading(box)) return;
    const { data, error } = await client.from("donation_settings").select("*").eq("is_active", true).order("sort_order", { ascending: true });
    if (!stillLoading(box)) return;
    if (error) box.innerHTML = '<div class="donation-empty">No se pudo cargar la información de apoyo.</div>';
    else if (!(data || []).length) box.innerHTML = '<div class="donation-empty">Todavía no hay datos de donación publicados.</div>';
  }

  async function recover() {
    await new Promise((resolve) => setTimeout(resolve, 1800));
    const client = await waitForClient();
    const current = page();

    if (!client) {
      document.querySelectorAll(".shimmer-card").forEach((card) => {
        card.outerHTML = errorCard("Sin conexión", "No se pudo iniciar la biblioteca. Recarga la página.", card.classList.contains("artist-card") ? "artist-card" : card.classList.contains("quick-card") ? "quick-card" : "song-card");
      });
      const donation = document.querySelector("#donationMethods");
      if (stillLoading(donation)) donation.innerHTML = '<div class="donation-empty">No se pudo iniciar la conexión. Recarga la página.</div>';
      return;
    }

    try {
      if (current === "index.html") await recoverHome(client);
      else if (current === "canciones.html") await recoverSongs(client);
      else if (current === "artistas.html") await recoverArtists(client);
      else if (current === "categorias.html") await recoverCategories(client);
      else if (current === "albumes.html") await recoverAlbums(client);
      else if (current === "donaciones.html") await recoverDonations(client);
    } catch (error) {
      console.error("JHD public recovery failed", error);
      document.querySelectorAll(".shimmer-card").forEach((card) => {
        card.outerHTML = errorCard("No se pudo cargar", error?.message || "Error desconocido", card.classList.contains("artist-card") ? "artist-card" : card.classList.contains("quick-card") ? "quick-card" : "song-card");
      });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", recover, { once: true });
  else recover();
})();
