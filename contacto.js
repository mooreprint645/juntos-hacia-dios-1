(() => {
  const $ = (selector) => document.querySelector(selector);
  const params = new URLSearchParams(location.search);
  const type = $("#contactType");
  const title = $("#contactTitle");
  const artist = $("#contactArtist");
  const details = $("#contactDetails");
  const source = $("#contactSource");
  const status = $("#contactStatus");
  const form = $("#contactForm");
  const linked = $("#linkedSongNotice");
  const linkedTitle = $("#linkedSongTitle");

  const navButton = $("#menuToggle");
  const navMenu = $("#navMenu");
  navButton?.setAttribute("aria-expanded", "false");
  navButton?.addEventListener("click", () => {
    const open = Boolean(navMenu?.classList.toggle("open"));
    navButton.setAttribute("aria-expanded", String(open));
  });
  document.querySelectorAll("#navMenu a").forEach((link) => link.addEventListener("click", () => {
    navMenu?.classList.remove("open");
    navButton?.setAttribute("aria-expanded", "false");
  }));

  const typeByParam = {
    correccion: "Corrección de letra",
    letra: "Corrección de letra",
    acordes: "Corrección de acordes o tono",
    tono: "Corrección de acordes o tono",
    solicitud: "Solicitud de canto",
    sugerencia: "Otra sugerencia"
  };

  const requestedType = typeByParam[String(params.get("tipo") || "").toLowerCase()] || "";
  if (requestedType && type) type.value = requestedType;

  const prefilledTitle = params.get("cancion") || params.get("titulo") || "";
  const prefilledArtist = params.get("artista") || "";
  const prefilledSource = params.get("enlace") || params.get("song") || "";
  if (prefilledTitle && title) title.value = prefilledTitle;
  if (prefilledArtist && artist) artist.value = prefilledArtist;
  if (prefilledSource && source) source.value = prefilledSource;
  if (prefilledTitle && linked && linkedTitle) {
    linked.hidden = false;
    linkedTitle.textContent = prefilledTitle;
  }

  const buildMessage = () => [
    `Tipo: ${type?.value || "Comentario general"}`,
    title?.value.trim() ? `Canto o tema: ${title.value.trim()}` : "",
    artist?.value.trim() ? `Artista o sección: ${artist.value.trim()}` : "",
    source?.value.trim() ? `Enlace relacionado: ${source.value.trim()}` : "",
    "",
    "Detalle:",
    details?.value.trim() || "",
    "",
    `Enviado desde: ${location.href}`
  ].filter(Boolean).join("\n");

  const valid = () => {
    if (!details?.value.trim()) {
      if (status) status.textContent = "Describe tu sugerencia o la corrección que encontraste.";
      details?.focus();
      return false;
    }
    const correction = /Corrección/.test(type?.value || "");
    if (correction && !title?.value.trim()) {
      if (status) status.textContent = "Indica el nombre del canto para poder localizarlo.";
      title?.focus();
      return false;
    }
    return true;
  };

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!valid()) return;
    const destination = "spiblack0@gmail.com";
    const subject = `[${type?.value || "Mensaje"}] ${title?.value.trim() || "Juntos Hacia Dios"}`;
    if (status) status.textContent = "Abriendo tu aplicación de correo…";
    location.href = `mailto:${destination}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(buildMessage())}`;
  });

  $("#copyContact")?.addEventListener("click", async () => {
    if (!valid()) return;
    try {
      await navigator.clipboard.writeText(buildMessage());
      if (status) status.textContent = "Mensaje copiado. Puedes pegarlo en tu correo o medio de contacto.";
    } catch (_) {
      if (status) status.textContent = "No se pudo copiar automáticamente. Mantén presionado el texto y cópialo manualmente.";
    }
  });

  const year = $("#year");
  if (year) year.textContent = new Date().getFullYear();
})();
