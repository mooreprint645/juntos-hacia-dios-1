(() => {
  const db = window.supabaseClient;
  const $ = (selector) => document.querySelector(selector);
  const defaults = {
    eyebrow: "Solicitudes",
    title: "Solicita un canto para el cancionero",
    highlight: "lo revisamos",
    intro: "Comparte el nombre del canto, artista o ministerio y, si lo tienes, un enlace de referencia. Cada solicitud se revisa antes de agregarse al cancionero.",
    side_title: "Ayuda a identificarlo mejor",
    side_text: "Mientras más precisa sea la información, más fácil será revisar la letra, el tono y los acordes correctos.",
    tip1_title: "Nombre del canto",
    tip1_text: "Escribe el título como aparece en el video, álbum o ministerio.",
    tip2_title: "Artista o ministerio",
    tip2_text: "Ayuda a encontrar la versión correcta y evitar confusiones.",
    tip3_title: "Enlace de referencia",
    tip3_text: "Un video o página permite revisar la letra, el tono y el contexto del canto."
  };

  function initNavigation() {
    const button = $("#menuToggle"), menu = $("#navMenu");
    button?.setAttribute("aria-expanded", "false");
    button?.addEventListener("click", () => {
      const open = Boolean(menu?.classList.toggle("open"));
      button.setAttribute("aria-expanded", String(open));
    });
  }

  function applyContent(content) {
    const data = { ...defaults, ...(content || {}) };
    document.querySelectorAll("[data-request-content]").forEach((node) => {
      const key = node.dataset.requestContent;
      if (key && data[key] != null) node.textContent = data[key];
    });
    document.title = `${data.title || defaults.title} | Juntos Hacia Dios`;
    document.querySelector('meta[name="description"]')?.setAttribute("content", data.intro || defaults.intro);
  }

  async function loadContent() {
    applyContent(defaults);
    if (!db) return;
    const { data } = await db.from("site_content").select("content").eq("content_key", "request_song").maybeSingle();
    if (data?.content && typeof data.content === "object") applyContent(data.content);
  }

  const value = (selector) => $(selector)?.value?.trim() || "";
  const status = () => $("#requestSongStatus");
  const setStatus = (message, bad = false) => {
    const box = status();
    if (!box) return;
    box.textContent = message || "";
    box.style.color = bad ? "#ffb4b4" : "";
  };
  const missingTable = (error) => /contact_messages|relation|schema cache|PGRST205/i.test(String(error?.message || error?.code || ""));

  function requestDetails() {
    return [
      value("#requestMoment") ? `Momento de uso: ${value("#requestMoment")}` : "",
      value("#requestNotes") ? `Notas: ${value("#requestNotes")}` : ""
    ].filter(Boolean).join("\n\n") || "Solicitud de canto";
  }

  function bindForm() {
    const form = $("#requestSongForm");
    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const song = value("#requestSongTitle");
      if (!song) {
        setStatus("Escribe el nombre del canto.", true);
        $("#requestSongTitle")?.focus();
        return;
      }
      if (!db) {
        setStatus("No se pudo conectar con Supabase. Intenta de nuevo en un momento.", true);
        return;
      }
      setStatus("Enviando solicitud…");
      const { error } = await db.from("contact_messages").insert([{
        message_type: "Solicitud de canto",
        song_title: song,
        artist_name: value("#requestArtist") || null,
        source_url: value("#requestLink") || null,
        details: requestDetails(),
        contact_name: value("#requestName") || null,
        contact_email: value("#requestEmail") || null,
        page_url: location.href,
        user_agent: navigator.userAgent,
        status: "pendiente",
        updated_at: new Date().toISOString()
      }]);
      if (error) {
        setStatus(missingTable(error) ? "Falta ejecutar supabase-contact-messages.sql en Supabase." : `No se pudo enviar: ${error.message}`, true);
        return;
      }
      form.reset();
      setStatus("Solicitud enviada. Gracias por ayudar a ampliar el cancionero.");
    });
  }

  initNavigation();
  loadContent();
  bindForm();
  const year = $("#year");
  if (year) year.textContent = new Date().getFullYear();
})();