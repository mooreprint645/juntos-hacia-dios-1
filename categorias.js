const Cat = window.JHD;
let categoryType = "";
let categoryFolder = null;
let categorySongId = null;
const categoryGrid = Cat.$("#categoriesGrid");
const categorySearch = Cat.$("#categorySearch");
const allowedTypes = new Set(["", "catolico", "cristiano", "mixto", "general"]);

const findCategory = (value) => Cat.state.categories.find((item) => String(item.id) === String(value) || Cat.normalize(item.slug) === Cat.normalize(value) || Cat.normalize(item.name) === Cat.normalize(value));
const categoryKey = (item) => item?.slug || item?.id || "";
const childrenOf = () => Cat.state.categories.filter((item) => String(item.parent_id || "") === String(categoryFolder || "") && (!categoryType || Cat.normalize(item.song_type) === categoryType)).sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.name).localeCompare(String(b.name), "es"));
const categoryPath = (item) => { const result = []; let current = item; const seen = new Set(); while (current && !seen.has(String(current.id))) { seen.add(String(current.id)); result.unshift(current); current = Cat.state.categories.find((row) => String(row.id) === String(current.parent_id)); } return result; };

function routeFromLocation() {
  const params = new URLSearchParams(location.search);
  const type = Cat.normalize(params.get("tipo") || "");
  const folder = findCategory(params.get("carpeta"));
  const song = findCategory(params.get("categoria"));
  return {
    type: allowedTypes.has(type) ? type : "",
    folder: folder?.id || null,
    song: song?.id || null,
    search: params.get("buscar") || ""
  };
}

function routeUrl() {
  const url = new URL(location.href);
  const params = url.searchParams;
  ["tipo", "carpeta", "categoria", "buscar"].forEach((key) => params.delete(key));
  if (categoryType) params.set("tipo", categoryType);
  const folder = findCategory(categoryFolder);
  const song = findCategory(categorySongId);
  const search = String(categorySearch?.value || "").trim();
  if (folder) params.set("carpeta", categoryKey(folder));
  if (song) params.set("categoria", categoryKey(song));
  if (search) params.set("buscar", search);
  return `${url.pathname}${params.toString() ? `?${params.toString()}` : ""}${url.hash}`;
}

function syncHistory(mode = "replace") {
  const state = { ...(history.state || {}), jhdCategoryRoute: { type: categoryType, folder: categoryFolder, song: categorySongId, search: String(categorySearch?.value || "") } };
  const url = routeUrl();
  if (mode === "push") history.pushState(state, "", url);
  else history.replaceState(state, "", url);
}

function applyRoute(route, write = false) {
  categoryType = route.type || "";
  categoryFolder = route.folder || null;
  categorySongId = route.song || null;
  if (categorySearch) categorySearch.value = route.search || "";
  if (write) syncHistory("replace");
  if (categorySongId) showCategorySongs(categorySongId, false);
  else renderCategoryBrowser();
}

const categoryTile = (item) => {
  const nested = Cat.state.categories.some((row) => String(row.parent_id || "") === String(item.id));
  return `<article class="public-category-card"><p class="hero-kicker">${Cat.esc(Cat.typeLabel(item.song_type))}</p><h3>📁 ${Cat.esc(item.name || "Categoría")}</h3><p>${Cat.esc(item.description || "Cantos organizados en esta categoría.")}</p><div class="public-category-card-actions">${nested ? `<button class="song-btn small-btn" data-folder="${Cat.esc(item.id)}">Abrir carpeta</button>` : ""}<button class="song-btn small-btn secondary" data-category="${Cat.esc(item.id)}">Ver cantos</button></div></article>`;
};

function bindCategoryButtons() {
  Cat.$$('[data-category-type]').forEach((button) => button.addEventListener("click", () => {
    categoryType = Cat.normalize(button.dataset.categoryType);
    categoryFolder = null;
    categorySongId = null;
    if (categorySearch) categorySearch.value = "";
    syncHistory("push");
    renderCategoryBrowser();
  }));
  Cat.$$('[data-folder]').forEach((button) => button.addEventListener("click", () => {
    categoryFolder = button.dataset.folder || null;
    categorySongId = null;
    if (categorySearch) categorySearch.value = "";
    syncHistory("push");
    renderCategoryBrowser();
  }));
  Cat.$$('[data-category]').forEach((button) => button.addEventListener("click", () => showCategorySongs(button.dataset.category, true)));
}

