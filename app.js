document.addEventListener("click", (event) => {
  const link = event.target.closest('a[href^="artista.html?slug="]');
  if (!link) return;
  event.preventDefault();
  const url = new URL(link.href);
  location.href = `artistas.html?slug=${encodeURIComponent(url.searchParams.get("slug") || "")}`;
});

(() => {
  const setHomeCrosses = () => {
    const groups = [...document.querySelectorAll(".home-access-group")];
    groups.forEach((group) => {
      const title = group.querySelector("h3")?.textContent?.trim();
      if (title !== "Católico" && title !== "Cristiano") return;
      const icon = group.querySelector(".home-access-symbol");
      if (icon && icon.textContent.trim() !== "✝") icon.textContent = "✝";
    });
    return groups.length >= 2;
  };

  document.addEventListener("DOMContentLoaded", () => {
    const observer = new MutationObserver(() => {
      if (setHomeCrosses()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    if (setHomeCrosses()) observer.disconnect();
  });
})();
