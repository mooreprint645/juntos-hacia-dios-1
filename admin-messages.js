(() => {
  if (window.__jhdAdminMessages) return;
  window.__jhdAdminMessages = true;
  const db = window.supabaseClient;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  let messages = [];
  let filter = "pendiente";
  let query = "";
  let open = false;

  const missingTable = (error) => /contact_messages|relation|schema cache|PGRST205/i.test(String(error?.message || error?.code || ""));
  const statusLabels = { pendiente: "Pendiente", revisado: "Revisado", resuelto: "Resuelto", descartado: "Descartado" };
  const dateLabel = (value) => value ? new Date(value).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" }) : "Sin fecha";

  function note(message, bad = false) {
    const box = $("#messagesAdminStatus") || $("#adminMessage");
    if (!box) return;
    box.textContent = message || "";
    box.style.color = bad ? "#ffb4b4" : "";
  }

  async function load() {
    if (!db) throw new Error("No hay conexión con Supabase.");
    const { data, error } = await db.from("contact_messages").select("*").order("created_at", { ascending: false }).limit(200);
    if (error) throw error;
    messages = data || [];
  }

  function filteredRows() {
    const q = query.trim().toLowerCase();
    return messages.filter((row) => {
      const byStatus = filter === "todos" || String(row.status || "pendiente") === filter;
      const text = [row.message_type, row.song_title, row.artist_name, row.details, row.contact_name, row.contact_email, row.admin_notes].filter(Boolean).join(" ").toLowerCase();
      return byStatus && (!q || text.includes(q));
    });
  }

  function renderCard(row) {
    const id = esc(row.id);
    const status = row.status || "pendiente";
    return `<article class="admin-list-item"><div class="admin-editor-head"><div><h4>${esc(row.song_title || row.message_type || "Mensaje")}</h4><p>${esc(row.message_type || "Mensaje")} · ${esc(statusLabels[status] || status)} · ${esc(dateLabel(row.created_at))}</p></div></div>${row.artist_name ? `<p><strong>Artista/sección:</strong> ${esc(row.artist_name)}</p>` : ""}${row.contact_name || row.contact_email ? `<p><strong>Contacto:</strong> ${esc([row.contact_name, row.contact_email].filter(Boolean).join(" · "))}</p>` : ""}${row.source_url ? `<p><strong>Enlace relacionado:</strong> <a class="text-link" href="${esc(row.source_url)}" target="_blank" rel="noopener">Abrir enlace ↗</a></p>` : ""}<p class="admin-note">${esc(row.details || "Sin detalle.")}</p><label>Notas internas<textarea rows="2" data-message-note="${id}" placeholder="Agrega una nota privada para seguimiento.">${esc(row.admin_notes || "")}</textarea></label><div class="admin-actions"><button class="song-btn small-btn" type="button" data-save-note="${id}">Guardar nota</button><button class="song-btn small-btn secondary" type="button" data-status-message="${id}" data-status="pendiente">Pendiente</button><button class="song-btn small-btn secondary" type="button" data-status-message="${id}" data-status="revisado">Revisado</button><button class="song-btn small-btn secondary" type="button" data-status-message="${id}" data-status="resuelto">Resuelto</button><button class="song-btn small-btn secondary" type="button" data-delete-message="${id}">Eliminar</button></div></article>`;
  }

  function render() {
    const view = $("#adminView");
    const tab = $("#adminMessagesTab");
    if (!view || !tab) return;
    document.querySelectorAll(".admin-tab").forEach((button) => button.classList.remove("active"));
    tab.classList.add("active");
    const rows = filteredRows();
    const pending = messages.filter((row) => (row.status || "pendiente") === "pendiente").length;
    view.innerHTML = `<section class="admin-section"><div class="admin-section-heading"><div><p class="hero-kicker">Bandeja</p><h2>Mensajes recibidos</h2></div><p class="admin-count">${pending} pendientes</p></div><div class="admin-filter-row"><input class="admin-filter-input" id="messagesSearch" type="search" value="${esc(query)}" placeholder="Buscar por canto, artista, mensaje o contacto"><select id="messagesStatus"><option value="pendiente" ${filter === "pendiente" ? "selected" : ""}>Pendientes</option><option value="revisado" ${filter === "revisado" ? "selected" : ""}>Revisados</option><option value="resuelto" ${filter === "resuelto" ? "selected" : ""}>Resueltos</option><option value="descartado" ${filter === "descartado" ? "selected" : ""}>Descartados</option><option value="todos" ${filter === "todos" ? "selected" : ""}>Todos</option></select><button class="song-btn small-btn secondary" id="messagesRefresh" type="button">Actualizar</button></div><div class="admin-list">${rows.length ? rows.map(renderCard).join("") : `<div class="admin-empty">No hay mensajes con este filtro.</div>`}</div><p class="admin-message" id="messagesAdminStatus" aria-live="polite"></p></section>`;
    bind();
  }

  async function updateMessage(id, patch, message) {
    const { error } = await db.from("contact_messages").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) {
      note(`Error: ${error.message}`, true);
      return;
    }
    await load();
    render();
    note(message || "Mensaje actualizado.");
  }

  async function removeMessage(id) {
    if (!confirm("¿Eliminar este mensaje?")) return;
    const { error } = await db.from("contact_messages").delete().eq("id", id);
    if (error) {
      note(`Error: ${error.message}`, true);
      return;
    }
    await load();
    render();
    note("Mensaje eliminado.");
  }

  function bind() {
    $("#messagesSearch")?.addEventListener("input", (event) => { query = event.target.value; render(); });
    $("#messagesStatus")?.addEventListener("change", (event) => { filter = event.target.value; render(); });
    $("#messagesRefresh")?.addEventListener("click", openInbox);
    $$('[data-status-message]').forEach((button) => button.addEventListener("click", () => updateMessage(button.dataset.statusMessage, { status: button.dataset.status }, "Estado actualizado.")));
    $$('[data-save-note]').forEach((button) => button.addEventListener("click", () => {
      const id = button.dataset.saveNote;
      updateMessage(id, { admin_notes: $(`[data-message-note="${CSS.escape(id)}"]`)?.value || "" }, "Nota guardada.");
    }));
    $$('[data-delete-message]').forEach((button) => button.addEventListener("click", () => removeMessage(button.dataset.deleteMessage)));
  }

  async function openInbox() {
    open = true;
    const view = $("#adminView");
    const tab = $("#adminMessagesTab");
    if (!view || !tab) return;
    document.querySelectorAll(".admin-tab").forEach((button) => button.classList.remove("active"));
    tab.classList.add("active");
    view.innerHTML = `<section class="admin-section"><div class="admin-card"><p class="admin-note">Cargando mensajes…</p></div></section>`;
    try {
      await load();
      if (open) render();
    } catch (error) {
      const msg = missingTable(error) ? "Falta ejecutar supabase-contact-messages.sql en Supabase." : (error.message || "No se pudieron cargar los mensajes.");
      view.innerHTML = `<section class="admin-section"><div class="admin-card"><h3>No se pudieron cargar los mensajes</h3><p class="admin-note">${esc(msg)}</p></div></section>`;
    }
  }

  function attach() {
    const workspace = $("#adminWorkspace");
    const tabs = workspace?.querySelector(".admin-tabs");
    if (!tabs || $("#adminMessagesTab")) return;
    const button = document.createElement("button");
    button.id = "adminMessagesTab";
    button.className = "admin-tab";
    button.type = "button";
    button.textContent = "Mensajes";
    button.addEventListener("click", openInbox);
    tabs.append(button);
    tabs.querySelectorAll("[data-admin-tab]").forEach((tab) => tab.addEventListener("click", () => { open = false; }));
  }

  const observer = new MutationObserver(attach);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  attach();
})();