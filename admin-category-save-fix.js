(() => {
  if (!window.__jhdCategorySaveFixLoaded) {
    window.__jhdCategorySaveFixLoaded = true;

    function categoryType(value) {
      const type = String(value || "").trim().toLowerCase();
      return type === "catolico" || type === "cristiano" ? type : "";
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
        song_type: categoryType(data.song_type),
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
  }

  if (!window.__jhdSongCategorySearchLoader) {
    window.__jhdSongCategorySearchLoader = true;
    const script = document.createElement("script");
    script.src = "admin-song-category-search.js?v=1";
    document.head.append(script);
  }
})();
