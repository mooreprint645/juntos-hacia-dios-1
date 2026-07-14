const SUPABASE_URL = "https://bmtgfbtoyxwrrnygsqcj.supabase.co";
const SUPABASE_ANON_KEY = [
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.",
  "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtdGdmYnRveXh3cnJueWdzcWNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MjQwMTQsImV4cCI6MjA5ODAwMDAxNH0.",
  "7RF-h7yqT6gn-rQvtTDOVtxqn_vlVYlwAIusb1wPuLA"
].join("");

var supabaseClient = null;

if (window.supabase?.createClient) {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  window.supabaseClient = supabaseClient;
  window.jhdSupabaseReady = Promise.resolve(supabaseClient);
  window.dispatchEvent(new CustomEvent("jhd:supabase-ready", {
    detail: { client: supabaseClient }
  }));
} else {
  window.supabaseClient = null;
  window.jhdSupabaseReady = Promise.resolve(null);
  console.error("No se cargó la biblioteca de Supabase antes del bootstrap.");
  window.dispatchEvent(new CustomEvent("jhd:supabase-error", {
    detail: { client: null }
  }));
}

(() => {
  if (/(^|\/)admin\.html$/i.test(location.pathname)) return;
  ["site-footer-links.js?v=1", "site-public-nav.js?v=1"].forEach((src) => {
    if (document.querySelector(`script[src^="${src.split("?")[0]}"]`)) return;
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    document.head.append(script);
  });
})();
