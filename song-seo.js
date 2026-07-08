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
    const meta = [...document.querySelectorAll("#songMeta .filter-btn")].map((item) => item.textContent?.trim() || "").filter(Boolean);
    const tone = meta.find((item) => /^(tono\s+)?[A-G](?:#|b)?/i.test(item))?.replace(/^tono\s+/i, "") || "";
    const categories = meta.filter((item) => !/^(tono\s+)?[A-G](?:#|b)?/i.test(item) && !/capo|fácil|intermedio|avanzado/i.test(item)).slice(0, 4);
    const artist = subtitle.replace(/^Por\s+/i, "");
    const description = `${artist && !/canción del cancionero/i.test(artist) ? `${title} de ${artist}. ` : ""}Letra y acordes${tone ? ` en tono ${tone}` : ""} para tocar en comunidad${categories.length ? `. ${categories.join(" · ")}` : ""}.`;
    window.JHDSEO.setSong({ title, artist, tone, type, categories, description });
    done = true;
    observer.disconnect();
  }

  const observer = new MutationObserver(update);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  document.addEventListener("DOMContentLoaded", update);
  update();
})();