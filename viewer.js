const Viewer = window.JHD;
Viewer.detail = null;
Viewer.capo = () => {
  const d = Viewer.detail, s = d.song;
  return d.capoIndex < 0 ? { capo_position: s.capo_position || 0, capo_key: s.capo_key || "" } : (s._capoVersions || [])[d.capoIndex] || { capo_position: 0, capo_key: "" };
};
Viewer.steps = () => {
  const d = Viewer.detail;
  if (!d.capoMode) return d.transpose;
  const capo = Viewer.capo(), a = Viewer.noteIndex(Viewer.rootNote(d.song.tone)), b = Viewer.noteIndex(Viewer.rootNote(capo.capo_key));
  return d.transpose + (a >= 0 && b >= 0 ? b - a : -Number(capo.capo_position || 0));
};
Viewer.draw = () => {
  const box = Viewer.$("#songPage"), d = Viewer.detail, s = d.song, capo = Viewer.capo(), steps = Viewer.steps();
  const artist = (s._artists || []).map((a) => `<a href="artista.html?slug=${encodeURIComponent(a.slug || Viewer.slugify(a.name))}">${Viewer.esc(a.name)}</a>`).join(" · ") || "Sin artista";
  const resources = (s._links || []).map((link) => `<a class="song-link-item" href="${Viewer.esc(link.url)}" target="_blank" rel="noopener"><span>🔗</span><div><strong>${Viewer.esc(link.title || "Recurso")}</strong><small>${Viewer.esc([link.platform, link.link_type].filter(Boolean).join(" · "))}</small></div></a>`).join("");
  const choices = [`<button class="filter-btn ${!d.capoMode ? "active" : ""}" data-capo="off">Sin capo</button>`, ...(Number(s.capo_position || 0) ? [`<button class="filter-btn ${d.capoMode && d.capoIndex < 0 ? "active" : ""}" data-capo="main">Capo ${Viewer.esc(s.capo_position)}${s.capo_key ? ` · ${Viewer.esc(s.capo_key)}` : ""}</button>`] : []), ...(s._capoVersions || []).map((v, i) => `<button class="filter-btn ${d.capoMode && d.capoIndex === i ? "active" : ""}" data-capo="${i}">${Viewer.esc(v.label || `Capo ${v.capo_position || 0}${v.capo_key ? ` · ${v.capo_key}` : ""}`)}</button>`)].join("");
  box.innerHTML = `<article class="song-detail-card"><a class="song-btn small-btn secondary" href="canciones.html">← Volver a canciones</a><p class="artists-line">${artist}</p><h1>${Viewer.esc(s.title || "Canción")}</h1><p class="song-meta-line">${Viewer.esc(Viewer.songMeta(s))}</p><div class="transpose-box"><button class="song-btn small-btn" data-step="-1">Bajar tono</button><span>${d.transpose === 0 ? "Tono original" : `${d.transpose > 0 ? "+" : ""}${d.transpose}`}</span><button class="song-btn small-btn" data-step="1">Subir tono</button><button class="song-btn small-btn secondary" data-step="reset">Original</button></div><div class="capo-box"><span>${d.capoMode ? `Con capo ${capo.capo_position || 0}${capo.capo_key ? ` · Figuras en ${Viewer.esc(capo.capo_key)}` : ""}` : "Sin capo / tono original"}</span><div class="song-filters">${choices}</div></div><pre class="lyrics-block">${Viewer.renderChordLyrics(s.lyrics || "Letra no disponible.", steps)}</pre>${resources ? `<section class="song-links-box"><h2>Tutoriales y enlaces</h2><div class="song-links-list">${resources}</div></section>` : ""}</article>`;
  box.querySelectorAll("[data-step]").forEach((b) => b.addEventListener("click", () => { d.transpose = b.dataset.step === "reset" ? 0 : d.transpose + Number(b.dataset.step); Viewer.draw(); }));
  box.querySelectorAll("[data-capo]").forEach((b) => b.addEventListener("click", () => { const v = b.dataset.capo; d.capoMode = v !== "off"; d.capoIndex = v === "main" || v === "off" ? -1 : Number(v); d.transpose = 0; Viewer.draw(); }));
};
Viewer.loadDetail = async () => {
  if (Viewer.page() !== "cancion.html") return;
  const box = Viewer.$("#songPage"), id = Viewer.param("id"), slug = Viewer.param("slug");
  let wanted = id;
  if (!wanted && slug) { const { data } = await Viewer.sb.from("songs").select("id").eq("slug", slug).maybeSingle(); wanted = data?.id; }
  if (!wanted) { box.innerHTML = Viewer.errorCard("Canción no encontrada", "Vuelve al cancionero e intenta nuevamente."); return; }
  const result = await Viewer.fetchSongsWithRelations([wanted]);
  if (result.error || !result.data?.[0]) { box.innerHTML = Viewer.errorCard("Error al cargar", result.error?.message || "No se pudo cargar la canción."); return; }
  Viewer.detail = { song: result.data[0], transpose: 0, capoMode: false, capoIndex: -1 };
  document.title = `${Viewer.detail.song.title || "Canción"} | Juntos Hacia Dios`;
  Viewer.draw();
};
document.addEventListener("DOMContentLoaded", Viewer.loadDetail);
