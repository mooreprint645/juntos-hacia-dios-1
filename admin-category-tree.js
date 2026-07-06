const CategoryTreeAdmin = window.supabaseClient;
const ct = (s) => document.querySelector(s);
function option(items) { return '<option value="">Categoría principal</option>' + items.map((item) => `<option value="${item.id}">${item.name}</option>`).join(""); }
async function loadTreeOptions() {
  const form = ct("#categoryForm");
  if (!form) return;
  if (!ct("#categoryParent")) {
    const parent = document.createElement("select");
    parent.name = "parent_id";
    parent.id = "categoryParent";
    form.querySelector("textarea")?.before(parent);
    const sort = document.createElement("input");
    sort.name = "sort_order";
    sort.type = "number";
    sort.min = "0";
    sort.placeholder = "Orden (opcional)";
    parent.after(sort);
  }
  const { data } = await CategoryTreeAdmin.from("categories").select("id,name").order("name", { ascending: true });
  ct("#categoryParent").innerHTML = option(data || []);
}
function startTreeAdmin() { loadTreeOptions(); CategoryTreeAdmin.auth.onAuthStateChange(() => loadTreeOptions()); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startTreeAdmin); else startTreeAdmin();
