(() => {
  if (window.__jhdAdminHomeSection) return;
  window.__jhdAdminHomeSection = true;

  const db = window.supabaseClient;
  const META_PATTERN = /<!--JHD_HOME_ACCESS:([\s\S]*?)-->\s*$/;
  let currentCategories = [];
  let opening = false;

  const esc = (value) => String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const normalize = (value) => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  function splitMeta(value) {
    const raw = String(value || "");
    const match = raw.match(META_PATTERN);
    if (!match) return { text: raw.trim(), meta: {} };
    try {
      return { text: raw.replace(META_PATTERN, "").trim(), meta: JSON.parse(match[1]) || {} };
    } catch (_) {
      return { text: raw.replace(META_PATTERN, "").trim(), meta: {} };
    }
  }

  function packMeta(text, meta) {
    const clean = String(text || "").replace(META_PATTERN, "").trim();
    const normal = { visible: meta.visible !== false, order: Number.isFinite(Number(meta.order)) ? Number(meta.order) : 0 };
    return `${clean}${clean ? "\n" : ""}<!--JHD_HOME_ACCESS:${JSON.stringify(normal)}-->`;
  }

  function rootsForType(categories, type) {
    const typed = (categories || []).filter((category) => normalize(category.song_type) === type);
    let roots = typed.filter((category) => !category.parent_id);
    const generic = type === "catolico" ? ["catolico", "catolica"] : ["cristiano", "cristiana"];
    if (roots.length === 1 && generic.includes(normalize(roots[0].name))) {
      const children = typed.filter((category) => String(category.parent_id) === String(roots[0].id));
      if (children.length) roots = children;
    }
    return roots.sort((a, b) => {
      const aMeta = splitMeta(a.description).meta;
      const bMeta = splitMeta(b.description).meta;
      const orderA = Number(aMeta.order);
      const orderB = Number(bMeta.order);
      const hasA = Number.isFinite(orderA);
      const hasB = Number.isFinite(orderB);
      if (hasA || hasB) return (hasA ? orderA : Number(a.sort_order || 0)) - (hasB ? orderB : Number(b.sort_order || 0)) || String(a.name || "").localeCompare(String(b.name || ""), "es");
      return Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.name || "").localeCompare(String(b.name || ""), "es");
    });
  }

  function setTabActive(button) {
    const tabs = button?.closest(".admin-tabs");
    tabs?.querySelectorAll(".admin-tab").forEach((tab) => tab.classList.toggle("active", tab === button));
  }

  function setStatus(message, error = false) {
    const status = document.getElementById("jhdHomeSectionStatus");
    if (!status) return;
    status.textContent = message || "";
    status.style.color = error ? "#ffb4b4" : "";
  }

  function groupHTML(type, title, description) {
    const rows = rootsForType(currentCategories, type);
    const content = rows.length ? rows.map((category) => {
      const { meta } = splitMeta(category.description);
      const visible = meta.visible !== false;
      const order = Number.isFinite(Number(meta.order)) ? Number(meta.order) : Number(category.sort_order || 0);
      return `<div class="jhd-home-section-row" data-home-category="${esc(category.id)}"><input type="checkbox" data-home-visible ${visible ? "checked" : ""} aria-label="Mostrar ${esc(category.name)} en Inicio"><div><strong>${esc(category.name || "Categoría")}</strong><small>${visible ? "Visible en Inicio" : "Oculta en Inicio"}</small></div><label>Orden<input type="number" min="0" inputmode="numeric" data-home-order value="${esc(order)}" aria-label="Orden de ${esc(category.name)}"></label></div>`;
    }).join("") : '<div class="jhd-home-section-empty">No hay categorías disponibles para este bloque. Crea categorías de tipo correspondiente desde la pestaña Categorías.</div>';
    return `<article class="jhd-home-section-group"><h3><span aria-hidden="true">✝</span>${title}</h3><p>${description}</p><div class="jhd-home-section-list">${content}</div></article>`;
  }

  function render() {
    const view = document.getElementById("adminView");
    if (!view) return;
    view.innerHTML = `<section class="admin-section"><div class="admin-section-heading"><div><p class="hero-kicker">Página principal</p><h2>¿Para qué necesitas un canto?</h2></div><p class="admin-count">Control de Inicio</p></div><p class="jhd-home-section-note">Decide qué categorías aparecen en esta sección y el orden en que se muestran. Ambas columnas usan una cruz; las tarjetas de artistas conservan sus iniciales.</p><div class="jhd-home-section-groups">${groupHTML("catolico", "Católico", "Misa, tiempos litúrgicos y devociones.")}${groupHTML("cristiano", "Cristiano", "Alabanza, oración y ministerios.")}</div><div class="jhd-home-section-actions"><button class="song-btn" id="jhdSaveHomeSection" type="button">Guardar cambios</button><button class="song-btn small-btn secondary" id="jhdResetHomeSection" type="button">Restablecer orden</button><p class="jhd-home-section-status" id="jhdHomeSectionStatus" aria-live="polite"></p></div></section>`;

    document.querySelectorAll("[data-home-visible]").forEach((input) => input.addEventListener("change", () => {
      const text = input.closest(".jhd-home-section-row")?.querySelector("small");
      if (text) text.textContent = input.checked ? "Visible en Inicio" : "Oculta en Inicio";
    }));
    document.getElementById("jhdSaveHomeSection")?.addEventListener("click", save);
    document.getElementById("jhdResetHomeSection")?.addEventListener("click", reset);
  }

  async function load() {
    if (!db) throw new Error("No se pudo iniciar la conexión con Supabase.");
    const { data, error } = await db.from("categories").select("id,name,description,parent_id,song_type,sort_order").order("sort_order", { ascending: true }).order("name", { ascending: true });
    if (error) throw error;
    currentCategories = data || [];
  }

  async function open(event) {
    if (opening) return;
    opening = true;
    const button = event?.currentTarget || document.querySelector("[data-jhd-home-section-tab]");
    setTabActive(button);
    const view = document.getElementById("adminView");
    if (view) view.innerHTML = '<section class="admin-section"><div class="admin-empty">Cargando control de Inicio…</div></section>';
    try {
      await load();
      render();
    } catch (error) {
      if (view) view.innerHTML = `<section class="admin-section"><div class="admin-empty">No se pudo cargar este control: ${esc(error?.message || "Error desconocido.")}</div></section>`;
    } finally {
      opening = false;
    }
  }

  async function save() {
    const rows = [...document.querySelectorAll("[data-home-category]")];
    if (!rows.length) return;
    const button = document.getElementById("jhdSaveHomeSection");
    if (button) button.disabled = true;
    setStatus("Guardando cambios…");
    try {
      const writes = rows.map((row) => {
        const id = String(row.dataset.homeCategory || "");
        const category = currentCategories.find((item) => String(item.id) === id);
        if (!category) return Promise.resolve({ error: null });
        const visible = Boolean(row.querySelector("[data-home-visible]")?.checked);
        const order = Math.max(0, Number(row.querySelector("[data-home-order]")?.value || 0));
        const { text } = splitMeta(category.description);
        const description = packMeta(text, { visible, order });
        return db.from("categories").update({ description }).eq("id", category.id);
      });
      const results = await Promise.all(writes);
      const error = results.find((result) => result.error)?.error;
      if (error) throw error;
      await load();
      render();
      setStatus("Cambios guardados. Recarga Inicio para verlos.");
    } catch (error) {
      setStatus(`No se pudieron guardar los cambios: ${error?.message || "Error desconocido."}`, true);
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function reset() {
    const rows = [...document.querySelectorAll("[data-home-category]")];
    const button = document.getElementById("jhdResetHomeSection");
    if (button) button.disabled = true;
    setStatus("Restableciendo…");
    try {
      const writes = rows.map((row) => {
        const id = String(row.dataset.homeCategory || "");
        const category = currentCategories.find((item) => String(item.id) === id);
        if (!category) return Promise.resolve({ error: null });
        const { text } = splitMeta(category.description);
        return db.from("categories").update({ description: packMeta(text, { visible: true, order: Number(category.sort_order || 0) }) }).eq("id", category.id);
      });
      const results = await Promise.all(writes);
      const error = results.find((result) => result.error)?.error;
      if (error) throw error;
      await load();
      render();
      setStatus("Orden restablecido según las categorías.");
    } catch (error) {
      setStatus(`No se pudo restablecer: ${error?.message || "Error desconocido."}`, true);
    } finally {
      if (button) button.disabled = false;
    }
  }

  function sanitizeCategoryAdmin() {
    const form = document.getElementById("categoryAdminForm");
    const field = form?.querySelector("textarea[name='description']");
    if (!field || field.dataset.jhdHomeNormalized === "true") return;
    const { text, meta } = splitMeta(field.value);
    if (!Object.keys(meta).length) return;
    field.value = text;
    field.dataset.jhdHomeNormalized = "true";
    field.dataset.jhdHomeMeta = JSON.stringify(meta);
  }

  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (form?.id !== "categoryAdminForm") return;
    const field = form.querySelector("textarea[name='description']");
    if (!field) return;
    let meta = {};
    try { meta = JSON.parse(field.dataset.jhdHomeMeta || "{}"); } catch (_) {}
    if (!Object.keys(meta).length) {
      const parsed = splitMeta(field.value);
      meta = parsed.meta;
      if (!Object.keys(meta).length) return;
    }
    field.value = packMeta(field.value, meta);
  }, true);

  function cleanAdminMarkers() {
    sanitizeCategoryAdmin();
    document.querySelectorAll(".admin-list-item p").forEach((node) => {
      if (!node.textContent.includes("<!--JHD_HOME_ACCESS:")) return;
      node.textContent = node.textContent.replace(META_PATTERN, "").replace(/\s+·\s*$/, "").trim();
    });
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

  const observer = new MutationObserver(() => {
    install();
    cleanAdminMarkers();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { install(); cleanAdminMarkers(); }, { once: true });
  else { install(); cleanAdminMarkers(); }
})();