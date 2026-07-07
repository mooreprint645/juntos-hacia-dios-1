(() => {
  const db = window.supabaseClient;
  const platforms = [
    ["youtube_url", "YouTube"],
    ["spotify_url", "Spotify"],
    ["instagram_url", "Instagram"],
    ["facebook_url", "Facebook"]
  ];
  const esc = (v) => String(v || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const norm = (v) => String(v || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const slugify = (v) => norm(v).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
  const say = (text, bad = false) => { if (typeof apNote === "function") apNote(text, bad); };
  const url = (v) => { try { const u = new URL(String(v || "").trim()); return /^https?:$/.test(u.protocol) ? u.href : null; } catch (_) { return null; } };
  const state = () => typeof AP === "undefined" ? null : AP;

  function addStyle() {
    if (document.querySelector("#artistProfileStorageStyle")) return;
    const style = document.createElement("style");
    style.id = "artistProfileStorageStyle";
    style.textContent = ".admin-artist-store-note{padding:11px 13px;border:1px solid rgba(246,196,83,.35);border-radius:14px;background:var(--card-soft);color:var(--gold);font-size:.9rem;margin:0 0 14px}.admin-artist-socials,.admin-artist-featured{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:14px;border:1px solid var(--border);border-radius:16px;background:var(--card-soft);margin-top:12px}.admin-artist-socials h4,.admin-artist-featured h4,.admin-artist-socials p,.admin-artist-featured p{grid-column:1/-1;margin:0}.admin-artist-socials p,.admin-artist-featured p{color:var(--muted);font-size:.9rem}.admin-artist-socials label{margin:0}.admin-artist-featured-list{grid-column:1/-1;display:grid;gap:8px;max-height:240px;overflow:auto}.admin-artist-featured-item{display:flex;gap:10px;align-items:center;padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:var(--card)}.admin-artist-featured-item input{width:18px;height:18px;accent-color:var(--gold)}.admin-artist-featured-item small{display:block;color:var(--muted);margin-top:2px}@media(max-width:620px){.admin-artist-socials{grid-template-columns:1fr}}";
    document.head.append(style);
  }

  function currentArtist() {
    const app = state();
    return app?.artists?.find((artist) => String(artist.id) === String(app.edits.artist)) || null;
  }

  function songsFor(artistId) {
    const app = state();
    return (app?.songs || []).filter((song) => (song._artists || []).some((artist) => String(artist.id) === String(artistId))).sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), "es"));
  }

  function featureList(artistId, selected = []) {
    const chosen = new Set(selected.map(String));
    const songs = songsFor(artistId);
    if (!artistId) return '<p>Guarda el artista primero. Después podrás elegir hasta 3 canciones destacadas.</p>';
    if (!songs.length) return '<p>Primero relaciona canciones con este artista.</p>';
    return `<div class="admin-artist-featured-list">${songs.map((song) => {
      const info = [song.song_type === "catolico" ? "Católico" : song.song_type === "cristiano" ? "Cristiano" : "", song.tone ? `Tono ${song.tone}` : ""].filter(Boolean).join(" · ");
      return `<label class="admin-artist-featured-item"><input type="checkbox" name="artist_featured_song" value="${esc(song.id)}" ${chosen.has(String(song.id)) ? "checked" : ""}><span>${esc(song.title || "Canción sin título")}<small>${esc(info)}</small></span></label>`;
    }).join("")}</div>`;
  }

  async function loadFeatured(artistId) {
    if (!artistId) return [];
    const { data, error } = await db.from("artist_featured_songs").select("song_id,sort_order").eq("artist_id", artistId).order("sort_order", { ascending: true });
    return error ? [] : (data || []).map((row) => String(row.song_id));
  }

  function renderFeatureBlock(block, artistId, selected) {
    block.querySelector(".admin-artist-featured-content").innerHTML = featureList(artistId, selected);
    block.querySelectorAll('input[name="artist_featured_song"]').forEach((input) => input.addEventListener("change", () => {
      const checked = [...block.querySelectorAll('input[name="artist_featured_song"]:checked')];
      if (checked.length > 3) { input.checked = false; say("Solo puedes elegir 3 canciones destacadas.", true); }
    }));
  }

  async function save(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    const name = String(data.name || "").trim();
    if (!name) { say("Escribe el nombre del artista.", true); return; }
    const app = state();
    const editId = app?.edits?.artist || "";
    const selected = [...form.querySelectorAll('input[name="artist_featured_song"]:checked')].map((input) => input.value).slice(0, 3);
    const payload = {
      name,
      slug: slugify(name),
      artist_type: String(data.artist_type || "").trim() || null,
      description: null,
      bio: String(data.description || "").trim() || null,
      youtube_url: url(form.querySelector('[name="artist_youtube_url"]')?.value),
      spotify_url: url(form.querySelector('[name="artist_spotify_url"]')?.value),
      instagram_url: url(form.querySelector('[name="artist_instagram_url"]')?.value),
      facebook_url: url(form.querySelector('[name="artist_facebook_url"]')?.value)
    };
    const result = editId ? await db.from("artists").update(payload).eq("id", editId).select("id").single() : await db.from("artists").insert([payload]).select("id").single();
    if (result.error || !result.data) { say(`No se pudo guardar. Ejecuta primero MIGRAR_PERFILES_ARTISTAS.sql. ${result.error?.message || ""}`, true); return; }
    const artistId = result.data.id;
    const removed = await db.from("artist_featured_songs").delete().eq("artist_id", artistId);
    if (removed.error) { say(`El artista se guardó, pero no las destacadas: ${removed.error.message}`, true); return; }
    if (selected.length) {
      const written = await db.from("artist_featured_songs").insert(selected.map((songId, index) => ({ artist_id: artistId, song_id: songId, sort_order: index })));
      if (written.error) { say(`El artista se guardó, pero no las destacadas: ${written.error.message}`, true); return; }
    }
    if (app) app.edits.artist = null;
    if (typeof apRefresh === "function") await apRefresh("Artista guardado."); else location.reload();
  }

  function enhance(form) {
    if (!form || form.dataset.profileStorage === "on") return;
    const bio = form.querySelector('textarea[name="description"]');
    if (!bio) return;
    addStyle();
    const artist = currentArtist();
    const label = bio.closest("label");
    [...(label?.childNodes || [])].forEach((node) => { if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) node.textContent = "Biografía pública"; });
    bio.rows = 7;
    bio.placeholder = "Trayectoria, ministerio, estilo musical y servicio.";
    bio.value = artist?.bio || "";

    const note = document.createElement("p");
    note.className = "admin-artist-store-note";
    note.textContent = "Biografía, enlaces y canciones destacadas se guardan en campos propios del artista.";
    label?.before(note);

    const socials = document.createElement("fieldset");
    socials.className = "admin-artist-socials";
    socials.innerHTML = `<h4>Enlaces oficiales</h4><p>Opcionales.</p>${platforms.map(([key, text]) => `<label>${text}<input type="url" name="artist_${key}" placeholder="https://..." value="${esc(artist?.[key] || "")}"></label>`).join("")}`;
    label?.after(socials);

    const featured = document.createElement("fieldset");
    featured.className = "admin-artist-featured";
    featured.innerHTML = '<h4>Canciones destacadas</h4><p>Elige hasta 3 para mostrar primero en el perfil público.</p><div class="admin-artist-featured-content"><p>Cargando canciones...</p></div>';
    socials.after(featured);
    loadFeatured(artist?.id).then((selected) => renderFeatureBlock(featured, artist?.id, selected));

    form.addEventListener("submit", (event) => { event.preventDefault(); event.stopImmediatePropagation(); save(form); }, true);
    form.dataset.profileStorage = "on";
  }

  function scan() {
    const app = state();
    (app?.artists || []).forEach((artist) => { if (artist.bio) artist.description = artist.bio; });
    enhance(document.querySelector("#artistAdminForm"));
  }

  function boot() {
    scan();
    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
