(() => {
  if (window.__jhdCategorySave) return;
  window.__jhdCategorySave = true;

  const normalizeType = (value) => {
    const type = String(value || "").trim().toLowerCase();
    return type === "catolico" || type === "cristiano" ? type : "";
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
    const result = editingId
      ? await AdminPro.from("categories").update(payload).eq("id", editingId)
      : await AdminPro.from("categories").insert([payload]);

    if (result.error) return apNote(`Error: ${result.error.message}`, true);

    AP.edits.category = null;
    AP.categoryNewParent = null;
    await apRefresh(editingId ? "Categoría actualizada." : "Categoría guardada.");
  }, true);
})();
