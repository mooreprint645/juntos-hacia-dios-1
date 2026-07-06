(() => {
  if (window.__jhdCategorySaveFixLoaded) return;
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
    if (!name) return apNote("Escribe el nombre de la categoría.", true);

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

    if (result.error) return apNote(`Error: ${result.error.message}`, true);
    AP.edits.category = null;
    AP.categoryNewParent = null;
    await apRefresh(editingId ? "Categoría actualizada." : "Categoría guardada.");
  }, true);

  const loadScript = (source, marker, done) => {
    if (document.querySelector(`script[${marker}]`)) return done?.();
    const script = document.createElement("script");
    script.setAttribute(marker, "true");
    script.src = source;
    script.onload = () => done?.();
    document.head.append(script);
  };

  const loadAdminEnhancements = () => {
    loadScript("admin-song-category-search.js?v=2", "data-song-category-search", () => {
      loadScript("admin-song-category-picker.js?v=1", "data-song-category-picker", () => {
        loadScript("admin-song-category-picker-layout.js?v=1", "data-song-category-picker-layout");
      });
    });
    loadScript("admin-history.js?v=1", "data-admin-history");
  };

  if (document.readyState === "complete") loadAdminEnhancements();
  else window.addEventListener("load", loadAdminEnhancements, { once: true });
})();
