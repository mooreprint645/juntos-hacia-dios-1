(() => {
  const addAboutLink = () => {
    if (/(^|\/)admin\.html$/i.test(location.pathname)) return;
    document.querySelectorAll("#navMenu").forEach((menu) => {
      let about = menu.querySelector('a[href="acerca.html"]');
      if (!about) {
        about = document.createElement("a");
        about.href = "acerca.html";
        about.textContent = "Acerca de";
        const donations = menu.querySelector('a[href="donaciones.html"]');
        if (donations) menu.insertBefore(about, donations);
        else menu.append(about);
      }
      if (/(^|\/)acerca\.html$/i.test(location.pathname)) about.classList.add("active");
    });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addAboutLink, { once: true });
  else addAboutLink();
})();
