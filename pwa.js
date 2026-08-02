/* =====================================================================
   PWA.JS — makes the dashboard installable as a downloadable web app
   ("Add to Home Screen" on mobile, "Install" on desktop Chrome/Edge).
   Registers the service worker and shows a custom Install button.
   ===================================================================== */

// Register the service worker (required for installability + offline use)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("service-worker.js")
      .then((reg) => console.log("Service worker registered:", reg.scope))
      .catch((err) => console.error("Service worker registration failed:", err));
  });
}

// ---------------------------------------------------------------------
// Custom "Install App" button.
// Chrome/Edge/Android don't show an install UI automatically — we
// capture the browser's install prompt event and trigger it ourselves
// so users have a visible button to tap.
// ---------------------------------------------------------------------
let deferredInstallPrompt = null;

function createInstallButton() {
  const btn = document.createElement("button");
  btn.id = "installAppBtn";
  btn.textContent = "⬇ Install App";
  btn.style.cssText = `
    position: fixed; bottom: 1rem; right: 1rem; z-index: 9998;
    background: #F2B705; color: #1B1D1F; border: none;
    font-family: 'IBM Plex Mono', monospace; font-weight: 600;
    font-size: 0.85rem; padding: 0.65rem 1rem; border-radius: 999px;
    cursor: pointer; box-shadow: 0 8px 24px rgba(0,0,0,0.35);
    display: none;
  `;
  document.body.appendChild(btn);

  btn.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    console.log("Install choice:", choice.outcome);
    deferredInstallPrompt = null;
    btn.style.display = "none";
  });

  return btn;
}

const installBtn = createInstallButton();

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installBtn.style.display = "block"; // only show once the browser confirms it's installable
});

window.addEventListener("appinstalled", () => {
  installBtn.style.display = "none";
  deferredInstallPrompt = null;
  console.log("Smart Bin Monitor installed.");
});
