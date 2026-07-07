document.addEventListener("click", (event) => {
  const link = event.target.closest('a[href^="artista.html?slug="]');
  if (!link) return;
  event.preventDefault();
  const url = new URL(link.href);
  location.href = `artistas.html?slug=${encodeURIComponent(url.searchParams.get("slug") || "")}`;
});

(() => {
  const page = () => (location.pathname.split("/").pop() || "index.html").toLowerCase();
  const esc = (value) => String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const norm = (value) => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const wait = (promise) => Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve({ data: [], error: { message: "Tiempo de espera agotado" } }), 9000))]);
  const notice = (box, title, text) => { if (box) box.innerHTML = `<article class="song-card"><h3>${esc(title)}</h3><p>${esc(text)}</p></article>`; };

  const renderGroups = (categories) => {
    if (document.getElementById("homeFaithAccess")) return;
    const hero = document.querySelector(".hero");
    if (!hero) return;
    const group = (type, title, description) => {
      const typed = categories.filter((item) => norm(item.song_type) === type);
      let roots = typed.filter((item) => !item.parent_id);
      const generic = type === "catolico" ? ["catolico", "catolica"] : ["cristiano", "cristiana"];
      if (roots.length === 1 && generic.includes(norm(roots[0].name))) {
        const children = typed.filter((item) => String(item.parent_id) === String(roots[0].id));
        if (children.length) roots = children;
      }
      roots = roots.sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)).slice(0, 8);
      const cards = roots.map((item) => `<a class="home-access-card" href="categorias.html?tipo=${type}&carpeta=${encodeURIComponent(item.slug || item.id)}"><strong>${esc(item.name || "Categoría")}</strong><small>Ver cantos</small></a>`).join("");
      return `<article class="home-access-group"><div class="home-access-group-heading"><span class="home-access-symbol">✝</span><div><h3>${title}</h3><p>${description}</p></div></div>${cards ? `<div class="home-access-grid">${cards}</div>` : '<p class="home-access-empty">Aún no hay categorías disponibles.</p>'}<div class="home-access-footer"><a class="text-link" href="categorias.html?tipo=${type}">Ver todas</a></div></article>`;
    };
    const section = document.createElement("section");
    section.id = "homeFaithAccess";
    section.className = "section home-faith-access";
    section.innerHTML = `<div class="section-heading"><p class="hero-kicker">Encuentra rápido</p><h2>¿Para qué necesitas un canto?</h2></div><div class="home-access-groups">${group("catolico", "Católico", "Misa, tiempos litúrgicos y devociones.")}${group("cristiano", "Cristiano", "Alabanza, oración y ministerios.")}</div>`;
    hero.insertAdjacentElement("afterend", section);
  };

  const recoverHome = async () => {
    if (page() !== "index.html") return;
    const client = window.supabaseClient;
    const songsBox = document.getElementById("homeSongsGrid");
    const artistsBox = document.getElementById("homeArtistsGrid");
    if (!client) {
      notice(songsBox, "Sin conexión", "No se pudo iniciar la biblioteca de canciones.");
      notice(artistsBox, "Sin conexión", "No se pudo iniciar la biblioteca de artistas.");
      renderGroups([]);
      return;
    }
    const [songs, artists, categories] = await Promise.all([
      wait(client.from("songs").select("id,title,slug,song_type,tone,difficulty").limit(6)),
      wait(client.from("artists").select("id,name,slug,description").limit(6)),
      wait(client.from("categories").select("id,name,slug,parent_id,song_type,sort_order").order("sort_order", { ascending: true }).order("name", { ascending: true }))
    ]);
    if (songs.error) notice(songsBox, "No se pudieron cargar las canciones", "Actualiza la página e inténtalo de nuevo.");
    else if ((songs.data || []).length) songsBox.innerHTML = songs.data.map((song) => { const href = `cancion.html?slug=${encodeURIComponent(song.slug || "")}`; const meta = [song.song_type === "catolico" ? "Católico" : song.song_type === "cristiano" ? "Cristiano" : "General", song.tone ? `Tono ${song.tone}` : ""].filter(Boolean).join(" · "); return `<article class="song-card song-preview-card"><a class="song-preview-main" href="${href}"><h3>${esc(song.title || "Canción")}</h3><p>${esc(meta)}</p></a><div class="song-card-actions"><a class="song-btn small-btn" href="${href}">Ver canción</a></div></article>`; }).join("");
    else notice(songsBox, "Sin canciones", "Aún no hay canciones publicadas.");
    if (artists.error) notice(artistsBox, "No se pudieron cargar los artistas", "Actualiza la página e inténtalo de nuevo.");
    else if ((artists.data || []).length) artistsBox.innerHTML = artists.data.map((artist) => { const name = artist.name || "Artista"; const initials = name.split(/\s+/).slice(0, 2).map((word) => word[0] || "").join("").toUpperCase(); return `<a class="artist-card" href="artista.html?slug=${encodeURIComponent(artist.slug || "")}"><div class="artist-mini-avatar">${esc(initials)}</div><h3>${esc(name)}</h3><p>${esc(artist.description || "Ver canciones y álbumes.")}</p></a>`; }).join("");
    else notice(artistsBox, "Sin artistas", "Aún no hay artistas publicados.");
    renderGroups(categories.data || []);
  };

  document.addEventListener("DOMContentLoaded", recoverHome);
})();
