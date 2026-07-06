const AdminTools = window.supabaseClient;
const tool$ = (selector) => document.querySelector(selector);
const toolEsc = (value) => String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
let toolSongs = [];

function toolMessage(text) {
  const box = tool$("#adminMessage");
  if (box) box.textContent = text || "";
}
function toolOptions(rows) {
  return '<option value="">Selecciona una canción</option>' + (rows || []).map((row) => `<option value="${toolEsc(row.id)}">${toolEsc(row.title || "Sin título")}</option>`).join("");
}
function toolName(row, key, fallback) {
  const item = row?.[key];
  return item?.name || item?.title || fallback;
}
async function toolSigned() {
  const { data } = await AdminTools.auth.getSession();
  return Boolean(data?.session);
}
function toolEmpty(text) {
  return `<p class="muted-text">${toolEsc(text)}</p>`;
}
function toolRelationBlock(title, rows, table, key, fallback) {
  if (!rows.length) return `<div><p class="hero-kicker">${toolEsc(title)}</p>${toolEmpty("Sin registros.")}</div>`;
  return `<div><p class="hero-kicker">${toolEsc(title)}</p>${rows.map((row) => `<div class="admin-list-item"><strong>${toolEsc(toolName(row, key, fallback))}</strong><div class="admin-actions"><button class="song-btn small-btn secondary" type="button" data-tool-remove-table="${toolEsc(table)}" data-tool-remove-id="${toolEsc(row.id)}">Quitar</button></div></div>`).join("")}</div>`;
}
function toolLinkForm(link) {
  return `<form class="admin-form admin-tool-form" data-tool-link-id="${toolEsc(link.id)}"><input name="title" value="${toolEsc(link.title)}" placeholder="Título" required><input name="platform" value="${toolEsc(link.platform)}" placeholder="Plataforma"><input name="link_type" value="${toolEsc(link.link_type)}" placeholder="Tipo"><input name="url" type="url" value="${toolEsc(link.url)}" placeholder="https://..." required><div class="hero-actions"><button class="song-btn small-btn" type="submit">Guardar enlace</button><button class="song-btn small-btn secondary" type="button" data-tool-remove-table="song_links" data-tool-remove-id="${toolEsc(link.id)}">Eliminar</button></div></form>`;
}
function toolCapoForm(capo) {
  return `<form class="admin-form admin-tool-form" data-tool-capo-id="${toolEsc(capo.id)}"><input name="label" value="${toolEsc(capo.label)}" placeholder="Etiqueta"><input name="capo_position" type="number" min="0" value="${toolEsc(capo.capo_position)}" placeholder="Posición"><input name="capo_key" value="${toolEsc(capo.capo_key)}" placeholder="Figuras en"><div class="hero-actions"><button class="song-btn small-btn" type="submit">Guardar capo</button><button class="song-btn small-btn secondary" type="button" data-tool-remove-table="song_capo_versions" data-tool-remove-id="${toolEsc(capo.id)}">Eliminar</button></div></form>`;
}

function bindToolRows(songId) {
  const panel = tool$("#adminToolsContent");
  if (!panel) return;
  panel.querySelectorAll("[data-tool-remove-id]").forEach((button) => button.addEventListener("click", async () => {
    if (!confirm("¿Quitar este registro?")) return;
    const { error } = await AdminTools.from(button.dataset.toolRemoveTable).delete().eq("id", button.dataset.toolRemoveId);
    if (error) { toolMessage(`Error: ${error.message}`); return; }
    toolMessage("Registro eliminado.");
    loadToolContent(songId);
  }));
  panel.querySelectorAll("[data-tool-link-id]").forEach((form) => form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const patch = Object.fromEntries(new FormData(form).entries());
    Object.keys(patch).forEach((key) => patch[key] = String(patch[key] || "").trim());
    const { error } = await AdminTools.from("song_links").update(patch).eq("id", form.dataset.toolLinkId);
    if (error) { toolMessage(`Error: ${error.message}`); return; }
    toolMessage("Enlace actualizado.");
    loadToolContent(songId);
  }));
  panel.querySelectorAll("[data-tool-capo-id]").forEach((form) => form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const patch = Object.fromEntries(new FormData(form).entries());
    patch.label = String(patch.label || "").trim() || null;
    patch.capo_key = String(patch.capo_key || "").trim() || null;
    patch.capo_position = Number(patch.capo_position || 0);
    const { error } = await AdminTools.from("song_capo_versions").update(patch).eq("id", form.dataset.toolCapoId);
    if (error) { toolMessage(`Error: ${error.message}`); return; }
    toolMessage("Versión de capo actualizada.");
    loadToolContent(songId);
  }));
}

