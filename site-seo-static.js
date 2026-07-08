(() => {
  if (window.__jhdStaticSeo) return;
  window.__jhdStaticSeo = true;

  const baseTitle = "Juntos Hacia Dios";
  const baseDescription = "Cancionero cristiano y católico con letras, acordes, tonos, artistas y categorías para coros, ministerios y comunidades.";
  const image = new URL("social-card.svg", location.href).href;
  const path = location.pathname.split("/").pop() || "index.html";

  const pages = {
    "index.html": {
      title: "Inicio | Juntos Hacia Dios",
      description: "Cancionero cristiano y católico con letras, acordes, tonos, artistas y recursos para coros, ministerios y comunidades.",
      keywords: "cancionero católico, cantos cristianos, letras y acordes, cantos para misa, ministerios de música"
    },
    "canciones.html": {
      title: "Canciones católicas y cristianas | Juntos Hacia Dios",
      description: "Explora cantos cristianos y católicos con letras, acordes, tonos, artistas y categorías para coros, ministerios y comunidades.",
      keywords: "canciones católicas, cantos cristianos, acordes católicos, letras de cantos, tonos de canciones"
    },
    "artistas.html": {
      title: "Artistas y ministerios | Juntos Hacia Dios",
      description: "Explora artistas, salmistas y ministerios con sus cantos, álbumes y recursos musicales en Juntos Hacia Dios.",
      keywords: "artistas católicos, ministerios de música, salmistas, cantos por artista"
    },
    "categorias.html": {
      title: "Categorías de cantos | Juntos Hacia Dios",
      description: "Encuentra cantos organizados por momentos, temas, usos litúrgicos y categorías pastorales.",
      keywords: "categorías de cantos, cantos para misa, adoración, comunión, entrada, alabanza"
    },
    "albumes.html": {
      title: "Álbumes de cantos | Juntos Hacia Dios",
      description: "Explora álbumes, proyectos y colecciones de cantos cristianos y católicos con canciones relacionadas.",
      keywords: "álbumes católicos, álbumes cristianos, canciones por álbum, colecciones de cantos"
    },
    "acerca.html": {
      title: "Acerca de | Juntos Hacia Dios",
      description: "Conoce el propósito de Juntos Hacia Dios, un cancionero para servir con música y fe a comunidades y ministerios.",
      keywords: "Juntos Hacia Dios, cancionero católico, cancionero cristiano, ministerio de música"
    },
    "contacto.html": {
      title: "Contacto y correcciones | Juntos Hacia Dios",
      description: "Envía correcciones, sugerencias o comentarios para mejorar letras, acordes, tonos y datos del cancionero.",
      keywords: "reportar corrección, sugerencias, corregir acordes, corregir letras"
    },
    "solicitar-canto.html": {
      title: "Solicitar canto | Juntos Hacia Dios",
      description: "Solicita un canto para que sea revisado y agregado al cancionero Juntos Hacia Dios.",
      keywords: "solicitar canto, pedir canción, agregar canto católico, agregar canto cristiano"
    },
    "donaciones.html": {
      title: "Donaciones | Juntos Hacia Dios",
      description: "Apoya el mantenimiento, organización y crecimiento del cancionero Juntos Hacia Dios.",
      keywords: "donaciones, apoyar cancionero, Juntos Hacia Dios"
    }
  };

  function meta(attribute, key, value) {
    if (!value) return;
    let tag = document.head.querySelector(`meta[${attribute}="${CSS.escape(key)}"]`);
    if (!tag) {
      tag = document.createElement("meta");
      tag.setAttribute(attribute, key);
      document.head.append(tag);
    }
    tag.setAttribute("content", value);
  }

  function link(rel, href) {
    let tag = document.head.querySelector(`link[rel="${rel}"]`);
    if (!tag) {
      tag = document.createElement("link");
      tag.rel = rel;
      document.head.append(tag);
    }
    tag.href = href;
  }

  function schema(id, data) {
    document.getElementById(id)?.remove();
    const script = document.createElement("script");
    script.id = id;
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(data);
    document.head.append(script);
  }

  function apply(page) {
    if (!page) return;
    const url = location.href.split("#")[0];
    document.title = page.title;
    meta("name", "description", page.description);
    meta("name", "keywords", page.keywords);
    meta("name", "robots", "index,follow");
    meta("property", "og:title", page.title);
    meta("property", "og:description", page.description);
    meta("property", "og:type", "website");
    meta("property", "og:url", url);
    meta("property", "og:image", image);
    meta("property", "og:locale", "es_MX");
    meta("name", "twitter:card", "summary_large_image");
    meta("name", "twitter:title", page.title);
    meta("name", "twitter:description", page.description);
    meta("name", "twitter:image", image);
    link("canonical", url);
    schema("jhdGeneralSchema", {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "Organization", "@id": `${location.origin}#organization`, "name": baseTitle, "url": location.origin, "logo": image, "description": baseDescription },
        { "@type": "WebSite", "@id": `${location.origin}#website`, "name": baseTitle, "url": location.origin, "inLanguage": "es-MX", "description": baseDescription, "potentialAction": { "@type": "SearchAction", "target": `${new URL("canciones.html?q={search_term_string}", location.href).href}`, "query-input": "required name=search_term_string" } },
        { "@type": "WebPage", "@id": `${url}#webpage`, "url": url, "name": page.title, "description": page.description, "inLanguage": "es-MX", "isPartOf": { "@id": `${location.origin}#website` } }
      ]
    });
  }

  function enhanceDynamicArtist() {
    if (path !== "artista.html") return;
    const h1 = document.querySelector("#artistProfile h1");
    const name = h1?.textContent?.trim();
    if (!name || /cargando|un momento/i.test(name)) return;
    apply({
      title: `${name} | Canciones y álbumes | ${baseTitle}`,
      description: `Explora canciones, álbumes y recursos musicales de ${name} en Juntos Hacia Dios.`,
      keywords: `${name}, canciones de ${name}, acordes, letras, cantos cristianos, cantos católicos`
    });
  }

  if (path === "artista.html") {
    const observer = new MutationObserver(enhanceDynamicArtist);
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    enhanceDynamicArtist();
  } else {
    apply(pages[path]);
  }
})();