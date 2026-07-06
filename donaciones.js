function initNavigation() {
  const menuButton = document.querySelector("#menuToggle");
  const menu = document.querySelector("#navMenu");
  const themeButton = document.querySelector("#themeToggle");

  menuButton?.addEventListener("click", () => menu?.classList.toggle("open"));

  if (localStorage.getItem("jhd-theme") === "light") {
    document.body.classList.add("light-mode");
    if (themeButton) themeButton.textContent = "☀️";
  }

  themeButton?.addEventListener("click", () => {
    document.body.classList.toggle("light-mode");
    const light = document.body.classList.contains("light-mode");
    localStorage.setItem("jhd-theme", light ? "light" : "dark");
    themeButton.textContent = light ? "☀️" : "🌙";
  });
}

function initDonationCopy() {
  const button = document.querySelector("#copyDonation");
  const message = document.querySelector("#donationMessage");
  if (!button || !message) return;

  const donationText = "Gracias por apoyar el proyecto Juntos Hacia Dios. Aquí puedes colocar tu información de donación.";

  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(donationText);
      message.textContent = "Información copiada. Puedes pegarla donde la necesites.";
    } catch (error) {
      console.error(error);
      message.textContent = donationText;
    }
  });
}

initNavigation();
initDonationCopy();
