(() => {
  const db = window.supabaseClient;
  const params = new URLSearchParams(location.search);
  const norm = (v) => String(v || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const slugify = (v) => norm(v).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
  const esc = (v) => String(v || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const clean = (v) => String(v || "").replace(/<!--JHD_ARTIST_META:[\s\S]*?-->\s*$/, "").trim();
  const typeLabel = (v) => ({ catolico: "Católico", cristiano: "Cristiano", mixto: "Mixto" }[norm(v)] || "Artista");
  const initials = (v) => String(v || "JHD").trim().split(/\s+/).slice(0, 2).map((p) => p[0] || "").join("").toUpperCase();

  function style() {
    if (document.getElementById("artistDiscoveryStyle")) return;
    const s = document.createElement("style");
    s.id = "artistDiscoveryStyle";
    s.textContent = ".artist-discovery-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.artist-discovery-section{margin:0}.artist-discovery-list{display:grid;gap:10px}.artist-discovery-card{display:flex;align-items:center;gap:12px;padding:14px;border:1px solid var(--border);border-radius:18px;background:var(--card);color:var(--text);text-decoration:none;transition:transform .2s ease,border-color .2s ease,background .2s ease}.artist-discovery-card:hover{transform:translateY(-2px);border-color:rgba(246,196,83,.55);background:var(--card-soft)}.artist-discovery-avatar{display:grid;place-items:center;flex:0 0 42px;width:42px;height:42px;border-radius:50%;background:rgba(246,196,83,.15);color:var(--gold);font-weight:900}.artist-discovery-copy{display:grid;gap:3px;min-width:0}.artist-discovery-copy strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.artist-discovery-copy small{color:var(--muted);line-height:1.35}.artist-discovery-empty{padding:15px;border:1px dashed var(--border);border-radius:16px;background:var(--card-soft);color:var(--muted);font-size:.92rem}@media(max-width:760px){.artist-discovery-grid{grid-template-columns:1fr}}";
    document.head.append(s);
  }

  function card(artist, note) {
    const href = `artista.html?slug=${encodeURIComponent(artist.slug || slugify(artist.name))}`;
    return `<a class="artist-discovery-card" href="${href}"><span class="artist-discovery-avatar">${esc(initials(artist.name))}</span><span class="artist-discovery-copy"><strong>${esc(artist.name || "Artista")}</strong><small>${esc(note || clean(artist.description) || typeLabel(artist.artist_type))}</small></span></a>`;
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

  async function load() {
    const profile = document.querySelector("#artistProfile");
    const hero = profile?.querySelector(".artist-hero-card:not(.shimmer-card)");
    if (!profile || !hero || document.getElementById("artistDiscovery")) return false;
    if (!db) return true;

    const h1 = hero.querySelector("h1")?.textContent?.trim() || "";
    const anchor = document.querySelector("#categoriasArtista") || profile.lastElementChild;
    const wrap = document.createElement("div");
    wrap.id = "artistDiscovery";
    wrap.className = "artist-discovery-grid";
    wrap.innerHTML = section("colaboradoresFrecuentes", "En comunidad", "Colaboradores frecuentes", "Buscando colaboraciones...") + section("artistasRelacionados", "Descubre más", "Artistas relacionados", "Buscando artistas relacionados...");
    anchor?.insertAdjacentElement("afterend", wrap);
    style();
    addNav();

    try {
      const [artistsRes, relationsRes, categoriesRes] = await Promise.all([
        db.from("artists").select("id,name,slug,artist_type,description").order("name", { ascending: true }),
        db.from("song_artists").select("song_id,artist_id"),
        db.from("song_categories").select("song_id,category_id")
      ]);
      if (artistsRes.error || relationsRes.error || categoriesRes.error) throw new Error();

      const artists = artistsRes.data || [];
      const idParam = params.get("id") || "";
      const slugParam = params.get("slug") || "";
      const current = artists.find((a) => String(a.id) === String(idParam) || norm(a.slug) === norm(slugParam) || slugify(a.name) === norm(slugParam) || norm(a.name) === norm(h1));
      if (!current) throw new Error();

      const byId = new Map(artists.map((a) => [String(a.id), a]));
      const songsByArtist = new Map();
      const artistsBySong = new Map();
      (relationsRes.data || []).forEach((r) => {
        const song = String(r.song_id), artist = String(r.artist_id);
        if (!songsByArtist.has(artist)) songsByArtist.set(artist, new Set());
        songsByArtist.get(artist).add(song);
        if (!artistsBySong.has(song)) artistsBySong.set(song, new Set());
        artistsBySong.get(song).add(artist);
      });
      const categoriesBySong = new Map();
      (categoriesRes.data || []).forEach((r) => {
        const song = String(r.song_id);
        if (!categoriesBySong.has(song)) categoriesBySong.set(song, new Set());
        categoriesBySong.get(song).add(String(r.category_id));
      });

      const ownSongs = songsByArtist.get(String(current.id)) || new Set();
      const ownCats = new Set();
      ownSongs.forEach((song) => (categoriesBySong.get(song) || new Set()).forEach((cat) => ownCats.add(cat)));
      const collaboratorCounts = new Map();
      ownSongs.forEach((song) => (artistsBySong.get(song) || new Set()).forEach((artist) => {
        if (artist !== String(current.id)) collaboratorCounts.set(artist, (collaboratorCounts.get(artist) || 0) + 1);
      }));

      const collaborators = [...collaboratorCounts.entries()].map(([id, count]) => ({ artist: byId.get(id), count })).filter((x) => x.artist).sort((a, b) => b.count - a.count || String(a.artist.name).localeCompare(String(b.artist.name), "es")).slice(0, 5);
      const related = artists.filter((a) => String(a.id) !== String(current.id)).map((a) => {
        const candidateSongs = songsByArtist.get(String(a.id)) || new Set();
        const shared = new Set();
        candidateSongs.forEach((song) => (categoriesBySong.get(song) || new Set()).forEach((cat) => { if (ownCats.has(cat)) shared.add(cat); }));
        const collabs = collaboratorCounts.get(String(a.id)) || 0;
        const sameType = norm(a.artist_type) && norm(a.artist_type) === norm(current.artist_type);
        return { artist: a, collabs, shared: shared.size, sameType, score: collabs * 100 + shared.size * 10 + (sameType ? 1 : 0) };
      }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score || String(a.artist.name).localeCompare(String(b.artist.name), "es")).slice(0, 5);

      const cBox = wrap.querySelector("#colaboradoresFrecuentes .artist-discovery-list");
      const rBox = wrap.querySelector("#artistasRelacionados .artist-discovery-list");
      if (cBox) cBox.innerHTML = collaborators.length ? collaborators.map(({ artist, count }) => card(artist, `${count} canto${count === 1 ? "" : "s"} en colaboración`)).join("") : '<p class="artist-discovery-empty">Todavía no hay canciones compartidas con otros artistas.</p>';
      if (rBox) rBox.innerHTML = related.length ? related.map(({ artist, collabs, shared, sameType }) => {
        const reason = [];
        if (collabs) reason.push(`${collabs} colaboración${collabs === 1 ? "" : "es"}`);
        if (shared) reason.push(`${shared} categoría${shared === 1 ? "" : "s"} en común`);
        if (!reason.length && sameType) reason.push(`También es ${typeLabel(artist.artist_type).toLowerCase()}`);
        return card(artist, reason.join(" · "));
      }).join("") : '<p class="artist-discovery-empty">Aún no hay suficientes coincidencias para sugerir artistas relacionados.</p>';
    } catch (_) {
      const cBox = wrap.querySelector("#colaboradoresFrecuentes .artist-discovery-list");
      const rBox = wrap.querySelector("#artistasRelacionados .artist-discovery-list");
      if (cBox) cBox.innerHTML = '<p class="artist-discovery-empty">No se pudieron cargar las colaboraciones por ahora.</p>';
      if (rBox) rBox.innerHTML = '<p class="artist-discovery-empty">No se pudieron cargar los artistas relacionados por ahora.</p>';
    }
    return true;
  }

  function boot() {
    if (load()) return;
    const observer = new MutationObserver(() => { if (load()) observer.disconnect(); });
    observer.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true }); else boot();
})();
