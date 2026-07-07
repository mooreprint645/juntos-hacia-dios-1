(() => {
  const profile = document.getElementById("artistProfile");
  if (!profile) return;
  let done = false;

  const update = () => {
    if (done || !window.JHDSEO) return;
    const title = profile.querySelector(".artist-hero-card h1")?.textContent?.trim();
    const description = profile.querySelector(".artist-hero-card p:not(.hero-kicker)")?.textContent?.trim() || "";
    if (!title || /cargando|momento por favor/i.test(title)) return;
    window.JHDSEO.setArtist({ name: title, description });
    done = true;
    observer.disconnect();
  };

  const observer = new MutationObserver(update);
  observer.observe(profile, { childList: true, subtree: true, characterData: true });
  document.addEventListener("DOMContentLoaded", update);
  update();
})();