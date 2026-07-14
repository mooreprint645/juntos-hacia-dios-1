(() => {
  if (window.__jhdAdminAuthController) return;
  window.__jhdAdminAuthController = true;

  const db = window.supabaseClient;
  const form = document.querySelector("#adminLoginForm");
  const message = document.querySelector("#adminLoginMessage");

  const setMessage = (text, bad = false) => {
    if (!message) return;
    message.textContent = text || "";
    message.style.color = bad ? "#ffb4b4" : "";
  };

  const adminUrl = () => {
    const url = new URL("./admin.html", window.location.href);
    url.search = "";
    url.hash = "";
    return url.href;
  };

  const callbackError = () => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    return hash.get("error_description") || query.get("error_description") || hash.get("error") || query.get("error") || "";
  };

  const cleanCallbackUrl = () => {
    if (!window.location.hash && !/[?&](error|error_description|access_token|refresh_token|expires_in|token_type)=/i.test(window.location.search)) return;
    history.replaceState({}, document.title, adminUrl());
  };

  async function isAuthorized(session) {
    if (!db || !session?.user) return false;
    const { data, error } = await db.rpc("jhd_is_admin");
    if (error) throw error;
    return data === true;
  }

  async function validateSession(session) {
    if (!session?.user) return false;
    try {
      const authorized = await isAuthorized(session);
      if (!authorized) {
        await db.auth.signOut();
        setMessage("Esta cuenta no tiene permiso para administrar el sitio.", true);
        return false;
      }
      cleanCallbackUrl();
      return true;
    } catch (error) {
      setMessage(`No se pudo comprobar el acceso: ${error.message || "error desconocido"}`, true);
      return false;
    }
  }

  async function requestAccess(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!db) {
      setMessage("No se pudo iniciar la conexión con Supabase.", true);
      return;
    }

    const email = String(new FormData(form).get("email") || "").trim().toLowerCase();
    const button = form?.querySelector('button[type="submit"]');
    if (!email) {
      setMessage("Escribe el correo autorizado.", true);
      return;
    }

    if (button) button.disabled = true;
    setMessage("Enviando enlace de acceso...");

    const { error } = await db.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: adminUrl(),
        shouldCreateUser: false
      }
    });

    if (button) button.disabled = false;
    if (error) {
      setMessage(`No se pudo enviar el enlace: ${error.message}`, true);
      return;
    }
    setMessage("Revisa tu correo. El enlace regresará directamente a este panel.");
  }

  form?.addEventListener("submit", requestAccess, true);

  const error = callbackError();
  if (error) setMessage(`El enlace de acceso no pudo completarse: ${error.replace(/\+/g, " ")}`, true);

  if (!db) {
    setMessage("No se pudo iniciar la conexión con Supabase.", true);
    return;
  }

  db.auth.getSession().then(({ data }) => validateSession(data?.session));
  db.auth.onAuthStateChange((event, session) => {
    if (["INITIAL_SESSION", "SIGNED_IN", "TOKEN_REFRESHED"].includes(event) && session) {
      setTimeout(() => validateSession(session), 0);
    }
  });
})();
