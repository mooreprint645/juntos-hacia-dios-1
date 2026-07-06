(() => {
  const originalSaveCategory = apSaveCategory;
  const originalDeleteCategory = apDeleteCategory;

  AP.categoryBrowser = AP.categoryBrowser || { type: "", parentId: null, limit: 8, query: "", orderDirty: false };

  const catStyle = document.createElement("style");
  catStyle.id = "adminCategoryBrowserStyle";
  catStyle.textContent = `
    .admin-category-browser{display:grid;gap:12px}
    .admin-category-browser-top{display:flex;gap:9px;align-items:center;flex-wrap:wrap}
    .admin-category-type-tabs{display:flex;gap:7px;overflow:auto;flex:1;min-width:0;padding:2px}
    .admin-category-type-tab{border:1px solid var(--border);border-radius:999px;background:var(--card-soft);color:var(--muted);padding:9px 12px;font:inherit;font-weight:800;white-space:nowrap;cursor:pointer}
    .admin-category-type-tab.active{background:var(--gold);border-color:var(--gold);color:#171717}
    .admin-category-path{display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:10px 11px;border:1px solid var(--border);border-radius:14px;background:var(--card-soft);font-size:.88rem;color:var(--muted)}
    .admin-category-path button{border:0;background:transparent;color:var(--gold);font:inherit;font-weight:800;padding:0;cursor:pointer}
    .admin-category-current{padding:13px;border:1px solid rgba(246,196,83,.35);border-radius:16px;background:rgba(246,196,83,.07)}
    .admin-category-current h3,.admin-category-current p{margin:0}.admin-category-current h3{color:var(--gold);margin-bottom:5px}.admin-category-current p{color:var(--muted);font-size:.9rem}
    .admin-category-folder-grid{display:grid;gap:10px}
    .admin-category-folder-card{padding:14px;border:1px solid var(--border);border-radius:17px;background:var(--card-soft)}
    .admin-category-folder-card h4,.admin-category-folder-card p{margin:0}.admin-category-folder-card h4{margin-bottom:5px}.admin-category-folder-card p{font-size:.9rem;color:var(--muted);line-height:1.45}
    .admin-category-folder-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:11px}.admin-category-folder-actions .song-btn{padding:8px 11px;font-size:.84rem}
    .admin-category-order-note{font-size:.88rem;color:var(--gold);font-weight:800;margin:0}
    .admin-category-form-location{padding:11px;border:1px dashed var(--border);border-radius:13px;background:var(--card-soft);color:var(--muted);font-size:.9rem}.admin-category-form-location strong{color:var(--gold)}
    @media(max-width:620px){.admin-category-browser-top{align-items:stretch}.admin-category-type-tabs{flex-basis:100%}.admin-category-browser-top>.song-btn{width:100%}.admin-category-folder-actions{display:grid;grid-template-columns:1fr 1fr}.admin-category-folder-actions .song-btn{width:100%}}
  `;
  if (!document.getElementById(catStyle.id)) document.head.append(catStyle);

  const catTypeName = (type) => ({ catolico: "Católico", cristiano: "Cristiano", "": "General" }[apNorm(type)] || "General");
  const catId = (value) => apId(value);
  const browser = () => AP.categoryBrowser;
  const categoryById = (id) => AP.categories.find((row) => catId(row.id) === catId(id));
  const categoryType = (row) => apNorm(row?.song_type || "");

  function categoryPath(id) {
    const path = [];
    let current = categoryById(id);
    const seen = new Set();
    while (current && !seen.has(catId(current.id))) {
      seen.add(catId(current.id));
      path.unshift(current);
      current = categoryById(current.parent_id);
    }
    return path;
  }
  function childrenOf(parentId) {
    const state = browser();
    let rows = AP.categories.filter((row) => catId(row.parent_id) === catId(parentId));
    if (!parentId) rows = rows.filter((row) => categoryType(row) === categoryType(state.type));
    return rows.sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.name || "").localeCompare(String(b.name || ""), "es"));
  }
  function childCount(id) { return AP.categories.filter((row) => catId(row.parent_id) === catId(id)).length; }
  function folderLabel(parentId) {
    const state = browser();
    const path = categoryPath(parentId);
    return path.length ? `${catTypeName(path[0].song_type)} › ${path.map((row) => row.name || "Categoría").join(" › ")}` : catTypeName(state.type);
  }
  function setBrowser(type, parentId) {
    const state = browser();
    state.type = type ?? state.type;
    state.parentId = parentId || null;
    state.limit = 8;
    state.query = "";
    state.orderDirty = false;
  }
  function openNewHere() {
    AP.edits.category = null;
    AP.categoryNewParent = browser().parentId || "";
    AP.visualForms = AP.visualForms || {};
    AP.visualForms.categories = true;
    apRenderView();
    requestAnimationFrame(() => document.querySelector("#categoryAdminForm input[name='name']")?.focus({ preventScroll: true }));
  }
  function filterFolderList() {
    const input = document.getElementById("categoryFolderSearch");
    const query = apNorm(input?.value || "");
    const cards = [...document.querySelectorAll("[data-category-folder]")];
    let shown = 0;
    cards.forEach((card) => {
      const match = !query || apNorm(card.textContent || "").includes(query);
      card.hidden = !match;
      if (match) shown += 1;
    });
    const empty = document.getElementById("categoryFolderSearchEmpty");
    if (empty) empty.hidden = shown > 0;
  }

  function categoryFormHTML() {
    const current = categoryById(browser().parentId);
    const editing = AP.categories.find((row) => catId(row.id) === catId(AP.edits.category));
    const source = editing || {};
    const defaultParent = editing ? source.parent_id || "" : AP.categoryNewParent ?? browser().parentId ?? "";
    const defaultType = editing ? source.song_type || "" : current?.song_type || browser().type || "";
    const siblingCount = childrenOf(defaultParent).length;
    const sort = editing ? Number(source.sort_order || 0) : (siblingCount + 1) * 10;
    const descendants = new Set();
    if (editing) {
      descendants.add(catId(editing.id));
      let changed = true;
      while (changed) {
        changed = false;
        AP.categories.forEach((row) => {
          if (descendants.has(catId(row.parent_id)) && !descendants.has(catId(row.id))) { descendants.add(catId(row.id)); changed = true; }
        });
      }
    }
    const parentChoices = apFlatCategories().filter((row) => !descendants.has(catId(row.id)));
    const typeChoices = `<option value="" ${categoryType(defaultType) === "" ? "selected" : ""}>General</option><option value="catolico" ${categoryType(defaultType) === "catolico" ? "selected" : ""}>Católico</option><option value="cristiano" ${categoryType(defaultType) === "cristiano" ? "selected" : ""}>Cristiano</option><option value="mixto" ${categoryType(defaultType) === "mixto" ? "selected" : ""}>Mixto</option>`;
    const fixedLocation = !editing;
    return `<div class="admin-card"><div class="admin-editor-head"><h3>${editing ? "Editar categoría" : "Agregar categoría"}</h3>${editing ? `<button class="song-btn small-btn secondary" data-cat-cancel-edit type="button">Cancelar</button>` : ""}</div><form class="admin-form" id="categoryAdminForm"><label>Nombre<input name="name" required value="${apEsc(source.name || "")}" placeholder="Ejemplo: Adviento, María, Alabanza"></label>${fixedLocation ? `<input type="hidden" name="parent_id" value="${apEsc(defaultParent)}"><input type="hidden" name="song_type" value="${apEsc(defaultType)}"><div class="admin-category-form-location">Se agregará dentro de: <strong>${apEsc(folderLabel(defaultParent))}</strong></div>` : `<div class="admin-form-grid"><label>Tipo<select name="song_type">${typeChoices}</select></label><label>Dentro de<select name="parent_id"><option value="">Categoría principal</option>${apOptions(parentChoices, "id", (row) => apCategoryPath(row)).replace(`value=\"${apEsc(defaultParent)}\"`, `value=\"${apEsc(defaultParent)}\" selected`)}</select></label></div>`}<label>Orden<input name="sort_order" type="number" min="0" value="${apEsc(sort)}"></label><label>Descripción<textarea name="description" rows="4" placeholder="Breve descripción">${apEsc(source.description || "")}</textarea></label><button class="song-btn" type="submit">${editing ? "Guardar cambios" : "Guardar categoría"}</button></form></div>`;
  }

  function categoryBrowserHTML() {
    const state = browser();
    const current = categoryById(state.parentId);
    const path = categoryPath(state.parentId);
    const siblings = childrenOf(state.parentId);
    const shown = siblings.slice(0, state.limit);
    const typeTabs = [["catolico", "Católico"], ["cristiano", "Cristiano"], ["", "General"]];
    const breadcrumb = path.length ? `<button type="button" data-cat-home>Inicio</button>${path.map((row) => `<span>›</span><button type="button" data-cat-crumb="${apEsc(row.id)}">${apEsc(row.name || "Categoría")}</button>`).join("")}` : `<span>Ruta: <strong>${apEsc(catTypeName(state.type))}</strong></span>`;
    return `<div class="admin-category-browser"><div class="admin-category-browser-top"><div class="admin-category-type-tabs">${typeTabs.map(([type, name]) => `<button type="button" class="admin-category-type-tab ${categoryType(state.type) === type ? "active" : ""}" data-cat-type="${type}">${name}</button>`).join("")}</div><button class="song-btn small-btn" type="button" data-cat-add>+ Agregar aquí</button></div><input class="admin-filter-input" id="categoryFolderSearch" type="search" placeholder="Buscar en esta carpeta"><div class="admin-category-path">${breadcrumb}</div>${current ? `<div class="admin-category-current"><h3>📁 ${apEsc(current.name || "Categoría")}</h3><p>${apEsc(catTypeName(current.song_type))} · Orden ${apEsc(current.sort_order || 0)}${current.description ? ` · ${apEsc(current.description)}` : ""}</p><div class="admin-category-folder-actions"><button class="song-btn small-btn" type="button" data-cat-edit="${apEsc(current.id)}">Editar esta categoría</button><button class="song-btn small-btn secondary" type="button" data-cat-delete="${apEsc(current.id)}">Eliminar esta categoría</button></div></div>` : ""}${shown.length ? `<div class="admin-category-folder-grid">${shown.map((row, index) => `<article class="admin-category-folder-card" data-category-folder><h4>📁 ${apEsc(row.name || "Categoría")}</h4><p>${apEsc(catTypeName(row.song_type))} · Orden ${apEsc(row.sort_order || 0)}</p>${row.description ? `<p>${apEsc(row.description)}</p>` : ""}<p>${childCount(row.id)} subcategoría(s)</p><div class="admin-category-folder-actions"><button class="song-btn small-btn" type="button" data-cat-move="${apEsc(row.id)}" data-direction="-1" ${index === 0 ? "disabled" : ""}>↑ Subir</button><button class="song-btn small-btn" type="button" data-cat-move="${apEsc(row.id)}" data-direction="1" ${index === siblings.length - 1 ? "disabled" : ""}>↓ Bajar</button><button class="song-btn small-btn" type="button" data-cat-open="${apEsc(row.id)}">Abrir</button><button class="song-btn small-btn" type="button" data-cat-edit="${apEsc(row.id)}">Editar</button><button class="song-btn small-btn secondary" type="button" data-cat-delete="${apEsc(row.id)}">Eliminar</button></div></article>`).join("")}</div><div id="categoryFolderSearchEmpty" class="admin-empty" hidden>No hay categorías que coincidan en esta carpeta.</div>${siblings.length > state.limit ? `<button class="song-btn secondary" type="button" data-cat-more>Ver más categorías</button>` : ""}<div class="admin-actions"><button class="song-btn small-btn" type="button" data-cat-save-order>Guardar orden</button>${state.orderDirty ? `<p class="admin-category-order-note">Orden cambiado. Toca Guardar orden.</p>` : ""}</div>` : `<div class="admin-empty"><p>No hay subcategorías aquí.</p><button class="song-btn small-btn" type="button" data-cat-add>+ Agregar primera categoría aquí</button></div>`}</div>`;
  }

  apCategoriesHTML = function () {
    const state = browser();
    const count = `${AP.categories.length} registradas`;
    return `<section class="admin-section">${apSectionHead("Categorías", "Categorías y carpetas", count)}<div class="admin-layout">${categoryFormHTML()}<div>${categoryBrowserHTML()}</div></div></section>`;
  };

  async function saveOrder() {
    const state = browser();
    const rows = childrenOf(state.parentId);
    if (!rows.length) return;
    apNote("Guardando orden...");
    for (let index = 0; index < rows.length; index += 1) {
      const order = (index + 1) * 10;
      const { error } = await AdminPro.from("categories").update({ sort_order: order }).eq("id", rows[index].id);
      if (error) { apNote(`Error guardando orden: ${error.message}`, true); return; }
      rows[index].sort_order = order;
    }
    state.orderDirty = false;
    await apRefresh("Orden guardado correctamente.");
  }
  function moveOrder(id, direction) {
    const state = browser();
    const rows = childrenOf(state.parentId);
    const index = rows.findIndex((row) => catId(row.id) === catId(id));
    const next = index + Number(direction || 0);
    if (index < 0 || next < 0 || next >= rows.length) return;
    const first = rows[index], second = rows[next];
    const order = first.sort_order;
    first.sort_order = second.sort_order;
    second.sort_order = order;
    state.orderDirty = true;
    apRenderView();
  }
  function openFolder(id) {
    const row = categoryById(id);
    if (!row) return;
    setBrowser(row.song_type || browser().type, row.id);
    AP.edits.category = null;
    apRenderView();
  }
  function editCategoryFromBrowser(id) {
    const row = categoryById(id);
    if (!row) return;
    AP.edits.category = id;
    setBrowser(row.song_type || "", row.parent_id || null);
    AP.visualForms = AP.visualForms || {};
    AP.visualForms.categories = true;
    apRenderView();
    requestAnimationFrame(() => document.querySelector("#categoryAdminForm input[name='name']")?.focus({ preventScroll: true }));
  }
  async function deleteCategoryFromBrowser(id) {
    const row = categoryById(id);
    if (catId(browser().parentId) === catId(id)) browser().parentId = row?.parent_id || null;
    await originalDeleteCategory(id);
  }

  apBindCategories = function () {
    document.querySelector("#categoryAdminForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      await originalSaveCategory(event);
      AP.categoryNewParent = null;
    });
    document.querySelector("[data-cat-cancel-edit]")?.addEventListener("click", () => {
      AP.edits.category = null;
      AP.categoryNewParent = null;
      AP.visualForms = AP.visualForms || {};
      AP.visualForms.categories = false;
      apRenderView();
    });
    document.querySelectorAll("[data-cat-type]").forEach((button) => button.addEventListener("click", () => {
      setBrowser(button.dataset.catType || "", null);
      AP.edits.category = null;
      apRenderView();
    }));
    document.querySelectorAll("[data-cat-add]").forEach((button) => button.addEventListener("click", openNewHere));
    document.querySelector("[data-cat-home]")?.addEventListener("click", () => { setBrowser(browser().type, null); apRenderView(); });
    document.querySelectorAll("[data-cat-crumb]").forEach((button) => button.addEventListener("click", () => { setBrowser(browser().type, button.dataset.catCrumb); apRenderView(); }));
    document.querySelectorAll("[data-cat-open]").forEach((button) => button.addEventListener("click", () => openFolder(button.dataset.catOpen)));
    document.querySelectorAll("[data-cat-edit]").forEach((button) => button.addEventListener("click", () => editCategoryFromBrowser(button.dataset.catEdit)));
    document.querySelectorAll("[data-cat-delete]").forEach((button) => button.addEventListener("click", () => deleteCategoryFromBrowser(button.dataset.catDelete)));
    document.querySelectorAll("[data-cat-move]").forEach((button) => button.addEventListener("click", () => moveOrder(button.dataset.catMove, button.dataset.direction)));
    document.querySelector("[data-cat-save-order]")?.addEventListener("click", saveOrder);
    document.querySelector("[data-cat-more]")?.addEventListener("click", () => { browser().limit += 8; apRenderView(); });
    document.querySelector("#categoryFolderSearch")?.addEventListener("input", filterFolderList);
  };
})();
