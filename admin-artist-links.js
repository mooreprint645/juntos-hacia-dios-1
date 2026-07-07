(() => {
  const META_PATTERN = /<!--JHD_ARTIST_META:([\s\S]*?)-->\s*$/;
  const PLATFORMS = [
    ["youtube", "YouTube"],
    ["spotify", "Spotify"],
    ["instagram", "Instagram"],
    ["facebook", "Facebook"]
  ];

  const escapeHTML = (value) => String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const getAP = () => typeof AP === "undefined" ? null : AP;

  const readProfile = (value) => {
    const raw = String(value || "");
    const match = raw.match(META_PATTERN);
    let links = {};
    let featuredSongIds = [];
    if (match) {
      try {
        const meta = JSON.parse(match[1]);
        links = meta && typeof meta.links === "object" && meta.links ? meta.links : {};
        featuredSongIds = Array.isArray(meta?.featuredSongIds) ? meta.featuredSongIds.map(String) : [];
      } catch (_) {}
    }
    return { description: raw.replace(META_PATTERN, "").trim(), links, featuredSongIds };
  };

  const validUrl = (value) => {
    try {
      const url = new URL(String(value || "").trim());
      return /^https?:$/.test(url.protocol) ? url.href : "";
    } catch (_) {
      return "";
    }
  };

  const packProfile = (description, links, featuredSongIds) => {
    const cleanDescription = String(description || "").replace(META_PATTERN, "").trim();
    const cleanLinks = Object.fromEntries(Object.entries(links).filter(([, value]) => Boolean(value)));
    const cleanFeatured = [...new Set((featuredSongIds || []).map(String).filter(Boolean))].slice(0, 3);
    const meta = {};
    if (Object.keys(cleanLinks).length) meta.links = cleanLinks;
    if (cleanFeatured.length) meta.featuredSongIds = cleanFeatured;
    if (!Object.keys(meta).length) return cleanDescription;
    return `${cleanDescription}${cleanDescription ? "\n\n" : ""}<!--JHD_ARTIST_META:${JSON.stringify(meta)}-->`;
  };

  const injectStyle = () => {
    if (document.getElementById("artistProfileAdminStyle")) return;
    const style = document.createElement("style");
    style.id = "artistProfileAdminStyle";
    style.textContent = `.admin-artist-socials,.admin-artist-featured{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:2px;padding:14px;border:1px solid var(--border);border-radius:16px;background:var(--card-soft)}.admin-artist-socials h4,.admin-artist-featured h4{grid-column:1/-1;margin:0;color:var(--gold)}.admin-artist-socials p,.admin-artist-featured p{grid-column:1/-1;margin:-5px 0 0;color:var(--muted);font-size:.9rem}.admin-artist-socials label{margin:0}.admin-artist-featured-list{grid-column:1/-1;display:grid;gap:8px;max-height:240px;overflow:auto;padding-right:2px}.admin-artist-featured-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:var(--card)}.admin-artist-featured-item input{width:18px;height:18px;accent-color:var(--gold)}.admin-artist-featured-item span{min-width:0}.admin-artist-featured-item small{display:block;color:var(--muted);margin-top:2px}.admin-artist-featured-empty{grid-column:1/-1;margin:0;color:var(--muted);font-size:.9rem}@media(max-width:620px){.admin-artist-socials{grid-template-columns:1fr}}`;
    document.head.append(style);
  };

  const cleanRenderedDescriptions = () => {
    document.querySelectorAll("#adminView .admin-list-item p").forEach((line) => {
      const markerAt = line.textContent.indexOf("<!--JHD_ARTIST_META:");
      if (markerAt >= 0) line.textContent = line.textContent.slice(0, markerAt).trim();
    });
  };

  const songsForArtist = (artistId) => {
    const app = getAP();
    if (!app || !artistId) return [];
    return (app.songs || [])
      .filter((song) => (song._artists || []).some((artist) => String(artist.id) === String(artistId)))
      .slice()
      .sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), "es"));
  };

  const setBiographyLabel = (description) => {
    const label = description.closest("label");
    if (!label) return;
    [...label.childNodes].forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) node.textContent = "Biografía pública";
    });
    description.rows = 7;
    description.placeholder = "Escribe una biografía breve: trayectoria, ministerio, estilo musical y servicio.";
  };

  const enhanceArtistForm = (form) => {
    if (!form || form.dataset.artistProfileReady === "true") return;
    const description = form.querySelector('textarea[name="description"]');
    if (!description) return;

    injectStyle();
    const profile = readProfile(description.value);
    description.value = profile.description;
    setBiographyLabel(description);

    const socials = document.createElement("fieldset");
    socials.className = "admin-artist-socials";
    socials.innerHTML = `<h4>Enlaces oficiales</h4><p>Opcionales. Se mostrarán separados de la biografía en el perfil público.</p>${PLATFORMS.map(([key, label]) => `<label>${label}<input type="url" name="artist_social_${key}" placeholder="https://..." value="${escapeHTML(profile.links[key] || "")}"></label>`).join("")}`;
    description.closest("label")?.after(socials);

    const app = getAP();
    const editId = app?.edits?.artist || "";
    const artistSongs = songsForArtist(editId);
    const featured = new Set(profile.featuredSongIds);
    const featuredBlock = document.createElement("fieldset");
    featuredBlock.className = "admin-artist-featured";
    featuredBlock.innerHTML = `<h4>Canciones destacadas</h4><p>Elige hasta 3 para mostrarlas primero en el perfil público.</p>${editId ? (artistSongs.length ? `<div class="admin-artist-featured-list">${artistSongs.map((song) => `<label class="admin-artist-featured-item"><input type="checkbox" name="artist_featured_song" value="${escapeHTML(song.id)}" ${featured.has(String(song.id)) ? "checked" : ""}><span>${escapeHTML(song.title || "Canción sin título")}<small>${escapeHTML([song.song_type ? (song.song_type === "catolico" ? "Católico" : song.song_type === "cristiano" ? "Cristiano" : "General") : "", song.tone ? `Tono ${song.tone}` : ""].filter(Boolean).join(" · "))}</small></span></label>`).join("")}</div>` : '<p class="admin-artist-featured-empty">Primero relaciona canciones con este artista para poder destacarlas.</p>') : '<p class="admin-artist-featured-empty">Guarda el artista primero. Después podrás elegir sus canciones destacadas.</p>'}`;
    socials.after(featuredBlock);

    featuredBlock.querySelectorAll('input[name="artist_featured_song"]').forEach((input) => input.addEventListener("change", () => {
      const selected = [...featuredBlock.querySelectorAll('input[name="artist_featured_song"]:checked')];
      if (selected.length > 3) {
        input.checked = false;
        const note = featuredBlock.querySelector("p");
        if (note) note.textContent = "Solo puedes seleccionar hasta 3 canciones destacadas.";
      }
    }));

    form.addEventListener("submit", () => {
      const links = {};
      PLATFORMS.forEach(([key]) => {
        const value = validUrl(form.querySelector(`[name="artist_social_${key}"]`)?.value);
        if (value) links[key] = value;
      });
      const selected = [...form.querySelectorAll('input[name="artist_featured_song"]:checked')].map((input) => input.value).slice(0, 3);
      description.value = packProfile(description.value, links, selected);
    }, true);

    form.dataset.artistProfileReady = "true";
  };

  const scan = () => {
    enhanceArtistForm(document.querySelector("#artistAdminForm"));
    cleanRenderedDescriptions();
  };

  const boot = () => {
    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
