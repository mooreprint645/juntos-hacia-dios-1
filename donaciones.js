const client = window.supabaseClient;
const $ = (selector) => document.querySelector(selector);

let donationText = "Gracias por apoyar el proyecto Juntos Hacia Dios.";
let donationMethods = [];

function initNavigation() {
  const button = $("#menuToggle");
  const menu = $("#navMenu");
  button?.setAttribute("aria-expanded", "false");
  button?.addEventListener("click", () => {
    const open = Boolean(menu?.classList.toggle("open"));
    button.setAttribute("aria-expanded", String(open));
  });
  document.querySelectorAll("#navMenu a").forEach((link) => link.addEventListener("click", () => {
    menu?.classList.remove("open");
    button?.setAttribute("aria-expanded", "false");
  }));
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function label(row, index) {
  return row.label || row.bank_name || row.account_type || `Opción ${index + 1}`;
}

function text(row, index) {
  return [
    `Opción: ${label(row, index)}`,
    row.bank_name && `Banco: ${row.bank_name}`,
    row.account_holder && `Titular: ${row.account_holder}`,
    row.account_number && `Cuenta: ${row.account_number}`,
    row.account_type && `Tipo: ${row.account_type}`,
    row.instructions && `Indicaciones: ${row.instructions}`,
    row.note
  ].filter(Boolean).join("\n");
}

function allText() {
  return donationMethods.map(text).filter(Boolean).join("\n\n---\n\n") || donationText;
}

function initCopy() {
  const button = $("#copyDonation");
  const message = $("#donationMessage");
  button?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(allText());
      if (message) message.textContent = "Información de donación copiada.";
    } catch {
      if (message) message.textContent = allText();
    }
  });
}

function detail(key, value) {
  return value
    ? `<div class="donation-detail"><span>${esc(key)}</span><strong>${esc(value)}</strong></div>`
    : "";
}

function renderMethods(rows) {
  const box = $("#donationMethods");
  if (!box) return;

  donationMethods = (rows || []).filter((row) => row && row.is_active !== false);
  donationText = allText();

  if (!donationMethods.length) {
    box.innerHTML = '<div class="donation-empty">Todavía no hay datos de donación publicados. Vuelve pronto o usa la página de contacto para solicitar información.</div>';
    return;
  }

  box.innerHTML = donationMethods.map((row, index) => `
    <article class="donation-method">
      <div><p class="hero-kicker">Forma de apoyo</p><h3>${esc(label(row, index))}</h3></div>
      <div class="donation-detail-list">
        ${detail("Banco", row.bank_name)}
        ${detail("Titular", row.account_holder)}
        ${detail("Cuenta", row.account_number)}
        ${detail("Tipo", row.account_type)}
      </div>
      ${row.instructions ? `<p>${esc(row.instructions)}</p>` : ""}
      ${row.note ? `<p>${esc(row.note)}</p>` : ""}
      <div class="donation-method-actions">
        <button class="song-btn small-btn" type="button" data-copy-donation="${index}">Copiar esta opción</button>
      </div>
    </article>
  `).join("");

  document.querySelectorAll("[data-copy-donation]").forEach((button) => button.addEventListener("click", async () => {
    const index = Number(button.dataset.copyDonation || 0);
    const message = $("#donationMessage");
    try {
      await navigator.clipboard.writeText(text(donationMethods[index], index));
      if (message) message.textContent = "Opción de donación copiada.";
    } catch {
      if (message) message.textContent = text(donationMethods[index], index);
    }
  }));
}

async function loadSettings() {
  const box = $("#donationMethods");
  if (!client) {
    if (box) box.innerHTML = '<div class="donation-empty">No se pudo iniciar la conexión. Recarga la página para intentarlo nuevamente.</div>';
    return;
  }

  const columns = "label,bank_name,account_holder,account_number,account_type,instructions,note,is_active,sort_order,updated_at";
  let result = await client
    .from("donation_settings")
    .select(columns)
    .order("sort_order", { ascending: true })
    .order("updated_at", { ascending: false });

  if (result.error) {
    result = await client
      .from("donation_settings")
      .select(columns)
      .order("updated_at", { ascending: false });
  }

  if (result.error) {
    if (box) box.innerHTML = '<div class="donation-empty">No se pudieron cargar las formas de apoyo. Inténtalo nuevamente.</div>';
    return;
  }

  renderMethods(result.data || []);
}

initNavigation();
initCopy();
loadSettings();
