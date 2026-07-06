(() => {
  if (window.__jhdAdminHistory) return;
  window.__jhdAdminHistory = true;

  const snapshot = () => ({
    tab: AP.tab || "songs",
    folder: AP.categoryBrowser?.parentId || null,
    type: AP.categoryBrowser?.type || "all"
  });

  const store = (state, replace) => {
    const value = { ...(history.state || {}), jhdAdmin: state };
    if (replace) history.replaceState(value, "", location.href);
    else history.pushState(value, "", location.href);
  };

  store(snapshot(), true);

  document.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-admin-tab]");
    if (tab && tab.dataset.adminTab && tab.dataset.adminTab !== AP.tab) {
      store({ ...snapshot(), tab: tab.dataset.adminTab }, false);
      return;
    }

    const type = event.target.closest("[data-cat2-type]");
    if (type) {
      store({ tab: "categories", type: type.dataset.cat2Type || "all", folder: null }, false);
      return;
    }

    const folder = event.target.closest("[data-cat2-open]");
    if (folder) {
      store({ ...snapshot(), tab: "categories", folder: folder.dataset.cat2Open || null }, false);
    }
  }, true);

  window.addEventListener("popstate", (event) => {
    const route = event.state?.jhdAdmin;
    if (!route) return;
    if (AP.tab === "songs" && typeof apCaptureSongDraft === "function") apCaptureSongDraft();
    AP.tab = route.tab || "songs";
    if (AP.categoryBrowser) {
      AP.categoryBrowser.type = route.type || "all";
      AP.categoryBrowser.parentId = route.folder || null;
      AP.categoryBrowser.limit = 8;
    }
    apRenderView();
  });
})();
