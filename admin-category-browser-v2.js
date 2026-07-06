(() => {
  const originalSave = apSaveCategory;
  const originalDelete = apDeleteCategory;
  const idOf = (value) => apId(value);
  const normType = (value) => {
    const type = apNorm(value || "");
    return type === "catolico" || type === "cristiano" || type === "mixto" ? type : "general";
  };
  const typeName = (type) => ({ all: "Todas", catolico: "Católico", cristiano: "Cristiano", mixto: "Mixto", general: "General" }[type] || "General");

  AP.categoryBrowser = AP.categoryBrowser || {};
  if (!["all", "catolico", "cristiano", "mixto", "general"].includes(AP.categoryBrowser.type)) AP.categoryBrowser.type = "all";
  AP.categoryBrowser.parentId = AP.categoryBrowser.parentId || null;
  AP.categoryBrowser.limit = AP.categoryBrowser.limit || 8;
  AP.categoryBrowser.orderDirty = Boolean(AP.categoryBrowser.orderDirty);

  const style = document.createElement("style");
  style.id = "adminCategoryBrowserV2Style";
  style.textContent = `.admin-category-browser{display:grid;gap:12px}.admin-category-browser-top{display:flex;gap:9px;align-items:center;flex-wrap:wrap}.admin-category-type-tabs{display:flex;gap:7px;overflow:auto;flex:1;min-width:0;padding:2px}.admin-category-type-tab{border:1px solid var(--border);border-radius:999px;background:var(--card-soft);color:var(--muted);padding:9px 12px;font:inherit;font-weight:800;white-space:nowrap;cursor:pointer}.admin-category-type-tab.active{background:var(--gold);border-color:var(--gold);color:#171717}.admin-category-path{display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:10px 11px;border:1px solid var(--border);border-radius:14px;background:var(--card-soft);font-size:.88rem;color:var(--muted)}.admin-category-path button{border:0;background:transparent;color:var(--gold);font:inherit;font-weight:800;padding:0;cursor:pointer}.admin-category-current{padding:13px;border:1px solid rgba(246,196,83,.35);border-radius:16px;background:rgba(246,196,83,.07)}.admin-category-current h3,.admin-category-current p{margin:0}.admin-category-current h3{color:var(--gold);margin-bottom:5px}.admin-category-current p{color:var(--muted);font-size:.9rem}.admin-category-folder-grid{display:grid;gap:10px}.admin-category-folder-card{padding:14px;border:1px solid var(--border);border-radius:17px;background:var(--card-soft)}.admin-category-folder-card h4,.admin-category-folder-card p{margin:0}.admin-category-folder-card h4{margin-bottom:5px}.admin-category-folder-card p{font-size:.9rem;color:var(--muted);line-height:1.45}.admin-category-folder-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:11px}.admin-category-folder-actions .song-btn{padding:8px 11px;font-size:.84rem}.admin-category-order-note{font-size:.88rem;color:var(--gold);font-weight:800;margin:0}.admin-category-form-location{padding:11px;border:1px dashed var(--border);border-radius:13px;background:var(--card-soft);color:var(--muted);font-size:.9rem}.admin-category-form-location strong{color:var(--gold)}@media(max-width:620px){.admin-category-browser-top{align-items:stretch}.admin-category-type-tabs{flex-basis:100%}.admin-category-browser-top>.song-btn{width:100%}.admin-category-folder-actions{display:grid;grid-template-columns:1fr 1fr}.admin-category-folder-actions .song-btn{width:100%}}`;
  if (!document.getElementById(style.id)) document.head.append(style);

  const state = () => AP.categoryBrowser;
  const byId = (id) => AP.categories.find((row) => idOf(row.id) === idOf(id));
  const isRoot = (row) => !row?.parent_id;
  const sorted = (rows) => [...rows].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.name || "").localeCompare(String(b.name || ""), "es"));
  const directChildren = (parentId) => sorted(AP.categories.filter((row) => idOf(row.parent_id) === idOf(parentId)));
  const descendantsCount = (id) => AP.categories.filter((row) => idOf(row.parent_id) === idOf(id)).length;
  function pathTo(id) {
    const path = [];
    const seen = new Set();
    let current = byId(id);
    while (current && !seen.has(idOf(current.id))) {
      seen.add(idOf(current.id));
      path.unshift(current);
      current = byId(current.parent_id);
    }
    return path;
  }
  function rootsForActiveType() {
    const active = state().type;
    const roots = AP.categories.filter(isRoot);
    return sorted(active === "all" ? roots : roots.filter((row) => normType(row.song_type) === active));
  }
  function visibleRows() {
    return state().parentId ? directChildren(state().parentId) : rootsForActiveType();
  }
  function setView(type, parentId = null) {
    state().type = type || "all";
    state().parentId = parentId || null;
    state().limit = 8;
    state().orderDirty = false;
  }
  function placeName(parentId) {
    const path = pathTo(parentId);
    if (path.length) return path.map((row) => row.name || "Categoría").join(" › ");
    return typeName(state().type);
  }
  function parentType(parentId) {
    const parent = byId(parentId);
    return parent ? String(parent.song_type || "") : (state().type === "all" || state().type === "general" ? "" : state().type);
  }

  function formHTML() {
    const editing = AP.categories.find((row) => idOf(row.id) === idOf(AP.edits.category));
    const source = editing || {};
    const defaultParent = editing ? source.parent_id || "" : AP.categoryNewParent ?? state().parentId ?? "";
    const defaultType = editing ? String(source.song_type || "") : parentType(defaultParent);
    const siblingTotal = directChildren(defaultParent).length;
    const sort = editing ? Number(source.sort_order || 0) : (siblingTotal + 1) * 10;
    const blocked = new Set();
    if (editing) {
      blocked.add(idOf(editing.id));
      let changed = true;
      while (changed) {
        changed = false;
        AP.categories.forEach((row) => {
          if (blocked.has(idOf(row.parent_id)) && !blocked.has(idOf(row.id))) { blocked.add(idOf(row.id)); changed = true; }
        });
      }
    }
    const parents = apFlatCategories().filter((row) => !blocked.has(idOf(row.id)));
    const selectedParent = apOptions(parents, "id", (row) => apCategoryPath(row)).replace(`value=\"${apEsc(defaultParent)}\"`, `value=\"${apEsc(defaultParent)}\" selected`);
    const types = `<option value="" ${normType(defaultType) === "general" ? "selected" : ""}>General</option><option value="catolico" ${normType(defaultType) === "catolico" ? "selected" : ""}>Católico</option><option value="cristiano" ${normType(defaultType) === "cristiano" ? "selected" : ""}>Cristiano</option><option value="mixto" ${normType(defaultType) === "mixto" ? "selected" : ""}>Mixto</option>`;
    const fixed = !editing;
    return `<div class="admin-card"><div class="admin-editor-head"><h3>${editing ? "Editar categoría" : "Agregar categoría"}</h3>${editing ? `<button class="song-btn small-btn secondary" type="button" data-cat2-cancel>Cancelar</button>` : ""}</div><form class="admin-form" id="categoryAdminForm"><label>Nombre<input name="name" required value="${apEsc(source.name || "")}" placeholder="Ejemplo: Adviento, María, Alabanza"></label>${fixed ? `<input type="hidden" name="parent_id" value="${apEsc(defaultParent)}"><input type="hidden" name="song_type" value="${apEsc(defaultType)}"><div class="admin-category-form-location">Se agregará dentro de: <strong>${apEsc(placeName(defaultParent))}</strong></div>` : `<div class="admin-form-grid"><label>Tipo<select name="song_type">${types}</select></label><label>Dentro de<select name="parent_id"><option value="">Categoría principal</option>${selectedParent}</select></label></div>`}<label>Orden<input name="sort_order" type="number" min="0" value="${apEsc(sort)}"></label><label>Descripción<textarea name="description" rows="4" placeholder="Breve descripción">${apEsc(source.description || "")}</textarea></label><button class="song-btn" type="submit">${editing ? "Guardar cambios" : "Guardar categoría"}</button></form></div>`;
  }

  function browserHTML() {
    const active = state().type;
    const current = byId(state().parentId);
    const path = pathTo(state().parentId);
    const allRows = visibleRows();
    const rows = allRows.slice(0, state().limit);
    const tabs = [["all", "Todas"], ["catolico", "Católico"], ["cristiano", "Cristiano"], ["general", "General"]];
    const crumbs = path.length ? `<button type="button" data-cat2-home>Inicio</button>${path.map((row) => `<span>›</span><button type="button" data-cat2-crumb="${apEsc(row.id)}">${apEsc(row.name || "Categoría")}</button>`).join("")}` : `<span>Ruta: <strong>${apEsc(typeName(active))}</strong></span>`;
    return `<div class="admin-category-browser"><div class="admin-category-browser-top"><div class="admin-category-type-tabs">${tabs.map(([key, label]) => `<button type="button" class="admin-category-type-tab ${active === key ? "active" : ""}" data-cat2-type="${key}">${label}</button>`).join("")}</div><button class="song-btn small-btn" type="button" data-cat2-add>+ Agregar aquí</button></div><input class="admin-filter-input" id="categoryFolderSearch" type="search" placeholder="Buscar en esta carpeta"><div class="admin-category-path">${crumbs}</div>${current ? `<div class="admin-category-current"><h3>📁 ${apEsc(current.name || "Categoría")}</h3><p>${apEsc(typeName(normType(current.song_type)))} · Orden ${apEsc(current.sort_order || 0)}${current.description ? ` · ${apEsc(current.description)}` : ""}</p><div class="admin-category-folder-actions"><button class="song-btn small-btn" type="button" data-cat2-edit="${apEsc(current.id)}">Editar esta categoría</button><button class="song-btn small-btn secondary" type="button" data-cat2-delete="${apEsc(current.id)}">Eliminar esta categoría</button></div></div>` : ""}${rows.length ? `<div class="admin-category-folder-grid">${rows.map((row, index) => `<article class="admin-category-folder-card" data-category-folder><h4>📁 ${apEsc(row.name || "Categoría")}</h4><p>${apEsc(typeName(normType(row.song_type)))} · Orden ${apEsc(row.sort_order || 0)}</p>${row.description ? `<p>${apEsc(row.description)}</p>` : ""}<p>${descendantsCount(row.id)} subcategoría(s)</p><div class="admin-category-folder-actions"><button class="song-btn small-btn" type="button" data-cat2-move="${apEsc(row.id)}" data-dir="-1" ${index === 0 ? "disabled" : ""}>↑ Subir</button><button class="song-btn small-btn" type="button" data-cat2-move="${apEsc(row.id)}" data-dir="1" ${index === allRows.length - 1 ? "disabled" : ""}>↓ Bajar</button><button class="song-btn small-btn" type="button" data-cat2-open="${apEsc(row.id)}">Abrir</button><button class="song-btn small-btn" type="button" data-cat2-edit="${apEsc(row.id)}">Editar</button><button class="song-btn small-btn secondary" type="button" data-cat2-delete="${apEsc(row.id)}">Eliminar</button></div></article>`).join("")}</div><div id="categoryFolderSearchEmpty" class="admin-empty" hidden>No hay carpetas que coincidan.</div>${allRows.length > state().limit ? `<button class="song-btn secondary" type="button" data-cat2-more>Ver más categorías</button>` : ""}<div class="admin-actions"><button class="song-btn small-btn" type="button" data-cat2-save-order>Guardar orden</button>${state().orderDirty ? `<p class="admin-category-order-note">Orden cambiado. Toca Guardar orden.</p>` : ""}</div>` : `<div class="admin-empty"><p>No hay carpetas en esta vista.</p><button class="song-btn small-btn" type="button" data-cat2-add>+ Agregar primera carpeta aquí</button></div>`}</div>`;
  }

  function filterVisible() {
    const q = apNorm(document.getElementById("categoryFolderSearch")?.value || "");
    const cards = [...document.querySelectorAll("[data-category-folder]")];
    let count = 0;
    cards.forEach((card) => { const show = !q || apNorm(card.textContent || "").includes(q); card.hidden = !show; if (show) count += 1; });
    const empty = document.getElementById("categoryFolderSearchEmpty");
    if (empty) empty.hidden = count > 0;
  }
  function showNew() {
    AP.edits.category = null;
    AP.categoryNewParent = state().parentId || "";
    AP.visualForms = AP.visualForms || {};
    AP.visualForms.categories = true;
    apRenderView();
    requestAnimationFrame(() => document.querySelector("#categoryAdminForm input[name='name']")?.focus({ preventScroll: true }));
  }
  function openFolder(id) {
    const row = byId(id);
    if (!row) return;
    setView(state().type, row.id);
    AP.edits.category = null;
    apRenderView();
  }
  function editFolder(id) {
    const row = byId(id);
    if (!row) return;
    AP.edits.category = id;
    setView(state().type, row.parent_id || null);
    AP.visualForms = AP.visualForms || {};
    AP.visualForms.categories = true;
    apRenderView();
    requestAnimationFrame(() => document.querySelector("#categoryAdminForm input[name='name']")?.focus({ preventScroll: true }));
  }
  function moveFolder(id, direction) {
    const rows = visibleRows();
    const index = rows.findIndex((row) => idOf(row.id) === idOf(id));
    const next = index + Number(direction || 0);
    if (index < 0 || next < 0 || next >= rows.length) return;
    const a = rows[index], b = rows[next], tmp = a.sort_order;
    a.sort_order = b.sort_order;
    b.sort_order = tmp;
    state().orderDirty = true;
    apRenderView();
  }
  async function saveOrder() {
    const rows = visibleRows();
    if (!rows.length) return;
    apNote("Guardando orden...");
    for (let index = 0; index < rows.length; index += 1) {
      const newOrder = (index + 1) * 10;
      const { error } = await AdminPro.from("categories").update({ sort_order: newOrder }).eq("id", rows[index].id);
      if (error) { apNote(`Error guardando orden: ${error.message}`, true); return; }
      rows[index].sort_order = newOrder;
    }
    state().orderDirty = false;
    await apRefresh("Orden guardado correctamente.");
  }

  apCategoriesHTML = function () {
    return `<section class="admin-section">${apSectionHead("Categorías", "Categorías y carpetas", `${AP.categories.length} registradas`)}<div class="admin-layout">${formHTML()}<div>${browserHTML()}</div></div></section>`;
  };
  apBindCategories = function () {
    document.querySelector("#categoryAdminForm")?.addEventListener("submit", async (event) => { event.preventDefault(); await originalSave(event); AP.categoryNewParent = null; });
    document.querySelector("[data-cat2-cancel]")?.addEventListener("click", () => { AP.edits.category = null; AP.categoryNewParent = null; apRenderView(); });
    document.querySelectorAll("[data-cat2-type]").forEach((button) => button.addEventListener("click", () => { setView(button.dataset.cat2Type || "all", null); AP.edits.category = null; apRenderView(); }));
    document.querySelectorAll("[data-cat2-add]").forEach((button) => button.addEventListener("click", showNew));
    document.querySelector("[data-cat2-home]")?.addEventListener("click", () => { setView(state().type, null); apRenderView(); });
    document.querySelectorAll("[data-cat2-crumb]").forEach((button) => button.addEventListener("click", () => { setView(state().type, button.dataset.cat2Crumb); apRenderView(); }));
    document.querySelectorAll("[data-cat2-open]").forEach((button) => button.addEventListener("click", () => openFolder(button.dataset.cat2Open)));
    document.querySelectorAll("[data-cat2-edit]").forEach((button) => button.addEventListener("click", () => editFolder(button.dataset.cat2Edit)));
    document.querySelectorAll("[data-cat2-delete]").forEach((button) => button.addEventListener("click", async () => { const id = button.dataset.cat2Delete; const row = byId(id); if (idOf(state().parentId) === idOf(id)) state().parentId = row?.parent_id || null; await originalDelete(id); }));
    document.querySelectorAll("[data-cat2-move]").forEach((button) => button.addEventListener("click", () => moveFolder(button.dataset.cat2Move, button.dataset.dir)));
    document.querySelector("[data-cat2-save-order]")?.addEventListener("click", saveOrder);
    document.querySelector("[data-cat2-more]")?.addEventListener("click", () => { state().limit += 8; apRenderView(); });
    document.querySelector("#categoryFolderSearch")?.addEventListener("input", filterVisible);
  };
})();
