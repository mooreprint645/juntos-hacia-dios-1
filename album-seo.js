(() => {
  if (!new URLSearchParams(location.search).get("album")) return;
  const title = document.getElementById("albumsTitle");
  const subtitle = document.getElementById("albumsSubtitle");
  if (!title) return;
  let done = false;

  const update = () => {
    const name = title.textContent?.trim();
    if (done || !window.JHDSEO || !name || name === "Álbumes" || /cargando/i.test(name)) return;
    window.JHDSEO.setAlbum({ title: name, description: subtitle?.textContent?.trim() || "" });
    done = true;
    observer.disconnect();
  };

  const observer = new MutationObserver(update);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  document.addEventListener("DOMContentLoaded", update);
  update();
})();