(() => {
  const db = window.supabaseClient;

  const installStyle = () => {
    if (document.getElementById("adminAccessGuardStyle")) return;
    const style = document.createElement("style");
    style.id = "adminAccessGuardStyle";
    style.textContent = ".jhd-admin-blocked #adminWorkspace{display:none!important}.jhd-admin-blocked #adminLoginSection{display:block!important}.jhd-admin-checking #adminWorkspace{visibility:hidden}.admin-access-message{margin-top:10px;color:#ffb4b4;line-height:1.45}";
    document.head.append(style);
  };

  const showBlocked = (message) => {
    document.documentElement.classList.remove("jhd-admin-checking");
    document.documentElement.classList.add("jhd-admin-blocked");
    const login = document.querySelector("#adminLoginSection");
    const feedback = document.querySelector("#adminLoginMessage");
    login?.classList.remove("admin-hidden");
    if (feedback) {
      feedback.className = "admin-access-message";
      feedback.textContent = message;
    }
  };

  const check = async () => {
    installStyle();
    document.documentElement.classList.add("jhd-admin-checking");
    if (!db) {
      document.documentElement.classList.remove("jhd-admin-checking");
      return;
    }

    const { data: sessionData } = await db.auth.getSession();
    if (!sessionData?.session) {
      document.documentElement.classList.remove("jhd-admin-checking");
      return;
    }

    const { data: isAdmin, error } = await db.rpc("jhd_is_admin");
    if (error || isAdmin !== true) {
      showBlocked("Esta cuenta no tiene permiso para administrar el cancionero.");
      return;
    }

    document.documentElement.classList.remove("jhd-admin-checking", "jhd-admin-blocked");
    document.documentElement.classList.add("jhd-admin-allowed");
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", check, { once: true });
  else check();
})();
