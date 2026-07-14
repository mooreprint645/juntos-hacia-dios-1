(() => {
  if (window.supabaseClient) return;

  const source = "supabase-bootstrap.js?v=1";
  if (document.readyState === "loading") {
    document.write(`<script src="${source}"><\/script>`);
    return;
  }

  if (document.querySelector(`script[src^="supabase-bootstrap.js"]`)) return;
  const script = document.createElement("script");
  script.src = source;
  script.async = false;
  document.head.append(script);
})();
