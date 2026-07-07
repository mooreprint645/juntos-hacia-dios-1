(() => {
  if (window.__jhdAdminBackupImport) return;
  window.__jhdAdminBackupImport = true;

  const db = window.supabaseClient || window.AdminPro;
  const PAGE_SIZE = 500;
  const BATCH_SIZE = 200;
  const FORMAT = "Juntos Hacia Dios backup";
  const VERSION = 1;
  const TABLES = [
    "artists",
    "categories",
    "albums",
    "songs",
    "donation_settings",
    "song_artists",
    "song_categories",
    "album_songs",
    "song_links",
    "song_capo_versions",
    "artist_featured_songs"
  ];
  const LABELS = {
    artists: "artistas",
    categories: "categorías",
    albums: "álbumes",
    songs: "canciones",
    donation_settings: "datos de donación",
    song_artists: "relaciones de artistas",
    song_categories: "relaciones de categorías",
    album_songs: "relaciones de álbumes",
    song_links: "enlaces de canciones",
    song_capo_versions: "versiones con capo",
    artist_featured_songs: "canciones destacadas"
  };

  let selectedBackup = null;
  let importBusy = false;

  const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const filenameDate = () => new Date().toISOString().replace(/[:.]/g, "-");
  const cleanRow = (row) => {
    const output = {};
    const blocked = new Set(["created_at", "updated_at", "artist", "artists", "album", "albums", "category", "categories"]);
    Object.entries(row || {}).forEach(([key, value]) => {
      if (key.startsWith("_") || blocked.has(key)) return;
      output[key] = value;
    });
    return output;
  };

  function addStyle() {
    if (document.getElementById("jhdAdminBackupImportStyle")) return;
    const style = document.createElement("style");
    style.id = "jhdAdminBackupImportStyle";
    style.textContent = ".jhd-import-summary{display:flex;flex-wrap:wrap;gap:7px;margin-top:14px}.jhd-import-summary span{padding:6px 9px;border:1px solid var(--border);border-radius:999px;background:var(--card);font-size:.82rem;color:var(--muted)}.jhd-import-file{margin-top:12px;font-size:.88rem;line-height:1.45;color:var(--muted)}.jhd-import-file strong{color:var(--text)}.jhd-import-status[data-error=\"true\"]{color:#d95b5b}.jhd-import-status[data-success=\"true\"]{color:var(--gold)}";
    document.head.append(style);
  }

  function getCard() {
    return document.getElementById("jhdImportBackupCard");
  }

  function getStatus() {
    return document.getElementById("jhdImportBackupStatus");
  }

  function setStatus(message, type = "") {
    const status = getStatus();
    if (!status) return;
    status.textContent = message || "";
    status.dataset.error = type === "error" ? "true" : "false";
    status.dataset.success = type === "success" ? "true" : "false";
  }

  function setControlsDisabled(disabled) {
    ["jhdChooseBackup", "jhdStartImport", "jhdClearImport"].forEach((id) => {
      const element = document.getElementById(id);
      if (element) element.disabled = disabled || (id === "jhdStartImport" && !selectedBackup);
    });
  }

  function safeDate(value) {
    const date = new Date(value || "");
    return Number.isNaN(date.getTime()) ? "fecha no disponible" : date.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
  }

  function getRows(catalog, table) {
    return Array.isArray(catalog?.[table]) ? catalog[table] : [];
  }

  function validateBackup(payload) {
    if (!isObject(payload)) throw new Error("El archivo no contiene un respaldo válido.");
    if (payload.format !== FORMAT) throw new Error("Este archivo no es un respaldo de Juntos Hacia Dios.");
    if (Number(payload.version) !== VERSION) throw new Error("La versión de este respaldo no es compatible.");
    if (!isObject(payload.catalog)) throw new Error("El respaldo no contiene el catálogo.");

    let total = 0;
    const counts = {};
    TABLES.forEach((table) => {
      const value = payload.catalog[table];
      if (value !== undefined && !Array.isArray(value)) throw new Error(`La sección “${table}” no tiene un formato válido.`);
      const rows = getRows(payload.catalog, table);
      if (rows.some((row) => !isObject(row))) throw new Error(`La sección “${table}” contiene registros inválidos.`);
      counts[table] = rows.length;
      total += rows.length;
    });

    if (!total) throw new Error("El respaldo está vacío.");
    return { counts, total };
  }

  function renderSelection() {
    const summary = document.getElementById("jhdImportSummary");
    const restore = document.getElementById("jhdStartImport");
    const clear = document.getElementById("jhdClearImport");
    if (!summary || !restore || !clear) return;

    if (!selectedBackup) {
      summary.innerHTML = "";
      restore.disabled = true;
      clear.hidden = true;
      return;
    }

    const { file, payload, counts, total } = selectedBackup;
    const highlights = ["songs", "artists", "categories", "albums"].filter((table) => counts[table]);
    summary.innerHTML = `<p class="jhd-import-file"><strong>${esc(file.name)}</strong><br>Creado: ${esc(safeDate(payload.created_at))} · ${esc(total)} registros.</p><div class="jhd-import-summary">${highlights.map((table) => `<span>${esc(counts[table])} ${esc(LABELS[table])}</span>`).join("")}</div>`;
    restore.disabled = importBusy;
    clear.hidden = false;
  }

  function clearSelection() {
    selectedBackup = null;
    const input = document.getElementById("jhdImportFile");
    if (input) input.value = "";
    renderSelection();
    setStatus("");
  }

  async function selectBackup(file) {
    if (!file || importBusy) return;
    if (file.size > 25 * 1024 * 1024) {
      clearSelection();
      setStatus("El archivo supera el límite de 25 MB.", "error");
      return;
    }

    setStatus("Revisando el archivo…");
    try {
      const payload = JSON.parse(await file.text());
      const { counts, total } = validateBackup(payload);
      selectedBackup = { file, payload, counts, total };
      renderSelection();
      setStatus("Archivo listo. Revisa el resumen y confirma la restauración.", "success");
    } catch (error) {
      clearSelection();
      setStatus(error?.message || "No se pudo leer el archivo JSON.", "error");
    }
  }

  async function selectAll(table) {
    const all = [];
    let start = 0;
    while (true) {
      const result = await db.from(table).select("*").range(start, start + PAGE_SIZE - 1);
      if (result.error) throw new Error(`${table}: ${result.error.message}`);
      const batch = result.data || [];
      all.push(...batch);
      if (batch.length < PAGE_SIZE) return all;
      start += PAGE_SIZE;
    }
  }

  function downloadJson(payload, filename) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function createSafetyBackup() {
    const catalog = {};
    for (const table of TABLES) catalog[table] = await selectAll(table);
    downloadJson(
      { format: FORMAT, version: VERSION, created_at: new Date().toISOString(), catalog },
      `juntos-hacia-dios-respaldo-antes-de-restaurar-${filenameDate()}.json`
    );
  }

  function categoryOrder(rows) {
    const pending = rows.slice();
    const backupIds = new Set(rows.map((row) => String(row.id || "")).filter(Boolean));
    const placed = new Set();
    const ordered = [];

    while (pending.length) {
      const index = pending.findIndex((row) => {
        const parentId = String(row.parent_id || "");
        return !parentId || !backupIds.has(parentId) || placed.has(parentId);
      });
      if (index === -1) {
        ordered.push(...pending.splice(0));
        break;
      }
      const [row] = pending.splice(index, 1);
      ordered.push(row);
      if (row.id) placed.add(String(row.id));
    }
    return ordered;
  }

  function chunks(rows) {
    const result = [];
    for (let index = 0; index < rows.length; index += BATCH_SIZE) result.push(rows.slice(index, index + BATCH_SIZE));
    return result;
  }

  async function restoreTable(table, rows) {
    const cleanRows = rows.map(cleanRow).filter((row) => Object.keys(row).length);
    const orderedRows = table === "categories" ? categoryOrder(cleanRows) : cleanRows;
    for (const group of chunks(orderedRows)) {
      const result = await db.from(table).upsert(group, { onConflict: "id" });
      if (result.error) throw new Error(`${LABELS[table] || table}: ${result.error.message}`);
    }
    return orderedRows.length;
  }

  async function importBackup() {
    if (!selectedBackup || importBusy || !db) return;
    const { file, payload, total } = selectedBackup;
    const accepted = confirm(
      `Se descargará primero una copia de seguridad del catálogo actual.\n\nDespués se fusionará “${file.name}” (${total} registros): los elementos con el mismo ID se actualizarán y los que falten se crearán. No se borrará contenido que ya exista.\n\n¿Deseas continuar?`
    );
    if (!accepted) return;

    importBusy = true;
    setControlsDisabled(true);
    try {
      setStatus("Creando respaldo de seguridad del catálogo actual…");
      await createSafetyBackup();

      let restored = 0;
      for (const table of TABLES) {
        const rows = getRows(payload.catalog, table);
        if (!rows.length) continue;
        setStatus(`Restaurando ${LABELS[table] || table} (${rows.length})…`);
        restored += await restoreTable(table, rows);
      }

      setStatus(`Respaldo restaurado correctamente: ${restored} registros procesados.`, "success");
      selectedBackup = null;
      renderSelection();
      await window.apRefresh?.("Respaldo cargado correctamente.");
    } catch (error) {
      setStatus(`No se pudo completar la restauración: ${error?.message || "Error desconocido."} Algunos registros pueden haberse restaurado; conserva la copia de seguridad descargada.`, "error");
    } finally {
      importBusy = false;
      setControlsDisabled(false);
    }
  }

  function bindCard() {
    document.getElementById("jhdChooseBackup")?.addEventListener("click", () => document.getElementById("jhdImportFile")?.click());
    document.getElementById("jhdImportFile")?.addEventListener("change", (event) => selectBackup(event.target.files?.[0]));
    document.getElementById("jhdStartImport")?.addEventListener("click", importBackup);
    document.getElementById("jhdClearImport")?.addEventListener("click", clearSelection);
  }

  function mountImporter() {
    const grid = document.querySelector("#jhdBackupView .admin-backup-grid");
    if (!grid || getCard()) return;
    grid.insertAdjacentHTML("beforeend", `<article class="admin-backup-card" id="jhdImportBackupCard"><h3>Cargar respaldo</h3><p>Selecciona un respaldo JSON de Juntos Hacia Dios. Primero se descargará una copia de seguridad del catálogo actual; después se agregarán o actualizarán los datos del archivo.</p><div class="admin-backup-actions"><button class="song-btn secondary" type="button" id="jhdChooseBackup">Elegir archivo JSON</button><button class="song-btn" type="button" id="jhdStartImport" disabled>Restaurar respaldo</button><button class="song-btn secondary" type="button" id="jhdClearImport" hidden>Quitar archivo</button><input id="jhdImportFile" type="file" accept="application/json,.json" hidden></div><div id="jhdImportSummary"></div><p class="admin-backup-status jhd-import-status" id="jhdImportBackupStatus"></p></article>`);
    bindCard();
    renderSelection();
  }

  function boot() {
    addStyle();
    mountImporter();
    const observer = new MutationObserver(() => mountImporter());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();