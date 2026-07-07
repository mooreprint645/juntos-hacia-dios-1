(() => {
  if (window.__jhdCategorySave) return;
  window.__jhdCategorySave = true;

  const normalizeType = (value) => {
    const type = String(value || "").trim().toLowerCase();
    return type === "catolico" || type === "cristiano" ? type : "";
  };

  const browserType = (value) => {
    const type = normalizeType(value);
    return type || "general";
  };

  const parentLabel = (parentId) => {
    if (!parentId) return "Todas";
    const row = (AP.categories || []).find((category) => String(category.id) === String(parentId));
    return row?.name || "esta carpeta";
  };

  const openDuplicate = (category) => {
    AP.edits.category = category.id;
    AP.filters.categories = category.name || "";
    AP.visualForms = AP.visualForms || {};
    AP.visualForms.categories = true;

    if (AP.categoryBrowser) {
      AP.categoryBrowser.type = browserType(category.song_type);
      AP.categoryBrowser.parentId = category.parent_id || null;
      AP.categoryBrowser.limit = 999999;
      AP.categoryBrowser.orderDirty = false;
    }

    if (typeof apRenderView === "function") apRenderView();
    requestAnimationFrame(() => {
      document.querySelector("#categoryAdminForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
      document.querySelector('#categoryAdminForm input[name="name"]')?.focus({ preventScroll: true });
    });
  };

  document.addEventListener("submit", async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== "categoryAdminForm") return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const data = Object.fromEntries(new FormData(form).entries());
    const name = String(data.name || "").trim();
    if (!name) return apNote("Escribe el nombre de la categoría.", true);

    const payload = {
      name,
      slug: apSlug(name),
      song_type: normalizeType(data.song_type),
      parent_id: String(data.parent_id || "").trim() || null,
      sort_order: Number(data.sort_order || 0),
      description: String(data.description || "").trim() || null
    };

    const editingId = AP.edits?.category || null;
    const duplicate = (AP.categories || []).find((category) =>
      String(category.id) !== String(editingId || "") &&
      String(category.slug || "") === payload.slug &&
      String(category.parent_id || "") === String(payload.parent_id || "") &&
      normalizeType(category.song_type) === payload.song_type
    );

    if (duplicate) {
      openDuplicate(duplicate);
      return apNote(`“${duplicate.name}” ya existe dentro de ${parentLabel(payload.parent_id)}. Se abrió para editarla.`, true);
    }

    const result = editingId
      ? await AdminPro.from("categories").update(payload).eq("id", editingId)
      : await AdminPro.from("categories").insert([payload]);

    if (result.error) {
      if (String(result.error.message || "").includes("categories_slug_parent_type_unique")) {
        const existing = (AP.categories || []).find((category) =>
          String(category.slug || "") === payload.slug &&
          String(category.parent_id || "") === String(payload.parent_id || "") &&
          normalizeType(category.song_type) === payload.song_type
        );
        if (existing) openDuplicate(existing);
        return apNote("Ya existe una categoría con ese nombre dentro de esta carpeta y tipo. Se abrió para editarla.", true);
      }
      return apNote(`Error: ${result.error.message}`, true);
    }

    AP.edits.category = null;
    AP.categoryNewParent = null;
    await apRefresh(editingId ? "Categoría actualizada." : "Categoría guardada.");
  }, true);
})();

(() => {
  if (window.__jhdAdminBackupLoader) return;
  window.__jhdAdminBackupLoader = true;
  const script = document.createElement("script");
  script.src = "admin-backup.js?v=1";
  script.defer = true;
  document.head.append(script);
})();
