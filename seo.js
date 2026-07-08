(() => {
  const DEFAULT_TITLE = "Juntos Hacia Dios";
  const DEFAULT_DESCRIPTION = "Cancionero cristiano y católico con letras, acordes, tonos, artistas y categorías para comunidades y coros.";
  const imageUrl = () => new URL("social-card.svg", location.href).href;

  const ensureMeta = (attribute, key, content) => {
    if (!content) return;
    let tag = document.head.querySelector(`meta[${attribute}="${CSS.escape(key)}"]`);
    if (!tag) {
      tag = document.createElement("meta");
      tag.setAttribute(attribute, key);
      document.head.append(tag);
    }
    tag.setAttribute("content", content);
  };

  const ensureLink = (rel, href) => {
    let tag = document.head.querySelector(`link[rel="${rel}"]`);
    if (!tag) {
      tag = document.createElement("link");
      tag.setAttribute("rel", rel);
      document.head.append(tag);
    }
    tag.setAttribute("href", href);
  };

  const replaceJsonLd = (id, data) => {
    document.getElementById(id)?.remove();
    const script = document.createElement("script");
    script.id = id;
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(data, (_, value) => value === undefined || value === "" ? undefined : value);
    document.head.append(script);
  };

  function setPage({ title, description, type = "website", image = imageUrl(), keywords = "" } = {}) {
    const cleanTitle = String(title || document.title || DEFAULT_TITLE).trim();
    const cleanDescription = String(description || document.querySelector('meta[name="description"]')?.content || DEFAULT_DESCRIPTION).trim();
    const url = location.href;
    document.title = cleanTitle;
    ensureMeta("name", "description", cleanDescription);
    ensureMeta("name", "robots", "index,follow");
    ensureMeta("name", "keywords", keywords);
    ensureMeta("property", "og:title", cleanTitle);
    ensureMeta("property", "og:description", cleanDescription);
    ensureMeta("property", "og:type", type);
    ensureMeta("property", "og:url", url);
    ensureMeta("property", "og:image", image);
    ensureMeta("property", "og:image:alt", "Juntos Hacia Dios");
    ensureMeta("property", "og:locale", "es_MX");
    ensureMeta("name", "twitter:card", "summary_large_image");
    ensureMeta("name", "twitter:title", cleanTitle);
    ensureMeta("name", "twitter:description", cleanDescription);
    ensureMeta("name", "twitter:image", image);
    ensureMeta("name", "theme-color", "#0f1117");
    ensureLink("canonical", url);
    replaceJsonLd("jhdWebsiteSchema", {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: DEFAULT_TITLE,
      url: location.origin,
      inLanguage: "es-MX",
      description: DEFAULT_DESCRIPTION,
      potentialAction: {
        "@type": "SearchAction",
        target: `${location.origin}${location.pathname.replace(/[^/]*$/, "")}canciones.html?q={search_term_string}`,
        "query-input": "required name=search_term_string"
      }
    });
  }

  function setSong({ title, description, artist, tone, type, categories = [] } = {}) {
    const cleanTitle = String(title || "Canción").trim();
    const cleanArtist = String(artist || "").replace(/^Por\s+/i, "").trim();
    const artistPrefix = cleanArtist && !/canción del cancionero/i.test(cleanArtist) ? `${cleanArtist} - ` : "";
    const heading = `${artistPrefix}${cleanTitle} | Letra y acordes | ${DEFAULT_TITLE}`;
    const catText = Array.isArray(categories) && categories.length ? ` Categorías: ${categories.join(", ")}.` : "";
    const copy = description || `${cleanArtist ? `${cleanTitle} de ${cleanArtist}. ` : ""}Letra, acordes${tone ? ` y tono ${tone}` : ""} para cantar y tocar en comunidad.${catText}`;
    setPage({
      title: heading,
      description: copy,
      type: "music.song",
      keywords: [cleanTitle, cleanArtist, tone && `tono ${tone}`, "letra", "acordes", "cantos católicos", "cantos cristianos", ...(categories || [])].filter(Boolean).join(", ")
    });
    replaceJsonLd("jhdItemSchema", {
      "@context": "https://schema.org",
      "@type": "MusicRecording",
      name: cleanTitle,
      url: location.href,
      inLanguage: "es-MX",
      byArtist: cleanArtist ? { "@type": "MusicGroup", name: cleanArtist } : undefined,
      genre: type || (categories || []).join(", ") || undefined,
      musicalKey: tone || undefined,
      description: copy,
      isAccessibleForFree: true
    });
  }

  function setArtist({ name, description } = {}) {
    const copy = description || `Perfil, canciones y álbumes de ${name || "este artista"} en Juntos Hacia Dios.`;
    setPage({ title: `${name || "Artista"} | ${DEFAULT_TITLE}`, description: copy, type: "profile" });
    replaceJsonLd("jhdItemSchema", {
      "@context": "https://schema.org",
      "@type": "MusicGroup",
      name: name || "Artista",
      url: location.href,
      description: copy
    });
  }

  function setAlbum({ title, artist, description } = {}) {
    const copy = description || `Canciones de ${title || "este álbum"}${artist ? ` por ${artist}` : ""} en Juntos Hacia Dios.`;
    setPage({ title: `${title || "Álbum"} | ${DEFAULT_TITLE}`, description: copy, type: "music.album" });
    replaceJsonLd("jhdItemSchema", {
      "@context": "https://schema.org",
      "@type": "MusicAlbum",
      name: title || "Álbum",
      url: location.href,
      byArtist: artist ? { "@type": "MusicGroup", name: artist } : undefined,
      description: copy
    });
  }

  window.JHDSEO = { setPage, setSong, setArtist, setAlbum };
  document.addEventListener("DOMContentLoaded", () => setPage());
})();