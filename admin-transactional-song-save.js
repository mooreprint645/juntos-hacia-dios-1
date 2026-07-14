(() => {
  const attach = () => {
    const form = document.querySelector("#songAdminForm");
    if (!form || form.dataset.transactionalSave === "true") return;

    form.dataset.transactionalSave = "true";
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      apCaptureSongDraft();
      const draft = AP.draft || {};
      const mainArtistId = apId(draft.main_artist_id);
      const artistIds = [...new Set([
        mainArtistId,
        ...(draft.collaborators || []).map(apId)
      ].filter(Boolean))];

      if (!String(draft.title || "").trim()) {
        apNote("Escribe el título de la canción.", true);
        return;
      }
      if (!String(draft.tone || "").trim()) {
        apNote("Escribe el tono original.", true);
        return;
      }
      if (!artistIds.length) {
        apNote("Selecciona al menos un artista.", true);
        return;
      }
      if (Number(draft.capo_position || 0) > 0 && !String(draft.capo_key || "").trim()) {
        apNote("Si usas capo principal, escribe las figuras.", true);
        return;
      }

      const submit = form.querySelector("button[type='submit']");
      const previousLabel = submit?.textContent || "Guardar canción";
      if (submit) {
        submit.disabled = true;
        submit.textContent = "Guardando...";
      }
      apNote("Guardando canción y relaciones...");

      const song = {
        title: String(draft.title).trim(),
        slug: apSlug(draft.title),
        song_type: draft.song_type || "catolico",
        tone: String(draft.tone).trim(),
        lyrics: String(draft.lyrics || ""),
        difficulty: String(draft.difficulty || "").trim() || null,
        capo_position: Number(draft.capo_position || 0),
        capo_key: Number(draft.capo_position || 0) > 0
          ? String(draft.capo_key || "").trim()
          : null
      };

      const artists = artistIds.map((artistId) => ({ artist_id: artistId }));
      const links = (AP.links || []).map((row, index) => ({
        title: String(row.title || "Enlace").trim(),
        link_type: String(row.link_type || "Tutorial").trim(),
        platform: String(row.platform || "").trim() || null,
        url: String(row.url || "").trim(),
        sort_order: index
      }));
      const capos = (AP.capos || []).map((row, index) => ({
        label: String(row.label || "").trim(),
        capo_position: Number(row.capo_position || 0),
        capo_key: String(row.capo_key || "").trim(),
        sort_order: index
      }));

      try {
        const { data, error } = await AdminPro.rpc("jhd_save_song_bundle", {
          p_song_id: AP.edits.song || null,
          p_song: song,
          p_artists: artists,
          p_category_id: draft.category_id || null,
          p_album_id: draft.album_id || null,
          p_links: links,
          p_capos: capos
        });

        if (error) throw error;
        if (!data) throw new Error("Supabase no devolvió el identificador de la canción.");

        apResetDraft();
        await apRefresh("Canción guardada completa y correctamente.");
      } catch (error) {
        console.error("Transactional song save failed", error);
        apNote(
          `No se guardó ningún cambio: ${error?.message || "Error desconocido"}`,
          true
        );
      } finally {
        if (submit?.isConnected) {
          submit.disabled = false;
          submit.textContent = previousLabel;
        }
      }
    }, true);
  };

  const observer = new MutationObserver(attach);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  attach();
})();
