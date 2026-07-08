(() => {
  const fallback = {
    eyebrow: "Conoce el proyecto",
    title: "Un cancionero para",
    highlight: "servir y acompañar",
    intro: "Juntos Hacia Dios reúne letras, acordes, tonos y recursos musicales para ayudar a coros, ministerios y comunidades a preparar momentos de oración, celebración y alabanza.",
    card1_title: "Encuentra",
    card1_text: "Busca cantos por título, artista, categoría o tono y consulta la letra con acordes desde cualquier dispositivo.",
    card2_title: "Prepara",
    card2_text: "Ajusta tono, capo, tamaño de letra y visualización de acordes para adaptarte a tu instrumento o ministerio.",
    card3_title: "Comparte",
    card3_text: "Explora artistas, álbumes y categorías para descubrir cantos relacionados y preparar repertorios en comunidad.",
    use_eyebrow: "Cómo usarlo",
    use_title: "Hecho para el momento de servir",
    use_text: "Abre un canto, revisa su letra y ajusta los acordes antes de un ensayo o celebración. Para una experiencia más enfocada, activa el modo lectura desde la página de cada canción.",
    community_eyebrow: "Una comunidad que mejora",
    community_title: "Tu participación también cuenta",
    community_text: "Un tono, una letra, una categoría o un artista pueden necesitar ajustes. También pueden faltar cantos que ayuden a otras comunidades. Envía una sugerencia o reporta una corrección para mejorar el cancionero."
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
