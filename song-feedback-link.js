(() => {
  const addFeedbackLink = () => {
    const lyrics = document.getElementById("songLyrics");
    const shell = lyrics?.closest(".song-reader-shell");
    const title = document.getElementById("songTitle")?.textContent?.trim();
    if (!lyrics || !shell || !title || title === "Cargando canción..." || document.getElementById("songFeedback")) return false;

    const subtitle = document.getElementById("songSubtitle")?.textContent?.trim() || "";
    const artist = subtitle.replace(/^Por\s+/i, "");
    const params = new URLSearchParams({
      tipo: "correccion",
      cancion: title,
      enlace: location.href
    });
    if (artist && artist !== "Canción del cancionero.") params.set("artista", artist);

    const feedback = document.createElement("aside");
    feedback.id = "songFeedback";
    feedback.className = "song-feedback";
    feedback.innerHTML = `<p><strong>¿Letra, acorde o tono incorrecto?</strong>Reporta el detalle y se revisará para mejorar el cancionero.</p><a class="text-link" href="contacto.html?${params.toString()}">Reportar detalle</a>`;
    const links = document.getElementById("songLinks");
    if (links?.parentElement === shell) links.after(feedback);
    else lyrics.after(feedback);
    return true;
  };

  if (addFeedbackLink()) return;
  const observer = new MutationObserver(() => {
    if (addFeedbackLink()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();