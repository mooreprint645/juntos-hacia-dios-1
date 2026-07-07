(() => {
  if (window.__jhdAdminBackup) return;
  window.__jhdAdminBackup = true;

  const db = window.supabaseClient || window.AdminPro;
  const TRASH_TABLE = "admin_trash";
  const PAGE_SIZE = 500;
  let trashRows = [];
  let busy = false;

  const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const say = (message, bad = false) => {
    if (typeof window.apNote === "function") window.apNote(message, bad);
  };
  const app = () => window.AP || null;
  const idOf = (value) => String(value || "");
  const safeDate = (value) => {
    const date = new Date(value || "");
    return Number.isNaN(date.getTime()) ? "Sin fecha" : date.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
  };
  const filenameDate = () => new Date().toISOString().replace(/[:.]/g, "-");

  function addStyle() {
    if (document.getElementById("jhdAdminBackupStyle")) return;
    const style = document.createElement("style");
    style.id = "jhdAdminBackupStyle";
    style.textContent = `.admin-backup-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.admin-backup-card{padding:21px;border:1px solid var(--border);border-radius:20px;background:var(--card-soft)}.admin-backup-card h3{margin:0 0 8px;color:var(--gold)}.admin-backup-card p{margin:0;color:var(--muted);line-height:1.55}.admin-backup-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:16px}.admin-backup-actions .song-btn{border:0;cursor:pointer}.admin-backup-summary{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}.admin-backup-summary span{padding:8px 11px;border:1px solid var(--border);border-radius:999px;background:var(--card);font-size:.88rem;color:var(--muted)}.admin-trash-list{display:grid;gap:10px}.admin-trash-item{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;padding:15px;border:1px solid var(--border);border-radius:17px;background:var(--card)}.admin-trash-item h4,.admin-trash-item p{margin:0}.admin-trash-item h4{color:var(--text)}.admin-trash-item p{margin-top:5px;color:var(--muted);font-size:.88rem;line-height:1.45}.admin-trash-actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end}.admin-trash-actions .song-btn{padding:8px 11px;font-size:.84rem}.admin-backup-status{min-height:1.4em;margin:13px 0 0;color:var(--muted);font-size:.92rem}.admin-backup-warning{margin-top:20px;padding:14px 16px;border:1px dashed rgba(246,196,83,.5);border-radius:16px;background:rgba(246,196,83,.06);color:var(--muted);line-height:1.55}.admin-backup-warning strong{color:var(--gold)}@media(max-width:760px){.admin-backup-grid{grid-template-columns:1fr}.admin-trash-item{grid-template-columns:1fr}.admin-trash-actions{justify-content:flex-start}}`;
    document.head.append(style);
  }

  function cleanRow(row, keepId = true) {
    const out = {};
    const blocked = new Set(["created_at", "updated_at", "artist", "artists", "album", "albums", "category", "categories"]);
    Object.entries(row || {}).forEach(([key, value]) => {
      if (key.startsWith("_") || blocked.has(key)) return;
      if (!keepId && key === "id") return;
      out[key] = value;
    });
    return out;
  }

  async function selectAll(table) {
    const all = [];
    let start = 0;
    while (true) {
      const result = await db.from(table).select("*").range(start, start + PAGE_SIZE - 1);
      if (result.error) throw result.error;
      const batch = result.data || [];
      all.push(...batch);
      if (batch.length < PAGE_SIZE) return all;
      start += PAGE_SIZE;
    }
  }

  async function one(table, id) {
    const result = await db.from(table).select("*").eq("id", id).maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) throw new Error("No se encontró el registro que intentas eliminar.");
    return result.data;
  }

  async function rows(table, key, value) {
    const result = await db.from(table).select("*").eq(key, value);
    if (result.error) throw result.error;
    return result.data || [];
  }

  async function buildSnapshot(kind, id) {
    if (kind === "song") {
      const [record, songArtists, songCategories, albumSongs, links, capoVersions, featured] = await Promise.all([
        one("songs", id),
        rows("song_artists", "song_id", id),
        rows("song_categories", "song_id", id),
        rows("album_songs", "song_id", id),
        rows("song_links", "song_id", id),
        rows("song_capo_versions", "song_id", id),
        rows("artist_featured_songs", "song_id", id)
      ]);
      return { version: 1, record: cleanRow(record, true), relations: { song_artists: songArtists.map((row) => cleanRow(row, false)), song_categories: songCategories.map((row) => cleanRow(row, false)), album_songs: albumSongs.map((row) => cleanRow(row, false)), song_links: links.map((row) => cleanRow(row, false)), song_capo_versions: capoVersions.map((row) => cleanRow(row, false)), artist_featured_songs: featured.map((row) => cleanRow(row, false)) } };
    }
    if (kind === "album") {
      const [record, albumSongs] = await Promise.all([one("albums", id), rows("album_songs", "album_id", id)]);
      return { version: 1, record: cleanRow(record, true), relations: { album_songs: albumSongs.map((row) => cleanRow(row, false)) } };
    }
    if (kind === "artist") {
      const [record, featured] = await Promise.all([one("artists", id), rows("artist_featured_songs", "artist_id", id)]);
      return { version: 1, record: cleanRow(record, true), relations: { artist_featured_songs: featured.map((row) => cleanRow(row, false)) } };
    }
    if (kind === "category") {
      const record = await one("categories", id);
      return { version: 1, record: cleanRow(record, true), relations: {} };
    }
    throw new Error("Tipo de elemento no compatible.");
  }

  function itemName(kind, id) {
    const state = app();
    const collections = { song: state?.songs, artist: state?.artists, category: state?.categories, album: state?.albums };
    const row = (collections[kind] || []).find((item) => idOf(item.id) === idOf(id));
    return row?.title || row?.name || "Elemento sin nombre";
  }

  async function archive(kind, id) {
    const snapshot = await buildSnapshot(kind, id);
    const payload = {
      item_type: kind,
      original_id: id,
      item_name: itemName(kind, id),
      snapshot,
      deleted_by: app()?.user?.id || null
    };
    const result = await db.from(TRASH_TABLE).insert([payload]).select("id").single();
    if (result.error) throw result.error;
    return result.data?.id || null;
  }

  async function removeArchive(id) {
    if (!id) return;
    await db.from(TRASH_TABLE).delete().eq("id", id);
  }

  function checkDelete(kind, id) {
    const state = app();
    if (kind === "artist") {
      const usedSongs = (state?.songs || []).some((song) => (song._artists || []).some((artist) => idOf(artist.id) === idOf(id)));
      const usedAlbums = (state?.albums || []).some((album) => idOf(album.artist_id) === idOf(id));
      if (usedSongs || usedAlbums) {
        say("No se puede eliminar: este artista tiene canciones o álbumes relacionados.", true);
        return false;
      }
    }
    if (kind === "category") {
      const hasChildren = (state?.categories || []).some((row) => idOf(row.parent_id) === idOf(id));
      const hasSongs = (state?.songs || []).some((song) => (song._categories || []).some((category) => idOf(category.id) === idOf(id)));
      if (hasChildren) { say("No se puede eliminar una categoría con subcategorías.", true); return false; }
      if (hasSongs) { say("No se puede eliminar: hay canciones relacionadas.", true); return false; }
    }
    return true;
  }

  async function deleteSavedItem(kind, id) {
    if (busy) return;
    if (!checkDelete(kind, id)) return;
    const label = itemName(kind, id);
    if (!confirm(`¿Enviar “${label}” a la papelera? Podrás restaurarlo desde Respaldo.`)) return;

    busy = true;
    let archiveId = null;
    try {
      say("Creando respaldo antes de eliminar...");
      archiveId = await archive(kind, id);

      let error = null;
      if (kind === "song") {
        const results = await Promise.all([
          db.from("song_artists").delete().eq("song_id", id),
          db.from("song_categories").delete().eq("song_id", id),
          db.from("album_songs").delete().eq("song_id", id),
          db.from("song_links").delete().eq("song_id", id),
          db.from("song_capo_versions").delete().eq("song_id", id),
          db.from("artist_featured_songs").delete().eq("song_id", id)
        ]);
        error = results.find((result) => result.error)?.error || null;
        if (!error) error = (await db.from("songs").delete().eq("id", id)).error;
      }
      if (kind === "artist") error = (await db.from("artists").delete().eq("id", id)).error;
      if (kind === "category") error = (await db.from("categories").delete().eq("id", id)).error;
      if (kind === "album") {
        const links = await db.from("album_songs").delete().eq("album_id", id);
        error = links.error || (await db.from("albums").delete().eq("id", id)).error;
      }

      if (error) {
        await removeArchive(archiveId);
        throw error;
      }
      await window.apRefresh?.("Elemento enviado a la papelera.");
    } catch (error) {
      say(`No se pudo eliminar con respaldo: ${error?.message || "Error desconocido."}. Ejecuta ADMIN_RESPALDO_PAPELERA.sql si aún no lo has hecho.`, true);
    } finally {
      busy = false;
    }
  }

  async function downloadBackup() {
    const status = document.getElementById("jhdBackupStatus");
    const button = document.getElementById("jhdDownloadBackup");
    if (button) button.disabled = true;
    if (status) status.textContent = "Preparando respaldo del catálogo...";
    try {
      const tables = ["artists", "categories", "albums", "songs", "song_artists", "song_categories", "album_songs", "song_links", "song_capo_versions", "artist_featured_songs", "donation_settings"];
      const catalog = {};
      for (const table of tables) {
        if (status) status.textContent = `Respaldando ${table}...`;
        catalog[table] = await selectAll(table);
      }
      const payload = { format: "Juntos Hacia Dios backup", version: 1, created_at: new Date().toISOString(), catalog };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `juntos-hacia-dios-respaldo-${filenameDate()}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      if (status) status.textContent = "Respaldo descargado. Guárdalo en Drive o en otra ubicación segura.";
    } catch (error) {
      if (status) status.textContent = `No se pudo crear el respaldo: ${error?.message || "Error desconocido."}`;
    } finally {
      if (button) button.disabled = false;
    }
  }

  function trashHTML() {
    if (!trashRows.length) return '<div class="admin-empty">La papelera está vacía.</div>';
    return trashRows.map((row) => `<article class="admin-trash-item"><div><h4>${esc(row.item_name || "Elemento eliminado")}</h4><p>${esc({ song: "Canción", artist: "Artista", category: "Categoría", album: "Álbum" }[row.item_type] || "Elemento")} · Eliminado ${esc(safeDate(row.deleted_at))}</p></div><div class="admin-trash-actions"><button class="song-btn small-btn" type="button" data-jhd-restore="${esc(row.id)}">Restaurar</button><button class="song-btn small-btn secondary" type="button" data-jhd-purge="${esc(row.id)}">Borrar definitivo</button></div></article>`).join("");
  }

  async function loadTrash() {
    const holder = document.getElementById("jhdTrashList");
    if (!holder || !db) return;
    holder.innerHTML = '<div class="admin-empty">Cargando papelera...</div>';
    const result = await db.from(TRASH_TABLE).select("*").order("deleted_at", { ascending: false }).limit(100);
    if (result.error) {
      holder.innerHTML = '<div class="admin-empty">La papelera se activará al ejecutar ADMIN_RESPALDO_PAPELERA.sql en Supabase.</div>';
      return;
    }
    trashRows = result.data || [];
    holder.innerHTML = trashHTML();
    bindTrashActions();
  }

  async function restoreRelations(relations) {
    const tables = ["song_artists", "song_categories", "album_songs", "song_links", "song_capo_versions", "artist_featured_songs"];
    for (const table of tables) {
      const values = (relations?.[table] || []).map((row) => cleanRow(row, false));
      if (!values.length) continue;
      const result = await db.from(table).insert(values);
      if (result.error) throw new Error(`${table}: ${result.error.message}`);
    }
  }

  async function restoreTrash(id) {
    const row = trashRows.find((item) => idOf(item.id) === idOf(id));
    if (!row || busy) return;
    if (!confirm(`¿Restaurar “${row.item_name}”?`)) return;
    busy = true;
    try {
      const snapshot = row.snapshot || {};
      const table = { song: "songs", artist: "artists", category: "categories", album: "albums" }[row.item_type];
      if (!table || !snapshot.record) throw new Error("El respaldo no tiene datos suficientes.");
      const exists = await db.from(table).select("id").eq("id", snapshot.record.id).maybeSingle();
      if (exists.error) throw exists.error;
      if (!exists.data) {
        const created = await db.from(table).insert([cleanRow(snapshot.record, true)]);
        if (created.error) throw created.error;
      }
      await restoreRelations(snapshot.relations || {});
      const removed = await db.from(TRASH_TABLE).delete().eq("id", row.id);
      if (removed.error) throw removed.error;
      await window.apRefresh?.("Elemento restaurado correctamente.");
    } catch (error) {
      say(`No se pudo restaurar: ${error?.message || "Error desconocido."}`, true);
    } finally {
      busy = false;
    }
  }

  async function purgeTrash(id) {
    const row = trashRows.find((item) => idOf(item.id) === idOf(id));
    if (!row || !confirm(`¿Borrar definitivamente “${row.item_name}”? Esta acción no se puede deshacer.`)) return;
    const result = await db.from(TRASH_TABLE).delete().eq("id", id);
    if (result.error) return say(`No se pudo borrar de la papelera: ${result.error.message}`, true);
    await loadTrash();
    say("Elemento eliminado definitivamente.");
  }

  function bindTrashActions() {
    document.querySelectorAll("[data-jhd-restore]").forEach((button) => button.addEventListener("click", () => restoreTrash(button.dataset.jhdRestore)));
    document.querySelectorAll("[data-jhd-purge]").forEach((button) => button.addEventListener("click", () => purgeTrash(button.dataset.jhdPurge)));
  }

  function backupViewHTML() {
    const state = app();
    return `<section class="admin-section" id="jhdBackupView"><div class="admin-section-heading"><div><p class="hero-kicker">Protección del catálogo</p><h2>Respaldo y recuperación</h2></div><p class="admin-count">${esc((state?.songs || []).length + (state?.artists || []).length + (state?.categories || []).length)} elementos</p></div><div class="admin-backup-summary"><span>${esc((state?.songs || []).length)} canciones</span><span>${esc((state?.artists || []).length)} artistas</span><span>${esc((state?.categories || []).length)} categorías</span><span>${esc((state?.albums || []).length)} álbumes</span></div><div class="admin-backup-grid"><article class="admin-backup-card"><h3>Descargar respaldo</h3><p>Guarda una copia completa del cancionero en un archivo JSON. Incluye canciones, artistas, categorías, álbumes, enlaces, versiones con capo, donaciones y destacadas.</p><div class="admin-backup-actions"><button class="song-btn" type="button" id="jhdDownloadBackup">Descargar respaldo</button></div><p class="admin-backup-status" id="jhdBackupStatus"></p></article><article class="admin-backup-card"><h3>Papelera segura</h3><p>Antes de eliminar una canción, artista, categoría o álbum, el panel guarda una copia para poder restaurarla después.</p><div class="admin-backup-actions"><button class="song-btn secondary" type="button" id="jhdRefreshTrash">Actualizar papelera</button></div></article></div><p class="admin-backup-warning"><strong>Recomendación:</strong> descarga un respaldo antes de hacer cambios grandes. La papelera protege eliminaciones hechas desde este panel; no sustituye una copia guardada fuera del sitio.</p><section class="artist-profile-section"><div class="admin-section-heading"><div><p class="hero-kicker">Recuperación</p><h2>Papelera</h2></div></div><div class="admin-trash-list" id="jhdTrashList"><div class="admin-empty">Cargando papelera...</div></div></section></section>`;
  }

  function renderBackupView() {
    addStyle();
    const view = document.getElementById("adminView");
    if (!view) return;
    view.innerHTML = backupViewHTML();
    document.getElementById("jhdDownloadBackup")?.addEventListener("click", downloadBackup);
    document.getElementById("jhdRefreshTrash")?.addEventListener("click", loadTrash);
    loadTrash();
  }

  function updateTabState() {
    document.querySelectorAll("[data-admin-tab], [data-jhd-backup-tab]").forEach((button) => {
      const isBackup = button.dataset.jhdBackupTab === "true";
      button.classList.toggle("active", isBackup ? app()?.tab === "backup" : button.dataset.adminTab === app()?.tab);
    });
  }

  function ensureBackupTab() {
    const tabs = document.querySelector(".admin-tabs");
    if (!tabs || tabs.querySelector("[data-jhd-backup-tab]")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "admin-tab";
    button.dataset.jhdBackupTab = "true";
    button.textContent = "Respaldo";
    button.addEventListener("click", () => {
      if (app()?.tab === "songs") window.apCaptureSongDraft?.();
      if (app()) app().tab = "backup";
      renderBackupView();
      updateTabState();
    });
    tabs.append(button);
    updateTabState();
  }

  function patchViewRenderer() {
    if (window.__jhdBackupRenderPatched || typeof window.apRenderView !== "function") return;
    const original = window.apRenderView;
    const patched = function(...args) {
      if (app()?.tab === "backup") {
        renderBackupView();
        ensureBackupTab();
        updateTabState();
        return;
      }
      const value = original.apply(this, args);
      queueMicrotask(() => { ensureBackupTab(); updateTabState(); });
      return value;
    };
    window.apRenderView = patched;
    window.__jhdBackupRenderPatched = true;
  }

  function installDeleteInterception() {
    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-delete-song],[data-delete-artist],[data-delete-category],[data-delete-album],[data-cat2-delete]");
      if (!button) return;
      let kind = "", id = "";
      if (button.dataset.deleteSong) { kind = "song"; id = button.dataset.deleteSong; }
      if (button.dataset.deleteArtist) { kind = "artist"; id = button.dataset.deleteArtist; }
      if (button.dataset.deleteCategory) { kind = "category"; id = button.dataset.deleteCategory; }
      if (button.dataset.deleteAlbum) { kind = "album"; id = button.dataset.deleteAlbum; }
      if (button.dataset.cat2Delete) { kind = "category"; id = button.dataset.cat2Delete; }
      if (!kind || !id) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      deleteSavedItem(kind, id);
    }, true);
  }

  function boot() {
    addStyle();
    patchViewRenderer();
    installDeleteInterception();
    const observer = new MutationObserver(() => {
      ensureBackupTab();
      if (app()?.tab === "backup" && !document.getElementById("jhdBackupView")) renderBackupView();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    ensureBackupTab();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
