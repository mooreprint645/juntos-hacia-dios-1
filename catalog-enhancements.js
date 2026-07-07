(() => {
  if (window.__jhdCatalogEnhancements) return;
  window.__jhdCatalogEnhancements = true;

  const page = () => (location.pathname.split("/").pop() || "index.html").toLowerCase();
  const normalize = (value) => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const escapeHTML = (value) => String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const categoryKey = (category) => category?.slug || category?.id || "";

  const descendantIds = (categories, categoryId) => {
    const ids = new Set([String(categoryId)]);
    let changed = true;
    while (changed) {
      changed = false;
      categories.forEach((category) => {
        const id = String(category.id || "");
        if (category.parent_id && ids.has(String(category.parent_id)) && !ids.has(id)) {
          ids.add(id);
          changed = true;
        }
      });
    }
    return ids;
  };

  const countSongs = (relations, ids) => {
    const songIds = new Set();
    (relations || []).forEach((row) => {
      if (ids.has(String(row.category_id))) songIds.add(String(row.song_id));
    });
    return songIds.size;
  };

  const share = async (title, url, button) => {
    const text = `Te comparto “${title}” en Juntos Hacia Dios.`;
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      const original = button.textContent;
      button.textContent = "Enlace copiado";
      setTimeout(() => { button.textContent = original; }, 1800);
    } catch (_) {
      window.prompt("Copia este enlace:", url);
    }
  };

  const enhanceSongCards = () => {
    document.querySelectorAll("a.song-link-card:not([data-catalog-enhanced])").forEach((link) => {
      const parent = link.parentElement;
      if (!parent) return;
      const wrapper = document.createElement("article");
      wrapper.className = "song-card song-preview-card";
      wrapper.dataset.catalogEnhanced = "true";
      link.dataset.catalogEnhanced = "true";
      link.classList.remove("song-card");
      link.classList.add("song-preview-main");
      parent.insertBefore(wrapper, link);
      wrapper.append(link);
      const title = link.querySelector("h3")?.textContent?.trim() || "Canción";
      const actions = document.createElement("div");
      actions.className = "song-card-actions";
      actions.innerHTML = `<a class="song-btn small-btn" href="${escapeHTML(link.getAttribute("href") || "canciones.html")}">Ver canción</a><button class="song-btn small-btn secondary" type="button" data-share-song="true">Compartir</button>`;
      actions.querySelector("[data-share-song]")?.addEventListener("click", (event) => share(title, link.href, event.currentTarget));
      wrapper.append(actions);
    });

    document.querySelectorAll(".song-card:not(.song-preview-card)").forEach((card) => {
      if (card.dataset.catalogActions) return;
      const link = card.querySelector('a.song-btn[href*="cancion.html"]');
      if (!link) return;
      card.dataset.catalogActions = "true";
      const title = card.querySelector("h3")?.textContent?.trim() || "Canción";
      const actions = document.createElement("div");
      actions.className = "song-card-actions";
      link.parentElement?.insertBefore(actions, link);
      actions.append(link);
      const button = document.createElement("button");
      button.className = "song-btn small-btn secondary";
      button.type = "button";
      button.textContent = "Compartir";
      button.addEventListener("click", () => share(title, link.href, button));
      actions.append(button);
    });
  };

  const enhanceCategoryCounts = () => {
    if (page() !== "categorias.html") return;
    const categories = window.JHD?.state?.categories || [];
    const songs = window.JHD?.state?.songs || [];
    if (!categories.length) return;
    document.querySelectorAll(".public-category-card").forEach((card) => {
      if (card.querySelector(".public-category-count")) return;
      const control = card.querySelector("[data-folder], [data-category]");
      const id = control?.dataset.folder || control?.dataset.category;
      if (!id) return;
      const ids = descendantIds(categories, id);
      const count = songs.filter((song) => (song._categories || []).some((category) => ids.has(String(category.id)))).length;
      const label = `${count} ${count === 1 ? "canto" : "cantos"}`;
      const countNode = document.createElement("p");
      countNode.className = "public-category-count";
      countNode.textContent = label;
      const actions = card.querySelector(".public-category-card-actions");
      if (actions) actions.before(countNode);
      else card.append(countNode);
    });
  };

  const insertHomeSearch = () => {
    if (page() !== "index.html" || document.getElementById("homeSongSearch")) return;
    const actions = document.querySelector(".hero .hero-actions");
    if (!actions) return;
    const form = document.createElement("form");
    form.className = "home-discovery-search";
    form.innerHTML = '<label for="homeSongSearch">Buscar un canto</label><input id="homeSongSearch" type="search" placeholder="Buscar por nombre, artista, tono o palabra..." autocomplete="off"><button class="song-btn" type="submit">Buscar</button>';
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const query = form.querySelector("input")?.value.trim() || "";
      location.href = `canciones.html${query ? `?buscar=${encodeURIComponent(query)}` : ""}`;
    });
    actions.before(form);
  };

  const accessRoots = (categories, type) => {
    const typed = categories.filter((category) => normalize(category.song_type) === type);
    let roots = typed.filter((category) => !category.parent_id);
    const genericName = type === "catolico" ? ["catolico", "catolica"] : ["cristiano", "cristiana"];
    if (roots.length === 1 && genericName.includes(normalize(roots[0].name))) {
      const childRoots = typed.filter((category) => String(category.parent_id) === String(roots[0].id));
      if (childRoots.length) roots = childRoots;
    }
    return roots.sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.name || "").localeCompare(String(b.name || ""), "es"));
  };

  const renderHomeAccess = (categories, relations) => {
    const old = document.getElementById("homeFaithAccess");
    if (old) old.remove();
    const hero = document.querySelector(".hero");
    if (!hero) return;
    const section = document.createElement("section");
    section.id = "homeFaithAccess";
    section.className = "section home-faith-access";

    const group = (type, title, description, symbol) => {
      const roots = accessRoots(categories, type).slice(0, 8);
      const cards = roots.map((category) => {
        const count = countSongs(relations, descendantIds(categories, category.id));
        const href = `categorias.html?tipo=${type}&carpeta=${encodeURIComponent(categoryKey(category))}`;
        return `<a class="home-access-card" href="${href}"><strong>${escapeHTML(category.name || "Categoría")}</strong><small>${count} ${count === 1 ? "canto" : "cantos"}</small></a>`;
      }).join("");
      return `<article class="home-access-group"><div class="home-access-group-heading"><span class="home-access-symbol">${symbol}</span><div><h3>${title}</h3><p>${description}</p></div></div>${cards ? `<div class="home-access-grid">${cards}</div>` : '<p class="home-access-empty">Las categorías aparecerán aquí cuando se agreguen.</p>'}<div class="home-access-footer"><a class="text-link" href="categorias.html?tipo=${type}">Ver todas</a></div></article>`;
    };

    section.innerHTML = `<div class="section-heading"><p class="hero-kicker">Encuentra rápido</p><h2>¿Para qué necesitas un canto?</h2></div><div class="home-access-groups">${group("catolico", "Católico", "Misa, tiempos litúrgicos y devociones.", "✝")}${group("cristiano", "Cristiano", "Alabanza, oración y ministerios.", "♫")}</div>`;
    hero.insertAdjacentElement("afterend", section);
  };

  const loadHomeAccess = async () => {
    if (page() !== "index.html" || !window.supabaseClient) return;
    insertHomeSearch();
    const [categoriesResult, relationsResult] = await Promise.all([
      window.supabaseClient.from("categories").select("id,name,slug,parent_id,song_type,sort_order").order("sort_order", { ascending: true }).order("name", { ascending: true }),
      window.supabaseClient.from("song_categories").select("song_id,category_id")
    ]);
    if (categoriesResult.error || relationsResult.error) return;
    renderHomeAccess(categoriesResult.data || [], relationsResult.data || []);
  };

  const refresh = () => {
    enhanceSongCards();
    enhanceCategoryCounts();
  };

  document.addEventListener("DOMContentLoaded", () => {
    insertHomeSearch();
    loadHomeAccess();
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();
