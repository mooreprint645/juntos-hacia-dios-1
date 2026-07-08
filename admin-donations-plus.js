(() => {
  if (window.__jhdAdminDonationsPlus) return;
  window.__jhdAdminDonationsPlus = true;
  const db = window.supabaseClient;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  let items = [];
  let editId = "";
  let busy = false;

  function setMessage(message, bad = false) {
    const box = $("#adminMessage") || $("#donationPlusMessage");
    if (!box) return;
    box.textContent = message || "";
    box.style.color = bad ? "#ffb4b4" : "";
  }

  function emptyItem() {
    return { label: "", bank_name: "", account_holder: "", account_number: "", account_type: "", instructions: "", note: "", sort_order: 0, is_active: true };
  }

  function currentItem() {
    return items.find((item) => String(item.id) === String(editId)) || emptyItem();
  }

  function missingColumns(error) {
    return /label|instructions|sort_order|is_active|column/i.test(String(error?.message || ""));
  }

  async function loadItems() {
    if (!db) return;
    let result = await db.from("donation_settings").select("*").order("sort_order", { ascending: true }).order("updated_at", { ascending: false });
    if (result.error) result = await db.from("donation_settings").select("*").order("updated_at", { ascending: false });
    if (result.error) throw result.error;
    items = result.data || [];
  }

  function rowStatus(item) {
    return item.is_active === false ? "Oculta" : "Publicada";
  }

  function render() {
    const original = $("#donationAdminForm");
    const section = $("#donationPlusAdmin") || original?.closest("section.admin-section");
    if (!section) return;
    const item = currentItem();
    section.id = "donationPlusAdmin";
    section.innerHTML = `<div class="admin-section-heading"><div><p class="hero-kicker">Apoyo</p><h2>Opciones de donación</h2></div><p class="admin-count">${items.length} registradas</p></div><div class="admin-layout"><div class="admin-card"><div class="admin-editor-head"><h3>${editId ? "Editar opción" : "Agregar opción"}</h3>${editId ? `<button class="song-btn small-btn secondary" id="donationCancelEdit" type="button">Cancelar</button>` : ""}</div><p class="admin-note">Puedes publicar varias formas de apoyo, ocultarlas temporalmente, editarlas o eliminarlas.</p><form class="admin-form" id="donationPlusForm"><label>Nombre visible<input name="label" value="${esc(item.label || "")}" placeholder="Ejemplo: Transferencia BBVA"></label><div class="admin-form-grid"><label>Banco o medio<input name="bank_name" value="${esc(item.bank_name || "")}" placeholder="Banco, PayPal, Mercado Pago..."></label><label>Tipo<input name="account_type" value="${esc(item.account_type || "")}" placeholder="Cuenta, CLABE, tarjeta, enlace..."></label></div><label>Titular<input name="account_holder" value="${esc(item.account_holder || "")}" placeholder="Nombre del titular"></label><label>Cuenta / clave / enlace<input name="account_number" value="${esc(item.account_number || "")}" placeholder="Número, CLABE, alias o enlace"></label><div class="admin-form-grid"><label>Orden<input name="sort_order" type="number" value="${esc(item.sort_order ?? 0)}"></label><label>Estado<select name="is_active"><option value="true" ${item.is_active !== false ? "selected" : ""}>Publicada</option><option value="false" ${item.is_active === false ? "selected" : ""}>Oculta</option></select></label></div><label>Indicaciones<textarea name="instructions" rows="3" placeholder="Ejemplo: Envía comprobante por contacto si deseas.">${esc(item.instructions || "")}</textarea></label><label>Nota<textarea name="note" rows="4" placeholder="Mensaje de agradecimiento o aclaración.">${esc(item.note || "")}</textarea></label><div class="admin-actions"><button class="song-btn" type="submit">${editId ? "Guardar cambios" : "Agregar opción"}</button><button class="song-btn secondary" id="donationNewOption" type="button">Nueva opción</button></div><p class="admin-message" id="donationPlusMessage" aria-live="polite"></p></form></div><div class="admin-preview-card"><h3>Vista pública</h3><p><strong>${esc(item.label || item.bank_name || "Nombre de la opción")}</strong></p><p><strong>Titular:</strong> ${esc(item.account_holder || "Sin información")}</p><p><strong>Cuenta:</strong> ${esc(item.account_number || "Sin información")}</p><p class="admin-note">${esc(item.note || item.instructions || "Aquí aparecerá la explicación para quien quiera apoyar.")}</p></div></div><div class="admin-list" style="margin-top:18px">${items.length ? items.map((row) => `<article class="admin-list-item"><h4>${esc(row.label || row.bank_name || "Opción sin nombre")}</h4><p>${esc([row.bank_name, row.account_type, row.account_holder].filter(Boolean).join(" · ") || "Sin datos visibles")}</p><p>${esc(rowStatus(row))}${row.sort_order != null ? ` · Orden ${esc(row.sort_order)}` : ""}</p><div class="admin-actions"><button class="song-btn small-btn" type="button" data-edit-donation="${esc(row.id)}">Editar</button><button class="song-btn small-btn secondary" type="button" data-toggle-donation="${esc(row.id)}">${row.is_active === false ? "Publicar" : "Ocultar"}</button><button class="song-btn small-btn secondary" type="button" data-delete-donation="${esc(row.id)}">Eliminar</button></div></article>`).join("") : `<div class="admin-empty">Todavía no hay opciones de donación.</div>`}</div>`;
    bind();
  }

  function capture(form) {
    const raw = Object.fromEntries(new FormData(form).entries());
    return {
      label: String(raw.label || "").trim() || null,
      bank_name: String(raw.bank_name || "").trim() || null,
      account_holder: String(raw.account_holder || "").trim() || null,
      account_number: String(raw.account_number || "").trim() || null,
      account_type: String(raw.account_type || "").trim() || null,
      instructions: String(raw.instructions || "").trim() || null,
      note: String(raw.note || "").trim() || null,
      sort_order: Number(raw.sort_order || 0),
      is_active: String(raw.is_active) !== "false",
      updated_at: new Date().toISOString()
    };
  }

  async function save(event) {
    event.preventDefault();
    if (busy) return;
    busy = true;
    const payload = capture(event.currentTarget);
    if (!payload.label && !payload.bank_name && !payload.account_number) {
      busy = false;
      setMessage("Agrega al menos un nombre, medio o cuenta.", true);
      return;
    }
    const result = editId ? await db.from("donation_settings").update(payload).eq("id", editId) : await db.from("donation_settings").insert([payload]);
    busy = false;
    if (result.error) {
      setMessage(missingColumns(result.error) ? "Falta ejecutar supabase-donations-multiple.sql en Supabase." : `Error: ${result.error.message}`, true);
      return;
    }
    editId = "";
    await loadItems();
    render();
    setMessage("Opción de donación guardada.");
  }

  async function remove(id) {
    if (!confirm("¿Eliminar esta opción de donación?")) return;
    const result = await db.from("donation_settings").delete().eq("id", id);
    if (result.error) {
      setMessage(`Error: ${result.error.message}`, true);
      return;
    }
    if (String(editId) === String(id)) editId = "";
    await loadItems();
    render();
    setMessage("Opción eliminada.");
  }

  async function toggle(id) {
    const item = items.find((row) => String(row.id) === String(id));
    if (!item) return;
    const result = await db.from("donation_settings").update({ is_active: item.is_active === false, updated_at: new Date().toISOString() }).eq("id", id);
    if (result.error) {
      setMessage(missingColumns(result.error) ? "Falta ejecutar supabase-donations-multiple.sql en Supabase." : `Error: ${result.error.message}`, true);
      return;
    }
    await loadItems();
    render();
  }

  function bind() {
    $("#donationPlusForm")?.addEventListener("submit", save);
    $("#donationNewOption")?.addEventListener("click", () => { editId = ""; render(); });
    $("#donationCancelEdit")?.addEventListener("click", () => { editId = ""; render(); });
    $$('[data-edit-donation]').forEach((button) => button.addEventListener("click", () => { editId = button.dataset.editDonation; render(); window.scrollTo({ top: 0, behavior: "smooth" }); }));
    $$('[data-delete-donation]').forEach((button) => button.addEventListener("click", () => remove(button.dataset.deleteDonation)));
    $$('[data-toggle-donation]').forEach((button) => button.addEventListener("click", () => toggle(button.dataset.toggleDonation)));
  }

  async function boot() {
    const oldForm = $("#donationAdminForm");
    if (!oldForm || $("#donationPlusAdmin")) return;
    const section = oldForm.closest("section.admin-section");
    if (!section) return;
    section.id = "donationPlusAdmin";
    section.innerHTML = `<div class="admin-card"><p class="admin-note">Cargando opciones de donación…</p></div>`;
    try {
      await loadItems();
      render();
    } catch (error) {
      section.innerHTML = `<div class="admin-card"><h3>No se pudieron cargar las donaciones</h3><p class="admin-note">${esc(error.message || "Error desconocido")}</p><p class="admin-note">Ejecuta supabase-donations-multiple.sql si aún no lo hiciste.</p></div>`;
    }
  }

  const observer = new MutationObserver(boot);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  boot();
})();