function renderCategoryBrowser() {
  if (!categoryGrid) return;
  const query = Cat.normalize(categorySearch?.value);
  if (query) {
    const items = Cat.state.categories.filter((item) => Cat.normalize([item.name, item.description, item.song_type, categoryPath(item).map((row) => row.name).join(" ")].join(" ")).includes(query));
    categoryGrid.innerHTML = items.length ? `<div class="public-category-grid">${items.map(categoryTile).join("")}</div>` : Cat.errorCard("Sin resultados", "No encontramos categorías con ese texto.");
    bindCategoryButtons();
    return;
  }
  const current = categoryFolder ? findCategory(categoryFolder) : null;
  const path = current ? categoryPath(current) : [];
  const items = childrenOf();
  categoryGrid.innerHTML = `<div class="public-category-explorer"><div class="public-category-tabs"><button class="filter-btn ${!categoryType ? "active" : ""}" data-category-type="">Todas</button><button class="filter-btn ${categoryType === "catolico" ? "active" : ""}" data-category-type="catolico">Católico</button><button class="filter-btn ${categoryType === "cristiano" ? "active" : ""}" data-category-type="cristiano">Cristiano</button><button class="filter-btn ${categoryType === "mixto" ? "active" : ""}" data-category-type="mixto">Mixto</button></div><nav class="public-category-path" aria-label="Ruta de categorías"><a class="text-link" href="index.html">Inicio</a><span>›</span><button class="text-link" data-folder="">Categorías</button>${path.map((item) => `<span>›</span><button class="text-link" data-folder="${Cat.esc(item.id)}">${Cat.esc(item.name)}</button>`).join("")}</nav>${items.length ? `<div class="public-category-grid">${items.map(categoryTile).join("")}</div>` : `<div class="public-category-empty"><p>No hay subcategorías aquí.</p>${current ? `<button class="song-btn small-btn" data-category="${Cat.esc(current.id)}">Ver cantos de esta categoría</button>` : ""}</div>`}</div>`;
  bindCategoryButtons();
}

function showCategorySongs(id, push = false) {
  const category = findCategory(id);
  if (!category || !categoryGrid) return;
  categorySongId = category.id;
  if (push) syncHistory("push");
  const ids = Cat.descendantIds(category.id);
  const songs = Cat.state.songs.filter((song) => (song._categories || []).some((item) => ids.has(String(item.id))));
  categoryGrid.innerHTML = `<div class="category-songs-view"><button class="song-btn small-btn secondary" id="backToCategories">← Volver a categorías</button><div class="category-songs-header"><p class="hero-kicker">Cantos encontrados</p><h2>${Cat.esc(category.name)}</h2><p>${Cat.esc(category.description || "Cantos de esta categoría y sus subcategorías.")}</p></div><div class="category-songs-list">${songs.length ? songs.map((song) => `<a class="category-song-card" href="cancion.html?slug=${encodeURIComponent(song.slug || Cat.slugify(song.title))}"><div><p class="eyebrow">${Cat.esc(Cat.artistNames(song))}</p><h3>${Cat.esc(song.title)}</h3><p>${Cat.esc(Cat.songMeta(song))}</p></div><span>›</span></a>`).join("") : `<p class="muted-text">Esta categoría todavía no tiene cantos relacionados.</p>`}</div></div>`;
  Cat.$("#backToCategories")?.addEventListener("click", () => {
    categorySongId = null;
    syncHistory("push");
    renderCategoryBrowser();
  });
}

async function loadNestedCategories() {
  if (Cat.page() !== "categorias.html") return;
  const [categoriesResult, songsResult] = await Promise.all([Cat.fetchCategories(), Cat.fetchSongsWithRelations()]);
  if (categoriesResult.error) { if (categoryGrid) categoryGrid.innerHTML = Cat.errorCard("Error al cargar categorías", categoriesResult.error.message); return; }
  Cat.state.categories = categoriesResult.data || [];
  Cat.state.songs = songsResult.data || [];
  categorySearch?.addEventListener("input", () => {
    categorySongId = null;
    syncHistory("replace");
    renderCategoryBrowser();
  });
  window.addEventListener("popstate", () => applyRoute(routeFromLocation(), false));
  applyRoute(routeFromLocation(), true);
}

document.addEventListener("DOMContentLoaded", loadNestedCategories);
