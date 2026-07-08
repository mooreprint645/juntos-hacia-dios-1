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

  const setMeta = (attr, key, value) => {
    if (!value) return;
    let tag = document.head.querySelector(`meta[${attr}="${CSS.escape(key)}"]`);
    if (!tag) {
      tag = document.createElement("meta");
      tag.setAttribute(attr, key);
      document.head.append(tag);
    }
    tag.setAttribute("content", value);
  };

  const setSchema = (title, description, url) => {
    if (document.getElementById("jhdStaticPageSchema")) return;
    const script = document.createElement("script");
    script.id = "jhdStaticPageSchema";
    script.type = "application/ld+json";
    script.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": title,
      "description": description,
      "url": url,
      "inLanguage": "es-MX",
      "isPartOf": { "@type": "WebSite", "name": "Juntos Hacia Dios", "url": location.origin }
    });
    document.head.append(script);
  };

  const setSeo = () => {
    const page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    const data = {
      "index.html": ["Inicio | Juntos Hacia Dios", "Cancionero cristiano y católico con letras, acordes, tonos, artistas y recursos para coros, ministerios y comunidades."],
      "canciones.html": ["Canciones católicas y cristianas | Juntos Hacia Dios", "Explora cantos cristianos y católicos con letras, acordes, tonos, artistas y categorías para coros, ministerios y comunidades."],
      "artistas.html": ["Artistas y ministerios | Juntos Hacia Dios", "Explora artistas, salmistas y ministerios con sus cantos, álbumes y recursos musicales."],
      "categorias.html": ["Categorías de cantos | Juntos Hacia Dios", "Encuentra cantos organizados por momentos, temas, usos litúrgicos y categorías pastorales."],
      "albumes.html": ["Álbumes de cantos | Juntos Hacia Dios", "Explora álbumes, proyectos y colecciones de cantos cristianos y católicos."],
      "acerca.html": ["Acerca de | Juntos Hacia Dios", "Conoce el propósito de Juntos Hacia Dios, un cancionero para servir con música y fe."],
      "contacto.html": ["Contacto y correcciones | Juntos Hacia Dios", "Envía correcciones, sugerencias o comentarios para mejorar letras, acordes, tonos y datos del cancionero."],
      "solicitar-canto.html": ["Solicitar canto | Juntos Hacia Dios", "Solicita un canto para que sea revisado y agregado al cancionero Juntos Hacia Dios."],
      "donaciones.html": ["Donaciones | Juntos Hacia Dios", "Apoya el mantenimiento, organización y crecimiento del cancionero Juntos Hacia Dios."]
    }[page];
    if (!data) return;
    const url = location.href.split("#")[0];
    const image = new URL("social-card.svg", location.href).href;
    document.title = data[0];
    setMeta("name", "description", data[1]);
    setMeta("name", "robots", "index,follow");
    setMeta("property", "og:title", data[0]);
    setMeta("property", "og:description", data[1]);
    setMeta("property", "og:url", url);
    setMeta("property", "og:image", image);
    setMeta("property", "og:locale", "es_MX");
    setMeta("name", "twitter:title", data[0]);
    setMeta("name", "twitter:description", data[1]);
    setMeta("name", "twitter:image", image);
    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.append(canonical);
    }
    canonical.href = url;
    setSchema(data[0], data[1], url);
  };

  const addPublicLinks = () => {
    if (/(^|\/)admin\.html$/i.test(location.pathname)) return;
    document.querySelectorAll("#navMenu").forEach((menu) => {
      ensureLink(menu, "solicitar-canto.html", "Solicitar canto", "donaciones.html");
      ensureLink(menu, "acerca.html", "Acerca de", "donaciones.html");
    });
    setSeo();
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addPublicLinks, { once: true });
  else addPublicLinks();
})();