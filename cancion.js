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
const moveNote = (value, move) => {
  const index = toneIndex(value);
  return index < 0 ? value : N[(index + Number(move || 0) + 120) % 12];
};
const chord = (value, move) => String(value || "").replace(/^([A-G](?:#|b)?)(.*)$/, (_, root, rest) => {
  const bass = String(rest || "").replace(/\/([A-G](?:#|b)?)/g, (_match, note) => `/${moveNote(note, move)}`);
  return moveNote(root, move) + bass;
});
const isChordToken = (value) => /^[A-G](?:#|b)?(?:maj(?:7|9|11|13)?|m(?:maj7|[0-9]*)?|min(?:[0-9]*)?|sus[24]?|add\d+|dim7?|aug|\+|-|[0-9]*)?(?:\/[A-G](?:#|b)?)?$/.test(String(value || "").trim());
const isChordGroup = (value) => {
  const tokens = String(value || "").trim().split(/\s+/).filter(Boolean);
  return tokens.length > 0 && tokens.every(isChordToken);
};
const chordGroup = (value, move) => String(value || "").split(/(\s+)/).map((token) => isChordToken(token) ? chord(token, move) : token).join("");
const capoOffset = (position, capoKey) => {
  const original = toneIndex(rootNote(currentSong?.tone || currentSong?.key));
  const shape = toneIndex(rootNote(capoKey));
  if (original >= 0 && shape >= 0) return shape - original;
  return -Number(position || 0);
};

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

function setSongError(message) {
  $("#songTitle").textContent = "No se pudo cargar";
  $("#songSubtitle").textContent = message;
  $("#songLyrics").textContent = "Vuelve a la lista de canciones e intenta abrir el canto nuevamente.";
}

function names(items) {
  return (items || []).map((item) => item?.name || item?.title || "").filter(Boolean).join(" · ");
}

function categoryKey(category) {
  return category?.slug || category?.id || "";
}

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
  } catch (_) {
    return null;
  }
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
      `<span aria-hidden="true">›</span>`,
      `<a href="canciones.html">Canciones</a>`,
      ...path.flatMap((item, index) => {
        const finalCategory = index === path.length - 1;
        const key = encodeURIComponent(categoryKey(item));
        const href = finalCategory ? `categorias.html?categoria=${key}` : `categorias.html?carpeta=${key}`;
        return [`<span aria-hidden="true">›</span>`, `<a href="${href}">${escapeHTML(item.name || "Categoría")}</a>`];
      }),
      `<span aria-hidden="true">›</span>`,
      `<span aria-current="page">${escapeHTML(song.title || "Canción")}</span>`
    ];
    breadcrumb.innerHTML = crumbs.join("");
  }

  const toolbar = prepareReaderToolbar();
  const backBar = $("#songBackBar");
  if (!toolbar || !backBar) return;

  const referrer = localReferrer();
  const pathName = referrer?.pathname.split("/").pop() || "";
  const fallback = referrer
    ? `${referrer.pathname}${referrer.search}${referrer.hash}`
    : primaryCategory
      ? `categorias.html?categoria=${encodeURIComponent(categoryKey(primaryCategory))}`
      : "canciones.html";
  const label = pathName === "categorias.html"
    ? "← Volver a Categorías"
    : pathName === "artista.html" || pathName === "artistas.html"
      ? "← Volver al artista"
      : pathName === "albumes.html"
        ? "← Volver al álbum"
        : "← Volver a Canciones";
  backBar.innerHTML = `<a class="song-back-link" id="songBackLink" href="${fallback}">${label}</a>`;
  $("#songBackLink")?.addEventListener("click", (event) => {
    if (referrer && history.length > 1) {
      event.preventDefault();
      history.back();
    }
  });
}

async function loadRelations(songId) {
  const [artistRes, categoryRes, albumRes, linksRes, capoRes, allCategoriesRes] = await Promise.all([
    client.from("song_artists").select("artists(id,name,slug,artist_type)").eq("song_id", songId),
    client.from("song_categories").select("categories(id,name,slug,song_type,parent_id)").eq("song_id", songId),
    client.from("album_songs").select("albums(id,title,slug,artist_id)").eq("song_id", songId),
    client.from("song_links").select("*").eq("song_id", songId).order("sort_order", { ascending: true }),
    client.from("song_capo_versions").select("*").eq("song_id", songId).order("sort_order", { ascending: true }),
    client.from("categories").select("id,name,slug,parent_id,sort_order").order("sort_order", { ascending: true }).order("name", { ascending: true })
  ]);
  return {
    artists: (artistRes.data || []).map((row) => row.artists).filter(Boolean),
    categories: (categoryRes.data || []).map((row) => row.categories).filter(Boolean),
    albums: (albumRes.data || []).map((row) => row.albums).filter(Boolean),
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

    const regex = /\(([^)]+)\)/g;
    let chordLine = "";
    let lyricLine = "";
    let position = 0;
    let last = 0;
    let match;
    let hasChords = false;

    while ((match = regex.exec(line)) !== null) {
      const before = line.slice(last, match.index);
      lyricLine += before;
      position += before.length;

      if (isChordGroup(match[1])) {
        while (chordLine.length < position) chordLine += " ";
        chordLine += chordGroup(match[1], move);
        hasChords = true;
      } else {
        lyricLine += match[0];
        position += match[0].length;
      }
      last = regex.lastIndex;
    }

    if (!hasChords) return `<span class="song-plain-line">${escapeHTML(line)}</span>`;
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
  const mainButton = mainCapo > 0
    ? `<button class="song-btn small-btn" type="button" data-position="${mainCapo}" data-key="${escapeHTML(mainKey)}" data-label="Capo ${mainCapo}${mainKey ? ` · Figuras en ${escapeHTML(mainKey)}` : ""}">Capo ${mainCapo}</button>`
    : "";
  const versionButtons = versions.map((item) => {
    const position = Number(item.capo_position || 0);
    const key = item.capo_key || "";
    const label = item.label || `Capo ${position}${key ? ` · Figuras en ${key}` : ""}`;
    return `<button class="song-btn small-btn" type="button" data-position="${position}" data-key="${escapeHTML(key)}" data-label="${escapeHTML(label)}">${escapeHTML(label)}</button>`;
  }).join("");

  toolbar.insertAdjacentHTML("beforeend", `<div class="song-reader-controls"><div class="transpose-box" id="transposeBox" aria-label="Control de tono"><button class="song-btn small-btn" type="button" data-tone="-1" aria-label="Bajar un semitono">Bajar tono</button><span id="transposeStatus" aria-live="polite">Tono original · Sin capo</span><button class="song-btn small-btn" type="button" data-tone="1" aria-label="Subir un semitono">Subir tono</button><button class="song-btn small-btn secondary" type="button" data-tone="0">Original</button></div><div class="song-filters" id="capoControls" aria-label="Opciones de capo"><button class="filter-btn active" type="button" data-position="0" data-key="" data-label="Sin capo" aria-pressed="true">Sin capo</button>${mainButton}${versionButtons}</div></div>`);

  $("#transposeBox").querySelectorAll("[data-tone]").forEach((button) => button.addEventListener("click", () => {
    const value = Number(button.dataset.tone);
    transpose = value === 0 ? 0 : transpose + value;
    renderChordLyrics();
  }));

  $("#capoControls").querySelectorAll("[data-position]").forEach((button) => button.addEventListener("click", () => {
    capoShift = capoOffset(button.dataset.position, button.dataset.key);
    capoLabel = button.dataset.label || "Sin capo";
    $("#capoControls").querySelectorAll("button").forEach((item) => {
      const selected = item === button;
      item.classList.toggle("active", selected);
      item.setAttribute("aria-pressed", String(selected));
    });
    renderChordLyrics();
  }));
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
  container.hidden = links.length === 0;
  container.innerHTML = links.length ? links.map((link) => `<a class="quick-card" href="${escapeHTML(link.url || "#")}" target="_blank" rel="noopener"><h3>${escapeHTML(link.title || link.link_type || "Recurso")}</h3><p>${escapeHTML([link.platform, link.link_type].filter(Boolean).join(" · ") || "Abrir recurso")}</p></a>`).join("") : "";
}

async function renderRelatedSongs(song, relations) {
  const section = $("#relatedSongsSection");
  const grid = $("#relatedSongsGrid");
  if (!section || !grid) return;
  const artistIds = (relations.artists || []).map((artist) => artist.id).filter(Boolean);
  const categoryIds = (relations.categories || []).map((category) => category.id).filter(Boolean);
  const albumIds = (relations.albums || []).map((album) => album.id).filter(Boolean);
  if (!artistIds.length && !categoryIds.length && !albumIds.length) {
    section.hidden = true;
    return;
  }

  grid.innerHTML = "<article class='song-card shimmer-card'><h3>Buscando cantos relacionados…</h3><p>Un momento por favor.</p></article>";
  section.hidden = false;

  const requests = [];
  if (artistIds.length) requests.push(client.from("song_artists").select("song_id").in("artist_id", artistIds));
  if (categoryIds.length) requests.push(client.from("song_categories").select("song_id").in("category_id", categoryIds));
  if (albumIds.length) requests.push(client.from("album_songs").select("song_id").in("album_id", albumIds));
  const responses = await Promise.all(requests);
  if (responses.some((response) => response.error)) {
    section.hidden = true;
    return;
  }

  const candidateIds = [...new Set(responses.flatMap((response) => (response.data || []).map((row) => row.song_id)).filter((id) => String(id) !== String(song.id)))];
  if (!candidateIds.length) {
    section.hidden = true;
    return;
  }

  const result = await client.from("songs").select("id,title,slug,song_type,tone").in("id", candidateIds).order("title", { ascending: true }).limit(30);
  if (result.error || !(result.data || []).length) {
    section.hidden = true;
    return;
  }

  const score = new Map();
  responses.forEach((response, index) => {
    const weight = artistIds.length && index === 0 ? 3 : categoryIds.length && index === (artistIds.length ? 1 : 0) ? 2 : 1;
    (response.data || []).forEach((row) => {
      const id = String(row.song_id);
      score.set(id, (score.get(id) || 0) + weight);
    });
  });

  const suggestions = (result.data || [])
    .sort((a, b) => (score.get(String(b.id)) || 0) - (score.get(String(a.id)) || 0) || String(a.title || "").localeCompare(String(b.title || ""), "es"))
    .slice(0, 6);

  grid.innerHTML = suggestions.map((item) => {
    const href = item.slug ? `cancion.html?slug=${encodeURIComponent(item.slug)}` : `cancion.html?id=${encodeURIComponent(item.id)}`;
    const meta = [item.song_type || "Canción", item.tone ? `Tono ${item.tone}` : ""].filter(Boolean).join(" · ");
    return `<a class="song-card song-link-card" href="${href}"><p class="artists-line">${escapeHTML(meta)}</p><h3>${escapeHTML(item.title || "Canción")}</h3><p>Ver letra y acordes</p></a>`;
  }).join("");
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
  renderRelatedSongs(song, relations);
}

async function loadSong() {
  if (!idParam && !slugParam) {
    setSongError("No se encontró el identificador de la canción.");
    return;
  }
  if (!client) {
    setSongError("No se pudo iniciar la conexión con Supabase.");
    return;
  }
  let query = client.from("songs").select("*");
  query = idParam ? query.eq("id", idParam) : query.eq("slug", slugParam);
  const { data, error } = await query.single();
  if (error || !data) {
    setSongError("La canción no existe o no pudo cargarse desde Supabase.");
    return;
  }
  const relations = await loadRelations(data.id);
  renderSong(data, relations);
}

initNavigation();
loadSong();