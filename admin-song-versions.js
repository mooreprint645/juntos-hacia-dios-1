(() => {
  if (window.__jhdAdminSongVersions) return;
  window.__jhdAdminSongVersions = true;

  const db = window.supabaseClient;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const norm = (value) => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  let editingSongId = "";
  let songs = [];
  let versions = [];
  let searchText = "";
  let targetSongId = "";

  function songLabel(song) {
    return [song.title || "Sin título", song.tone ? `Tono ${song.tone}` : ""].filter(Boolean).join(" · ");
  }

  function selectedSong() {
    return songs.find((song) => String(song.id) === String(targetSongId));
  }

  function currentSong() {
    return songs.find((song) => String(song.id) === String(editingSongId));
  }

  function missingTable(error) {
    return /song_versions|schema cache|relation|PGRST205/i.test(String(error?.message || error?.code || ""));
  }

  function status(message, bad = false) {
    const box = $("#songVersionsAdminStatus");
    if (!box) return;
    box.textContent = message || "";
    box.style.color = bad ? "#ffb4b4" : "";
  }

  function panelHTML() {
    const current = currentSong();
    const currentTitle = current?.title || "esta canción";
    const existingTargetIds = new Set(versions.map((row) => String(row.parent_song_id) === String(editingSongId) ? String(row.version_song_id) : String(row.parent_song_id)));
    const found = songs.filter((song) => String(song.id) !== String(editingSongId) && !existingTargetIds.has(String(song.id)) && (!searchText || norm(songLabel(song)).includes(norm(searchText)))).slice(0, 20);
    return `<div class="admin-resource-draft" id="songVersionsAdmin"><h4>Otras versiones de la canción</h4><p class="admin-note">Relaciona <strong>${esc(currentTitle)}</strong> con otra canción cuando sea la misma obra en otra versión, artista, tono o arreglo.</p><input id="songVersionSearch" value="${esc(searchText)}" placeholder="Buscar canción existente para relacionar"><div class="admin-mini-list">${found.length ? found.map((song) => `<button class="song-btn small-btn secondary" type="button" data-pick-version-song="${esc(song.id)}">${esc(songLabel(song))}</button>`).join("") : `<p class="admin-note">No hay canciones disponibles con esa búsqueda.</p>`}</div><div class="admin-form-grid"><label>Etiqueta<input id="songVersionLabel" placeholder="Ejemplo: Versión acústica, En vivo, Ministerio X"></label><label>Notas<input id="songVersionNotes" placeholder="Opcional: diferencia principal"></label></div><div class="admin-actions"><button class="song-btn small-btn" id="addSongVersion" type="button" ${targetSongId ? "" : "disabled"}>Agregar versión${selectedSong() ? `: ${esc(selectedSong().title || "")}` : ""}</button></div><div class="admin-mini-list">${versions.length ? versions.map((row) => versionRowHTML(row)).join("") : `<p class="admin-note">Todavía no hay versiones relacionadas.</p>`}</div><p class="admin-message" id="songVersionsAdminStatus" aria-live="polite"></p></div>`;
  }

  function versionRowHTML(row) {
    const otherId = String(row.parent_song_id) === String(editingSongId) ? row.version_song_id : row.parent_song_id;
    const song = songs.find((item) => String(item.id) === String(otherId));
    return `<div class="admin-mini-item"><div><strong>${esc(song?.title || "Canción relacionada")}</strong><br><small>${esc([row.label || "Versión", song?.tone ? `Tono ${song.tone}` : ""].filter(Boolean).join(" · "))}</small>${row.notes ? `<br><small>${esc(row.notes)}</small>` : ""}</div><button class="song-btn small-btn secondary" type="button" data-remove-version="${esc(row.id)}">Quitar</button></div>`;
  }

  function inject() {
    const form = $("#songAdminForm");
    if (!form || $("#songVersionsAdmin")) return;
    const target = form.querySelector(".admin-resource-grid");
    const box = document.createElement("div");
    if (!editingSongId) {
      box.className = "admin-resource-draft";
      box.id = "songVersionsAdmin";
      box.innerHTML = `<h4>Otras versiones de la canción</h4><p class="admin-note">Primero guarda la canción. Después podrás relacionarla con versiones de otros artistas o arreglos.</p>`;
    } else {
      box.innerHTML = panelHTML();
    }
    target?.insertAdjacentElement("afterend", box);
    bindPanel();
  }

  async function loadPanel() {
    if (!editingSongId || !db) return;
    const [songsRes, parentRes, versionRes] = await Promise.all([
      db.from("songs").select("id,title,slug,song_type,tone").order("title", { ascending: true }),
      db.from("song_versions").select("*").eq("parent_song_id", editingSongId).order("sort_order", { ascending: true }),
      db.from("song_versions").select("*").eq("version_song_id", editingSongId).order("sort_order", { ascending: true })
    ]);
    if (parentRes.error || versionRes.error) {
      inject();
      status(missingTable(parentRes.error || versionRes.error) ? "Falta ejecutar supabase-song-versions.sql en Supabase." : "No se pudieron cargar las versiones.", true);
      return;
    }
    songs = songsRes.data || [];
    versions = [...(parentRes.data || []), ...(versionRes.data || [])];
    $("#songVersionsAdmin")?.remove();
    inject();
  }

  function bindPanel() {
    $("#songVersionSearch")?.addEventListener("input", (event) => { searchText = event.target.value; $("#songVersionsAdmin")?.remove(); inject(); });
    $$('[data-pick-version-song]').forEach((button) => button.addEventListener("click", () => { targetSongId = button.dataset.pickVersionSong; $("#songVersionsAdmin")?.remove(); inject(); }));
    $("#addSongVersion")?.addEventListener("click", addVersion);
    $$('[data-remove-version]').forEach((button) => button.addEventListener("click", () => removeVersion(button.dataset.removeVersion)));
  }

  async function addVersion() {
    if (!editingSongId || !targetSongId) return;
    status("Guardando relación…");
    const label = $("#songVersionLabel")?.value?.trim() || "Versión alternativa";
    const notes = $("#songVersionNotes")?.value?.trim() || null;
    const { error } = await db.from("song_versions").insert([{ parent_song_id: editingSongId, version_song_id: targetSongId, label, notes, sort_order: versions.length }]);
    if (error) {
      status(missingTable(error) ? "Falta ejecutar supabase-song-versions.sql en Supabase." : `No se pudo agregar: ${error.message}`, true);
      return;
    }
    targetSongId = "";
    searchText = "";
    await loadPanel();
    status("Versión agregada.");
  }

  async function removeVersion(id) {
    if (!id || !confirm("¿Quitar esta relación de versión?")) return;
    const { error } = await db.from("song_versions").delete().eq("id", id);
    if (error) {
      status(`No se pudo quitar: ${error.message}`, true);
      return;
    }
    await loadPanel();
    status("Versión quitada.");
  }

  function scheduleInject() {
    setTimeout(() => { inject(); loadPanel(); }, 80);
  }

  document.addEventListener("click", (event) => {
    const edit = event.target.closest?.("[data-edit-song]");
    if (edit) {
      editingSongId = edit.dataset.editSong || "";
      searchText = "";
      targetSongId = "";
      scheduleInject();
      return;
    }
    if (event.target.closest?.("#newSongDraft,[data-cancel-song]")) {
      editingSongId = "";
      versions = [];
      searchText = "";
      targetSongId = "";
      scheduleInject();
    }
  }, true);

  new MutationObserver(inject).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", inject, { once: true });
  else inject();
})();