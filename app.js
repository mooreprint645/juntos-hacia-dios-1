document.addEventListener("click", (event) => {
  const link = event.target.closest('a[href^="artista.html?slug="]');
  if (!link) return;
  event.preventDefault();
  const url = new URL(link.href);
  location.href = `artistas.html?slug=${encodeURIComponent(url.searchParams.get("slug") || "")}`;
});

(() => {
  const setHomeCrosses = () => {
    document.querySelectorAll(".home-access-group").forEach((group) => {
      const title = group.querySelector("h3")?.textContent?.trim();
      if (title === "Católico" || title === "Cristiano") {
        const icon = group.querySelector(".home-access-symbol");
        if (icon) icon.textContent = "✝";
      }
    });
  };

  document.addEventListener("DOMContentLoaded", () => {
    const observer = new MutationObserver(setHomeCrosses);
    observer.observe(document.body, { childList: true, subtree: true });
    setHomeCrosses();
  });
})();
