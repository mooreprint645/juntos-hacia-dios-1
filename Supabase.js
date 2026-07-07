const SUPABASE_URL = "https://bmtgfbtoyxwrrnygsqcj.supabase.co";

const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtdGdmYnRveXh3cnJueWdzcWNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MjQwMTQsImV4cCI6MjA5ODAwMDAxNH0.7RF-h7yqT6gn-rQvtTDOVtxqn_vlVYlwAIusb1wPuLA";

var supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

window.supabaseClient = supabaseClient;

(() => {
  if (/(^|\/)admin\.html$/i.test(location.pathname)) return;
  const script = document.createElement("script");
  script.src = "site-footer-links.js?v=1";
  script.async = true;
  document.head.append(script);
})();

(() => {
  const isArtistProfile = () => /(^|\/)artista\.html$/i.test(location.pathname);
  if (!isArtistProfile()) return;

  ["seo.js?v=1", "artist-profile-seo.js?v=1", "artist-profile-fields.js?v=1", "artist-discovery.js?v=2"].forEach((src) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    document.head.append(script);
  });

  const addStyle = () => {
    if (document.getElementById("artistShareProfileStyle")) return;
    const style = document.createElement("style");
    style.id = "artistShareProfileStyle";
    style.textContent = ".artist-profile-actions .artist-share-profile{display:inline-flex;align-items:center;justify-content:center;min-height:36px;padding:8px 13px;border:1px solid rgba(246,196,83,.28);border-radius:999px;background:rgba(246,196,83,.12);color:var(--gold);font:inherit;font-weight:850;font-size:.86rem;cursor:pointer}.artist-profile-actions .artist-share-profile:hover,.artist-profile-actions .artist-share-profile:focus-visible{background:var(--gold);color:#151515;outline:none}.artist-profile-actions .artist-share-profile:disabled{opacity:.7;cursor:wait}";
    document.head.append(style);
  };

  const shareProfile = async (button, artistName) => {
    const url = location.href;
    const title = `${artistName} | Juntos Hacia Dios`;
    const text = `Conoce los cantos de ${artistName} en Juntos Hacia Dios.`;
    const original = button.textContent;

    button.disabled = true;
    try {
      if (navigator.share) {
        try {
          await navigator.share({ title, text, url });
          return;
        } catch (error) {
          if (error?.name === "AbortError") return;
        }
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        button.textContent = "Enlace copiado";
        setTimeout(() => { button.textContent = original; }, 1800);
        return;
      }

      window.prompt("Copia este enlace:", url);
    } catch (_) {
      window.prompt("Copia este enlace:", url);
    } finally {
      button.disabled = false;
    }
  };

  const install = () => {
    const actions = document.querySelector(".artist-profile-actions");
    const artistName = document.querySelector(".artist-hero-card h1")?.textContent?.trim();
    if (!actions || !artistName || actions.querySelector("[data-share-artist-profile]")) return false;

    addStyle();
    const button = document.createElement("button");
    button.type = "button";
    button.className = "artist-share-profile";
    button.dataset.shareArtistProfile = "true";
    button.textContent = "Compartir perfil";
    button.setAttribute("aria-label", `Compartir perfil de ${artistName}`);
    button.addEventListener("click", () => shareProfile(button, artistName));
    actions.append(button);
    return true;
  };

  const boot = () => {
    install();
    const observer = new MutationObserver(() => {
      if (install()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();