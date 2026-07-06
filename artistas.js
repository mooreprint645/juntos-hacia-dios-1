const db = window.supabaseClient;
const grid = document.querySelector("#artistsGrid");
async function start() {
  if (!db || !grid) return;
  const result = await db.from("artists").select("*").order("name", { ascending: true });
  if (result.error) { grid.textContent = "No se pudo cargar el contenido."; return; }
  grid.textContent = "";
  (result.data || []).forEach((item) => {
    const card = document.createElement("article");
    card.className = "artist-card";
    const title = document.createElement("h3");
    title.textContent = item.name || "Ministerio";
    const text = document.createElement("p");
    text.textContent = item.description || item.artist_type || "Contenido del cancionero.";
    card.append(title, text);
    grid.append(card);
  });
}
start();
