(() => {
  const db = window.supabaseClient;
  const params = new URLSearchParams(location.search);
  const escText = (value) => String(value || "");
  const norm = (value) => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const typeLabel = (value) => ({ catolico: "Católico", cristiano: "Cristiano", mixto: "Mixto" }[norm(value)] || "General");
  const safeUrl = (value) => {
    try {
      const url = new URL(String(value || ""));
      return /^https?:$/.test(url.protocol) ? url.href : "";
    } catch (_) { return ""; }
  };

  function socialLink(label, icon, href) {
    const url = safeUrl(href);
    if (!url) return null;
    const link = document.createElement("a");
    link.className = "artist-social-link";
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = `${icon} ${label}`;
    return link;
  }

  function updateHero(artist) {
    const hero = document.querySelector(".artist-hero-card:not(.shimmer-card)");
    if (!hero) return;
    const biography = hero.querySelector("h1 + p");
    const bio = String(artist.bio || "").trim();
    if (biography && bio) biography.textContent = bio;

    hero.querySelector(".artist-socials")?.remove();
    const socials = document.createElement("div");
    socials.className = "artist-socials";
    [
      ["YouTube", "▶", artist.youtube_url],
      ["Spotify", "♫", artist.spotify_url],
      ["Instagram", "◎", artist.instagram_url],
      ["Facebook", "f", artist.facebook_url]
    ].map(([label, icon, href]) => socialLink(label, icon, href)).filter(Boolean).forEach((link) => socials.append(link));
    if (socials.children.length) hero.querySelector(".artist-profile-actions")?.before(socials);
  }

  function songRow(song) {
    const link = document.createElement("a");
    link.className = "artist-song-row";
    link.href = `cancion.html?id=${encodeURIComponent(song.id)}`;
    const copy = document.createElement("div");
    const title = document.createElement("h3");
    const meta = document.createElement("p");
    title.textContent = song.title || "Canto sin título";
    meta.textContent = [song.song_type ? typeLabel(song.song_type) : "", song.tone ? `Tono ${song.tone}` : "", song.difficulty || ""].filter(Boolean).join(" · ") || "Canto disponible";
    copy.append(title, meta);
    const arrow = document.createElement("span");
    arrow.className = "artist-row-icon";
    arrow.textContent = "›";
    link.append(copy, arrow);
    return link;
  }

  async function replaceFeatured(artistId) {
    const { data: selected, error } = await db.from("artist_featured_songs").select("song_id,sort_order").eq("artist_id", artistId).order("sort_order", { ascending: true });
    if (error || !selected?.length) return;
    const ids = selected.map((row) => row.song_id).filter(Boolean);
    const { data: songs, error: songsError } = await db.from("songs").select("id,title,song_type,tone,difficulty").in("id", ids);
    if (songsError || !songs?.length) return;
    const byId = new Map(songs.map((song) => [String(song.id), song]));
    const ordered = ids.map((id) => byId.get(String(id))).filter(Boolean);
    const section = document.querySelector("#destacadasArtista");
    const list = section?.querySelector(".artist-song-list");
    if (!section || !list || !ordered.length) return;
    const description = section.querySelector(".artist-profile-section-header p:last-child");
    if (description) description.textContent = "Selección elegida desde el perfil del artista.";
    list.replaceChildren(...ordered.map(songRow));
  }

  async function load() {
    const profile = document.querySelector("#artistProfile");
    const hero = profile?.querySelector(".artist-hero-card:not(.shimmer-card)");
    if (!profile || !hero || profile.dataset.normalizedProfile === "ready" || !db) return false;
    const id = params.get("id");
    const slug = params.get("slug");
    let query = db.from("artists").select("id,bio,youtube_url,spotify_url,instagram_url,facebook_url");
    query = id ? query.eq("id", id) : query.eq("slug", slug || "");
    const { data: artist, error } = await query.maybeSingle();
    if (error || !artist) return false;
    profile.dataset.normalizedProfile = "ready";
    updateHero(artist);
    await replaceFeatured(artist.id);
    return true;
  }

  function boot() {
    let observer;
    const attempt = () => {
      load().then((done) => { if (done) observer?.disconnect(); });
    };
    observer = new MutationObserver(attempt);
    observer.observe(document.body, { childList: true, subtree: true });
    attempt();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
