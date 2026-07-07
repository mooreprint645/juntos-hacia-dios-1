(() => {
  if ((location.pathname.split("/").pop() || "index.html").toLowerCase() !== "index.html") return;
  const db = window.supabaseClient;
  if (!db) return;

  const esc = (value) => String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const normalize = (value) => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const contentType = (value) => {
    const type = normalize(value);
    if (type.includes("catolic")) return "catolico";
    if (type.includes("cristian")) return "cristiano";
    if (type.includes("mixto")) return "mixto";
    return "general";
  };

  function rootsForType(categories, type) {
    const typed = (categories || []).filter((category) => normalize(category.song_type) === type);
    let roots = typed.filter((category) => !category.parent_id);
    const generic = type === "catolico" ? ["catolico", "catolica"] : ["cristiano", "cristiana"];
    if (roots.length === 1 && generic.includes(normalize(roots[0].name))) {
      const children = typed.filter((category) => String(category.parent_id) === String(roots[0].id));
      if (children.length) roots = children;
    }
    return roots.sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.name || "").localeCompare(String(b.name || ""), "es"));
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

  function groupShell(type, title, description, cards) {
    return `<article class="home-access-group"><div class="home-access-group-heading"><span class="home-access-symbol" aria-hidden="true">✝</span><div><h3>${title}</h3><p>${description}</p></div></div>${cards ? `<div class="home-access-grid">${cards}</div>` : '<p class="home-access-empty">Aún no hay recomendaciones en esta columna.</p>'}<div class="home-access-footer"><a class="text-link" href="categorias.html?tipo=${type}">Ver todas</a></div></article>`;
  }

  function categoryCard(category, categories, links, manual = false) {
    const ids = descendants(category.id, categories);
    const count = new Set((links || []).filter((row) => ids.has(String(row.category_id))).map((row) => String(row.song_id))).size;
    const key = category.slug || category.id;
    return `<a class="home-access-card ${manual ? "home-access-featured-category" : ""}" href="categorias.html?categoria=${encodeURIComponent(key)}"><strong>${esc(category.name || "Carpeta")}</strong><small>${manual ? "✝ Carpeta · " : ""}${count} ${count === 1 ? "canto" : "cantos"}</small></a>`;
  }

  function songCard(song, artistNames = []) {
    const href = song.slug ? `cancion.html?slug=${encodeURIComponent(song.slug)}` : `cancion.html?id=${encodeURIComponent(song.id)}`;
    const meta = [artistNames.join(" · "), song.tone ? `Tono ${song.tone}` : ""].filter(Boolean).join(" · ");
    return `<a class="home-access-card home-access-featured-song" href="${href}"><strong>${esc(song.title || "Canto")}</strong><small>♫ Canto${meta ? ` · ${esc(meta)}` : ""}</small></a>`;
  }

  function renderAutomatic(section, categories, links) {
    const catholicCards = rootsForType(categories, "catolico").slice(0, 8).map((category) => categoryCard(category, categories, links)).join("");
    const christianCards = rootsForType(categories, "cristiano").slice(0, 8).map((category) => categoryCard(category, categories, links)).join("");
    section.querySelector(".home-access-groups").innerHTML = `${groupShell("catolico", "Católico", "Misa, tiempos litúrgicos y devociones.", catholicCards)}${groupShell("cristiano", "Cristiano", "Alabanza, oración y ministerios.", christianCards)}`;
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
    if (!section || section.dataset.homeAccessLoading === "true") return false;
    section.dataset.homeAccessLoading = "true";

    try {
      const [categoriesRes, linksRes, songsRes, artistLinksRes, recommendationsRes] = await Promise.all([
        db.from("categories").select("id,name,slug,parent_id,song_type,sort_order").order("sort_order", { ascending: true }).order("name", { ascending: true }),
        db.from("song_categories").select("song_id,category_id"),
        db.from("songs").select("id,title,slug,tone,song_type").order("title", { ascending: true }),
        db.from("song_artists").select("song_id,artists(name)"),
        db.from("home_recommendations").select("id,target_type,target_id,section_type,sort_order,is_visible").order("sort_order", { ascending: true })
      ]);

      if (categoriesRes.error || linksRes.error) return true;
      const categories = categoriesRes.data || [];
      const links = linksRes.data || [];
      const groups = section.querySelector(".home-access-groups");
      if (!groups) return true;
      if (recommendationsRes.error || !(recommendationsRes.data || []).length) {
        renderAutomatic(section, categories, links);
        section.dataset.homeAccessConfigured = "automatic";
        return true;
      }

      const songById = new Map((songsRes.data || []).map((song) => [String(song.id), song]));
      const categoryById = new Map(categories.map((category) => [String(category.id), category]));
      const artistNamesBySong = new Map();
      (artistLinksRes.data || []).forEach((row) => {
        const id = String(row.song_id || "");
        if (!row.artists?.name) return;
        if (!artistNamesBySong.has(id)) artistNamesBySong.set(id, []);
        artistNamesBySong.get(id).push(row.artists.name);
      });

      const resolve = (entry) => entry.target_type === "song" ? songById.get(String(entry.target_id)) : categoryById.get(String(entry.target_id));
      const sectionFor = (entry, item) => {
        const type = contentType(item?.song_type);
        return type === "catolico" || type === "cristiano" ? type : (entry.section_type === "cristiano" ? "cristiano" : "catolico");
      };
      const cardsFor = (targetSection) => {
        const seen = new Set();
        return (recommendationsRes.data || [])
          .filter((entry) => entry.is_visible !== false)
          .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
          .map((entry) => ({ entry, item: resolve(entry) }))
          .filter(({ entry, item }) => item && sectionFor(entry, item) === targetSection)
          .filter(({ entry }) => {
            const key = `${entry.target_type}:${entry.target_id}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .slice(0, 8)
          .map(({ entry, item }) => entry.target_type === "song" ? songCard(item, artistNamesBySong.get(String(item.id)) || []) : categoryCard(item, categories, links, true))
          .join("");
      };

      groups.innerHTML = `${groupShell("catolico", "Católico", "Misa, tiempos litúrgicos y devociones.", cardsFor("catolico"))}${groupShell("cristiano", "Cristiano", "Alabanza, oración y ministerios.", cardsFor("cristiano"))}`;
      section.dataset.homeAccessConfigured = "manual";
      return true;
    } finally {
      delete section.dataset.homeAccessLoading;
    }
  }

  function boot() {
    const observer = new MutationObserver(() => {
      improveArtistSearchResults();
      const section = document.getElementById("homeFaithAccess");
      if (section && !section.dataset.homeAccessConfigured) refreshSection();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    improveArtistSearchResults();
    refreshSection();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();