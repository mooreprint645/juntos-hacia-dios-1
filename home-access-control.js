(() => {
  if ((location.pathname.split("/").pop() || "index.html").toLowerCase() !== "index.html") return;
  const db = window.supabaseClient;
  if (!db) return;

  const META_PATTERN = /<!--JHD_HOME_ACCESS:([\s\S]*?)-->\s*$/;
  const esc = (value) => String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const normalize = (value) => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const metaFor = (category) => {
    const match = String(category?.description || "").match(META_PATTERN);
    if (!match) return {};
    try { return JSON.parse(match[1]) || {}; } catch (_) { return {}; }
  };

  function rootsForType(categories, type) {
    const typed = (categories || []).filter((category) => normalize(category.song_type) === type);
    let roots = typed.filter((category) => !category.parent_id);
    const generic = type === "catolico" ? ["catolico", "catolica"] : ["cristiano", "cristiana"];
    if (roots.length === 1 && generic.includes(normalize(roots[0].name))) {
      const children = typed.filter((category) => String(category.parent_id) === String(roots[0].id));
      if (children.length) roots = children;
    }
    return roots
      .filter((category) => metaFor(category).visible !== false)
      .sort((a, b) => {
        const orderA = Number(metaFor(a).order);
        const orderB = Number(metaFor(b).order);
        const hasA = Number.isFinite(orderA);
        const hasB = Number.isFinite(orderB);
        if (hasA || hasB) return (hasA ? orderA : 99999) - (hasB ? orderB : 99999) || String(a.name || "").localeCompare(String(b.name || ""), "es");
        return Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.name || "").localeCompare(String(b.name || ""), "es");
      });
  }

  function descendants(categoryId, categories) {
    const ids = new Set([String(categoryId)]);
    let changed = true;
    while (changed) {
      changed = false;
      (categories || []).forEach((category) => {
        const id = String(category.id || "");
        if (category.parent_id && ids.has(String(category.parent_id)) && !ids.has(id)) {
          ids.add(id);
          changed = true;
        }
      });
    }
    return ids;
  }

  function renderGroup(type, title, description, categories, links) {
    const countSongs = (categoryId) => {
      const ids = descendants(categoryId, categories);
      return new Set((links || []).filter((row) => ids.has(String(row.category_id))).map((row) => String(row.song_id))).size;
    };
    const cards = rootsForType(categories, type).slice(0, 8).map((category) => {
      const count = countSongs(category.id);
      const key = category.slug || category.id;
      return `<a class="home-access-card" href="categorias.html?tipo=${type}&carpeta=${encodeURIComponent(key)}"><strong>${esc(category.name || "Categoría")}</strong><small>${count} ${count === 1 ? "canto" : "cantos"}</small></a>`;
    }).join("");
    return `<article class="home-access-group"><div class="home-access-group-heading"><span class="home-access-symbol" aria-hidden="true">✝</span><div><h3>${title}</h3><p>${description}</p></div></div>${cards ? `<div class="home-access-grid">${cards}</div>` : '<p class="home-access-empty">Las categorías aparecerán aquí cuando se agreguen.</p>'}<div class="home-access-footer"><a class="text-link" href="categorias.html?tipo=${type}">Ver todas</a></div></article>`;
  }

  function improveArtistSearchResults() {
    const results = document.getElementById("homeSearchResults");
    if (!results) return;
    const artistGroup = [...results.querySelectorAll(".home-search-group")].find((group) => /artistas/i.test(group.querySelector(".home-search-group-title")?.textContent || ""));
    artistGroup?.querySelectorAll(".home-search-result").forEach((item) => {
      const icon = item.querySelector(".home-search-result-icon");
      const name = item.querySelector("strong")?.textContent || "";
      if (!icon || icon.dataset.artistInitials === "true") return;
      const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase() || "A";
      icon.textContent = initials;
      icon.dataset.artistInitials = "true";
      icon.classList.add("home-search-artist-initials");
    });
  }

  async function refreshSection() {
    const section = document.getElementById("homeFaithAccess");
    if (!section) return false;
    const [categoriesRes, linksRes] = await Promise.all([
      db.from("categories").select("id,name,slug,description,parent_id,song_type,sort_order").order("sort_order", { ascending: true }).order("name", { ascending: true }),
      db.from("song_categories").select("song_id,category_id")
    ]);
    if (categoriesRes.error || linksRes.error) return true;
    const groups = section.querySelector(".home-access-groups");
    if (!groups) return true;
    groups.innerHTML = `${renderGroup("catolico", "Católico", "Misa, tiempos litúrgicos y devociones.", categoriesRes.data || [], linksRes.data || [])}${renderGroup("cristiano", "Cristiano", "Alabanza, oración y ministerios.", categoriesRes.data || [], linksRes.data || [])}`;
    section.dataset.homeAccessConfigured = "true";
    return true;
  }

  function boot() {
    const observer = new MutationObserver(() => {
      improveArtistSearchResults();
      if (document.getElementById("homeFaithAccess")?.dataset.homeAccessConfigured !== "true") refreshSection();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    improveArtistSearchResults();
    refreshSection();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();