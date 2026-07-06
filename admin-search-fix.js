(() => {
  const searchIds = new Set(["artistFilter", "categoryFilter", "albumFilter", "songFilter"]);
  const originalRenderView = apRenderView;

  apRenderView = function (...args) {
    const active = document.activeElement;
    const id = active?.id || "";
    const start = typeof active?.selectionStart === "number" ? active.selectionStart : null;
    const end = typeof active?.selectionEnd === "number" ? active.selectionEnd : null;

    originalRenderView.apply(this, args);

    if (!searchIds.has(id)) return;
    requestAnimationFrame(() => {
      const field = document.getElementById(id);
      if (!field) return;
      field.focus({ preventScroll: true });
      if (start !== null && end !== null) field.setSelectionRange(start, end);
    });
  };
})();
