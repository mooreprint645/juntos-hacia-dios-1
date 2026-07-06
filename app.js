const client = window.supabaseClient;

const $ = (selector) => document.querySelector(selector);

function escapeHTML(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function initMenu() {
  const button = $("#menuToggle");
  const menu = $("#navMenu");
  if (!button || !menu) return;

  button.addEventListener("click", () => {
    menu.classList.toggle("open");
  });
}

function initTheme() {
  const button = $("#themeToggle");
  if (!button) return;

  const savedTheme = localStorage.getItem("jhd-theme");
  if (savedTheme === "light") {
    document.body.classList.add("light-mode");
    button.textContent = "☀️";
  }

  button.addEventListener("click", () => {
    document.body.classList.toggle("light-mode");
    const isLight = document.body.classList.contains("light-mode");
    localStorage.setItem("jhd-theme", isLight ? "light" : "dark");
    button.textContent = isLight ? "☀️" : "🌙";
  });
}

function songCard(song) {
  const title = escapeHTML(song.title || song.name || "Canción sin título");
  const tone = escapeHTML(song.tone || song.key || "");
  const type = escapeHTML(song.type || song.song_type || "");
  const id = encodeURIComponent(song.id || "");

  return `
    <article class="song-card">
      <h3>${title}</h3>
      <p>${type || "Canto disponible en la biblioteca."}</p>
      ${tone ? `<p><strong>Tono:</strong> ${tone}</p>` : ""}
      <a class="song-btn small-btn" href="cancion.html?id=${id}">Ver canción</a>
    </article>
  `;
}

function artistCard(artist) {
  const name = escapeHTML(artist.name || "Artista sin nombre");
  const type = escapeHTML(artist.type || artist.artist_type || "Ministerio");

  return `
    <article class="artist-card">
      <h3>${name}</h3>
      <p>${type}</p>
    </article>
  `;
}

function renderFallbackHome() {
  const songs = $("#homeSongsGrid");
  const artists = $("#homeArtistsGrid");

  if (songs) {
    songs.innerHTML = [
      "Alabanzas para misa",
      "Cantos de adoración",
      "Canciones con acordes"
    ].map((title) => `
      <article class="song-card">
        <h3>${title}</h3>
        <p>La biblioteca está lista para conectarse con Supabase.</p>
      </article>
    `).join("");
  }

  if (artists) {
    artists.innerHTML = [
      "Ministerios católicos",
      "Artistas cristianos",
      "Cantos mixtos"
    ].map((name) => `
      <article class="artist-card">
        <h3>${name}</h3>
        <p>Contenido organizado para la comunidad.</p>
      </article>
    `).join("");
  }
}

async function loadHome() {
  const songs = $("#homeSongsGrid");
  const artists = $("#homeArtistsGrid");

  if (!client) {
    renderFallbackHome();
    return;
  }

  try {
    const [songsResult, artistsResult] = await Promise.all([
      client.from("songs").select("*").order("created_at", { ascending: false }).limit(6),
      client.from("artists").select("*").order("created_at", { ascending: false }).limit(6)
    ]);

    if (songs) {
      const data = songsResult.data || [];
      songs.innerHTML = data.length ? data.map(songCard).join("") : "<article class='song-card'><h3>Sin canciones</h3><p>Aún no hay canciones para mostrar.</p></article>";
    }

    if (artists) {
      const data = artistsResult.data || [];
      artists.innerHTML = data.length ? data.map(artistCard).join("") : "<article class='artist-card'><h3>Sin artistas</h3><p>Aún no hay artistas para mostrar.</p></article>";
    }
  } catch (error) {
    console.error("Error cargando inicio:", error);
    renderFallbackHome();
  }
}

initMenu();
initTheme();
loadHome();
