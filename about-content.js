(() => {
  const fallback = {
    eyebrow: "Conoce el proyecto",
    title: "Un cancionero para",
    highlight: "servir con música y fe",
    intro: "Juntos Hacia Dios reúne letras, acordes, tonos y recursos musicales para acompañar a coros, ministerios y comunidades en la preparación de celebraciones, ensayos y momentos de oración.",
    card1_title: "Encuentra",
    card1_text: "Busca cantos por título, artista, categoría, álbum o tono y consulta la letra con acordes desde cualquier dispositivo.",
    card2_title: "Prepara",
    card2_text: "Ajusta tono, capo, tamaño de letra y modo lectura para adaptar cada canto al instrumento y al momento pastoral.",
    card3_title: "Comparte",
    card3_text: "Explora artistas, álbumes y cantos relacionados para formar repertorios útiles y compartirlos con tu comunidad.",
    use_eyebrow: "Cómo usarlo",
    use_title: "Pensado para ensayos y celebraciones",
    use_text: "Abre un canto, revisa su letra, tono y acordes, y prepara la versión que necesitas antes de tocar. En cada canción puedes activar herramientas de lectura para concentrarte mejor durante el servicio.",
    community_eyebrow: "Construido con ayuda de la comunidad",
    community_title: "Tu participación también mejora el cancionero",
    community_text: "Si encuentras una letra, acorde, tono, artista o categoría que necesita revisión, puedes reportarlo. También puedes solicitar cantos que ayuden a otros coros y ministerios. Cada aporte ayuda a que este espacio sea más claro, ordenado y útil."
  };

  const render = (content) => {
    const values = { ...fallback, ...(content || {}) };
    document.querySelectorAll("[data-about]").forEach((element) => {
      const value = values[element.dataset.about];
      if (typeof value === "string" && value.trim()) element.textContent = value;
    });
  };

  const load = async () => {
    render(fallback);
    const db = window.supabaseClient;
    if (!db) return;
    const { data, error } = await db.from("site_content").select("content").eq("content_key", "about").maybeSingle();
    if (!error && data?.content && typeof data.content === "object") render(data.content);
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", load, { once: true });
  else load();
})();