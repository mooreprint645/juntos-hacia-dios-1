(() => {
  const PATTERN = /\s*<!--JHD_HOME_ACCESS:[\s\S]*?-->\s*$/;
  const DEFAULT_CARD_TEXT = "Cantos organizados en esta categoría.";
  const DEFAULT_HEADER_TEXT = "Cantos de esta categoría y sus subcategorías.";

  function clean() {
    document.querySelectorAll(".public-category-card").forEach((card) => {
      const description = [...card.querySelectorAll(":scope > p")].find((item) => !item.classList.contains("hero-kicker") && !item.classList.contains("public-category-count"));
      if (!description || !description.textContent.includes("<!--JHD_HOME_ACCESS:")) return;
      const text = description.textContent.replace(PATTERN, "").trim();
      description.textContent = text || DEFAULT_CARD_TEXT;
    });
    document.querySelectorAll(".category-songs-header p").forEach((paragraph) => {
      if (!paragraph.textContent.includes("<!--JHD_HOME_ACCESS:")) return;
      const text = paragraph.textContent.replace(PATTERN, "").trim();
      paragraph.textContent = text || DEFAULT_HEADER_TEXT;
    });
  }

  const observer = new MutationObserver(clean);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", clean, { once: true });
  else clean();
})();