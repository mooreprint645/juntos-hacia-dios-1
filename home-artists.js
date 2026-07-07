(() => {
  if ((location.pathname.split("/").pop() || "index.html").toLowerCase() !== "index.html") return;

  const db = window.supabaseClient;
  const grid = document.getElementById("homeArtistsGrid");
  if (!db || !grid) return;

  let recentArtists = null;
  let loading = null;
  let scheduled = false;

  const esc = (value) => String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const normalize = (value) => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const cleanDescription = (value) => String(value || "").replace(/<!--JHD_ARTIST_META:[\s\S]*?-->\s*$/, "").trim();
  const initials = (name) => String(name || "JHD").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase();
  const typeLabel = (value) => ({ catolico: "Católico", cristiano: "Cristiano", mixto: "Mixto" }[normalize(value)] || "Ministerio");
  const pluralCantos = (count) => `${count} ${count === 1 ? "canto" : "cantos"}`;
  const slugify = (value) => normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");

  async function loadRecentArtists() {
    if (recentArtists) return recentArtists;
    if (loading) return loading;

    loading = (async () => {
      const artistsRes = await db
        .from("artists")
        .select("id,name,slug,description,artist_type,created_at")
        .order("created_at", { ascending: false })
        .limit(6);
      if (artistsRes.error) throw artistsRes.error;

      const artists = artistsRes.data || [];
      const ids = artists.map((artist) => artist.id).filter(Boolean);
      const linksRes = ids.length
        ? await db.from("song_artists").select("artist_id,song_id").in("artist_id", ids)
        : { data: [], error: null };
      if (linksRes.error) throw linksRes.error;

      const songIdsByArtist = new Map();
      (linksRes.data || []).forEach((link) => {
        const artistId = String(link.artist_id || "");
        if (!songIdsByArtist.has(artistId)) songIdsByArtist.set(artistId, new Set());
        if (link.song_id) songIdsByArtist.get(artistId).add(String(link.song_id));
      });

      recentArtists = artists.map((artist) => ({
        ...artist,
        song_count: songIdsByArtist.get(String(artist.id))?.size || 0,
        description: cleanDescription(artist.description)
      }));
      return recentArtists;
    })();

    try {
      return await loading;
    } finally {
      loading = null;
    }
  }

  function card(artist) {
    const name = artist.name || "Artista";
    const href = `artista.html?slug=${encodeURIComponent(artist.slug || slugify(name))}`;
    const description = artist.description || "Explora sus canciones, álbumes y colaboraciones.";
    const count = Number(artist.song_count || 0);

    return `<a class="artist-card home-artist-card" href="${href}" aria-label="Ver perfil de ${esc(name)}"><div class="home-artist-card-top"><div class="home-artist-avatar" aria-hidden="true">${esc(initials(name))}</div><div class="home-artist-heading"><span class="home-artist-type">${esc(typeLabel(artist.artist_type))}</span><h3>${esc(name)}</h3></div><span class="home-artist-arrow" aria-hidden="true">→</span></div><p class="home-artist-description">${esc(description)}</p><div class="home-artist-footer"><span class="home-artist-count"><span aria-hidden="true">♫</span> ${esc(pluralCantos(count))}</span><span class="home-artist-link">Ver perfil <span aria-hidden="true">→</span></span></div></a>`;
  }

  function isEnhanced() {
    return Boolean(grid.querySelector(".home-artist-card"));
  }

  async function enhance() {
    scheduled = false;
    if (isEnhanced()) return;
    try {
      const artists = await loadRecentArtists();
      if (!artists.length) return;
      grid.innerHTML = artists.map(card).join("");
      grid.dataset.homeArtistsEnhanced = "true";
    } catch (_) {
      /* Se conserva la vista básica que ya haya cargado Inicio. */
    }
  }

  function queueEnhance() {
    if (scheduled || isEnhanced()) return;
    scheduled = true;
    queueMicrotask(enhance);
  }

  const observer = new MutationObserver(() => {
    if (!isEnhanced()) queueEnhance();
  });
  observer.observe(grid, { childList: true, subtree: true });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", queueEnhance, { once: true });
  else queueEnhance();
})();