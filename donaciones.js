const client = window.supabaseClient;
const $ = (selector) => document.querySelector(selector);
let donationText = "Gracias por apoyar el proyecto Juntos Hacia Dios.";

function initNavigation() {
  const menuButton = $("#menuToggle");
  const menu = $("#navMenu");
  const themeButton = $("#themeToggle");
  menuButton?.addEventListener("click", () => menu?.classList.toggle("open"));
  if (localStorage.getItem("jhd-theme") === "light") {
    document.body.classList.add("light-mode");
    if (themeButton) themeButton.textContent = "☀️";
  }
  themeButton?.addEventListener("click", () => {
    document.body.classList.toggle("light-mode");
    const light = document.body.classList.contains("light-mode");
    localStorage.setItem("jhd-theme", light ? "light" : "dark");
    themeButton.textContent = light ? "☀️" : "🌙";
  });
}

function initCopy() {
  const button = $("#copyDonation");
  const message = $("#donationMessage");
  button?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(donationText);
      if (message) message.textContent = "Información copiada.";
    } catch {
      if (message) message.textContent = donationText;
    }
  });
}

async function loadSettings() {
  if (!client) return;
  const { data } = await client.from("donation_settings").select("*").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (!data) return;
  donationText = [data.bank_name && `Banco: ${data.bank_name}`, data.account_holder && `Titular: ${data.account_holder}`, data.account_number && `Cuenta: ${data.account_number}`, data.account_type && `Tipo: ${data.account_type}`, data.note].filter(Boolean).join("\n") || donationText;
}

initNavigation();
initCopy();
loadSettings();
