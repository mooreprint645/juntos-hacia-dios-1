(() => {
  if (window.__jhdSongCategoryFolderPicker) return;
  window.__jhdSongCategoryFolderPicker = true;

  const st = { open: false, type: "", id: "" };
  const id = (v) => String(v || "");
  const get = (v) => (AP.categories || []).find((x) => id(x.id) === id(v));
  const type = (x) => apNorm(x?.song_type || "") === "catolico" ? "catolico" : apNorm(x?.song_type || "") === "cristiano" ? "cristiano" : "general";
  const name = (v) => ({ catolico: "Católico", cristiano: "Cristiano", general: "General" }[v] || "General");
  const sort = (rows) => [...rows].sort((a,b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.name || "").localeCompare(String(b.name || ""), "es"));
  const kids = (parent) => sort((AP.categories || []).filter((x) => id(x.parent_id) === id(parent)));
  const roots = (t) => sort((AP.categories || []).filter((x) => !x.parent_id && type(x) === t));
  const path = (value) => { const out=[]; const seen=new Set(); let x=get(value); while(x && !seen.has(id(x.id))) { seen.add(id(x.id)); out.unshift(x); x=get(x.parent_id); } return out; };
  const pathText = (value) => path(value).map((x) => x.name || "Categoría").join(" › ");

  const style = document.createElement("style");
  style.id = "jhdSongFolderPickerStyle";
  style.textContent = `.jhd-song-category-native{display:none!important}.jhd-song-folder-picker{display:grid;gap:8px;margin-top:8px}.jhd-scp-summary{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:10px 11px;border:1px solid var(--border);border-radius:13px;background:var(--card-soft)}.jhd-scp-summary small{display:block;color:var(--muted);font-size:.78rem}.jhd-scp-summary strong{display:block;color:var(--gold);font-size:.9rem;max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.jhd-scp-panel{display:grid;gap:10px;padding:12px;border:1px solid var(--border);border-radius:15px;background:var(--card-soft)}.jhd-scp-text{margin:0;color:var(--muted);font-size:.87rem}.jhd-scp-text strong{color:var(--gold)}.jhd-scp-types,.jhd-scp-list{display:grid;gap:8px}.jhd-scp-types button,.jhd-scp-open{border:1px solid var(--border);border-radius:12px;background:var(--card);color:var(--text);padding:11px;text-align:left;font:inherit;font-weight:800;cursor:pointer}.jhd-scp-tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.jhd-scp-tools input{flex:1;min-width:150px}.jhd-scp-list{max-height:260px;overflow:auto}.jhd-scp-row{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;padding:9px;border:1px solid var(--border);border-radius:13px;background:var(--card)}.jhd-scp-open{border:0;background:transparent;padding:0;min-width:0}.jhd-scp-open small{display:block;margin-top:3px;color:var(--muted);font-size:.78rem}.jhd-scp-use{border:0;border-radius:10px;background:var(--gold);color:#1c1b18;padding:8px 10px;font:inherit;font-size:.8rem;font-weight:900;cursor:pointer}@media(max-width:620px){.jhd-scp-row{grid-template-columns:1fr}.jhd-scp-use{width:100%}.jhd-scp-summary strong{max-width:160px}}`;
  if (!document.getElementById(style.id)) document.head.append(style);

  function setup(select) {
    const label = select.closest("label");
    if (!label || label.dataset.jhdFolderPicker) return;
    label.dataset.jhdFolderPicker = "yes";
    label.querySelector(".song-cat-search")?.remove();
    select.classList.add("jhd-song-category-native");
    const host = document.createElement("div");
    host.className = "jhd-song-folder-picker";
    label.append(host);

    const choose = (value) => {
      select.value = value || "";
      select.dispatchEvent(new Event("input", { bubbles: true }));
      if (AP.draft) AP.draft.category_id = value || "";
      if (typeof apCaptureSongDraft === "function") apCaptureSongDraft();
      st.open = false; st.type = ""; st.id = ""; draw();
    };

    const draw = () => {
      const selected = get(select.value);
      const selectedText = selected ? pathText(selected.id) : "Sin categoría elegida";
      if (!st.open) {
        host.innerHTML = `<div class="jhd-scp-summary"><div><small>Categoría elegida</small><strong>${apEsc(selectedText)}</strong></div><button class="song-btn small-btn" type="button" data-scp-open>${selected ? "Cambiar" : "Elegir por carpetas"}</button></div>`;
        host.querySelector("[data-scp-open]").onclick = () => { st.open = true; draw(); };
        return;
      }

      let body = "";
      if (!st.type) {
        body = `<p class="jhd-scp-text">Primero elige el tipo de categoría:</p><div class="jhd-scp-types"><button type="button" data-scp-type="catolico">📁 Católico</button><button type="button" data-scp-type="cristiano">📁 Cristiano</button><button type="button" data-scp-type="general">📁 General</button></div>`;
      } else {
        const current = get(st.id);
        const list = current ? kids(current.id) : roots(st.type);
        const route = current ? `${name(type(current))} — ${pathText(current.id)}` : name(st.type);
        const useCurrent = current ? `<button class="song-btn small-btn" type="button" data-scp-use="${apEsc(current.id)}">Usar esta categoría para el canto</button>` : "";
        body = `<p class="jhd-scp-text">Ruta actual: <strong>${apEsc(route)}</strong></p>${useCurrent}<div class="jhd-scp-tools"><button class="song-btn small-btn secondary" type="button" data-scp-back>Volver</button><input type="search" placeholder="Buscar en esta carpeta" data-scp-search></div>${list.length ? `<div class="jhd-scp-list">${list.map((x) => `<article class="jhd-scp-row" data-scp-row><button class="jhd-scp-open" type="button" data-scp-folder="${apEsc(x.id)}"><strong>📁 ${apEsc(x.name || "Categoría")}</strong><small>${kids(x.id).length} subcarpeta(s)</small></button><button class="jhd-scp-use" type="button" data-scp-use="${apEsc(x.id)}">Usar</button></article>`).join("")}</div><p class="jhd-scp-text" data-scp-empty hidden>No hay carpetas que coincidan.</p>` : `<p class="jhd-scp-text">No hay categorías en este nivel.</p>`}`;
      }
      host.innerHTML = `<div class="jhd-scp-summary"><div><small>Categoría elegida</small><strong>${apEsc(selectedText)}</strong></div><button class="song-btn small-btn secondary" type="button" data-scp-close>Cerrar</button></div><div class="jhd-scp-panel">${body}<button class="song-btn small-btn secondary" type="button" data-scp-clear>Quitar categoría</button></div>`;
      host.querySelector("[data-scp-close]")?.addEventListener("click", () => { st.open=false; draw(); });
      host.querySelector("[data-scp-clear]")?.addEventListener("click", () => choose(""));
      host.querySelectorAll("[data-scp-type]").forEach((b) => b.addEventListener("click", () => { st.type=b.dataset.scpType; st.id=""; draw(); }));
      host.querySelectorAll("[data-scp-folder]").forEach((b) => b.addEventListener("click", () => { st.id=b.dataset.scpFolder; draw(); }));
      host.querySelectorAll("[data-scp-use]").forEach((b) => b.addEventListener("click", () => choose(b.dataset.scpUse || "")));
      host.querySelector("[data-scp-back]")?.addEventListener("click", () => { const current=get(st.id); if (current?.parent_id) st.id=current.parent_id; else { st.type=""; st.id=""; } draw(); });
      host.querySelector("[data-scp-search]")?.addEventListener("input", (e) => { const q=apNorm(e.target.value || ""); let count=0; host.querySelectorAll("[data-scp-row]").forEach((row) => { const show=!q || apNorm(row.textContent || "").includes(q); row.hidden=!show; if(show) count++; }); const empty=host.querySelector("[data-scp-empty]"); if(empty) empty.hidden=count>0; });
    };
    draw();
  }

  function attach() { document.querySelectorAll("#songAdminForm select[name='category_id']").forEach(setup); }
  const oldRender = apRenderView;
  apRenderView = function (...args) { oldRender.apply(this, args); attach(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", attach); else attach();
})();
