(() => {
  if (window.__jhdAdminHomeSection) return;
  window.__jhdAdminHomeSection = true;

  const db = window.supabaseClient;
  let categories = [];
  let songs = [];
  let artistNamesBySong = new Map();
  let recommendations = [];
  let recommendationsReady = false;
  let setupError = null;
  let opening = false;
  const draft = { targetType: "category", typeFilter: "all", query: "", targetId: "", sectionType: "catolico" };

  const esc = (value) => String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const normalize = (value) => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const contentType = (value) => {
    const type = normalize(value);
    if (type.includes("catolic")) return "catolico";
    if (type.includes("cristian")) return "cristiano";
    if (type.includes("mixto")) return "mixto";
    return "general";
  };
  const typeLabel = (type) => ({ catolico: "Católico", cristiano: "Cristiano", mixto: "Mixto", general: "General" }[type] || "General");
  const sectionLabel = (section) => section === "cristiano" ? "Cristiana" : "Católica";

  function setTabActive(button) {
    const tabs = button?.closest(".admin-tabs");
    tabs?.querySelectorAll(".admin-tab").forEach((tab) => tab.classList.toggle("active", tab === button));
  }

  function targetFor(type, id) {
    return (type === "song" ? songs : categories).find((item) => String(item.id) === String(id)) || null;
  }

  function sourceType(type, item) {
    return contentType(type === "song" ? item?.song_type : item?.song_type);
  }

  function targetName(type, item) {
    if (!item) return "Contenido eliminado";
    return type === "song" ? (item.title || "Canto sin título") : (item.name || "Carpeta sin nombre");
  }

  function targetMeta(type, item) {
    if (!item) return "El elemento ya no existe.";
    if (type === "song") {
      const artists = artistNamesBySong.get(String(item.id)) || [];
      return [artists.join(" · "), item.tone ? `Tono ${item.tone}` : "", "Canto"].filter(Boolean).join(" · ");
    }
    return ["Carpeta", item.parent_id ? "Subcarpeta" : "Carpeta principal"].join(" · ");
  }

  function sectionFor(row, item) {
    const type = sourceType(row.target_type, item);
    return type === "catolico" || type === "cristiano" ? type : (row.section_type === "cristiano" ? "cristiano" : "catolico");
  }

  function draftSection() {
    const item = targetFor(draft.targetType, draft.targetId);
    const type = sourceType(draft.targetType, item);
    return type === "catolico" || type === "cristiano" ? type : draft.sectionType;
  }

  function typeBadge(type) {
    return `<span class="jhd-type-badge type-${type}">${typeLabel(type)}</span>`;
  }

  function candidates() {
    const source = draft.targetType === "song" ? songs : categories;
    const key = normalize(draft.query);
    return source.filter((item) => {
      const type = sourceType(draft.targetType, item);
      const typeMatches = draft.typeFilter === "all" || (draft.typeFilter === "mixto-general" ? (type === "mixto" || type === "general") : type === draft.typeFilter);
      const haystack = draft.targetType === "song"
        ? [item.title, item.tone, item.song_type, (artistNamesBySong.get(String(item.id)) || []).join(" ")].join(" ")
        : [item.name, item.song_type, item.description].join(" ");
      return typeMatches && (!key || normalize(haystack).includes(key));
    }).slice(0, 18);
  }

  function duplicateRows() {
    const map = new Map();
    recommendations.forEach((row) => {
      const key = `${row.target_type}:${row.target_id}`;
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }

  function rowsForSection(section) {
    return recommendations
      .map((row) => ({ row, item: targetFor(row.target_type, row.target_id) }))
      .filter(({ row, item }) => sectionFor(row, item) === section)
      .sort((a, b) => Number(a.row.sort_order || 0) - Number(b.row.sort_order || 0));
  }

  function recRows(section) {
    const rows = rowsForSection(section);
    const duplicates = duplicateRows();
    if (!rows.length) return '<div class="jhd-home-section-empty">Aún no hay recomendaciones en esta columna.</div>';
    return rows.map(({ row, item }) => {
      const type = sourceType(row.target_type, item);
      const manual = type === "mixto" || type === "general";
      const duplicate = duplicates.get(`${row.target_type}:${row.target_id}`) > 1;
      const placement = manual
        ? `<label class="jhd-rec-control">Columna<select data-rec-section aria-label="Columna"><option value="catolico" ${row.section_type !== "cristiano" ? "selected" : ""}>Católica</option><option value="cristiano" ${row.section_type === "cristiano" ? "selected" : ""}>Cristiana</option></select></label>`
        : `<span class="jhd-rec-placement">Va en ${sectionLabel(section)} automáticamente</span>`;
      return `<article class="jhd-rec-card" data-rec-id="${esc(row.id)}"><div class="jhd-rec-card-main"><span class="jhd-rec-kind" aria-hidden="true">${row.target_type === "song" ? "♫" : "✝"}</span><div class="jhd-rec-name"><strong>${esc(targetName(row.target_type, item))}</strong><small>${esc(targetMeta(row.target_type, item))}</small><div class="jhd-rec-badges">${typeBadge(type)}${duplicate ? '<span class="jhd-rec-placement">Duplicado</span>' : ""}</div></div></div><div class="jhd-rec-actions"><label class="jhd-rec-control"><input type="checkbox" data-rec-visible ${row.is_visible !== false ? "checked" : ""}> Visible</label>${placement}<label class="jhd-rec-control">Orden<input type="number" min="0" inputmode="numeric" data-rec-order value="${esc(row.sort_order ?? 0)}"></label><button class="jhd-rec-delete" type="button" data-delete-rec="${esc(row.id)}" aria-label="Quitar recomendación">×</button></div></article>`;
    }).join("");
  }

  function renderTargetList() {
    const list = document.getElementById("jhdRecommendationTargets");
    const placement = document.getElementById("jhdSelectedRecommendation");
    const sectionSelect = document.getElementById("jhdRecommendationSection");
    if (list) {
      const matches = candidates();
      list.innerHTML = matches.length ? matches.map((item) => {
        const selected = String(item.id) === String(draft.targetId);
        const type = sourceType(draft.targetType, item);
        return `<button class="jhd-recommendation-target ${selected ? "is-selected" : ""}" type="button" data-target-id="${esc(item.id)}"><span class="jhd-recommendation-target-icon" aria-hidden="true">${draft.targetType === "song" ? "♫" : "✝"}</span><span><strong>${esc(targetName(draft.targetType, item))}</strong><small>${esc(targetMeta(draft.targetType, item))}</small></span>${typeBadge(type)}${selected ? '<em>Seleccionado</em>' : ""}</button>`;
      }).join("") : '<div class="jhd-recommendation-empty">No encontramos resultados con ese tipo o búsqueda.</div>';
      list.querySelectorAll("[data-target-id]").forEach((button) => button.addEventListener("click", () => {
        draft.targetId = button.dataset.targetId || "";
        const item = targetFor(draft.targetType, draft.targetId);
        const type = sourceType(draft.targetType, item);
        if (type === "catolico" || type === "cristiano") draft.sectionType = type;
        renderTargetList();
      }));
    }
    const item = targetFor(draft.targetType, draft.targetId);
    const type = sourceType(draft.targetType, item);
    const forced = type === "catolico" || type === "cristiano";
    if (sectionSelect) {
      sectionSelect.disabled = forced;
      sectionSelect.value = forced ? type : draft.sectionType;
    }
    if (placement) {
      placement.innerHTML = item
        ? `<strong>${esc(targetName(draft.targetType, item))}</strong> · ${typeBadge(type)} · se publicará en <strong>${sectionLabel(draftSection())}</strong>${forced ? " automáticamente" : ""}.`
        : "Selecciona una carpeta o un canto de la lista.";
    }
  }

  function renderSetup() {
    const view = document.getElementById("adminView");
    if (!view) return;
    view.innerHTML = `<section class="admin-section"><div class="admin-section-heading"><div><p class="hero-kicker">Página principal</p><h2>Recomendaciones de Inicio</h2></div><p class="admin-count">Configuración requerida</p></div><div class="jhd-home-section-setup"><h3>Activa las recomendaciones personalizadas</h3><p>El selector ya está preparado, pero primero necesitas crear la tabla que guarda tus recomendaciones. En Supabase abre <strong>SQL Editor</strong>, ejecuta el archivo <strong>supabase-home-recommendations.sql</strong> del proyecto y vuelve a abrir esta pestaña.</p><button class="song-btn" id="jhdRetryHomeRecommendations" type="button">Ya ejecuté el SQL, volver a intentar</button><p class="jhd-home-section-status" id="jhdHomeSectionStatus" aria-live="polite">${esc(setupError || "")}</p></div></section>`;
    document.getElementById("jhdRetryHomeRecommendations")?.addEventListener("click", open);
  }

  function recommendationColumn(section, title, copy) {
    const rows = rowsForSection(section);
    return `<article class="jhd-rec-column is-${section}"><div class="jhd-rec-column-heading"><div><h3><span aria-hidden="true">✝</span>${title}</h3><p>${copy}</p></div><span class="jhd-rec-column-count">${rows.length} ${rows.length === 1 ? "elemento" : "elementos"}</span></div><div class="jhd-home-section-list">${recRows(section)}</div></article>`;
  }

  function render() {
    if (!recommendationsReady) return renderSetup();
    const view = document.getElementById("adminView");
    if (!view) return;
    view.innerHTML = `<section class="admin-section"><div class="admin-section-heading"><div><p class="hero-kicker">Página principal</p><h2>Recomendaciones de Inicio</h2></div><p class="admin-count">Hasta 8 visibles por columna</p></div><p class="jhd-home-section-note">Los elementos <strong>Católicos</strong> y <strong>Cristianos</strong> se colocan automáticamente en su columna. Solo el contenido mixto o general puede elegir dónde aparecer.</p><div class="jhd-recommendation-builder"><div class="jhd-builder-heading"><span class="jhd-builder-step">1</span><div><strong>Agregar recomendación</strong><small>Busca cualquier carpeta o canto. El tipo real siempre se muestra antes de agregarlo.</small></div></div><div class="jhd-builder-fields"><label>Contenido<select id="jhdRecommendationType"><option value="category" ${draft.targetType === "category" ? "selected" : ""}>Carpeta o categoría</option><option value="song" ${draft.targetType === "song" ? "selected" : ""}>Canto</option></select></label><label>Tipo real<select id="jhdRecommendationTypeFilter"><option value="all" ${draft.typeFilter === "all" ? "selected" : ""}>Todos los tipos</option><option value="catolico" ${draft.typeFilter === "catolico" ? "selected" : ""}>Católicos</option><option value="cristiano" ${draft.typeFilter === "cristiano" ? "selected" : ""}>Cristianos</option><option value="mixto-general" ${draft.typeFilter === "mixto-general" ? "selected" : ""}>Mixtos y generales</option></select></label><label>Buscar<input id="jhdRecommendationSearch" type="search" placeholder="Nombre, artista o tono..." value="${esc(draft.query)}" autocomplete="off"></label><label>Columna de Inicio<select id="jhdRecommendationSection"><option value="catolico">Católica</option><option value="cristiano">Cristiana</option></select></label></div><div class="jhd-recommendation-targets" id="jhdRecommendationTargets"></div><div class="jhd-builder-footer"><p class="jhd-builder-selection" id="jhdSelectedRecommendation"></p><button class="song-btn" id="jhdAddRecommendation" type="button">Agregar a Inicio</button></div></div><div class="jhd-home-section-groups">${recommendationColumn("catolico", "Columna Católica", "Misa, tiempos litúrgicos y devociones.")}${recommendationColumn("cristiano", "Columna Cristiana", "Alabanza, oración y ministerios.")}</div><div class="jhd-home-section-actions"><button class="song-btn" id="jhdSaveHomeRecommendations" type="button">Guardar cambios</button><button class="song-btn small-btn secondary" id="jhdReloadHomeRecommendations" type="button">Actualizar lista</button><p class="jhd-home-section-status" id="jhdHomeSectionStatus" aria-live="polite"></p></div></section>`;

    renderTargetList();
    document.getElementById("jhdRecommendationType")?.addEventListener("change", (event) => {
      draft.targetType = event.target.value || "category";
      draft.query = "";
      draft.targetId = "";
      render();
    });
    document.getElementById("jhdRecommendationTypeFilter")?.addEventListener("change", (event) => {
      draft.typeFilter = event.target.value || "all";
      draft.targetId = "";
      renderTargetList();
    });
    document.getElementById("jhdRecommendationSearch")?.addEventListener("input", (event) => {
      draft.query = event.target.value;
      draft.targetId = "";
      renderTargetList();
    });
    document.getElementById("jhdRecommendationSection")?.addEventListener("change", (event) => { draft.sectionType = event.target.value || "catolico"; });
    document.getElementById("jhdAddRecommendation")?.addEventListener("click", addRecommendation);
    document.getElementById("jhdSaveHomeRecommendations")?.addEventListener("click", saveRecommendations);
    document.getElementById("jhdReloadHomeRecommendations")?.addEventListener("click", open);
    document.querySelectorAll("[data-delete-rec]").forEach((button) => button.addEventListener("click", () => deleteRecommendation(button.dataset.deleteRec)));
  }

  function setStatus(message, isError = false) {
    const status = document.getElementById("jhdHomeSectionStatus");
    if (!status) return;
    status.textContent = message || "";
    status.style.color = isError ? "#ffb4b4" : "";
  }

  async function load() {
    if (!db) throw new Error("No se pudo iniciar la conexión con Supabase.");
    const [categoriesRes, songsRes, artistLinksRes, recommendationsRes] = await Promise.all([
      db.from("categories").select("id,name,description,parent_id,song_type,sort_order").order("name", { ascending: true }),
      db.from("songs").select("id,title,slug,tone,song_type").order("title", { ascending: true }),
      db.from("song_artists").select("song_id,artists(name)"),
      db.from("home_recommendations").select("id,target_type,target_id,section_type,sort_order,is_visible").order("sort_order", { ascending: true })
    ]);
    const coreError = [categoriesRes, songsRes, artistLinksRes].find((result) => result.error)?.error;
    if (coreError) throw coreError;
    categories = categoriesRes.data || [];
    songs = songsRes.data || [];
    artistNamesBySong = new Map();
    (artistLinksRes.data || []).forEach((row) => {
      const id = String(row.song_id || "");
      if (!row.artists?.name) return;
      if (!artistNamesBySong.has(id)) artistNamesBySong.set(id, []);
      artistNamesBySong.get(id).push(row.artists.name);
    });
    recommendationsReady = !recommendationsRes.error;
    setupError = recommendationsRes.error?.message || null;
    recommendations = recommendationsRes.data || [];
  }

  async function open(event) {
    if (opening) return;
    opening = true;
    const button = event?.currentTarget || document.querySelector("[data-jhd-home-section-tab]");
    setTabActive(button);
    const view = document.getElementById("adminView");
    if (view) view.innerHTML = '<section class="admin-section"><div class="admin-empty">Cargando recomendaciones…</div></section>';
    try { await load(); render(); }
    catch (error) { if (view) view.innerHTML = `<section class="admin-section"><div class="admin-empty">No se pudo cargar este control: ${esc(error?.message || "Error desconocido.")}</div></section>`; }
    finally { opening = false; }
  }

  async function addRecommendation() {
    const item = targetFor(draft.targetType, draft.targetId);
    if (!item) return setStatus("Primero selecciona una carpeta o un canto de la lista.", true);
    const duplicate = recommendations.some((row) => row.target_type === draft.targetType && String(row.target_id) === String(item.id));
    if (duplicate) return setStatus("Ese elemento ya está recomendado. Revísalo en su columna antes de agregarlo otra vez.", true);
    const section = draftSection();
    const current = rowsForSection(section);
    const nextOrder = current.length ? Math.max(...current.map(({ row }) => Number(row.sort_order || 0))) + 1 : 0;
    const button = document.getElementById("jhdAddRecommendation");
    if (button) button.disabled = true;
    setStatus("Agregando recomendación…");
    try {
      const { error } = await db.from("home_recommendations").insert([{ target_type: draft.targetType, target_id: item.id, section_type: section, sort_order: nextOrder, is_visible: true }]);
      if (error) throw error;
      draft.query = "";
      draft.targetId = "";
      await load();
      render();
      setStatus("Recomendación agregada correctamente.");
    } catch (error) { setStatus(`No se pudo agregar: ${error?.message || "Error desconocido."}`, true); }
    finally { if (button) button.disabled = false; }
  }

  async function saveRecommendations() {
    const cards = [...document.querySelectorAll("[data-rec-id]")];
    const button = document.getElementById("jhdSaveHomeRecommendations");
    if (button) button.disabled = true;
    setStatus("Guardando cambios…");
    try {
      const writes = cards.map((card) => {
        const row = recommendations.find((item) => String(item.id) === String(card.dataset.recId));
        const target = row && targetFor(row.target_type, row.target_id);
        const type = row ? sourceType(row.target_type, target) : "general";
        const data = {
          sort_order: Math.max(0, Number(card.querySelector("[data-rec-order]")?.value || 0)),
          is_visible: Boolean(card.querySelector("[data-rec-visible]")?.checked)
        };
        if (type === "mixto" || type === "general") data.section_type = card.querySelector("[data-rec-section]")?.value || row.section_type || "catolico";
        return db.from("home_recommendations").update(data).eq("id", row.id);
      });
      const results = await Promise.all(writes);
      const error = results.find((result) => result.error)?.error;
      if (error) throw error;
      await load();
      render();
      setStatus("Cambios guardados. Inicio ya separará los tipos correctamente.");
    } catch (error) { setStatus(`No se pudieron guardar: ${error?.message || "Error desconocido."}`, true); }
    finally { if (button) button.disabled = false; }
  }

  async function deleteRecommendation(id) {
    if (!id || !confirm("¿Quitar esta recomendación de Inicio?")) return;
    setStatus("Quitando recomendación…");
    try {
      const { error } = await db.from("home_recommendations").delete().eq("id", id);
      if (error) throw error;
      await load();
      render();
      setStatus("Recomendación quitada.");
    } catch (error) { setStatus(`No se pudo quitar: ${error?.message || "Error desconocido."}`, true); }
  }

  function install() {
    const tabs = document.querySelector("#adminWorkspace .admin-tabs");
    if (!tabs || tabs.querySelector("[data-jhd-home-section-tab]")) return false;
    const button = document.createElement("button");
    button.className = "admin-tab";
    button.type = "button";
    button.dataset.jhdHomeSectionTab = "true";
    button.textContent = "Inicio";
    button.addEventListener("click", open);
    tabs.insertBefore(button, tabs.firstElementChild);
    tabs.querySelectorAll(".admin-tab:not([data-jhd-home-section-tab])").forEach((tab) => tab.addEventListener("click", () => button.classList.remove("active")));
    return true;
  }

  const observer = new MutationObserver(install);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();