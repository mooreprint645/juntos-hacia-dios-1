const Manage = window.supabaseClient;
const mq = (s) => document.querySelector(s);
const h = (v) => String(v || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
let type = "songs", rows = [];
const labels = { songs: "Canciones", artists: "Artistas", categories: "Categorías", albums: "Álbumes" };
const fields = { songs: ["title", "tone", "song_type", "lyrics"], artists: ["name", "artist_type", "description"], categories: ["name", "song_type", "description", "parent_id", "sort_order"], albums: ["title", "artist_id", "year", "description", "sort_order"] };
function msg(text) { const el = mq("#adminMessage"); if (el) el.textContent = text; }
async function signed() { const { data } = await Manage.auth.getSession(); return Boolean(data?.session); }
function mount() {
  const host = mq("#recentPanel");
  if (!host || mq("#managePanel")) return;
  const block = document.createElement("section");
  block.id = "managePanel";
  block.className = "section";
  block.innerHTML = `<div class="section-heading split-heading"><div><p class="hero-kicker">Administrar</p><h2>Editar o eliminar</h2></div><select id="manageType"><option value="songs">Canciones</option><option value="artists">Artistas</option><option value="categories">Categorías</option><option value="albums">Álbumes</option></select></div><div id="manageList" class="songs-grid"></div><div id="manageEditor"></div>`;
  host.append(block);
  mq("#manageType").addEventListener("change", (event) => { type = event.target.value; load(); });
}
function title(row) { return row.title || row.name || "Sin nombre"; }
function list() {
  const target = mq("#manageList");
  if (!target) return;
  target.innerHTML = rows.length ? rows.map((row) => `<article class="song-card"><h3>${h(title(row))}</h3><p>${h(row.description || row.tone || row.year || row.song_type || row.artist_type || "")}</p><div class="hero-actions"><button class="song-btn small-btn" data-edit="${h(row.id)}" type="button">Editar</button><button class="song-btn small-btn secondary" data-remove="${h(row.id)}" type="button">Eliminar</button></div></article>`).join("") : "<article class='song-card'><h3>Sin registros</h3><p>No hay contenido en esta sección.</p></article>";
  target.querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => edit(button.dataset.edit)));
  target.querySelectorAll("[data-remove]").forEach((button) => button.addEventListener("click", () => remove(button.dataset.remove)));
}
function edit(id) {
  const row = rows.find((item) => String(item.id) === String(id));
  const target = mq("#manageEditor");
  if (!row || !target) return;
  const controls = fields[type].map((key) => key === "description" || key === "lyrics" ? `<textarea name="${key}" rows="${key === "lyrics" ? 8 : 4}" placeholder="${key}">${h(row[key])}</textarea>` : `<input name="${key}" value="${h(row[key])}" placeholder="${key}">`).join("");
  target.innerHTML = `<article class="quick-card"><h3>Editar ${h(title(row))}</h3><form class="admin-form" id="manageForm">${controls}<div class="hero-actions"><button class="song-btn" type="submit">Guardar cambios</button><button class="song-btn secondary" type="button" id="cancelEdit">Cancelar</button></div></form></article>`;
  mq("#cancelEdit").addEventListener("click", () => { target.innerHTML = ""; });
  mq("#manageForm").addEventListener("submit", async (event) => { event.preventDefault(); const patch = Object.fromEntries(new FormData(event.currentTarget).entries()); Object.keys(patch).forEach((key) => { patch[key] = String(patch[key] || "").trim(); if (!patch[key]) patch[key] = null; }); if ((type === "songs" || type === "albums") && patch.title) patch.slug = String(patch.title).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, ""); if ((type === "artists" || type === "categories") && patch.name) patch.slug = String(patch.name).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, ""); const { error } = await Manage.from(type).update(patch).eq("id", id); if (error) { msg(`Error: ${error.message}`); return; } msg("Cambios guardados."); target.innerHTML = ""; load(); });
}
async function remove(id) {
  const row = rows.find((item) => String(item.id) === String(id));
  if (!row || !confirm(`¿Eliminar ${title(row)}? Esta acción no se puede deshacer.`)) return;
  const cleanup = { songs: ["song_artists", "song_categories", "album_songs", "song_links", "song_capo_versions"], artists: ["song_artists"], categories: ["song_categories"], albums: ["album_songs"] };
  const foreign = type === "songs" ? "song_id" : type === "artists" ? "artist_id" : type === "categories" ? "category_id" : "album_id";
  for (const table of cleanup[type] || []) { const { error } = await Manage.from(table).delete().eq(foreign, id); if (error) { msg(`No se pudo limpiar relaciones: ${error.message}`); return; } }
  if (type === "categories") { const children = await Manage.from("categories").select("id").eq("parent_id", id).limit(1); if (children.data?.length) { msg("No se puede eliminar una categoría con subcategorías. Muévelas primero."); return; } }
  const { error } = await Manage.from(type).delete().eq("id", id);
  if (error) { msg(`Error: ${error.message}`); return; }
  msg("Registro eliminado.");
  mq("#manageEditor").innerHTML = "";
  load();
}
async function load() {
  if (!await signed()) return;
  const order = type === "songs" || type === "albums" ? "title" : "name";
  const { data, error } = await Manage.from(type).select("*").order(order, { ascending: true }).limit(80);
  if (error) { msg(`Error: ${error.message}`); return; }
  rows = data || [];
  list();
}
function start() { mount(); load(); Manage.auth.onAuthStateChange(() => load()); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
