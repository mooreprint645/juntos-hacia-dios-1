(() => {
  const JHD = window.JHD;
  if (!JHD) return;

  const renderGroups = (categories) => {
    const old = document.getElementById("homeFaithAccess");
    if (old) old.remove();
    const hero = document.querySelector(".hero");
    if (!hero) return;

    const group = (type, title, description) => {
      const typed = (categories || []).filter((item) => JHD.normalize(item.song_type) === type);
      let roots = typed.filter((item) => !item.parent_id);
      const generic = type === "catolico" ? ["catolico", "catolica"] : ["cristiano", "cristiana"];
      if (roots.length === 1 && generic.includes(JHD.normalize(roots[0].name))) {
        const children = typed.filter((item) => String(item.parent_id) === String(roots[0].id));
        if (children.length) roots = children;
      }
      roots = roots.sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)).slice(0, 8);
      const cards = roots.map((item) => `<a class="home-access-card" href="categorias.html?tipo=${type}&carpeta=${encodeURIComponent(item.slug || item.id)}"><strong>${JHD.esc(item.name || "Categoría")}</strong><small>Ver cantos</small></a>`).join("");
      return `<article class="home-access-group"><div class="home-access-group-heading"><span class="home-access-symbol">✝</span><div><h3>${title}</h3><p>${description}</p></div></div>${cards ? `<div class="home-access-grid">${cards}</div>` : '<p class="home-access-empty">Aún no hay categorías disponibles.</p>'}<div class="home-access-footer"><a class="text-link" href="categorias.html?tipo=${type}">Ver todas</a></div></article>`;
    };

    const section = document.createElement("section");
    section.id = "homeFaithAccess";
    section.className = "section home-faith-access";
    section.innerHTML = `<div class="section-heading"><p class="hero-kicker">Encuentra rápido</p><h2>¿Para qué necesitas un canto?</h2></div><div class="home-access-groups">${group("catolico", "Católico", "Misa, tiempos litúrgicos y devociones.")}${group("cristiano", "Cristiano", "Alabanza, oración y ministerios.")}</div>`;
    hero.insertAdjacentElement("afterend", section);
  };

  JHD.loadHome = async () => {
    if (JHD.page() !== "index.html") return;
    const songsBox = JHD.$("#homeSongsGrid");
    const artistsBox = JHD.$("#homeArtistsGrid");
    if (!JHD.sb) {
      if (songsBox) songsBox.innerHTML = JHD.errorCard("Sin conexión", "No se pudo iniciar la biblioteca de canciones.");
      if (artistsBox) artistsBox.innerHTML = JHD.errorCard("Sin conexión", "No se pudo iniciar la biblioteca de artistas.");
      renderGroups([]);
      return;
    }

    const [songsRes, artistsRes, categoriesRes] = await Promise.all([
      JHD.sb.from("songs").select("id,title,slug,song_type,tone,difficulty").order("title", { ascending: true }).limit(6),
      JHD.sb.from("artists").select("id,name,slug,description,artist_type").order("name", { ascending: true }).limit(6),
      JHD.sb.from("categories").select("id,name,slug,parent_id,song_type,sort_order").order("sort_order", { ascending: true }).order("name", { ascending: true })
    ]);

    if (songsBox) {
      if (songsRes.error) songsBox.innerHTML = JHD.errorCard("Error al cargar canciones", songsRes.error.message);
      else {
        const cards = (songsRes.data || []).map((song) => {
          const href = `cancion.html?slug=${encodeURIComponent(song.slug || JHD.slugify(song.title))}`;
          return `<a class="song-card song-link-card" href="${href}"><h3>${JHD.esc(song.title || "Canción sin título")}</h3><p>${JHD.esc(JHD.songMeta(song))}</p></a>`;
        });
        songsBox.innerHTML = cards.length ? cards.join("") : JHD.errorCard("Sin canciones", "Aún no hay canciones publicadas.");
      }
    }

    if (artistsBox) {
      if (artistsRes.error) artistsBox.innerHTML = JHD.errorCard("Error al cargar artistas", artistsRes.error.message);
      else {
        const cards = (artistsRes.data || []).map(JHD.artistCard);
        artistsBox.innerHTML = cards.length ? cards.join("") : JHD.errorCard("Sin artistas", "Aún no hay artistas publicados.");
      }
    }

    renderGroups(categoriesRes.data || []);
  };

  document.addEventListener("click", (event) => {
    const link = event.target.closest('a[href^="artista.html?slug="]');
    if (!link) return;
    event.preventDefault();
    const url = new URL(link.href);
    location.href = `artistas.html?slug=${encodeURIComponent(url.searchParams.get("slug") || "")}`;
  });
})();
