(() => {
  const db = window.supabaseClient;
  const params = new URLSearchParams(location.search);
  const norm = (value) => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const slugify = (value) => norm(value).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
  const esc = (value) => String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const clean = (value) => String(value || "").replace(/<!--JHD_ARTIST_META:[\s\S]*?-->\s*$/, "").trim();
  const typeLabel = (value) => ({ catolico: "Católico", cristiano: "Cristiano", mixto: "Mixto" }[norm(value)] || "Artista");
  const initials = (value) => String(value || "JHD").trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase();
  const chunk = (items, size = 350) => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, index * size + size));

  function style() {
    if (document.getElementById("artistDiscoveryStyle")) return;
    const style = document.createElement("style");
    style.id = "artistDiscoveryStyle";
    style.textContent = ".artist-discovery-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.artist-discovery-section{margin:0}.artist-discovery-list{display:grid;gap:10px}.artist-discovery-card{display:flex;align-items:center;gap:12px;padding:14px;border:1px solid var(--border);border-radius:18px;background:var(--card);color:var(--text);text-decoration:none;transition:transform .2s ease,border-color .2s ease,background .2s ease}.artist-discovery-card:hover{transform:translateY(-2px);border-color:rgba(246,196,83,.55);background:var(--card-soft)}.artist-discovery-avatar{display:grid;place-items:center;flex:0 0 42px;width:42px;height:42px;border-radius:50%;background:rgba(246,196,83,.15);color:var(--gold);font-weight:900}.artist-discovery-copy{display:grid;gap:3px;min-width:0}.artist-discovery-copy strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.artist-discovery-copy small{color:var(--muted);line-height:1.35}.artist-discovery-empty{padding:15px;border:1px dashed var(--border);border-radius:16px;background:var(--card-soft);color:var(--muted);font-size:.92rem}@media(max-width:760px){.artist-discovery-grid{grid-template-columns:1fr}}";
    document.head.append(style);
  }

  function card(artist, note) {
    const href = `artista.html?slug=${encodeURIComponent(artist.slug || slugify(artist.name))}`;
    const description = artist.bio || clean(artist.description);
    return `<a class="artist-discovery-card" href="${href}"><span class="artist-discovery-avatar">${esc(initials(artist.name))}</span><span class="artist-discovery-copy"><strong>${esc(artist.name || "Artista")}</strong><small>${esc(note || description || typeLabel(artist.artist_type))}</small></span></a>`;
  }

  function section(id, kicker, title, text) {
    return `<section class="artist-profile-section artist-discovery-section" id="${id}"><div class="artist-profile-section-header"><div><p class="hero-kicker">${kicker}</p><h2>${title}</h2></div></div><div class="artist-discovery-list"><p class="artist-discovery-empty">${text}</p></div></section>`;
  }

  function addNav() {
    const nav = document.querySelector(".artist-profile-actions");
    if (!nav) return;
    if (!nav.querySelector('[href="#colaboradoresFrecuentes"]')) nav.insertAdjacentHTML("beforeend", '<a href="#colaboradoresFrecuentes">Colaboradores</a>');
    if (!nav.querySelector('[href="#artistasRelacionados"]')) nav.insertAdjacentHTML("beforeend", '<a href="#artistasRelacionados">Relacionados</a>');
  }

  async function rowsByChunks(table, columns, field, values) {
    const ids = [...new Set((values || []).filter(Boolean))];
    if (!ids.length) return [];
    const rows = [];
    for (const part of chunk(ids)) {
      const result = await db.from(table).select(columns).in(field, part);
      if (result.error) throw result.error;
      rows.push(...(result.data || []));
    }
    return rows;
  }

  async function findArtist() {
    const id = params.get("id");
    const slug = params.get("slug");
    if (!id && !slug) return null;
    let query = db.from("artists").select("id,name,slug,artist_type,bio,description");
    query = id ? query.eq("id", id) : query.eq("slug", slug);
    const result = await query.maybeSingle();
    if (result.error) throw result.error;
    return result.data || null;
  }

  function normalizeRpcRow(row) {
    return {
      id: row.artist_id,
      name: row.artist_name,
      slug: row.artist_slug,
      artist_type: row.artist_type,
      bio: row.artist_bio,
      description: row.artist_description,
      sharedSongs: Number(row.shared_songs || 0),
      sharedCategories: Number(row.shared_categories || 0),
      sameType: Boolean(row.same_type)
    };
  }

  async function optimizedDiscovery(artistId) {
    const result = await db.rpc("jhd_artist_discovery", { p_artist_id: artistId, p_limit: 5 });
    if (result.error) throw result.error;
    const rows = result.data || [];
    const collaborators = rows.filter((row) => row.relation_kind === "collaborator").map(normalizeRpcRow);
    const used = new Set(collaborators.map((artist) => String(artist.id)));
    const related = rows.filter((row) => row.relation_kind === "related").map(normalizeRpcRow).filter((artist) => !used.has(String(artist.id)));
    return { collaborators, related };
  }

  async function localFallback(current) {
    const ownSongsResult = await db.from("song_artists").select("song_id").eq("artist_id", current.id);
    if (ownSongsResult.error) throw ownSongsResult.error;
    const ownSongIds = [...new Set((ownSongsResult.data || []).map((row) => row.song_id).filter(Boolean))];
    const [ownCategories, sameTypeResult, ownRelations] = await Promise.all([
      rowsByChunks("song_categories", "song_id,category_id", "song_id", ownSongIds),
      current.artist_type ? db.from("artists").select("id,name,slug,artist_type,bio,description").eq("artist_type", current.artist_type).neq("id", current.id).order("name", { ascending: true }).limit(8) : Promise.resolve({ data: [], error: null }),
      rowsByChunks("song_artists", "song_id,artist_id", "song_id", ownSongIds)
    ]);
    if (sameTypeResult.error) throw sameTypeResult.error;

    const collaboratorCounts = new Map();
    ownRelations.forEach((row) => {
      const artistId = String(row.artist_id);
      if (artistId !== String(current.id)) collaboratorCounts.set(artistId, (collaboratorCounts.get(artistId) || 0) + 1);
    });
    const collaboratorIds = [...collaboratorCounts.keys()];
    const collaboratorArtists = await rowsByChunks("artists", "id,name,slug,artist_type,bio,description", "id", collaboratorIds);
    const collaboratorById = new Map(collaboratorArtists.map((artist) => [String(artist.id), artist]));
    const collaborators = [...collaboratorCounts.entries()]
      .map(([id, sharedSongs]) => ({ ...collaboratorById.get(id), sharedSongs, sharedCategories: 0, sameType: false }))
      .filter((artist) => artist.id)
      .sort((a, b) => b.sharedSongs - a.sharedSongs || String(a.name).localeCompare(String(b.name), "es"))
      .slice(0, 5);

    const ownCategoriesSet = new Set(ownCategories.map((row) => String(row.category_id)));
    const categorySongRows = await rowsByChunks("song_categories", "song_id,category_id", "category_id", [...ownCategoriesSet]);
    const categoryIdsBySong = new Map();
    categorySongRows.forEach((row) => {
      const songId = String(row.song_id);
      if (!categoryIdsBySong.has(songId)) categoryIdsBySong.set(songId, new Set());
      categoryIdsBySong.get(songId).add(String(row.category_id));
    });
    const candidateRelations = await rowsByChunks("song_artists", "song_id,artist_id", "song_id", [...categoryIdsBySong.keys()]);
    const categoryCounts = new Map();
    candidateRelations.forEach((row) => {
      const artistId = String(row.artist_id);
      if (artistId === String(current.id)) return;
      if (!categoryCounts.has(artistId)) categoryCounts.set(artistId, new Set());
      (categoryIdsBySong.get(String(row.song_id)) || new Set()).forEach((categoryId) => {
        if (ownCategoriesSet.has(categoryId)) categoryCounts.get(artistId).add(categoryId);
      });
    });

    const sameTypeArtists = sameTypeResult.data || [];
    const allRelatedIds = [...new Set([...categoryCounts.keys(), ...sameTypeArtists.map((artist) => String(artist.id))])]
      .filter((id) => id !== String(current.id) && !collaboratorCounts.has(id));
    const fetchedRelated = await rowsByChunks("artists", "id,name,slug,artist_type,bio,description", "id", allRelatedIds);
    const relatedById = new Map([...sameTypeArtists, ...fetchedRelated].map((artist) => [String(artist.id), artist]));
    const sameTypeIds = new Set(sameTypeArtists.map((artist) => String(artist.id)));
    const related = allRelatedIds
      .map((id) => {
        const artist = relatedById.get(id);
        const sharedCategories = categoryCounts.get(id)?.size || 0;
        const sameType = sameTypeIds.has(id);
        return artist ? { ...artist, sharedSongs: 0, sharedCategories, sameType, score: sharedCategories * 10 + (sameType ? 1 : 0) } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || String(a.name).localeCompare(String(b.name), "es"))
      .slice(0, 5);
    return { collaborators, related };
  }

  function collaboratorReason(artist) {
    return `${artist.sharedSongs} canto${artist.sharedSongs === 1 ? "" : "s"} en colaboración`;
  }

  function relatedReason(artist) {
    const reason = [];
    if (artist.sharedCategories) reason.push(`${artist.sharedCategories} categoría${artist.sharedCategories === 1 ? "" : "s"} en común`);
    if (artist.sameType) reason.push(`También es ${typeLabel(artist.artist_type).toLowerCase()}`);
    return reason.join(" · ");
  }

  function render(wrap, discovery) {
    const collaboratorsBox = wrap.querySelector("#colaboradoresFrecuentes .artist-discovery-list");
    const relatedBox = wrap.querySelector("#artistasRelacionados .artist-discovery-list");
    if (collaboratorsBox) collaboratorsBox.innerHTML = discovery.collaborators.length
      ? discovery.collaborators.map((artist) => card(artist, collaboratorReason(artist))).join("")
      : '<p class="artist-discovery-empty">Todavía no hay canciones compartidas con otros artistas.</p>';
    if (relatedBox) relatedBox.innerHTML = discovery.related.length
      ? discovery.related.map((artist) => card(artist, relatedReason(artist))).join("")
      : '<p class="artist-discovery-empty">Aún no hay suficientes coincidencias para sugerir artistas relacionados.</p>';
  }

  async function load() {
    const profile = document.querySelector("#artistProfile");
    const hero = profile?.querySelector(".artist-hero-card:not(.shimmer-card)");
    if (!profile || !hero || document.getElementById("artistDiscovery")) return false;
    if (!db) return true;

    const anchor = document.querySelector("#categoriasArtista") || profile.lastElementChild;
    const wrap = document.createElement("div");
    wrap.id = "artistDiscovery";
    wrap.className = "artist-discovery-grid";
    wrap.innerHTML = section("colaboradoresFrecuentes", "En comunidad", "Colaboradores frecuentes", "Buscando colaboraciones...") + section("artistasRelacionados", "Descubre más", "Artistas relacionados", "Buscando artistas relacionados...");
    anchor?.insertAdjacentElement("afterend", wrap);
    style();
    addNav();

    try {
      const current = await findArtist();
      if (!current) throw new Error("Artista no encontrado");
      let discovery;
      try {
        discovery = await optimizedDiscovery(current.id);
      } catch (_) {
        discovery = await localFallback(current);
      }
      render(wrap, discovery);
    } catch (_) {
      const collaboratorsBox = wrap.querySelector("#colaboradoresFrecuentes .artist-discovery-list");
      const relatedBox = wrap.querySelector("#artistasRelacionados .artist-discovery-list");
      if (collaboratorsBox) collaboratorsBox.innerHTML = '<p class="artist-discovery-empty">No se pudieron cargar las colaboraciones por ahora.</p>';
      if (relatedBox) relatedBox.innerHTML = '<p class="artist-discovery-empty">No se pudieron cargar los artistas relacionados por ahora.</p>';
    }
    return true;
  }

  function boot() {
    let observer;
    const attempt = () => {
      load().then((done) => { if (done) observer?.disconnect(); });
    };
    observer = new MutationObserver(attempt);
    observer.observe(document.body, { childList: true, subtree: true });
    attempt();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
