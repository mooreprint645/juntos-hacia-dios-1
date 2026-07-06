const client = window.supabaseClient;
const categoriesGrid = document.querySelector("#categoriesGrid");
const searchInput = document.querySelector("#categorySearch");
let allCategories = [];

const escapeHTML = (value) => String(value || "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function initNavigation() {
  const menuButton = document.querySelector("#menuToggle");
  const menu = document.querySelector("#navMenu");
  const themeButton = document.querySelector("#themeToggle");

  menuButton?.addEventListener("click", () => menu?.classList.toggle("open"));

  if (localStorage.getItem("jhd-theme") === "light") {
    document.body.classList.add("light-mode");
    if (themeButton) themeButton.textContent = "☀️";
  }

  themeButton?.addEventListener("click", () => {
    document.body.classList.toggle("light-mode");
    const light = document.body.classList.contains("light-mode");
    localStorage.setItem("jhd-theme", light ? "light" : "dark");
    themeButton.textContent = light ? "☀️" : "🌙";
  });
}

function normalize(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function renderCategories() {
  const query = normalize(searchInput?.value);
  const filtered = allCategories.filter((category) => {
    const text = normalize([category.name, category.title, category.description].join(" "));
    return !query || text.includes(query);
  });

  if (!categoriesGrid) return;

  if (!filtered.length) {
    categoriesGrid.innerHTML = "<article class='quick-card'><h3>Sin resultados</h3><p>Prueba con otra categoría.</p></article>";
    return;
  }

  categoriesGrid.innerHTML = filtered.map((category) => {
    const name = escapeHTML(category.name || category.title || "Categoría");
    const description = escapeHTML(category.description || "Cantos organizados dentro de esta categoría.");
    return `<a class="quick-card" href="canciones.html?categoria=${encodeURIComponent(category.name || category.title || "")}"><span>📖</span><h3>${name}</h3><p>${description}</p></a>`;
  }).join("");
}

async function loadCategories() {
  if (!client) {
    categoriesGrid.innerHTML = "<article class='quick-card'><h3>Sin conexión</h3><p>No se pudo iniciar Supabase.</p></article>";
    return;
  }

  const { data, error } = await client.from("categories").select("*").order("name", { ascending: true });
  if (error) {
    console.error(error);
    categoriesGrid.innerHTML = "<article class='quick-card'><h3>Error al cargar</h3><p>Revisa la conexión o la tabla categories.</p></article>";
    return;
  }

  allCategories = data || [];
  renderCategories();
}

searchInput?.addEventListener("input", renderCategories);
initNavigation();
loadCategories();
