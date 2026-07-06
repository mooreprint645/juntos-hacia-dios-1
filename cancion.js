const client = window.supabaseClient;
const params = new URLSearchParams(window.location.search);
const idParam = params.get("id");
const slugParam = params.get("slug");
const $ = (selector) => document.querySelector(selector);
let currentSong = null;
let transpose = 0;
let capoShift = 0;
let capoLabel = "Sin capo";

const escapeHTML = (value) => String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const N = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const flat = { Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#" };
const rootNote = (value) => (String(value || "").match(/[A-G](?:#|b)?/) || [""])[0];
const toneIndex = (value) => N.indexOf(flat[String(value || "")] || String(value || ""));
const moveNote = (value, move) => { const index = toneIndex(value); return index < 0 ? value : N[(index + Number(move || 0) + 120) % 12]; };
const chord = (value, move) => String(value || "").replace(/^([A-G](?:#|b)?)(.*)$/, (_, root, rest) => {
  const bass = String(rest || "").replace(/\/([A-G](?:#|b)?)/g, (match, note) => `/${moveNote(note, move)}`);
  return moveNote(root, move) + bass;
});
const chordGroup = (value, move) => String(value || "").replace(/[A-G](?:#|b)?[a-zA-Z0-9#b+\-susmajdimaug/()]*/g, (item) => chord(item, move));
const capoOffset = (position, capoKey) => {
  const original = toneIndex(rootNote(currentSong?.tone || currentSong?.key));
  const shape = toneIndex(rootNote(capoKey));
  if (original >= 0 && shape >= 0) return shape - original;
  return -Number(position || 0);
};

function initNavigation() {
  const menuButton = $("#menuToggle"), menu = $("#navMenu"), themeButton = $("#themeToggle");
  menuButton?.addEventListener("click", () => menu?.classList.toggle("open"));
  if (localStorage.getItem("jhd-theme") === "light") { document.body.classList.add("light-mode"); if (themeButton) themeButton.textContent = "☀️"; }
  themeButton?.addEventListener("click", () => { document.body.classList.toggle("light-mode"); const light = document.body.classList.contains("light-mode"); localStorage.setItem("jhd-theme", light ? "light" : "dark"); themeButton.textContent = light ? "☀️" : "🌙"; });
}

function setSongError(message) {
  $("#songTitle").textContent = "No se pudo cargar";
  $("#songSubtitle").textContent = message;
  $("#songLyrics").textContent = "Vuelve a la lista de canciones e intenta abrir el canto nuevamente.";
}

function names(items) { return (items || []).map((item) => item?.name || item?.title || "").filter(Boolean).join(" · "); }
function categoryKey(category) { return category?.slug || category?.id || ""; }
function categoryPath(category, allCategories) {
  const path = [];
  const seen = new Set();
  let current = category;
  while (current && !seen.has(String(current.id))) {
    seen.add(String(current.id));
    path.unshift(current);
    current = (allCategories || []).find((item) => String(item.id) === String(current.parent_id));
  }
  return path;
}
function localReferrer() {
  try {
    const url = new URL(document.referrer || "");
    return url.origin === location.origin && !url.pathname.endsWith("/cancion.html") ? url : null;
  } catch (_) { return null; }
}
function prepareReaderToolbar() {
  const meta = $("#songMeta");
  if (!meta) return null;
  let toolbar = $("#songReaderToolbar");
  if (!toolbar) {
    toolbar = document.createElement("aside");
    toolbar.id = "songReaderToolbar";
    toolbar.className = "song-reader-toolbar";
    meta.parentElement?.insertBefore(toolbar, meta);
    toolbar.append(meta);
  }
  if (!$("#songBackBar")) {
    const back = document.createElement("div");
    back.id = "songBackBar";
    back.className = "song-back-bar";
    toolbar.prepend(back);
  }
  return toolbar;
}
function renderReaderNavigation(song, relations) {
  const primaryCategory = (relations.categories || [])[0];
  const path = primaryCategory ? categoryPath(primaryCategory, relations.categoryTree || []) : [];
  const hero = document.querySelector(".hero .hero-content");
  let breadcrumb = $("#songBreadcrumb");
  if (!breadcrumb && hero) {
    breadcrumb = document.createElement("nav");
    breadcrumb.id = "songBreadcrumb";
    breadcrumb.className = "song-breadcrumb";
    breadcrumb.setAttribute("aria-label", "Ruta de navegación");
    hero.prepend(breadcrumb);
  }
  if (breadcrumb) {
    const crumbs = [
      `<a href="index.html">Inicio</a>`,
      `<span>›</span>`,
      `<a href="canciones.html">Canciones</a>`,
      ...path.flatMap((item, index) => {
        const finalCategory = index === path.length - 1;
        const key = encodeURIComponent(categoryKey(item));
        const href = finalCategory ? `categorias.html?categoria=${key}` : `categorias.html?carpeta=${key}`;
        return [`<span>›</span>`, `<a href="${href}">${escapeHTML(item.name || "Categoría")}</a>`];
      }),
      `<span>›</span>`,
      `<span aria-current="page">${escapeHTML(song.title || "Canción")}</span>`
    ];
    breadcrumb.innerHTML = crumbs.join("");
  }

  const toolbar = prepareReaderToolbar();
  const backBar = $("#songBackBar");
  if (!toolbar || !backBar) return;
  const referrer = localReferrer();
  const pathName = referrer?.pathname.split("/").pop() || "";
  const fallback = referrer ? `${referrer.pathname}${referrer.search}${referrer.hash}` : primaryCategory ? `categorias.html?categoria=${encodeURIComponent(categoryKey(primaryCategory))}` : "canciones.html";
  const label = pathName === "categorias.html" ? "← Volver a Categorías" : pathName === "artista.html" || pathName === "artistas.html" ? "← Volver al artista" : pathName === "albumes.html" ? "← Volver al álbum" : "← Volver a Canciones";
  backBar.innerHTML = `<a class="song-back-link" id="songBackLink" href="${fallback}">${label}</a>`;
  $("#songBackLink")?.addEventListener("click", (event) => {
    if (referrer && history.length > 1) { event.preventDefault(); history.back(); }
  });
}

async function loadRelations(songId) {
  const [artistRes, categoryRes, linksRes, capoRes, allCategoriesRes] = await Promise.all([
    client.from("song_artists").select("artists(id,name,slug,artist_type)").eq("song_id", songId),
    client.from("song_categories").select("categories(id,name,slug,song_type,parent_id)").eq("song_id", songId),
    client.from("song_links").select("*").eq("song_id", songId).order("sort_order", { ascending: true }),
    client.from("song_capo_versions").select("*").eq("song_id", songId).order("sort_order", { ascending: true }),
    client.from("categories").select("id,name,slug,parent_id,sort_order").order("sort_order", { ascending: true }).order("name", { ascending: true })
  ]);
  return {
    artists: (artistRes.data || []).map((row) => row.artists).filter(Boolean),
    categories: (categoryRes.data || []).map((row) => row.categories).filter(Boolean),
    links: linksRes.data || [],
    capos: capoRes.data || [],
    categoryTree: allCategoriesRes.data || []
  };
}

function renderChordLyrics() {
  const target = $("#songLyrics");
  if (!target || !currentSong) return;
  const lyrics = currentSong.lyrics || currentSong.letter || currentSong.content || "Letra no disponible.";
  const move = transpose + capoShift;
  target.className = "lyrics-block";
  target.innerHTML = String(lyrics).split("\n").map((line) => {
    if (!line.trim()) return "<span class='song-empty-line'></span>";
    const section = line.trim().match(/^\[([^\]]+)\]$/);
    if (section) return `<span class="song-section-label">${escapeHTML(section[1])}</span>`;
    if (!line.includes("(")) return `<span class="song-plain-line">${escapeHTML(line)}</span>`;
    let chordLine = "", lyricLine = "", position = 0, last = 0, match;
    const regex = /\(([^)]+)\)/g;
    while ((match = regex.exec(line)) !== null) { const before = line.slice(last, match.index); lyricLine += before; position += before.length; while (chordLine.length < position) chordLine += " "; chordLine += chordGroup(match[1], move); last = regex.lastIndex; }
    lyricLine += line.slice(last);
    return `<span class="song-line"><span class="chord-line">${escapeHTML(chordLine)}</span><span class="lyric-line">${escapeHTML(lyricLine)}</span></span>`;
  }).join("");
  const status = $("#transposeStatus");
  if (status) status.textContent = `${transpose === 0 ? "Tono original" : `Transposición ${transpose > 0 ? "+" : ""}${transpose}`} · ${capoLabel}`;
}

function renderControls(relations) {
  const toolbar = prepareReaderToolbar();
  if (!toolbar || $("#transposeBox")) return;
  const versions = relations.capos || [];
  const mainCapo = Number(currentSong.capo_position || 0);
  const mainKey = currentSong.capo_key || "";
  const mainButton = mainCapo > 0 ? `<button class="song-btn small-btn" data-position="${mainCapo}" data-key="${escapeHTML(mainKey)}" data-label="Capo ${mainCapo}${mainKey ? ` · Figuras en ${escapeHTML(mainKey)}` : ""}">Capo ${mainCapo}</button>` : "";
  const versionButtons = versions.map((item) => {
    const position = Number(item.capo_position || 0);
    const key = item.capo_key || "";
    const label = item.label || `Capo ${position}${key ? ` · Figuras en ${key}` : ""}`;
    return `<button class="song-btn small-btn" data-position="${position}" data-key="${escapeHTML(key)}" data-label="${escapeHTML(label)}">${escapeHTML(label)}</button>`;
  }).join("");
  toolbar.insertAdjacentHTML("beforeend", `<div class="song-reader-controls"><div class="transpose-box" id="transposeBox"><button class="song-btn small-btn" data-tone="-1">Bajar tono</button><span id="transposeStatus">Tono original · Sin capo</span><button class="song-btn small-btn" data-tone="1">Subir tono</button><button class="song-btn small-btn secondary" data-tone="0">Original</button></div><div class="song-filters" id="capoControls"><button class="filter-btn active" data-position="0" data-key="" data-label="Sin capo">Sin capo</button>${mainButton}${versionButtons}</div></div>`);
  $("#transposeBox").querySelectorAll("[data-tone]").forEach((button) => button.addEventListener("click", () => { const value = Number(button.dataset.tone); transpose = value === 0 ? 0 : transpose + value; renderChordLyrics(); }));
  $("#capoControls").querySelectorAll("[data-position]").forEach((button) => button.addEventListener("click", () => { capoShift = capoOffset(button.dataset.position, button.dataset.key); capoLabel = button.dataset.label || "Sin capo"; $("#capoControls").querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button)); renderChordLyrics(); }));
}

function renderMeta(song, relations) {
  const items = [song.song_type || song.type, names(relations.categories), song.tone || song.key, names(relations.artists)].filter(Boolean);
  const meta = $("#songMeta");
  if (meta) meta.innerHTML = items.length ? items.map((item) => `<span class="filter-btn">${escapeHTML(item)}</span>`).join("") : "<span class='filter-btn'>Sin metadatos</span>";
}

function renderLinks(relations) {
  const container = $("#songLinks");
  if (!container) return;
  const links = relations.links || [];
  container.innerHTML = links.length ? links.map((link) => `<a class="quick-card" href="${escapeHTML(link.url || "#")}" target="_blank" rel="noopener"><h3>${escapeHTML(link.title || link.link_type || "Recurso")}</h3><p>${escapeHTML([link.platform, link.link_type].filter(Boolean).join(" · ") || "Abrir recurso")}</p></a>`).join("") : "<article class='quick-card'><h3>Sin recursos</h3><p>Aún no hay enlaces disponibles para esta canción.</p></article>";
}

function renderSong(song, relations) {
  currentSong = song;
  const title = song.title || song.name || "Canción sin título";
  const type = song.song_type || song.type || "Canción";
  const artistText = names(relations.artists) || song.artist || song.artist_name || "";
  document.title = `${title} | Juntos Hacia Dios`;
  $("#songType").textContent = type;
  $("#songTitle").textContent = title;
  $("#songSubtitle").textContent = artistText ? `Por ${artistText}` : "Canción del cancionero.";
  renderReaderNavigation(song, relations);
  renderMeta(song, relations);
  renderControls(relations);
  renderChordLyrics();
  renderLinks(relations);
}

async function loadSong() {
  if (!idParam && !slugParam) { setSongError("No se encontró el identificador de la canción."); return; }
  if (!client) { setSongError("No se pudo iniciar la conexión con Supabase."); return; }
  let query = client.from("songs").select("*");
  query = idParam ? query.eq("id", idParam) : query.eq("slug", slugParam);
  const { data, error } = await query.single();
  if (error || !data) { setSongError("La canción no existe o no pudo cargarse desde Supabase."); return; }
  const relations = await loadRelations(data.id);
  renderSong(data, relations);
}

initNavigation();
loadSong();
