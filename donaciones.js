const client = window.supabaseClient;
const $ = (selector) => document.querySelector(selector);

function initNavigation() {
  const menuButton = $("#menuToggle"), menu = $("#navMenu"), themeButton = $("#themeToggle");
  menuButton?.addEventListener("click", () => menu?.classList.toggle("open"));
  if (localStorage.getItem("jhd-theme") === "light") { document.body.classList.add("light-mode"); if (themeButton) themeButton.textContent = "☀️"; }
  themeButton?.addEventListener("click", () => { document.body.classList.toggle("light-mode"); const light = document.body.classList.contains("light-mode"); localStorage.setItem("jhd-theme", light ? "light" : "dark"); themeButton.textContent = light ? "☀️" : "🌙"; });
}

function setText(id, value) { const element = $(id); if (element) element.textContent = value || ""; }
function safe(value, fallback) { return value || fallback || ""; }

async function loadDonations() {
  if (!client) return;
  const { data, error } = await client.from("donation_settings").select("*").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (error) { console.error(error); return; }
  const details = data || {};
  setText("#donationTitle", safe(details.title, "Ayuda a que este proyecto siga creciendo"));
  setText("#donationSubtitle", safe(details.subtitle, "Tu apoyo permite mantener y mejorar este cancionero."));
  setText("#donationBank", safe(details.bank_name, "No especificado"));
  setText("#donationHolder", safe(details.account_holder, "No especificado"));
  setText("#donationAccount", safe(details.account_number, "No especificado"));
  setText("#donationType", safe(details.account_type, "No especificado"));
  setText("#donationNote", details.note || "");
  const button = $("#copyDonation"), message = $("#donationMessage");
  const text = [`Banco: ${details.bank_name || ""}`, `Titular: ${details.account_holder || ""}`, `Cuenta: ${details.account_number || ""}`, `Tipo: ${details.account_type || ""}`].filter(Boolean).join("\n");
  button?.addEventListener("click", async () => { try { await navigator.clipboard.writeText(text); if (message) message.textContent = "Información copiada."; } catch { if (message) message.textContent = text || "No hay información configurada."; } });
}

initNavigation();
loadDonations();
