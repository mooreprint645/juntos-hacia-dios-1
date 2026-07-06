(() => {
  const css = document.createElement("style");
  css.textContent = `.song-cat-native{display:none!important}.song-cat-search{display:grid;gap:8px;margin-top:7px}.song-cat-current{font-size:.86rem;color:var(--muted);padding:9px 10px;border:1px solid var(--border);border-radius:12px;background:var(--card-soft)}.song-cat-current strong{color:var(--gold)}.song-cat-results{display:grid;gap:7px;max-height:230px;overflow:auto}.song-cat-result{width:100%;text-align:left;border:1px solid var(--border);border-radius:12px;background:var(--card-soft);color:var(--text);padding:10px;font:inherit;cursor:pointer}.song-cat-result strong{display:block}.song-cat-result small{display:block;margin-top:3px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.song-cat-help{font-size:.83rem;color:var(--muted);padding:4px 0}`;
  document.head.append(css);

  const id = (value) => String(value || "");
  const path = (categoryId) => {
    const parts = [];
    const seen = new Set();
    let row = (AP.categories || []).find((item) => id(item.id) === id(categoryId));
    while (row && !seen.has(id(row.id))) {
      seen.add(id(row.id));
      parts.unshift(row.name || "Categoría");
      row = (AP.categories || []).find((item) => id(item.id) === id(row.parent_id));
    }
    return parts.join(" › ");
  };

  function enhance() {
    const select = document.querySelector("#songAdminForm select[name='category_id']");
    if (!select || select.dataset.songCatSearch) return;
    select.dataset.songCatSearch = "yes";
    select.classList.add("song-cat-native");

    const box = document.createElement("div");
    box.className = "song-cat-search";
    box.innerHTML = `<input class="admin-filter-input" type="search" placeholder="Buscar categoría por nombre o ruta"><div class="song-cat-current"></div><div class="song-cat-results"></div>`;
    select.parentElement.append(box);

    const input = box.querySelector("input");
    const current = box.querySelector(".song-cat-current");
    const results = box.querySelector(".song-cat-results");
    const refreshCurrent = () => {
      const value = select.value;
      current.innerHTML = value ? `Elegida: <strong>${apEsc(path(value))}</strong>` : "Sin categoría elegida.";
    };
    const show = () => {
      const query = apNorm(input.value || "");
      if (!query) {
        results.innerHTML = `<p class="song-cat-help">Escribe para buscar entre todas las carpetas y subcarpetas.</p>`;
        return;
      }
      const rows = (AP.categories || []).filter((row) => apNorm(`${row.name || ""} ${row.description || ""} ${path(row.id)}`).includes(query)).slice(0, 30);
      results.innerHTML = rows.length ? rows.map((row) => `<button type="button" class="song-cat-result" data-song-cat-id="${apEsc(row.id)}"><strong>📁 ${apEsc(row.name || "Categoría")}</strong><small>${apEsc(path(row.id))}</small></button>`).join("") : `<p class="song-cat-help">No se encontraron categorías.</p>`;
      results.querySelectorAll("[data-song-cat-id]").forEach((button) => button.addEventListener("click", () => {
        const value = button.dataset.songCatId || "";
        select.value = value;
        if (typeof apCaptureSongDraft === "function") apCaptureSongDraft();
        if (AP.draft) AP.draft.category_id = value;
        input.value = "";
        refreshCurrent();
        show();
      }));
    };
    input.addEventListener("input", show);
    refreshCurrent();
    show();
  }

  const previous = apRenderView;
  apRenderView = function (...args) {
    previous.apply(this, args);
    enhance();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", enhance); else enhance();
})();
