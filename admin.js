const client = window.supabaseClient;
const message = document.querySelector("#adminMessage");
const recent = document.querySelector("#adminRecent");

const escapeHTML = (value) => String(value || "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function initNavigation() {
  const menuButton = document.querySelector("#menuToggle");
  const menu = document.querySelector("#navMenu");
  const themeButton = document.querySelector("#themeToggle");
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

function setMessage(text) {
  if (message) message.textContent = text;
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function cleanPayload(payload) {
  return Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, String(value || "").trim()]).filter(([, value]) => value !== ""));
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function enrichPayload(table, rawPayload) {
  const payload = cleanPayload(rawPayload);
  if ((table === "artists" || table === "categories") && payload.name && !payload.slug) {
    payload.slug = slugify(payload.name);
  }
  if (table === "songs" && payload.title && !payload.slug) {
    payload.slug = slugify(payload.title);
  }
  return payload;
}

async function insertRecord(table, payload, successText) {
  if (!client) {
    setMessage("No se pudo iniciar Supabase.");
    return false;
  }
  const finalPayload = enrichPayload(table, payload);
  const { error } = await client.from(table).insert([finalPayload]);
  if (error) {
    console.error(error);
    setMessage(`Error al guardar en ${table}: ${error.message}`);
    return false;
  }
  setMessage(successText);
  await loadRecent();
  return true;
}

function initForms() {
  document.querySelector("#songForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const ok = await insertRecord("songs", formData(form), "Canción guardada correctamente.");
    if (ok) form.reset();
  });
  document.querySelector("#artistForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const ok = await insertRecord("artists", formData(form), "Artista guardado correctamente.");
    if (ok) form.reset();
  });
  document.querySelector("#categoryForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const ok = await insertRecord("categories", formData(form), "Categoría guardada correctamente.");
    if (ok) form.reset();
  });
  document.querySelector("#refreshAdmin")?.addEventListener("click", loadRecent);
}

async function loadRecent() {
  if (!recent) return;
  if (!client) {
    recent.innerHTML = "<article class='song-card'><h3>Sin conexión</h3><p>No se pudo iniciar Supabase.</p></article>";
    return;
  }
  const { data, error } = await client.from("songs").select("*").order("created_at", { ascending: false }).limit(6);
  if (error) {
    console.error(error);
    recent.innerHTML = "<article class='song-card'><h3>Error</h3><p>No se pudieron cargar registros recientes.</p></article>";
    return;
  }
  const songs = data || [];
  recent.innerHTML = songs.length ? songs.map((song) => {
    const title = escapeHTML(song.title || song.name || "Canción sin título");
    const type = escapeHTML(song.song_type || song.type || "Canción");
    const tone = escapeHTML(song.tone || "");
    return `<article class="song-card"><h3>${title}</h3><p>${type}${tone ? ` · Tono ${tone}` : ""}</p></article>`;
  }).join("") : "<article class='song-card'><h3>Sin canciones</h3><p>Aún no hay registros recientes.</p></article>";
}

initNavigation();
initForms();
loadRecent();
