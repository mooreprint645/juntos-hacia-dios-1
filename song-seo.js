(() => {
  const heading = document.getElementById("songTitle");
  if (!heading) return;
  let done = false;

  function update() {
    if (done || !window.JHDSEO) return;
    const title = heading.textContent?.trim();
    if (!title || /cargando|no se pudo cargar/i.test(title)) return;
    const subtitle = document.getElementById("songSubtitle")?.textContent?.trim() || "";
    const type = document.getElementById("songType")?.textContent?.trim() || "Canción";
    const meta = [...document.querySelectorAll("#songMeta .filter-btn")].map((item) => item.textContent?.trim() || "");
    const tone = meta.find((item) => /^(tono\s+)?[A-G](?:#|b)?/i.test(item))?.replace(/^tono\s+/i, "") || "";
    const artist = subtitle.replace(/^Por\s+/i, "");
    window.JHDSEO.setSong({
      title,
      artist,
      tone,
      type,
      description: `${subtitle ? `${subtitle}. ` : ""}Letra, acordes${tone ? ` y tono ${tone}` : ""} de ${title} en Juntos Hacia Dios.`
    });
    done = true;
    observer.disconnect();
  }

  const observer = new MutationObserver(update);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  document.addEventListener("DOMContentLoaded", update);
  update();
})();