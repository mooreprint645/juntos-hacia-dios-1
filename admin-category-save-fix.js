(() => {
  if (window.__jhdCategorySave) return;
  window.__jhdCategorySave = true;

  const normalizeType = (value) => {
    const type = String(value || "").trim().toLowerCase();
    return type === "catolico" || type === "cristiano" ? type : "";
  };

  const parentLabel = (parentId) => {
    if (!parentId) return "Todas";
    const row = (AP.categories || []).find((category) => String(category.id) === String(parentId));
    return row?.name || "esta carpeta";
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
      AP.edits.category = duplicate.id;
      AP.filters.categories = duplicate.name || name;
      if (typeof apRenderView === "function") apRenderView();
      return apNote(`“${duplicate.name}” ya existe dentro de ${parentLabel(payload.parent_id)}. Se abrió para editarla.`, true);
    }

    const result = editingId
      ? await AdminPro.from("categories").update(payload).eq("id", editingId)
      : await AdminPro.from("categories").insert([payload]);

    if (result.error) {
      if (String(result.error.message || "").includes("categories_slug_parent_type_unique")) {
        return apNote("Ya existe una categoría con ese nombre dentro de esta carpeta y tipo. Usa la búsqueda para editarla.", true);
      }
      return apNote(`Error: ${result.error.message}`, true);
    }

    AP.edits.category = null;
    AP.categoryNewParent = null;
    await apRefresh(editingId ? "Categoría actualizada." : "Categoría guardada.");
  }, true);
})();
