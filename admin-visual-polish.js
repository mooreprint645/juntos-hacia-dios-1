(() => {
  const formInfo = {
    artists: { form: "#artistAdminForm", title: "Nuevo artista", copy: "Agregar artista o ministerio" },
    categories: { form: "#categoryAdminForm", title: "Nueva categoría", copy: "Agregar categoría o carpeta" },
    albums: { form: "#albumAdminForm", title: "Nuevo álbum", copy: "Agregar álbum o carpeta" },
    songs: { form: "#songAdminForm", title: "Nueva canción", copy: "Agregar canto, acordes, capo y enlaces" },
    donations: { form: "#donationAdminForm", title: "Editar donaciones", copy: "Actualizar datos de apoyo" }
  };

  const formEditKey = { artists: "artist", categories: "category", albums: "album", songs: "song", donations: "donation" };
  const priorRender = apRenderView;

  AP.visualForms = AP.visualForms || {};

  function isEditing(tab) {
    if (tab === "donations") return Boolean(AP.donation?.id);
    return Boolean(AP.edits?.[formEditKey[tab]]);
  }

  function enhanceCurrentView() {
    const tab = AP.tab;
    const info = formInfo[tab];
    if (!info) return;

    const form = document.querySelector(info.form);
    const card = form?.closest(".admin-card");
    if (!form || !card || card.dataset.visualPolished === "yes") return;

    card.dataset.visualPolished = "yes";
    const editorHead = card.querySelector(".admin-editor-head");
    const heading = editorHead?.querySelector("h3");
    const currentTitle = heading?.textContent?.trim() || info.title;
    const edited = isEditing(tab);
    const open = edited || Boolean(AP.visualForms[tab]);

    const toggle = document.createElement("div");
    toggle.className = "admin-form-toggle";
    toggle.innerHTML = `<span>${edited ? "Edición en curso" : info.copy}</span><button class="song-btn small-btn" type="button">${edited ? "Editar" : "+ Nuevo"}</button>`;
    const button = toggle.querySelector("button");

    const details = document.createElement("details");
    details.className = "admin-form-collapsible";
    details.open = open;
    const summary = document.createElement("summary");
    summary.textContent = currentTitle;

    if (editorHead) editorHead.remove();
    card.prepend(toggle, details);
    details.append(summary, form);

    button.addEventListener("click", () => {
      details.open = !details.open;
      AP.visualForms[tab] = details.open;
      if (details.open) requestAnimationFrame(() => form.querySelector("input,select,textarea")?.focus({ preventScroll: true }));
    });
    details.addEventListener("toggle", () => { AP.visualForms[tab] = details.open; });

    if (edited) {
      details.open = true;
      AP.visualForms[tab] = true;
    }
  }

  apRenderView = function (...args) {
    priorRender.apply(this, args);
    enhanceCurrentView();
  };

  const start = () => {
    if (document.querySelector("#adminView")) enhanceCurrentView();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
