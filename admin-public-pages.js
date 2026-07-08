(() => {
  if (window.__jhdAdminPublicPages) return;
  window.__jhdAdminPublicPages = true;

  const db = window.supabaseClient;
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const defaults = {
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

  let editorOpen = false;
  let editorDirty = false;
  let current = { ...defaults };

  const waitFor = (promise, milliseconds, message) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), milliseconds))
  ]);
  const missingTable = (error) => error?.code === "PGRST205" || /site_content|relation .*site_content/i.test(String(error?.message || ""));
  const setStatus = (message, bad = false) => {
    const status = $("#publicPageStatus");
    if (!status) return;
    status.textContent = message || "";
    status.style.color = bad ? "#ffb4b4" : "";
  };

  const field = (name, label, value, multiline = false, hint = "") => `<label>${esc(label)}${hint ? `<span class="muted-text">${esc(hint)}</span>` : ""}${multiline ? `<textarea name="${esc(name)}" rows="${name.endsWith("text") || name === "intro" ? 4 : 3}">${esc(value)}</textarea>` : `<input name="${esc(name)}" value="${esc(value)}">`}</label>`;

  const pageForm = () => `<section class="admin-section"><div class="admin-section-heading"><div><p class="hero-kicker">Contenido público</p><h2>Página Acerca de</h2></div><a class="song-btn small-btn secondary" href="acerca.html" target="_blank" rel="noopener">Ver página ↗</a></div><div class="admin-card"><p class="admin-note">Edita estos textos y guarda. Los cambios aparecerán en la opción <strong>Acerca de</strong> del menú público.</p><form class="admin-form" id="publicPageForm"><div class="admin-form-grid">${field("eyebrow", "Etiqueta superior", current.eyebrow)}${field("title", "Título principal", current.title)}</div>${field("highlight", "Palabras destacadas del título", current.highlight)}${field("intro", "Texto de introducción", current.intro, true)}<h3 class="admin-subsection-title">Tarjetas informativas</h3><div class="admin-form-grid">${field("card1_title", "Tarjeta 1 · Título", current.card1_title)}${field("card2_title", "Tarjeta 2 · Título", current.card2_title)}${field("card3_title", "Tarjeta 3 · Título", current.card3_title)}</div><div class="admin-form-grid">${field("card1_text", "Tarjeta 1 · Texto", current.card1_text, true)}${field("card2_text", "Tarjeta 2 · Texto", current.card2_text, true)}${field("card3_text", "Tarjeta 3 · Texto", current.card3_text, true)}</div><h3 class="admin-subsection-title">Sección de uso</h3><div class="admin-form-grid">${field("use_eyebrow", "Etiqueta", current.use_eyebrow)}${field("use_title", "Título", current.use_title)}</div>${field("use_text", "Texto", current.use_text, true)}<h3 class="admin-subsection-title">Sección de colaboración</h3><div class="admin-form-grid">${field("community_eyebrow", "Etiqueta", current.community_eyebrow)}${field("community_title", "Título", current.community_title)}</div>${field("community_text", "Texto", current.community_text, true)}<div class="admin-actions"><button class="song-btn" type="submit">Guardar página</button><button class="song-btn small-btn secondary" id="restoreAboutDefaults" type="button">Restaurar texto inicial</button></div><p class="admin-message" id="publicPageStatus" aria-live="polite"></p></form></div></section>`;

  const loadPage = async () => {
    if (!db) throw new Error("No se pudo iniciar la conexión con Supabase.");
    const { data, error } = await waitFor(
      db.from("site_content").select("content").eq("content_key", "about").maybeSingle(),
      6500,
      "La conexión tardó demasiado. Puedes editar y guardar la página de todos modos."
    );
    if (error) {
      if (missingTable(error)) throw new Error("Falta activar la edición de páginas. Ejecuta supabase-public-pages.sql en Supabase.");
      throw error;
    }
    return data?.content && typeof data.content === "object" ? { ...defaults, ...data.content } : { ...defaults };
  };

  const bindForm = () => {
    const form = $("#publicPageForm");
    form?.querySelectorAll("input, textarea").forEach((input) => input.addEventListener("input", () => { editorDirty = true; }));
    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const raw = Object.fromEntries(new FormData(form).entries());
      const content = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, String(value || "").trim()]));
      setStatus("Guardando página…");
      try {
        const { error } = await waitFor(
          db.from("site_content").upsert({ content_key: "about", content, updated_at: new Date().toISOString() }, { onConflict: "content_key" }),
          9000,
          "La conexión tardó demasiado al guardar. Revisa tu internet e inténtalo de nuevo."
        );
        if (error) {
          setStatus(missingTable(error) ? "Falta ejecutar supabase-public-pages.sql en Supabase." : `No se pudo guardar: ${error.message}`, true);
          return;
        }
        current = { ...defaults, ...content };
        editorDirty = false;
        setStatus("Página guardada. Actualiza Acerca de para ver los cambios.");
      } catch (error) {
        setStatus(error.message || "No se pudo guardar la página.", true);
      }
    });
    $("#restoreAboutDefaults")?.addEventListener("click", () => {
      current = { ...defaults };
      editorDirty = true;
      const view = $("#adminView");
      if (!view) return;
      view.innerHTML = pageForm();
      bindForm();
      setStatus("Texto inicial restaurado. Presiona Guardar página para publicarlo.");
    });
  };

  const openEditor = async () => {
    editorOpen = true;
    editorDirty = false;
    current = { ...defaults };
    const view = $("#adminView");
    const tab = $("#adminPublicPagesTab");
    if (!view || !tab) return;
    document.querySelectorAll(".admin-tab").forEach((button) => button.classList.remove("active"));
    tab.classList.add("active");
    view.innerHTML = pageForm();
    bindForm();
    setStatus("Cargando contenido guardado…");
    try {
      const storedContent = await loadPage();
      if (!editorOpen || editorDirty) return;
      current = storedContent;
      view.innerHTML = pageForm();
      bindForm();
      setStatus("Contenido guardado cargado.");
    } catch (error) {
      if (!editorOpen || editorDirty) return;
      setStatus(error.message || "No se pudo cargar el contenido guardado.", true);
    }
  };

  const attach = () => {
    const workspace = $("#adminWorkspace");
    const tabs = workspace?.querySelector(".admin-tabs");
    if (!tabs || $("#adminPublicPagesTab")) return;
    const button = document.createElement("button");
    button.id = "adminPublicPagesTab";
    button.className = "admin-tab";
    button.type = "button";
    button.textContent = "Página pública";
    button.addEventListener("click", openEditor);
    tabs.append(button);
    tabs.querySelectorAll("[data-admin-tab]").forEach((tab) => tab.addEventListener("click", () => { editorOpen = false; }));
  };

  const observer = new MutationObserver(attach);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  attach();
})();