(() => {
  const SUPABASE_URL = "https://bmtgfbtoyxwrrnygsqcj.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtdGdmYnRveXh3cnJueWdzcWNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MjQwMTQsImV4cCI6MjA5ODAwMDAxNH0.7RF-h7yqT6gn-rQvtTDOVtxqn_vlVYlwAIusb1wPuLA";

  let resolveReady;
  window.jhdSupabaseReady = window.jhdSupabaseReady || new Promise((resolve) => {
    resolveReady = resolve;
  });

  const finish = (client) => {
    window.supabaseClient = client || null;
    if (resolveReady) resolveReady(window.supabaseClient);
    window.dispatchEvent(new CustomEvent(client ? "jhd:supabase-ready" : "jhd:supabase-error", {
      detail: { client: window.supabaseClient }
    }));
    return window.supabaseClient;
  };

  const initialize = () => {
    if (window.supabaseClient) return finish(window.supabaseClient);
    if (!window.supabase?.createClient) return null;
    try {
      return finish(window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY));
    } catch (error) {
      console.error("No se pudo crear el cliente de Supabase", error);
      return null;
    }
  };

  const loadScript = (src) => new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.append(script);
  });

  const boot = async () => {
    if (initialize()) return;
    const sources = [
      "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
      "https://unpkg.com/@supabase/supabase-js@2"
    ];
    for (const source of sources) {
      const loaded = await loadScript(source);
      if (loaded && initialize()) return;
    }
    finish(null);
  };

  boot();

  const adminPage = /(^|\/)admin\.html$/i.test(location.pathname);
  const helpers = adminPage
    ? []
    : [
        "public-loader-recovery.js?v=1",
        "site-footer-links.js?v=1",
        "site-public-nav.js?v=1"
      ];

  helpers.forEach((src) => {
    if (document.querySelector(`script[src^="${src.split("?")[0]}"]`)) return;
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    document.head.append(script);
  });
})();
