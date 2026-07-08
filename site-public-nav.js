(() => {
  const ensureLink = (menu, href, label, beforeHref) => {
    let link = menu.querySelector(`a[href="${href}"]`);
    if (!link) {
      link = document.createElement("a");
      link.href = href;
      link.textContent = label;
      const before = beforeHref ? menu.querySelector(`a[href="${beforeHref}"]`) : null;
      if (before) menu.insertBefore(link, before);
      else menu.append(link);
    }
    if (location.pathname.toLowerCase().endsWith(`/${href}`) || location.pathname.toLowerCase().endsWith(href)) link.classList.add("active");
  };

  const addPublicLinks = () => {
    if (/(^|\/)admin\.html$/i.test(location.pathname)) return;
    document.querySelectorAll("#navMenu").forEach((menu) => {
      ensureLink(menu, "solicitar-canto.html", "Solicitar canto", "donaciones.html");
      ensureLink(menu, "acerca.html", "Acerca de", "donaciones.html");
    });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addPublicLinks, { once: true });
  else addPublicLinks();
})();