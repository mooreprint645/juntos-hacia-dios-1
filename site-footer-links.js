(() => {
  const addLinks = () => {
    if (/(^|\/)admin\.html$/i.test(location.pathname)) return;
    document.querySelectorAll("footer p:last-child").forEach((line) => {
      if (line.querySelector("[data-jhd-footer-info]")) return;
      const wrapper = document.createElement("span");
      wrapper.dataset.jhdFooterInfo = "true";
      wrapper.innerHTML = ' · <a href="acerca.html">Acerca de</a> · <a href="contacto.html">Contacto</a>';
      line.append(wrapper);
    });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addLinks, { once: true });
  else addLinks();
})();