async function loadToolContent(songId) {
  const panel = tool$("#adminToolsContent");
  if (!panel) return;
  if (!songId) { panel.innerHTML = toolEmpty("Elige una canción para administrar sus relaciones y recursos."); return; }
  panel.innerHTML = toolEmpty("Cargando contenido relacionado...");
  const [artistRes, categoryRes, albumRes, linksRes, capoRes] = await Promise.all([
    AdminTools.from("song_artists").select("id,artists(id,name)").eq("song_id", songId),
    AdminTools.from("song_categories").select("id,categories(id,name)").eq("song_id", songId),
    AdminTools.from("album_songs").select("id,albums(id,title)").eq("song_id", songId),
    AdminTools.from("song_links").select("*").eq("song_id", songId).order("sort_order", { ascending: true }),
    AdminTools.from("song_capo_versions").select("*").eq("song_id", songId).order("sort_order", { ascending: true })
  ]);
  const error = [artistRes, categoryRes, albumRes, linksRes, capoRes].find((result) => result.error)?.error;
  if (error) { panel.innerHTML = toolEmpty(`No se pudo cargar: ${error.message}`); return; }
  const artists = artistRes.data || [], categories = categoryRes.data || [], albums = albumRes.data || [], links = linksRes.data || [], capos = capoRes.data || [];
  panel.innerHTML = `<div class="admin-tools-grid">${toolRelationBlock("Artistas relacionados", artists, "song_artists", "artists", "Sin artista")}${toolRelationBlock("Categorías relacionadas", categories, "song_categories", "categories", "Sin categoría")}${toolRelationBlock("Álbumes relacionados", albums, "album_songs", "albums", "Sin álbum")}</div><div class="admin-tools-block"><p class="hero-kicker">Enlaces de la canción</p>${links.length ? links.map(toolLinkForm).join("") : toolEmpty("No hay enlaces guardados.")}</div><div class="admin-tools-block"><p class="hero-kicker">Versiones de capo</p>${capos.length ? capos.map(toolCapoForm).join("") : toolEmpty("No hay versiones de capo guardadas.")}</div>`;
  bindToolRows(songId);
}

function mountLyricsHelper() {
  const form = tool$("#songForm");
  const lyrics = form?.querySelector("[name='lyrics']");
  if (!form || !lyrics || tool$("#lyricsHelper")) return;
  const helper = document.createElement("div");
  helper.id = "lyricsHelper";
  helper.className = "admin-list-item";
  helper.innerHTML = `<p class="hero-kicker">Editor de letra</p><div class="hero-actions"><button class="song-btn small-btn" type="button" data-tool-section="Intro">+ Intro</button><button class="song-btn small-btn" type="button" data-tool-section="Verso">+ Verso</button><button class="song-btn small-btn" type="button" data-tool-section="Coro">+ Coro</button><button class="song-btn small-btn" type="button" data-tool-section="Puente">+ Puente</button></div><pre class="muted-text" id="lyricsPreview">Vista previa de la letra.</pre>`;
  lyrics.after(helper);
  const preview = helper.querySelector("#lyricsPreview");
  const showPreview = () => { preview.textContent = lyrics.value || "Vista previa de la letra."; };
  helper.querySelectorAll("[data-tool-section]").forEach((button) => button.addEventListener("click", () => {
    const token = `\n[${button.dataset.toolSection}]\n`;
    const start = lyrics.selectionStart || lyrics.value.length;
    const end = lyrics.selectionEnd || start;
    lyrics.value = lyrics.value.slice(0, start) + token + lyrics.value.slice(end);
    lyrics.focus();
    lyrics.setSelectionRange(start + token.length, start + token.length);
    showPreview();
  }));
  lyrics.addEventListener("input", showPreview);
  showPreview();
}

async function loadToolSongs() {
  if (!await toolSigned()) return;
  const { data, error } = await AdminTools.from("songs").select("id,title").order("title", { ascending: true });
  if (error) return;
  toolSongs = data || [];
  const select = tool$("#adminToolsSong");
  if (select) select.innerHTML = toolOptions(toolSongs);
}
function mountAdminTools() {
  const host = tool$("#relationsPanel .quick-cards");
  if (!host || tool$("#adminToolsPanel")) { mountLyricsHelper(); return; }
  const card = document.createElement("article");
  card.className = "quick-card";
  card.id = "adminToolsPanel";
  card.innerHTML = `<h3>Gestionar relaciones y recursos</h3><p class="muted-text">Edita o elimina enlaces, capos, artistas, categorías y álbumes ya relacionados.</p><select id="adminToolsSong"></select><div id="adminToolsContent">${toolEmpty("Elige una canción.")}</div>`;
  host.append(card);
  tool$("#adminToolsSong")?.addEventListener("change", (event) => loadToolContent(event.target.value));
  mountLyricsHelper();
}
function startAdminTools() {
  mountAdminTools();
  loadToolSongs();
  AdminTools.auth.onAuthStateChange(() => { loadToolSongs(); mountLyricsHelper(); });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startAdminTools); else startAdminTools();
