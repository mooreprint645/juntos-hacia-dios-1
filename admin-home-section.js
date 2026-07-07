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
  const draft = { targetType: "category", query: "", targetId: "", sectionType: "catolico" };

  const esc = (value) => String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const normalize = (value) => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const typeLabel = (value) => ({ catolico: "Católico", cristiano: "Cristiano", mixto: "Mixto" }[normalize(value)] || "General");

  function setTabActive(button) {
    const tabs = button?.closest(".admin-tabs");
    tabs?.querySelectorAll(".admin-tab").forEach((tab) => tab.classList.toggle("active", tab === button));
  }

  function targetFor(type, id) {
    if (type === "song") return songs.find((song) => String(song.id) === String(id)) || null;
    return categories.find((category) => String(category.id) === String(id)) || null;
  }

  function targetName(type, item) {
    if (!item) return "Contenido eliminado";
    if (type === "song") return item.title || "Canto sin título";
    return item.name || "Carpeta sin nombre";
  }

  function targetMeta(type, item) {
    if (!item) return "El elemento ya no existe.";
    if (type === "song") {
      const artists = artistNamesBySong.get(String(item.id)) || [];
      return [artists.join(" · "), item.tone ? `Tono ${item.tone}` : "", typeLabel(item.song_type)].filter(Boolean).join(" · ") || "Canto";
    }
    return ["Carpeta", typeLabel(item.song_type), item.parent_id ? "Subcarpeta" : "Carpeta principal"].filter(Boolean).join(" · ");
  }

  function candidates() {
    const source = draft.targetType === "song" ? songs : categories;
    const key = normalize(draft.query);
    return source.filter((item) => {
      const haystack = draft.targetType === "song"
        ? [item.title, item.tone, item.song_type, (artistNamesBySong.get(String(item.id)) || []).join(" ")].join(" ")
        : [item.name, item.song_type, item.description].join(" ");
      return !key || normalize(haystack).includes(key);
    }).slice(0, 18);
  }

  function recRows(sectionType) {
    const rows = recommendations
      .filter((row) => row.section_type === sectionType)
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
    if (!rows.length) return '<div class="jhd-home-section-empty">Aún no hay recomendaciones en esta columna.</div>';

    return rows.map((row) => {
      const item = targetFor(row.target_type, row.target_id);
      const kind = row.target_type === "song" ? "♫" : "✝";
      return `<div class="jhd-rec-row" data-rec-id="${esc(row.id)}"><input type="checkbox" data-rec-visible ${row.is_visible !== false ? "checked" : ""} aria-label="Mostrar ${esc(targetName(row.target_type, item))}"><span class="jhd-rec-kind" aria-hidden="true">${kind}</span><div class="jhd-rec-name"><strong>${esc(targetName(row.target_type, item))}</strong><small>${esc(targetMeta(row.target_type, item))}</small></div><select data-rec-section aria-label="Columna"><option value="catolico" ${row.section_type === "catolico" ? "selected" : ""}>Católica</option><option value="cristiano" ${row.section_type === "cristiano" ? "selected" : ""}>Cristiana</option></select><input type="number" min="0" inputmode="numeric" data-rec-order value="${esc(row.sort_order ?? 0)}" aria-label="Orden"><button class="jhd-rec-delete" type="button" data-delete-rec="${esc(row.id)}" aria-label="Quitar recomendación">×</button></div>`;
    }).join("");
  }

  function targetListHTML() {
    const matches = candidates();
    if (!matches.length) return '<div class="jhd-recommendation-empty">No encontramos resultados. Prueba otro nombre.</div>';
    return matches.map((item) => {
      const selected = String(item.id) === String(draft.targetId);
      const icon = draft.targetType === "song" ? "♫" : "✝";
      return `<button class="jhd-recommendation-target ${selected ? "is-selected" : ""}" type="button" data-target-id="${esc(item.id)}"><span class="jhd-recommendation-target-icon" aria-hidden="true">${icon}</span><span><strong>${esc(targetName(draft.targetType, item))}</strong><small>${esc(targetMeta(draft.targetType, item))}</small></span>${selected ? '<em>Seleccionado</em>' : ""}</button>`;
    }).join("");
  }

  function renderTargetList() {
    const list = document.getElementById("jhdRecommendationTargets");
    const selected = document.getElementById("jhdSelectedRecommendation");
    if (list) {
      list.innerHTML = targetListHTML();
      list.querySelectorAll("[data-target-id]").forEach((button) => button.addEventListener("click", () => {
        draft.targetId = button.dataset.targetId || "";
        renderTargetList();
      }));
    }
    if (selected) {
      const item = targetFor(draft.targetType, draft.targetId);
      selected.textContent = item ? `Seleccionado: ${targetName(draft.targetType, item)}` : "Selecciona una opción de la lista.";
    }
  }

  function renderSetup() {
    const view = document.getElementById("adminView");
    if (!view) return;
    view.innerHTML = `<section class="admin-section"><div class="admin-section-heading"><div><p class="hero-kicker">Página principal</p><h2>Recomendaciones de Inicio</h2></div><p class="admin-count">Configuración requerida</p></div><div class="jhd-home-section-setup"><h3>Activa las recomendaciones personalizadas</h3><p>El selector ya está preparado, pero primero necesitas crear la tabla que guarda tus recomendaciones. En Supabase abre <strong>SQL Editor</strong>, ejecuta el archivo <strong>supabase-home-recommendations.sql</strong> del proyecto y vuelve a abrir esta pestaña.</p><button class="song-btn" id="jhdRetryHomeRecommendations" type="button">Ya ejecuté el SQL, volver a intentar</button><p class="jhd-home-section-status" id="jhdHomeSectionStatus" aria-live="polite">${esc(setupError || "")}</p></div></section>`;
    document.getElementById("jhdRetryHomeRecommendations")?.addEventListener("click", open);
  }

  function render() {
    if (!recommendationsReady) return renderSetup();
    const view = document.getElementById("adminView");
    if (!view) return;
    view.innerHTML = `<section class="admin-section"><div class="admin-section-heading"><div><p class="hero-kicker">Página principal</p><h2>Recomendaciones de Inicio</h2></div><p class="admin-count">Hasta 8 visibles por columna</p></div><p class="jhd-home-section-note">Elige cualquier carpeta o cualquier canto del catálogo. Decide en qué columna se verá, ajusta el orden y oculta lo que no quieras mostrar. Las dos columnas de Inicio usan una cruz.</p><div class="jhd-recommendation-builder"><label>Recomendar<select id="jhdRecommendationType"><option value="category" ${draft.targetType === "category" ? "selected" : ""}>Carpeta o categoría</option><option value="song" ${draft.targetType === "song" ? "selected" : ""}>Canto</option></select></label><label>Buscar<input id="jhdRecommendationSearch" type="search" placeholder="Escribe para buscar..." value="${esc(draft.query)}" autocomplete="off"></label><label>Columna<select id="jhdRecommendationSection"><option value="catolico" ${draft.sectionType === "catolico" ? "selected" : ""}>Católica</option><option value="cristiano" ${draft.sectionType === "cristiano" ? "selected" : ""}>Cristiana</option></select></label><button class="song-btn" id="jhdAddRecommendation" type="button">Agregar</button><div class="jhd-recommendation-targets" id="jhdRecommendationTargets"></div><p class="jhd-home-section-status" id="jhdSelectedRecommendation"></p></div><div class="jhd-home-section-groups"><article class="jhd-home-section-group"><h3><span aria-hidden="true">✝</span>Católica</h3><p>Misa, tiempos litúrgicos y devociones.</p><div class="jhd-home-section-list">${recRows("catolico")}</div></article><article class="jhd-home-section-group"><h3><span aria-hidden="true">✝</span>Cristiana</h3><p>Alabanza, oración y ministerios.</p><div class="jhd-home-section-list">${recRows("cristiano")}</div></article></div><div class="jhd-home-section-actions"><button class="song-btn" id="jhdSaveHomeRecommendations" type="button">Guardar orden y visibilidad</button><button class="song-btn small-btn secondary" id="jhdReloadHomeRecommendations" type="button">Actualizar lista</button><p class="jhd-home-section-status" id="jhdHomeSectionStatus" aria-live="polite"></p></div></section>`;

    renderTargetList();
    document.getElementById("jhdRecommendationType")?.addEventListener("change", (event) => {
      draft.targetType = event.target.value || "category";
      draft.query = "";
      draft.targetId = "";
      render();
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
      db.from("home_recommendations").select("id,target_type,target_id,section_type,sort_order,is_visible").order("section_type", { ascending: true }).order("sort_order", { ascending: true })
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
    try {
      await load();
      render();
    } catch (error) {
      if (view) view.innerHTML = `<section class="admin-section"><div class="admin-empty">No se pudo cargar este control: ${esc(error?.message || "Error desconocido.")}</div></section>`;
    } finally {
      opening = false;
    }
  }

  async function addRecommendation() {
    const item = targetFor(draft.targetType, draft.targetId);
    if (!item) { setStatus("Primero selecciona una carpeta o un canto de la lista.", true); return; }
    const duplicate = recommendations.some((row) => row.target_type === draft.targetType && String(row.target_id) === String(item.id) && row.section_type === draft.sectionType);
    if (duplicate) { setStatus("Ese elemento ya está recomendado en esta columna.", true); return; }
    const current = recommendations.filter((row) => row.section_type === draft.sectionType);
    const nextOrder = current.length ? Math.max(...current.map((row) => Number(row.sort_order || 0))) + 1 : 0;
    const button = document.getElementById("jhdAddRecommendation");
    if (button) button.disabled = true;
    setStatus("Agregando recomendación…");
    try {
      const { error } = await db.from("home_recommendations").insert([{ target_type: draft.targetType, target_id: item.id, section_type: draft.sectionType, sort_order: nextOrder, is_visible: true }]);
      if (error) throw error;
      draft.query = "";
      draft.targetId = "";
      await load();
      render();
      setStatus("Recomendación agregada.");
    } catch (error) {
      setStatus(`No se pudo agregar: ${error?.message || "Error desconocido."}`, true);
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function saveRecommendations() {
    const rows = [...document.querySelectorAll("[data-rec-id]")];
    const button = document.getElementById("jhdSaveHomeRecommendations");
    if (button) button.disabled = true;
    setStatus("Guardando orden y visibilidad…");
    try {
      const writes = rows.map((row) => {
        const id = row.dataset.recId;
        return db.from("home_recommendations").update({
          section_type: row.querySelector("[data-rec-section]")?.value || "catolico",
          sort_order: Math.max(0, Number(row.querySelector("[data-rec-order]")?.value || 0)),
          is_visible: Boolean(row.querySelector("[data-rec-visible]")?.checked)
        }).eq("id", id);
      });
      const results = await Promise.all(writes);
      const error = results.find((result) => result.error)?.error;
      if (error) throw error;
      await load();
      render();
      setStatus("Cambios guardados. Recarga Inicio para verlos.");
    } catch (error) {
      setStatus(`No se pudieron guardar: ${error?.message || "Error desconocido."}`, true);
    } finally {
      if (button) button.disabled = false;
    }
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
    } catch (error) {
      setStatus(`No se pudo quitar: ${error?.message || "Error desconocido."}`, true);
    }
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