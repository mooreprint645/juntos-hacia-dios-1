const client = window.supabaseClient;
const $ = (selector) => document.querySelector(selector);
let donationText = "Gracias por apoyar el proyecto Juntos Hacia Dios.";

function initNavigation() {
  const menuButton = $("#menuToggle");
  const menu = $("#navMenu");
  menuButton?.setAttribute("aria-expanded", "false");
  menuButton?.addEventListener("click", () => {
    const open = Boolean(menu?.classList.toggle("open"));
    menuButton.setAttribute("aria-expanded", String(open));
  });
  document.querySelectorAll("#navMenu a").forEach((link) => link.addEventListener("click", () => {
    menu?.classList.remove("open");
    menuButton?.setAttribute("aria-expanded", "false");
  }));
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

function showDetails(data) {
  const values = [["Banco", data.bank_name], ["Titular", data.account_holder], ["Cuenta", data.account_number], ["Tipo", data.account_type]].filter(([, value]) => value);
  if (!values.length) return;
  const box = document.createElement("div");
  box.className = "song-card";
  values.forEach(([label, value]) => {
    const row = document.createElement("p");
    const strong = document.createElement("strong");
    strong.textContent = `${label}: `;
    row.append(strong, document.createTextNode(value));
    box.append(row);
  });
  if (data.note) {
    const note = document.createElement("p");
    note.className = "muted-text";
    note.textContent = data.note;
    box.append(note);
  }
  $(".hero-actions")?.before(box);
}

async function loadSettings() {
  if (!client) return;
  const { data } = await client.from("donation_settings").select("*").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (!data) return;
  donationText = [data.bank_name && `Banco: ${data.bank_name}`, data.account_holder && `Titular: ${data.account_holder}`, data.account_number && `Cuenta: ${data.account_number}`, data.account_type && `Tipo: ${data.account_type}`, data.note].filter(Boolean).join("\n") || donationText;
  showDetails(data);
}

initNavigation();
initCopy();
loadSettings();