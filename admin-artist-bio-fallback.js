(() => {
  const clean = (value) => String(value || "").replace(/<!--JHD_ARTIST_META:[\s\S]*?-->\s*$/, "").trim();
  const apply = () => {
    const form = document.querySelector("#artistAdminForm");
    const textarea = form?.querySelector('textarea[name="description"]');
    const artist = typeof AP === "undefined" ? null : (AP.artists || []).find((item) => String(item.id) === String(AP.edits.artist));
    if (!textarea || !artist || textarea.value.trim() || !artist.description) return false;
    textarea.value = clean(artist.description);
    return true;
  };
  const boot = () => {
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    apply();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
