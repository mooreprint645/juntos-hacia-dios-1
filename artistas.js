const P = window.JHD;
P.loadProfile = async () => {
  if (P.page() !== "artista.html") return;
  const result = await P.fetchArtists();
  console.log(result);
};
document.addEventListener("DOMContentLoaded", P.loadProfile);
