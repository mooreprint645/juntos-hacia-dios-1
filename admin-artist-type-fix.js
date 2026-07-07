(() => {
  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== "artistAdminForm") return;
    const type = form.querySelector('select[name="artist_type"]');
    if (type && !String(type.value || "").trim()) type.value = "general";
  }, true);
})();
