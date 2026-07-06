(() => {
  const style = document.createElement("style");
  style.id = "adminVisualPolish";
  style.textContent = `
    .admin-tabs{position:sticky;top:0;z-index:30;margin:0 -2px 14px;padding:10px 2px 12px;background:linear-gradient(180deg,var(--card) 78%,rgba(0,0,0,0));backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
    .admin-filter-row{display:flex;flex-wrap:wrap;gap:10px;align-items:stretch;grid-template-columns:none}
    .admin-filter-row>input[type="search"]{flex:1 1 100%;min-width:0;order:-1}
    .admin-filter-row>select{flex:1 1 180px;min-width:0;width:auto}
    .admin-form-toggle{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 14px;padding:11px 12px;border:1px solid var(--border);border-radius:15px;background:var(--card-soft)}
    .admin-form-toggle span{font-size:.9rem;color:var(--muted);font-weight:700}
    .admin-form-toggle .song-btn{margin-left:auto}
    .admin-form-collapsible{margin:0 0 16px;border:1px solid var(--border);border-radius:18px;background:var(--card-soft);overflow:hidden}
    .admin-form-collapsible>summary{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 15px;cursor:pointer;list-style:none;font-weight:900;color:var(--gold)}
    .admin-form-collapsible>summary::-webkit-details-marker{display:none}
    .admin-form-collapsible>summary::after{content:"⌄";font-size:1.15rem;transition:transform .18s ease}
    .admin-form-collapsible[open]>summary::after{transform:rotate(180deg)}
    .admin-form-collapsible form{padding:0 15px 16px}
    .admin-form-collapsible .admin-editor-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0;padding:0 15px 13px}
    .admin-form-collapsible .admin-editor-head h3{display:none}
    .admin-card{padding:15px}
    .admin-list-item{padding:12px 13px;border-radius:17px}
    .admin-list-item h4{font-size:1rem}.admin-list-item p{font-size:.9rem}.admin-list-item .admin-actions{margin-top:10px}.admin-list-item .song-btn{padding:8px 12px;font-size:.86rem}
    .admin-section-heading{margin-bottom:11px}.admin-section-heading h2{font-size:1.3rem}.admin-count{font-size:.84rem;padding:7px 9px;border-radius:999px;background:var(--card-soft);border:1px solid var(--border)}
    @media(max-width:920px){.admin-filter-row>select{flex-basis:100%}}
    @media(max-width:620px){.admin-tabs{top:0;margin:0 -4px 12px;padding:9px 4px 11px}.admin-form-toggle{padding:10px 11px}.admin-form-toggle span{font-size:.82rem}.admin-form-collapsible>summary{padding:13px}.admin-form-collapsible form{padding:0 13px 14px}.admin-list-item .admin-actions{display:grid;grid-template-columns:1fr 1fr}.admin-list-item .song-btn{width:100%}}
  `;
  if (!document.getElementById(style.id)) document.head.append(style);

  const searchIds = new Set(["artistFilter", "categoryFilter", "albumFilter", "songFilter"]);
  const formInfo = {
    artists: { form: "#artistAdminForm", copy: "Agregar artista o ministerio" },
    categories: { form: "#categoryAdminForm", copy: "Agregar categoría o carpeta" },
    albums: { form: "#albumAdminForm", copy: "Agregar álbum o carpeta" },
    songs: { form: "#songAdminForm", copy: "Agregar canto, acordes, capo y enlaces" },
    donations: { form: "#donationAdminForm", copy: "Actualizar datos de apoyo" }
  };
  const editKey = { artists: "artist", categories: "category", albums: "album", songs: "song", donations: "donation" };
  const originalRenderView = apRenderView;

  AP.visualForms = AP.visualForms || {};

  function enhanceForm() {
    const tab = AP.tab;
    const info = formInfo[tab];
    if (!info) return;
    const form = document.querySelector(info.form);
    const card = form?.closest(".admin-card");
    if (!form || !card || card.dataset.visualPolished === "yes") return;

    card.dataset.visualPolished = "yes";
    const head = card.querySelector(".admin-editor-head");
    const title = head?.querySelector("h3")?.textContent?.trim() || (tab === "donations" ? "Editar donaciones" : "Nuevo registro");
    const editing = tab === "donations" ? Boolean(AP.donation?.id) : Boolean(AP.edits?.[editKey[tab]]);
    const details = document.createElement("details");
    details.className = "admin-form-collapsible";
    details.open = editing || Boolean(AP.visualForms[tab]);
    const summary = document.createElement("summary");
    const label = document.createElement("span");
    label.textContent = title;
    summary.append(label);

    const cancel = head?.querySelector("button");
    if (cancel) {
      cancel.addEventListener("click", (event) => event.stopPropagation());
      summary.append(cancel);
    }
    head?.remove();

    const toolbar = document.createElement("div");
    toolbar.className = "admin-form-toggle";
    toolbar.innerHTML = `<span>${editing ? "Edición en curso" : info.copy}</span><button class="song-btn small-btn" type="button">${editing ? "Editar" : "+ Nuevo"}</button>`;
    const trigger = toolbar.querySelector("button");
    trigger.addEventListener("click", () => {
      details.open = !details.open;
      AP.visualForms[tab] = details.open;
      if (details.open) requestAnimationFrame(() => form.querySelector("input,select,textarea")?.focus({ preventScroll: true }));
    });
    details.addEventListener("toggle", () => { AP.visualForms[tab] = details.open; });

    card.prepend(toolbar, details);
    details.append(summary, form);
  }

  apRenderView = function (...args) {
    const active = document.activeElement;
    const id = active?.id || "";
    const start = typeof active?.selectionStart === "number" ? active.selectionStart : null;
    const end = typeof active?.selectionEnd === "number" ? active.selectionEnd : null;

    originalRenderView.apply(this, args);
    enhanceForm();

    if (!searchIds.has(id)) return;
    const field = document.getElementById(id);
    if (!field) return;
    field.focus({ preventScroll: true });
    if (start !== null && end !== null) field.setSelectionRange(start, end);
  };

  const boot = () => enhanceForm();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
