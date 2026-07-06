document.addEventListener("click", (event) => {
  const link = event.target.closest('a[href^="artista.html?slug="]');
  if (!link) return;
  event.preventDefault();
  const url = new URL(link.href);
  location.href = `artistas.html?slug=${encodeURIComponent(url.searchParams.get("slug") || "")}`;
});
