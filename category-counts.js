(() => {
  const renderCounts = () => {
    const jhd = window.JHD;
    const categories = jhd?.state?.categories || [];
    const songs = jhd?.state?.songs || [];
    if (!categories.length) return;

    const idsFor = (startId) => {
      const ids = new Set([String(startId)]);
      let changed = true;
      while (changed) {
        changed = false;
        categories.forEach((category) => {
          const id = String(category.id || "");
          if (category.parent_id && ids.has(String(category.parent_id)) && !ids.has(id)) {
            ids.add(id);
            changed = true;
          }
        });
      }
      return ids;
    };

    document.querySelectorAll(".public-category-card").forEach((card) => {
      if (card.querySelector(".public-category-count")) return;
      const control = card.querySelector("[data-folder], [data-category]");
      const id = control?.dataset.folder || control?.dataset.category;
      if (!id) return;
      const ids = idsFor(id);
      const count = songs.filter((song) => (song._categories || []).some((category) => ids.has(String(category.id)))).length;
      const badge = document.createElement("p");
      badge.className = "public-category-count";
      badge.textContent = `${count} ${count === 1 ? "canto" : "cantos"}`;
      const actions = card.querySelector(".public-category-card-actions");
      if (actions) actions.before(badge);
      else card.append(badge);
    });
  };

  const boot = () => {
    const grid = document.getElementById("categoriesGrid");
    if (!grid) return;
    const observer = new MutationObserver(renderCounts);
    observer.observe(grid, { childList: true, subtree: true });
    renderCounts();
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
