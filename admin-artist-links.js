(() => {
  const META_PATTERN = /<!--JHD_ARTIST_META:([\s\S]*?)-->\s*$/;
  const PLATFORMS = [
    ["youtube", "YouTube"],
    ["spotify", "Spotify"],
    ["instagram", "Instagram"],
    ["facebook", "Facebook"]
  ];

  const readProfile = (value) => {
    const raw = String(value || "");
    const match = raw.match(META_PATTERN);
    let links = {};
    if (match) {
      try {
        const meta = JSON.parse(match[1]);
        links = meta && typeof meta.links === "object" && meta.links ? meta.links : {};
      } catch (_) {}
    }
    return { description: raw.replace(META_PATTERN, "").trim(), links };
  };

  const validUrl = (value) => {
    try {
      const url = new URL(String(value || "").trim());
      return /^https?:$/.test(url.protocol) ? url.href : "";
    } catch (_) {
      return "";
    }
  };

  const packProfile = (description, links) => {
    const cleanDescription = String(description || "").replace(META_PATTERN, "").trim();
    const cleanLinks = Object.fromEntries(Object.entries(links).filter(([, value]) => Boolean(value)));
    if (!Object.keys(cleanLinks).length) return cleanDescription;
    return `${cleanDescription}${cleanDescription ? "\n\n" : ""}<!--JHD_ARTIST_META:${JSON.stringify({ links: cleanLinks })}-->`;
  };

  const injectStyle = () => {
    if (document.getElementById("artistSocialAdminStyle")) return;
    const style = document.createElement("style");
    style.id = "artistSocialAdminStyle";
    style.textContent = `.admin-artist-socials{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:2px;padding:14px;border:1px solid var(--border);border-radius:16px;background:var(--card-soft)}.admin-artist-socials h4{grid-column:1/-1;margin:0;color:var(--gold)}.admin-artist-socials p{grid-column:1/-1;margin:-5px 0 0;color:var(--muted);font-size:.9rem}.admin-artist-socials label{margin:0}@media(max-width:620px){.admin-artist-socials{grid-template-columns:1fr}}`;
    document.head.append(style);
  };

  const cleanRenderedDescriptions = () => {
    document.querySelectorAll("#adminView .admin-list-item p").forEach((line) => {
      const markerAt = line.textContent.indexOf("<!--JHD_ARTIST_META:");
      if (markerAt >= 0) line.textContent = line.textContent.slice(0, markerAt).trim();
    });
  };

  const enhanceArtistForm = (form) => {
    if (!form || form.dataset.artistLinksReady === "true") return;
    const description = form.querySelector('textarea[name="description"]');
    if (!description) return;

    injectStyle();
    const profile = readProfile(description.value);
    description.value = profile.description;

    const block = document.createElement("fieldset");
    block.className = "admin-artist-socials";
    block.innerHTML = `<h4>Enlaces oficiales</h4><p>Opcionales. Se mostrarán en el perfil público del artista.</p>${PLATFORMS.map(([key, label]) => `<label>${label}<input type="url" name="artist_social_${key}" placeholder="https://..." value="${String(profile.links[key] || "").replaceAll("&", "&amp;").replaceAll('"', "&quot;")}"></label>`).join("")}`;
    description.closest("label")?.after(block);

    form.addEventListener("submit", () => {
      const links = {};
      PLATFORMS.forEach(([key]) => {
        const value = validUrl(form.querySelector(`[name="artist_social_${key}"]`)?.value);
        if (value) links[key] = value;
      });
      description.value = packProfile(description.value, links);
    }, true);

    form.dataset.artistLinksReady = "true";
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
