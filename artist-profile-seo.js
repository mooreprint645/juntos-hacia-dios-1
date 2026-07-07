(() => {
  let done = false;
  let attempts = 0;

  function boot() {
    const profile = document.getElementById("artistProfile");
    if (!profile || !window.JHDSEO) {
      if (attempts < 50) {
        attempts += 1;
        setTimeout(boot, 100);
      }
      return;
    }

    const update = () => {
      if (done) return;
      const title = profile.querySelector(".artist-hero-card h1")?.textContent?.trim();
      const description = profile.querySelector(".artist-hero-card p:not(.hero-kicker)")?.textContent?.trim() || "";
      if (!title || /cargando|momento por favor/i.test(title)) return;
      window.JHDSEO.setArtist({ name: title, description });
      done = true;
      observer.disconnect();
    };

    const observer = new MutationObserver(update);
    observer.observe(profile, { childList: true, subtree: true, characterData: true });
    update();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();