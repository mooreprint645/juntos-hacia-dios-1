const AdminExtra = window.supabaseClient;
const ae = (s) => document.querySelector(s);
const dataOf = (form) => Object.fromEntries(new FormData(form).entries());
const trimValues = (row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, String(v || "").trim()]).filter(([, v]) => v));
const slugValue = (value) => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
let aeSongs = [], aeArtists = [], aeAlbums = [];

function choices(rows) { return '<option value="">Seleccionar...</option>' + rows.map((row) => `<option value="${row.id}">${row.title || row.name || row.id}</option>`).join(""); }
function select(id, html) { const field = ae(id); if (field) field.innerHTML = html; }
async function active() { const { data } = await AdminExtra.auth.getSession(); return Boolean(data?.session); }
async function save(table, form, message) {
  if (!await active()) return;
  const row = trimValues(dataOf(form));
  if (table === "albums" && row.title) row.slug = row.slug || slugValue(row.title);
  const { error } = await AdminExtra.from(table).insert([row]);
  const note = ae("#adminMessage");
  if (note) note.textContent = error ? `Error: ${error.message}` : message;
  if (!error) { form.reset(); await reload(); }
}
function bind(id, table, message) { ae(id)?.addEventListener("submit", (event) => { event.preventDefault(); save(table, event.currentTarget, message); }); }
function mount() {
  const host = ae("#relationsPanel .quick-cards");
  if (!host || ae("#albumForm")) return;
  host.insertAdjacentHTML("beforeend", `<article class="quick-card"><h3>Nuevo álbum</h3><form class="admin-form" id="albumForm"><input name="title" placeholder="Título" required><select name="artist_id" id="extraAlbumArtist"></select><input name="year" placeholder="Año"><textarea name="description" rows="3" placeholder="Descripción"></textarea><button class="song-btn" type="submit">Guardar álbum</button></form></article><article class="quick-card"><h3>Asignar álbum</h3><form class="admin-form" id="albumSongForm"><select name="song_id" id="extraAlbumSong" required></select><select name="album_id" id="extraAlbum"></select><button class="song-btn" type="submit">Unir canción</button></form></article><article class="quick-card"><h3>Agregar enlace</h3><form class="admin-form" id="linkForm"><select name="song_id" id="extraLinkSong" required></select><input name="title" placeholder="Título"><input name="platform" placeholder="Plataforma"><input name="link_type" placeholder="Tipo"><input name="url" type="url" placeholder="https://..." required><button class="song-btn" type="submit">Guardar enlace</button></form></article><article class="quick-card"><h3>Versión de capo</h3><form class="admin-form" id="capoForm"><select name="song_id" id="extraCapoSong" required></select><input name="label" placeholder="Ejemplo: Capo 2"><input name="capo_position" type="number" min="0" placeholder="Posición"><input name="capo_key" placeholder="Figuras en"><button class="song-btn" type="submit">Guardar capo</button></form></article><article class="quick-card"><h3>Donaciones</h3><form class="admin-form" id="donationForm"><input name="bank_name" placeholder="Banco"><input name="account_holder" placeholder="Titular"><input name="account_number" placeholder="Cuenta"><input name="account_type" placeholder="Tipo de cuenta"><textarea name="note" rows="3" placeholder="Nota"></textarea><button class="song-btn" type="submit">Guardar datos</button></form></article>`);
  bind("#albumForm", "albums", "Álbum guardado.");
  bind("#albumSongForm", "album_songs", "Canción unida al álbum.");
  bind("#linkForm", "song_links", "Enlace guardado.");
  bind("#capoForm", "song_capo_versions", "Versión de capo guardada.");
  bind("#donationForm", "donation_settings", "Datos de donación guardados.");
}
async function reload() {
  if (!await active()) return;
  const [songs, artists, albums] = await Promise.all([AdminExtra.from("songs").select("id,title").order("title"), AdminExtra.from("artists").select("id,name").order("name"), AdminExtra.from("albums").select("id,title").order("title")]);
  aeSongs = songs.data || []; aeArtists = artists.data || []; aeAlbums = albums.data || [];
  select("#extraAlbumArtist", choices(aeArtists));
  select("#extraAlbumSong", choices(aeSongs));
  select("#extraAlbum", choices(aeAlbums));
  select("#extraLinkSong", choices(aeSongs));
  select("#extraCapoSong", choices(aeSongs));
}
function loadManage() { const script = document.createElement("script"); script.src = "admin-manage.js?v=1"; document.head.append(script); }
function startExtra() { mount(); reload(); loadManage(); AdminExtra.auth.onAuthStateChange(() => reload()); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startExtra); else startExtra();
