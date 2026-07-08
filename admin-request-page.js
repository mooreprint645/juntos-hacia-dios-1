(() => {
  if (window.__jhdAdminRequestPage) return;
  window.__jhdAdminRequestPage = true;
  const db = window.supabaseClient;
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const defaults = {
    eyebrow: "Solicitudes",
    title: "Solicita un canto para el cancionero",
    highlight: "lo revisamos",
    intro: "Comparte el nombre del canto, artista y algún enlace de referencia. Las solicitudes se revisan desde el panel de administración antes de agregarse al cancionero.",
    side_title: "Ayuda a encontrarlo mejor",
    side_text: "Incluye el nombre exacto, artista o ministerio, enlace de YouTube si existe y el momento donde suele usarse.",
    tip1_title: "Nombre del canto",
    tip1_text: "Escribe el título como aparece en la canción o video.",
    tip2_title: "Artista o ministerio",
    tip2_text: "Si no lo sabes, deja el campo vacío y agrega pistas en la nota.",
    tip3_title: "Enlace de referencia",
    tip3_text: "Un video o página ayuda a revisar letra, tono y acordes."
  };
  let current = { ...defaults };
  let open = false;

  const waitFor = (promise, ms, message) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms))]);
  const missingTable = (error) => error?.code === "PGRST205" || /site_content|relation .*site_content/i.test(String(error?.message || ""));
  const setStatus = (message, bad = false) => {
    const box = $("#requestPageStatus");
    if (!box) return;
    box.textContent = message || "";
    box.style.color = bad ? "#ffb4b4" : "";
  };
  const field = (name, label, value, multiline = false) => `<label>${esc(label)}${multiline ? `<textarea name="${esc(name)}" rows="3">${esc(value)}</textarea>` : `<input name="${esc(name)}" value="${esc(value)}">`}</label>`;

  function formHTML() {
    return `<section class="admin-section"><div class="admin-section-heading"><div><p class="hero-kicker">Contenido público</p><h2>Página Solicitar canto</h2></div><a class="song-btn small-btn secondary" href="solicitar-canto.html" target="_blank" rel="noopener">Ver página ↗</a></div><div class="admin-card"><p class="admin-note">Edita los textos de la página donde los usuarios piden nuevos cantos. Las solicitudes aparecerán en la pestaña <strong>Mensajes</strong>.</p><form class="admin-form" id="requestPageForm"><div class="admin-form-grid">${field("eyebrow", "Etiqueta superior", current.eyebrow)}${field("title", "Título principal", current.title)}</div>${field("highlight", "Palabras destacadas", current.highlight)}${field("intro", "Introducción", current.intro, true)}<h3 class="admin-subsection-title">Tarjeta lateral</h3>${field("side_title", "Título lateral", current.side_title)}${field("side_text", "Texto lateral", current.side_text, true)}<h3 class="admin-subsection-title">Consejos</h3><div class="admin-form-grid">${field("tip1_title", "Consejo 1 · Título", current.tip1_title)}${field("tip2_title", "Consejo 2 · Título", current.tip2_title)}${field("tip3_title", "Consejo 3 · Título", current.tip3_title)}</div><div class="admin-form-grid">${field("tip1_text", "Consejo 1 · Texto", current.tip1_text, true)}${field("tip2_text", "Consejo 2 · Texto", current.tip2_text, true)}${field("tip3_text", "Consejo 3 · Texto", current.tip3_text, true)}</div><div class="admin-actions"><button class="song-btn" type="submit">Guardar página</button><button class="song-btn small-btn secondary" id="restoreRequestDefaults" type="button">Restaurar texto inicial</button></div><p class="admin-message" id="requestPageStatus" aria-live="polite"></p></form></div></section>`;
  }

  async function loadPage() {
    const { data, error } = await waitFor(db.from("site_content").select("content").eq("content_key", "request_song").maybeSingle(), 6500, "La conexión tardó demasiado.");
    if (error) throw error;
    current = data?.content && typeof data.content === "object" ? { ...defaults, ...data.content } : { ...defaults };
  }

  function bind() {
    const form = $("#requestPageForm");
    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const raw = Object.fromEntries(new FormData(form).entries());
      const content = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, String(value || "").trim()]));
      setStatus("Guardando página…");
      try {
        const { error } = await waitFor(db.from("site_content").upsert({ content_key: "request_song", content, updated_at: new Date().toISOString() }, { onConflict: "content_key" }), 9000, "La conexión tardó demasiado al guardar.");
        if (error) {
          setStatus(missingTable(error) ? "Falta ejecutar supabase-public-pages.sql en Supabase." : `No se pudo guardar: ${error.message}`, true);
          return;
        }
        current = { ...defaults, ...content };
        setStatus("Página guardada. Actualiza Solicitar canto para ver los cambios.");
      } catch (error) {
        setStatus(error.message || "No se pudo guardar.", true);
      }
    });
    $("#restoreRequestDefaults")?.addEventListener("click", () => {
      current = { ...defaults };
      const view = $("#adminView");
      if (!view) return;
      view.innerHTML = formHTML();
      bind();
      setStatus("Texto inicial restaurado. Presiona Guardar página para publicarlo.");
    });
  }

  async function openEditor() {
    open = true;
    const view = $("#adminView");
    const tab = $("#adminRequestPageTab");
    if (!view || !tab) return;
    document.querySelectorAll(".admin-tab").forEach((button) => button.classList.remove("active"));
    tab.classList.add("active");
    current = { ...defaults };
    view.innerHTML = formHTML();
    bind();
    setStatus("Cargando contenido guardado…");
    try {
      await loadPage();
      if (!open) return;
      view.innerHTML = formHTML();
      bind();
      setStatus("Contenido guardado cargado.");
    } catch (error) {
      setStatus(missingTable(error) ? "Falta ejecutar supabase-public-pages.sql en Supabase." : (error.message || "No se pudo cargar."), true);
    }
  }

  function attach() {
    const workspace = $("#adminWorkspace");
    const tabs = workspace?.querySelector(".admin-tabs");
    if (!tabs || $("#adminRequestPageTab")) return;
    const button = document.createElement("button");
    button.id = "adminRequestPageTab";
    button.className = "admin-tab";
    button.type = "button";
    button.textContent = "Solicitar canto";
    button.addEventListener("click", openEditor);
    tabs.append(button);
    tabs.querySelectorAll("[data-admin-tab]").forEach((tab) => tab.addEventListener("click", () => { open = false; }));
  }

  const observer = new MutationObserver(attach);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  attach();
})();