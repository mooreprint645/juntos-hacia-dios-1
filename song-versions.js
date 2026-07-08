(() => {
  if (window.__jhdSongVersions) return;
  window.__jhdSongVersions = true;

  const db = window.supabaseClient;
  const params = new URLSearchParams(location.search);
  const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const songHref = (song) => song?.slug ? `cancion.html?slug=${encodeURIComponent(song.slug)}` : `cancion.html?id=${encodeURIComponent(song?.id || "")}`;

  async function currentSongId() {
    const id = params.get("id");
    if (id) return id;
    const slug = params.get("slug");
    if (!slug || !db) return "";
    const { data } = await db.from("songs").select("id").eq("slug", slug).maybeSingle();
    return data?.id || "";
  }

  function ensureSection() {
    let section = document.getElementById("songVersionsSection");
    if (section) return section;
    section = document.createElement("section");
    section.className = "section related-songs-section";
    section.id = "songVersionsSection";
    section.hidden = true;
    section.innerHTML = `<div class="section-heading split-heading"><div><p class="hero-kicker">Versiones</p><h2>Otras versiones</h2></div><a class="text-link" href="canciones.html">Ver canciones</a></div><div class="songs-grid" id="songVersionsGrid"></div>`;
    const related = document.getElementById("relatedSongsSection");
    if (related?.parentNode) related.parentNode.insertBefore(section, related);
    else document.querySelector("main")?.append(section);
    return section;
  }

  async function artistText(songIds) {
    if (!songIds.length || !db) return new Map();
    const { data } = await db.from("song_artists").select("song_id,artists(name)").in("song_id", songIds);
    const map = new Map();
    (data || []).forEach((row) => {
      const id = String(row.song_id);
      if (!map.has(id)) map.set(id, []);
      if (row.artists?.name) map.get(id).push(row.artists.name);
    });
    return new Map([...map.entries()].map(([id, names]) => [id, names.join(" · ")]));
  }

  async function loadVersions() {
    if (!db) return;
    const id = await currentSongId();
    if (!id) return;
    const [asParent, asVersion] = await Promise.all([
      db.from("song_versions").select("*").eq("parent_song_id", id).order("sort_order", { ascending: true }),
      db.from("song_versions").select("*").eq("version_song_id", id).order("sort_order", { ascending: true })
    ]);
    if (asParent.error || asVersion.error) return;
    const rows = [...(asParent.data || []), ...(asVersion.data || [])];
    const seen = new Set();
    const targets = rows.map((row) => ({ row, targetId: String(row.parent_song_id) === String(id) ? row.version_song_id : row.parent_song_id })).filter((item) => {
      const key = String(item.targetId || "");
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (!targets.length) return;
    const targetIds = targets.map((item) => item.targetId);
    const songsRes = await db.from("songs").select("id,title,slug,song_type,tone").in("id", targetIds);
    if (songsRes.error || !(songsRes.data || []).length) return;
    const songs = new Map((songsRes.data || []).map((song) => [String(song.id), song]));
    const artists = await artistText(targetIds);
    const cards = targets.map(({ row, targetId }) => {
      const song = songs.get(String(targetId));
      if (!song) return "";
      const label = row.label || "Versión alternativa";
      const meta = [artists.get(String(targetId)), song.tone ? `Tono ${song.tone}` : "", song.song_type].filter(Boolean).join(" · ");
      return `<a class="song-card song-link-card" href="${songHref(song)}"><p class="artists-line">${esc(label)}</p><h3>${esc(song.title || "Canción")}</h3><p>${esc(meta || "Ver versión")}</p>${row.notes ? `<p class="muted-text">${esc(row.notes)}</p>` : ""}</a>`;
    }).filter(Boolean).join("");
    if (!cards) return;
    const section = ensureSection();
    const grid = document.getElementById("songVersionsGrid");
    if (!grid) return;
    grid.innerHTML = cards;
    section.hidden = false;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", loadVersions, { once: true });
  else loadVersions();
})();