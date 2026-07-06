(() => {
  if (window.__jhdCategorySaveFixLoaded) return;
  window.__jhdCategorySaveFixLoaded = true;

  function normalizeType(value) {
    const type = String(value || "").trim().toLowerCase();
    if (type === "catolico" || type === "cristiano" || type === "mixto" || type === "general") return type;
    return "general";
  }

  document.addEventListener("submit", async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== "categoryAdminForm") return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const data = Object.fromEntries(new FormData(form).entries());
    const name = String(data.name || "").trim();
    if (!name) {
      apNote("Escribe el nombre de la categoría.", true);
      return;
    }

    const payload = {
      name,
      slug: apSlug(name),
      song_type: normalizeType(data.song_type),
      parent_id: String(data.parent_id || "").trim() || null,
      sort_order: Number(data.sort_order || 0),
      description: String(data.description || "").trim() || null
    };

    const editingId = AP.edits?.category || null;
    const result = editingId
      ? await AdminPro.from("categories").update(payload).eq("id", editingId)
      : await AdminPro.from("categories").insert([payload]);

    if (result.error) {
      apNote(`Error: ${result.error.message}`, true);
      return;
    }

    AP.edits.category = null;
    AP.categoryNewParent = null;
    await apRefresh(editingId ? "Categoría actualizada." : "Categoría guardada.");
  }, true);
})();
