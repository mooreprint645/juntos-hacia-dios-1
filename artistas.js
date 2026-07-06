const P = window.JHD;
P.loadProfile = async () => {
  if (P.page() !== "artista.html") return;
};
document.addEventListener("DOMContentLoaded", P.loadProfile);
