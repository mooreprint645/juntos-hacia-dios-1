const client = window.supabaseClient;
const $ = (s) => document.querySelector(s);
let songs = [], artists = [], categories = [];
const esc = (v) => String(v || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const note = (id, text) => { const el = $(id); if (el) el.textContent = text; };

function nav() {
  $("#menuToggle")?.addEventListener("click", () => $("#navMenu")?.classList.toggle("open"));
  const theme = $("#themeToggle");
  if (localStorage.getItem("jhd-theme") === "light") { document.body.classList.add("light-mode"); if (theme) theme.textContent = "☀️"; }
  theme?.addEventListener("click", () => { document.body.classList.toggle("light-mode"); const light = document.body.classList.contains("light-mode"); localStorage.setItem("jhd-theme", light ? "light" : "dark"); theme.textContent = light ? "☀️" : "🌙"; });
}

function show(on) {
  ["#adminPanel", "#relationsPanel", "#recentPanel"].forEach((id) => $(id)?.classList.toggle("hidden", !on));
  $("#loginSection")?.classList.toggle("hidden", on);
}

const formData = (form) => Object.fromEntries(new FormData(form).entries());
const clean = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, String(v || "").trim()]).filter(([, v]) => v));
const slug = (v) => String(v || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
function payload(table, raw) { const p = clean(raw); if (table === "songs" && p.title) p.slug ||= slug(p.title); if ((table === "artists" || table === "categories") && p.name) p.slug ||= slug(p.name); return p; }

async function hasSession() {
  const { data } = await client.auth.getSession();
  const ok = Boolean(data?.session);
  show(ok);
  if (ok) await refresh();
  return ok;
}

async function add(table, raw, okText) {
  if (!await hasSession()) { note("#adminMessage", "Primero entra al panel."); return false; }
  const { error } = await client.from(table).insert([payload(table, raw)]);
  if (error) { note("#adminMessage", `Error: ${error.message}`); return false; }
  note("#adminMessage", okText);
  await refresh();
  return true;
}

function bind() {
  $("#loginForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = formData(e.currentTarget);
    note("#loginMessage", "Revisando acceso...");
    const { error } = await client.auth.signInWithOtp({ email: f.email, options: { emailRedirectTo: window.location.href } });
    note("#loginMessage", error ? error.message : "Revisa tu correo para entrar al panel.");
  });
  $("#logoutButton")?.addEventListener("click", async () => { await client.auth.signOut(); show(false); note("#loginMessage", "Sesión cerrada."); });
  $("#songForm")?.addEventListener("submit", async (e) => { e.preventDefault(); if (await add("songs", formData(e.currentTarget), "Canción guardada.")) e.currentTarget.reset(); });
  $("#artistForm")?.addEventListener("submit", async (e) => { e.preventDefault(); if (await add("artists", formData(e.currentTarget), "Artista guardado.")) e.currentTarget.reset(); });
  $("#categoryForm")?.addEventListener("submit", async (e) => { e.preventDefault(); if (await add("categories", formData(e.currentTarget), "Categoría guardada.")) e.currentTarget.reset(); });
  $("#songArtistForm")?.addEventListener("submit", async (e) => { e.preventDefault(); if (await add("song_artists", formData(e.currentTarget), "Artista unido.")) e.currentTarget.reset(); });
  $("#songCategoryForm")?.addEventListener("submit", async (e) => { e.preventDefault(); if (await add("song_categories", formData(e.currentTarget), "Categoría unida.")) e.currentTarget.reset(); });
  $("#refreshAdmin")?.addEventListener("click", refresh);
}

function options(items) { return '<option value="">Seleccionar...</option>' + items.map((x) => `<option value="${esc(x.id)}">${esc(x.title || x.name || x.id)}</option>`).join(""); }
function fill() { const so = options(songs), ao = options(artists), co = options(categories); if ($("#songArtistSong")) $("#songArtistSong").innerHTML = so; if ($("#songCategorySong")) $("#songCategorySong").innerHTML = so; if ($("#songArtistArtist")) $("#songArtistArtist").innerHTML = ao; if ($("#songCategoryCategory")) $("#songCategoryCategory").innerHTML = co; }
function renderRecent() { const box = $("#adminRecent"); if (!box) return; box.innerHTML = songs.length ? songs.slice(0, 6).map((s) => `<article class="song-card"><h3>${esc(s.title || "Sin título")}</h3><p>${esc(s.song_type || "Canción")}${s.tone ? ` · Tono ${esc(s.tone)}` : ""}</p></article>`).join("") : "<article class='song-card'><h3>Sin canciones</h3><p>Aún no hay registros.</p></article>"; }
async function refresh() { const [a, b, c] = await Promise.all([client.from("songs").select("*").order("created_at", { ascending: false }).limit(50), client.from("artists").select("*").order("name", { ascending: true }).limit(200), client.from("categories").select("*").order("name", { ascending: true }).limit(200)]); songs = a.data || []; artists = b.data || []; categories = c.data || []; fill(); renderRecent(); }

nav(); bind(); show(false); hasSession();
