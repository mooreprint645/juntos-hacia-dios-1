(() => {
  if (window.__jhdContactMessages) return;
  window.__jhdContactMessages = true;
  const db = window.supabaseClient;
  const $ = (selector) => document.querySelector(selector);
  const form = $("#contactForm");
  const status = $("#contactStatus");
  if (!form) return;

  const value = (selector) => $(selector)?.value?.trim() || "";
  const setStatus = (message, bad = false) => {
    if (!status) return;
    status.textContent = message || "";
    status.style.color = bad ? "#ffb4b4" : "";
  };
  const isMissingTable = (error) => /contact_messages|relation|schema cache|PGRST205/i.test(String(error?.message || error?.code || ""));

  function validate() {
    const details = value("#contactDetails");
    const type = value("#contactType");
    const title = value("#contactTitle");
    if (!details) {
      setStatus("Describe tu solicitud, sugerencia o corrección.", true);
      $("#contactDetails")?.focus();
      return false;
    }
    if (/Corrección/i.test(type) && !title) {
      setStatus("Indica el nombre del canto para poder localizarlo.", true);
      $("#contactTitle")?.focus();
      return false;
    }
    return true;
  }

  function payload() {
    return {
      message_type: value("#contactType") || "Mensaje",
      song_title: value("#contactTitle") || null,
      artist_name: value("#contactArtist") || null,
      source_url: value("#contactSource") || null,
      details: value("#contactDetails"),
      contact_name: value("#contactName") || null,
      contact_email: value("#contactEmail") || null,
      page_url: location.href,
      user_agent: navigator.userAgent,
      status: "pendiente",
      updated_at: new Date().toISOString()
    };
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!validate()) return;
    if (!db) {
      setStatus("No se pudo conectar con Supabase. Intenta de nuevo en un momento.", true);
      return;
    }
    setStatus("Enviando mensaje…");
    const { error } = await db.from("contact_messages").insert([payload()]);
    if (error) {
      setStatus(isMissingTable(error) ? "Falta ejecutar supabase-contact-messages.sql en Supabase." : `No se pudo enviar: ${error.message}`, true);
      return;
    }
    form.reset();
    const linked = $("#linkedSongNotice");
    if (linked) linked.hidden = true;
    setStatus("Mensaje enviado. Gracias por ayudar a mejorar el cancionero.");
  }, true);
})();