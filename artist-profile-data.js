(() => {
  const db = window.supabaseClient;
  const params = new URLSearchParams(location.search);
  const esc = (v) => String(v || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const safeUrl = (v) => { try { const u = new URL(String(v || "")); return /^https?:$/.test(u.protocol) ? u.href : ""; } catch (_) { return ""; } };
  const songMeta = (song) => [song.song_type === "catolico" ? "Católico" : song.song_type === "cristiano" ? "Cristiano" : "", song.tone ? `Tono ${song.tone}` : "", song.difficulty || ""].filter(Boolean).join(" · ") || "Canto disponible";

  function socials(data) {
    const entries = [["youtube_url", "▶", "YouTube"], ["spotify_url", "♫", "Spotify"], ["instagram_url", "◎", "Instagram"], ["facebook_url", "f", "Facebook"]]
      .map(([key, icon, label]) => { const href = safeUrl(data[key]); return href ? `<a class="artist-social-link" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${icon} ${label}</a>` : ""; })
      .filter(Boolean);
    return entries.length ? `<div class="artist-socials">${entries.join("")}</div>` : "";
  }

  function rows(songs) {
    return songs.map((song) => `<a class="artist-song-row artist-profile-song-item" data-search="${esc(`${song.title || ""} ${song.tone || ""} ${song.song_type || ""} ${song.difficulty || ""}`.toLowerCase())}" data-tone="${esc(String(song.tone || "").toLowerCase())}" data-categories="" href="cancion.html?id=${encodeURIComponent(song.id)}"><div><h3>${esc(song.title || "Canto sin título")}</h3><p>${esc(songMeta(song))}</p></div><span class="artist-row-icon">›</span></a>`).join("");
  }

  async function load() {
    const profile = document.querySelector("#artistProfile");
    const hero = profile?.querySelector(".artist-hero-card:not(.shimmer-card)");
    if (!profile || !hero || profile.dataset.profileDataLoaded === "yes") return false;
    if (!db) return true;

    const id = params.get("id") || "";
    const slug = params.get("slug") || "";
    let query = db.from("artists").select("id,bio,youtube_url,spotify_url,instagram_url,facebook_url");
    query = id ? query.eq("id", id) : query.eq("slug", slug);
    const { data: artist, error } = await query.maybeSingle();
    if (error || !artist) return true;

    const main = hero.querySelector("div:last-child");
    const bio = main?.querySelector("p:not(.hero-kicker)");
    if (bio && artist.bio) bio.textContent = artist.bio;
    const currentSocials = main?.querySelector(".artist-socials");
    const markup = socials(artist);
    if (currentSocials) currentSocials.outerHTML = markup;
    else if (markup) main?.querySelector(".artist-profile-actions")?.insertAdjacentHTML("beforebegin", markup);

    const featuredRes = await db.from("artist_featured_songs").select("song_id,sort_order").eq("artist_id", artist.id).order("sort_order", { ascending: true });
    if (!featuredRes.error && featuredRes.data?.length) {
      const ids = featuredRes.data.map((row) => row.song_id);
      const { data: songs, error: songError } = await db.from("songs").select("id,title,song_type,tone,difficulty").in("id", ids);
      if (!songError) {
        const byId = new Map((songs || []).map((song) => [String(song.id), song]));
        const selected = ids.map(String).map((songId) => byId.get(songId)).filter(Boolean);
        const section = document.querySelector("#destacadasArtista");
        const list = section?.querySelector(".artist-song-list");
        const description = section?.querySelector(".artist-profile-section-header p:not(.hero-kicker)");
        if (list && selected.length) list.innerHTML = rows(selected);
        if (description) description.textContent = "Selección elegida desde el perfil del artista.";
      }
    }

    profile.dataset.profileDataLoaded = "yes";
    return true;
  }

  function boot() {
    let observer;
    const attempt = () => load().then((done) => { if (done) observer?.disconnect(); });
    observer = new MutationObserver(attempt);
    observer.observe(document.body, { childList: true, subtree: true });
    attempt();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true }); else boot();
})();
